-- =============================================================================
-- ZR APP · MIGRACIÓN 043 · Currículo real: PTMA, PFTA, sedes y cohortes reales
-- =============================================================================
-- Reemplaza los datos de relleno (un solo "programa" con 3 módulos genéricos,
-- Sprint 0/017) por el negocio real: la academia tiene DOS programas de
-- 1.5 años, PTMA (San Antonio de Los Altos) y PFTA (UCV), con la MISMA malla
-- de 14 módulos (12 numerados + 2 complementarios online, también
-- obligatorios). docs/17_PLAN_CONSOLIDADO_CURRICULUM_Y_COORDINADOR.md,
-- Sprint 1.
--
-- Se agrega el concepto de SEDE a cohorts, separado de `location` (que sigue
-- siendo el salón/taller). Sede es dónde funciona el programa; location es
-- dónde, dentro de esa sede, se dicta la clase.
-- =============================================================================

alter table public.cohorts
  add column sede  text,
  add column turno text check (turno in ('mañana', 'tarde'));

alter table public.modules
  add column is_complementario boolean not null default false;

comment on column public.modules.is_complementario is
  'true para los 2 módulos complementarios (inglés técnico, proyecto integrador): son online, pero igual de obligatorios que los demás.';

comment on column public.cohorts.sede is
  'Sede física donde funciona el programa de esta cohorte (San Antonio de Los Altos / UCV). No confundir con location, que es el salón/taller puntual.';

comment on column public.cohorts.turno is
  'Turno genérico de la cohorte. Horas exactas por confirmar con la academia — por ahora: mañana ~9:00am, tarde ~2:00pm.';

do $$
declare
  v_ptma_id uuid;
  v_pfta_id uuid;

  -- Módulos PTMA
  v_ptma_m1 uuid; v_ptma_m2 uuid; v_ptma_m3 uuid; v_ptma_m4 uuid; v_ptma_m5 uuid;
  v_ptma_m6 uuid; v_ptma_c1 uuid; v_ptma_m7 uuid; v_ptma_m8 uuid; v_ptma_m9 uuid;
  v_ptma_m10 uuid; v_ptma_m11 uuid; v_ptma_m12 uuid; v_ptma_c2 uuid;

  -- Módulos PFTA
  v_pfta_m1 uuid; v_pfta_m3 uuid; v_pfta_m5 uuid; v_pfta_m10 uuid; v_pfta_m11 uuid;

  v_old_program_id uuid;
