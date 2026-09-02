-- =============================================================================
-- ZR APP · MIGRACIÓN 063 · Recrea las 7 cohortes reales (confirmadas 02/09/2026)
-- =============================================================================
-- El día anterior se borraron las 6 cohortes que había en producción: estaban
-- vacías (0 estudiantes) y con datos poco confiables — nombres que no
-- coincidían con su fecha real (PFTA-2025-II empezaba en 2026), sedes escritas
-- de tres formas distintas entre el código, los comentarios y lo que dice la
-- academia. Se pidió esperar a verificar antes de reconstruir.
--
-- Esta es la reconstrucción, con los datos que confirmó el cliente:
--
--   Sedes:  PTMA se dicta en "La Morita". PFTA se dicta en "UCV".
--           (No "San Antonio de Los Altos" ni "Universidad Central": esos
--           nombres estaban en comentarios de migraciones viejas, pero no son
--           como la academia los llama en el día a día.)
--
--   Los 14 módulos del catálogo (tabla `modules`) ya estaban bien cargados —
--   coinciden nombre por nombre con el programa que dio el cliente. Lo único
--   que había que corregir eran las COHORTES: cuáles existen, en qué sede, en
--   qué módulo va cada una ahora mismo.
--
-- El nombre de cada cohorte y su correlativo (PTMA-2026-I, "01") los pone el
-- trigger de las migraciones 057/060, no este script — por eso el ORDEN en
-- que se insertan estas filas importa: es el orden en que se reparten los
-- números dentro de cada (programa, año).
--
-- Nota que no se guarda en ninguna columna, solo para quien lea esto: el
-- corte PFTA que arrancó en 2025 usa una numeración de módulos distinta a la
-- del resto (para ellos "Performance" es su módulo 7, no el XI) — es una
-- particularidad histórica de ese grupo, no un error de carga. El contenido
-- de los módulos es el mismo para todos; solo cambia cómo ESE grupo los cuenta.
-- =============================================================================

do $$
declare
  v_ptma   uuid;
  v_pfta   uuid;
  v_manana text := '9:00 a.m. – 12:00 p.m.';
  v_tarde  text := '2:00 p.m. – 5:00 p.m.';
begin
  select id into v_ptma from public.programs where name like 'PTMA%';
  select id into v_pfta from public.programs where name like 'PFTA%';

  -- ---------------------------------------------------------------------------
  -- PTMA · La Morita
  -- ---------------------------------------------------------------------------

  -- PTMA-2025-I: acaban de presentar el proyecto técnico integrador. Sigue
  -- 'activa' porque falta la entrega de certificados — cuando eso pase,
  -- administración la pasa a 'finalizada' desde /cohortes.
  insert into public.cohorts (program_id, sede, turno, start_date, days, schedule, status, current_module_id)
  values (
    v_ptma, 'La Morita', 'mañana', '2025-01-01', 'Sábados', v_manana, 'activa',
    (select id from public.modules where program_id = v_ptma and order_index = 14)
  );

  -- PTMA-2025-II: módulo X, Aire acondicionado automotriz.
  insert into public.cohorts (program_id, sede, turno, start_date, days, schedule, status, current_module_id)
  values (
    v_ptma, 'La Morita', 'tarde', '2025-01-01', 'Sábados', v_tarde, 'activa',
    (select id from public.modules where program_id = v_ptma and order_index = 11)
  );

  -- PTMA-2026-I: módulo V, Sistemas de transmisión.
  insert into public.cohorts (program_id, sede, turno, start_date, days, schedule, status, current_module_id)
  values (
    v_ptma, 'La Morita', 'tarde', '2026-01-01', 'Sábados', v_tarde, 'activa',
    (select id from public.modules where program_id = v_ptma and order_index = 5)
  );

  -- PTMA-2026-II: arranca el 5 de septiembre de 2026, módulo I.
  insert into public.cohorts (program_id, sede, turno, start_date, days, schedule, status, current_module_id)
  values (
    v_ptma, 'La Morita', 'mañana', '2026-09-05', 'Sábados', v_manana, 'activa',
    (select id from public.modules where program_id = v_ptma and order_index = 1)
  );

  -- ---------------------------------------------------------------------------
  -- PFTA · UCV
  -- ---------------------------------------------------------------------------

  -- PFTA-2025-I: terminan Performance este sábado y arrancan con Aire
  -- acondicionado — se registra el módulo al que están entrando.
  insert into public.cohorts (program_id, sede, turno, start_date, days, schedule, status, current_module_id)
  values (
    v_pfta, 'UCV', 'mañana', '2025-01-01', 'Sábados', v_manana, 'activa',
    (select id from public.modules where program_id = v_pfta and order_index = 11)
  );

  -- PFTA-2026-I: turno mañana, módulo III, Fluidos automotrices.
  insert into public.cohorts (program_id, sede, turno, start_date, days, schedule, status, current_module_id)
  values (
    v_pfta, 'UCV', 'mañana', '2026-01-01', 'Sábados', v_manana, 'activa',
    (select id from public.modules where program_id = v_pfta and order_index = 3)
  );

  -- PFTA-2026-II: mismo módulo, turno tarde.
  insert into public.cohorts (program_id, sede, turno, start_date, days, schedule, status, current_module_id)
  values (
    v_pfta, 'UCV', 'tarde', '2026-01-01', 'Sábados', v_tarde, 'activa',
    (select id from public.modules where program_id = v_pfta and order_index = 3)
  );
end $$;
