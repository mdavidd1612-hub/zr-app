-- =============================================================================
-- ZR APP · MIGRACIÓN 060 · El nombre de la cohorte lo genera el servidor
-- =============================================================================
-- EL PROBLEMA (reportado por el cliente el 02/09/2026)
-- El nombre de la cohorte lo escribía a mano quien la creaba. Resultado real en
-- producción: dos cohortes distintas llamadas ambas "PTMA-2026-II", una en San
-- Antonio de Los Altos y otra en UCV. Al inscribir, el vendedor veía dos
-- opciones idénticas en el desplegable y no había forma de saber cuál era cuál.
--
-- Escribir el nombre a mano no tiene sentido: el nombre no es información nueva,
-- es la suma de tres cosas que el sistema ya sabe — las siglas del programa, el
-- año de inicio y el número de corte dentro de ese año. Si el correlativo del
-- carnet ya lo asigna el servidor (migración 057), el nombre tiene que salir de
-- ahí mismo, o los dos se separan y vuelve la confusión.
--
-- LA REGLA
--   nombre = <SIGLAS DEL PROGRAMA>-<AÑO DE INICIO>-<Nº DE CORTE EN ROMANO>
--   Ej.: PTMA-2026-III  (tercer corte de PTMA abierto en 2026)
--
-- Queda amarrado al código de carnet por construcción: el mismo corte que en el
-- carnet es "03" en el nombre es "III". No se pueden desincronizar.
--
-- Se sigue pudiendo editar el nombre después, para casos con nombre propio. Lo
-- que cambia es que ya no hay que inventarlo al crear.
--
-- Además: el vendedor puede corregir y borrar las cohortes que él mismo creó.
-- Antes solo tenía INSERT y SELECT, así que si se equivocaba tenía que pedirle
-- a un administrador que lo arreglara.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Números romanos
-- -----------------------------------------------------------------------------
-- La academia nombra los cortes en romano (PTMA-2026-II), no en arábigo. El
-- correlativo vive como entero (`code_number`) porque es lo que entra en el
-- código de carnet; esto es solo para mostrarlo.
create or replace function public.a_romano(n int)
returns text
language plpgsql
immutable
as $$
declare
  valores int[]  := array[1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  simbolos text[] := array['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  resto int := n;
  salida text := '';
  i int;
begin
  if n is null or n < 1 then
    return coalesce(n::text, '');
  end if;

  for i in 1 .. array_length(valores, 1) loop
    while resto >= valores[i] loop
      salida := salida || simbolos[i];
      resto  := resto - valores[i];
    end loop;
  end loop;

  return salida;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Correlativo y nombre, en el mismo trigger
-- -----------------------------------------------------------------------------
-- Van juntos a propósito: el nombre depende del correlativo, y separarlos en dos
-- triggers dejaría el resultado a merced del orden alfabético en que Postgres
-- los dispara. Reemplaza a la versión de la migración 057.
create or replace function public.fn_set_cohort_code_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_siglas text;
begin
  -- Se permite fijar el correlativo explícitamente (migraciones de datos,
  -- correcciones de dirección). El índice único de la 057 impide repetirlo.
  if new.code_number is null then
    select coalesce(max(c.code_number), 0) + 1
      into new.code_number
      from public.cohorts c
     where c.program_id = new.program_id
       and extract(year from c.start_date) = extract(year from new.start_date);
  end if;

  -- El nombre solo se genera si no vino uno: quien quiera ponerle un nombre
  -- propio a un corte, puede.
  if new.name is null or btrim(new.name) = '' then
    -- Las siglas son la primera palabra del nombre del programa:
    -- 'PTMA · Programa Técnico en Mecánica Automotriz' → 'PTMA'.
    -- Cuando exista `programs.siglas` como columna propia (R-21 del plan 19),
    -- este split_part se reemplaza por esa columna.
    select split_part(p.name, ' ', 1)
      into v_siglas
      from public.programs p
     where p.id = new.program_id;

    new.name := coalesce(v_siglas, 'COHORTE')
      || '-' || extract(year from new.start_date)::int
      || '-' || public.a_romano(new.code_number);
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Renombrar lo que ya existe para que siga la misma regla
-- -----------------------------------------------------------------------------
-- Las dos cohortes de PFTA 2026 llevaban el turno pegado al nombre
-- ('PFTA-2026-I · turno mañana'), que era la manera de distinguirlas antes de
-- que turno y sede se mostraran como etiqueta propia en la interfaz. Ya no hace
-- falta, y así el nombre coincide con el corte del carnet.
update public.cohorts c
   set name = split_part(p.name, ' ', 1)
     || '-' || extract(year from c.start_date)::int
     || '-' || public.a_romano(c.code_number)
  from public.programs p
 where p.id = c.program_id
   and c.name is distinct from (
     split_part(p.name, ' ', 1)
     || '-' || extract(year from c.start_date)::int
     || '-' || public.a_romano(c.code_number)
   );

-- Ahora que los nombres los genera el servidor, no puede haber dos iguales
-- dentro del mismo programa. Es la otra mitad del problema que reportó el
-- cliente: aunque alguien edite un nombre a mano, la base no deja duplicarlo.
create unique index idx_cohorts_nombre_por_programa
  on public.cohorts (program_id, name);

-- -----------------------------------------------------------------------------
-- 4. El vendedor puede corregir y borrar lo que él creó
-- -----------------------------------------------------------------------------
alter table public.cohorts
  add column created_by uuid references public.profiles(id) default auth.uid();

comment on column public.cohorts.created_by is
  'Quién creó la cohorte desde la app. Null en las que nacieron por migración. Es lo que permite al vendedor corregir o borrar las suyas sin poder tocar las de nadie más.';

create policy "vendedor: editar sus cohortes"
  on public.cohorts for update to authenticated
  using ((select public.is_vendedor()) and created_by = auth.uid())
  with check ((select public.is_vendedor()) and created_by = auth.uid());

-- Borrar solo si está vacía. Una cohorte con estudiantes inscritos no se borra
-- ni por error: la FK de students ya lo impediría, pero es mejor que la política
-- lo diga explícitamente a que salga un error de llave foránea en pantalla.
create policy "vendedor: borrar sus cohortes vacias"
  on public.cohorts for delete to authenticated
  using (
    (select public.is_vendedor())
    and created_by = auth.uid()
    and not exists (select 1 from public.students s where s.cohort_id = cohorts.id)
  );
