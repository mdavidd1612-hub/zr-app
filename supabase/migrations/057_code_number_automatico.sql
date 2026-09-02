-- =============================================================================
-- ZR APP · MIGRACIÓN 057 · El correlativo de cohorte lo asigna el servidor
-- =============================================================================
-- Cierra R-01 de docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md.
--
-- EL PROBLEMA
-- `cohorts.code_number` es el "04" de PTMA-2026-04-762: entra en el código de
-- carnet del estudiante, que además es su contraseña de primer ingreso. Hasta
-- hoy ese número NO se generaba: estaba escrito a mano, cohorte por cohorte, en
-- la migración 044, contando desde 2025 sin reiniciar por año. De ahí el bug que
-- reportó la directiva (salió 04 donde esperaban un número bajo).
--
-- Peor: las pantallas que crean cohortes (/programas del vendedor y /cohortes de
-- administración) nunca escribieron esta columna. Toda cohorte creada desde la
-- app nacía con code_number NULL, y set_student_code_calc() devuelve entonces
-- 'ZR-PENDIENTE-xxxxxxxx' — que se imprime en la planilla que firma el
-- representante y se fija como contraseña de la cuenta.
--
-- LA REGLA (confirmada por la directiva el 01/09/2026 y por los datos)
--   code_number = correlativo por (programa, año de start_date), desde 01,
--   reiniciando cada año, en orden de creación.
-- No es el turno. La relación turno↔número no es consistente entre sedes: en San
-- Antonio la primera cohorte de 2026 resultó ser la de tarde, y en Central la de
-- mañana. Es solo el orden en que se crearon dentro del año.
--
-- Ojo con lo que este número NO es: no es el orden de los módulos, y no cambia
-- si después se corrige la fecha de inicio a otro año. Si eso llegara a pasar,
-- se corrige a mano — reasignarlo solo rompería códigos de carnet ya entregados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. La asignación, en el servidor
-- -----------------------------------------------------------------------------
-- Regla 2 de AGENTS.md: esto nunca se calcula en el cliente. Las pantallas
-- insertan la cohorte sin code_number y el trigger pone el que toca.
create or replace function public.fn_set_cohort_code_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Se permite fijarlo explícitamente (migraciones de datos, correcciones
  -- puntuales de dirección). Si viene, se respeta; el índice único de abajo
  -- igual impide que se repita.
  if new.code_number is not null then
    return new;
  end if;

  select coalesce(max(c.code_number), 0) + 1
    into new.code_number
    from public.cohorts c
   where c.program_id = new.program_id
     and extract(year from c.start_date) = extract(year from new.start_date);

  return new;
end;
$$;

drop trigger if exists trg_cohorts_code_number on public.cohorts;
create trigger trg_cohorts_code_number
  before insert on public.cohorts
  for each row execute function public.fn_set_cohort_code_number();

-- -----------------------------------------------------------------------------
-- 2. Renumerar lo que ya existe
-- -----------------------------------------------------------------------------
-- Se reordena dentro de cada (programa, año) respetando el code_number actual
-- como criterio de orden: created_at no sirve porque las 7 cohortes se crearon
-- en la misma migración (043) y comparten timestamp al microsegundo, mientras
-- que el número escrito a mano sí refleja el orden real de creación.
--
-- Efecto: PTMA-2026-I pasa de 3 a 1, PTMA-2026-II de 4 a 2, PFTA-2026-I mañana
-- de 2 a 1 y tarde de 3 a 2. Las de 2025 ya estaban bien y no se mueven.
with renumeradas as (
  select id,
         row_number() over (
           partition by program_id, extract(year from start_date)
           order by code_number nulls last, name
         ) as nuevo
    from public.cohorts
)
update public.cohorts c
   set code_number = r.nuevo
  from renumeradas r
 where r.id = c.id
   and c.code_number is distinct from r.nuevo;

-- -----------------------------------------------------------------------------
-- 3. Que la base impida el duplicado, no solo la aplicación
-- -----------------------------------------------------------------------------
-- Sin esto, dos cohortes creadas a la vez podrían tomar el mismo número y dos
-- estudiantes de cohortes distintas terminarían con el mismo código de carnet
-- —es decir, con la misma contraseña—.
create unique index idx_cohorts_code_number_por_anio
  on public.cohorts (program_id, (extract(year from start_date)), code_number);

comment on column public.cohorts.code_number is
  'Correlativo de 2 dígitos del código de carnet (PTMA-2026-02-...). Lo asigna el servidor por (programa, año de start_date), desde 01. No es el turno ni el orden de módulos.';