begin
  -- ---------------------------------------------------------------------------
  -- 1. Programas (programs.name no tiene unique, así que se verifica a mano)
  -- ---------------------------------------------------------------------------
  select id into v_ptma_id from public.programs where name = 'PTMA · Programa Técnico en Mecánica Automotriz';
  if v_ptma_id is null then
    insert into public.programs (name, total_modules, total_duration_months)
    values ('PTMA · Programa Técnico en Mecánica Automotriz', 14, 18)
    returning id into v_ptma_id;
  end if;

  select id into v_pfta_id from public.programs where name = 'PFTA · Programa de Formación en Tecnología Automotriz';
  if v_pfta_id is null then
    insert into public.programs (name, total_modules, total_duration_months)
    values ('PFTA · Programa de Formación en Tecnología Automotriz', 14, 18)
    returning id into v_pfta_id;
  end if;

  -- ---------------------------------------------------------------------------
  -- 2. Los 14 módulos, idénticos para ambos programas
  -- ---------------------------------------------------------------------------
  -- PTMA
  insert into public.modules (program_id, order_index, name, is_complementario) values
    (v_ptma_id, 1,  'Fundamentos del automóvil', false),
    (v_ptma_id, 2,  'Instrumentación automotriz', false),
    (v_ptma_id, 3,  'Fluidos automotrices', false),
    (v_ptma_id, 4,  'Motor de combustión interna', false),
    (v_ptma_id, 5,  'Sistemas de transmisión', false),
    (v_ptma_id, 6,  'Componentes estructurales y dinámicos del vehículo', false),
    (v_ptma_id, 7,  'Inglés técnico automotriz', true),
    (v_ptma_id, 8,  'Fundamentos de fabricación mecánica', false),
    (v_ptma_id, 9,  'Electricidad automotriz', false),
    (v_ptma_id, 10, 'Diagnóstico automotriz', false),
    (v_ptma_id, 11, 'Aire acondicionado automotriz', false),
    (v_ptma_id, 12, 'Performance vehicular', false),
    (v_ptma_id, 13, 'Gestión técnica y operativa del taller automotriz', false),
    (v_ptma_id, 14, 'Proyecto técnico integrador', true)
  on conflict (program_id, order_index) do nothing;

  -- PFTA (misma malla)
  insert into public.modules (program_id, order_index, name, is_complementario) values
    (v_pfta_id, 1,  'Fundamentos del automóvil', false),
    (v_pfta_id, 2,  'Instrumentación automotriz', false),
    (v_pfta_id, 3,  'Fluidos automotrices', false),
    (v_pfta_id, 4,  'Motor de combustión interna', false),
    (v_pfta_id, 5,  'Sistemas de transmisión', false),
    (v_pfta_id, 6,  'Componentes estructurales y dinámicos del vehículo', false),
    (v_pfta_id, 7,  'Inglés técnico automotriz', true),
    (v_pfta_id, 8,  'Fundamentos de fabricación mecánica', false),
    (v_pfta_id, 9,  'Electricidad automotriz', false),
    (v_pfta_id, 10, 'Diagnóstico automotriz', false),
    (v_pfta_id, 11, 'Aire acondicionado automotriz', false),
    (v_pfta_id, 12, 'Performance vehicular', false),
    (v_pfta_id, 13, 'Gestión técnica y operativa del taller automotriz', false),
    (v_pfta_id, 14, 'Proyecto técnico integrador', true)
  on conflict (program_id, order_index) do nothing;

  select id into v_ptma_m1  from public.modules where program_id = v_ptma_id and order_index = 1;
  select id into v_ptma_m5  from public.modules where program_id = v_ptma_id and order_index = 5;
  select id into v_ptma_m11 from public.modules where program_id = v_ptma_id and order_index = 11;

  select id into v_pfta_m3  from public.modules where program_id = v_pfta_id and order_index = 3;
  select id into v_pfta_m11 from public.modules where program_id = v_pfta_id and order_index = 11;

  -- ---------------------------------------------------------------------------
  -- 3. Las 7 cohortes reales
  -- ---------------------------------------------------------------------------
  insert into public.cohorts (program_id, name, current_module_id, sede, turno, location, start_date, status)
  select * from (values
    (v_ptma_id, 'PTMA-2025-I',  v_ptma_m11, 'San Antonio de Los Altos', 'mañana', null::text, '2025-01-01'::date, 'finalizada'::public.cohort_status),
    (v_ptma_id, 'PTMA-2025-II', v_ptma_m11, 'San Antonio de Los Altos', 'tarde',  null, '2025-01-01', 'activa'),
    (v_ptma_id, 'PTMA-2026-I',  v_ptma_m5,  'San Antonio de Los Altos', 'tarde',  null, '2026-01-01', 'activa'),
    (v_ptma_id, 'PTMA-2026-II', v_ptma_m1,  'San Antonio de Los Altos', 'mañana', null, '2026-09-05', 'activa'),
    (v_pfta_id, 'PFTA-2025-I',  v_pfta_m11, 'UCV', 'mañana', null, '2025-01-01', 'activa'),
    (v_pfta_id, 'PFTA-2026-I · turno mañana', v_pfta_m3, 'UCV', 'mañana', null, '2026-01-01', 'activa'),
    (v_pfta_id, 'PFTA-2026-I · turno tarde',  v_pfta_m3, 'UCV', 'tarde',  null, '2026-01-01', 'activa')
  ) as nuevas(program_id, name, current_module_id, sede, turno, location, start_date, status)
  where not exists (
    select 1 from public.cohorts existentes where existentes.name = nuevas.name
  );

  -- ---------------------------------------------------------------------------
  -- 4. Reasignar estudiantes de prueba a una cohorte real (arranca 5 sept)
  -- ---------------------------------------------------------------------------
  update public.students s
     set cohort_id = c.id
    from public.cohorts c
   where c.name = 'PTMA-2026-II'
     and s.id in (select id from public.profiles where cedula like 'V-3%');

  -- El módulo de prueba (Sprint 0/017) ya no se usa: se limpia la
  -- inscripción vieja para que "Mi módulo" y notas no muestren datos de
  -- relleno junto a los reales.
  select id into v_old_program_id from public.programs
   where name = 'Mecánica Automotriz Integral';

  if v_old_program_id is not null then
    delete from public.module_enrollments me
     using public.modules m
     where me.module_id = m.id and m.program_id = v_old_program_id;
  end if;
end $$;
