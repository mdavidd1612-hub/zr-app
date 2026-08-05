-- =============================================================================
-- ZR APP · MIGRACIÓN 017 · Personal de prueba + estructura académica mínima
-- =============================================================================
-- Sin esta migración no hay forma de probar el panel del profesor: el
-- disparador handle_new_user SIEMPRE crea perfiles como 'estudiante', así que
-- el personal solo puede existir si se inserta desde el servidor (o desde aquí,
-- en desarrollo).
--
-- También crea el programa, un módulo, una cohorte y una sesión, porque un
-- examen necesita module_id y teacher_id para existir, y la cohorte es lo que
-- conecta al estudiante con lo que puede ver.
--
-- SOLO PARA DESARROLLO LOCAL. No aplicar en producción.
-- =============================================================================

do $$
declare
  v_prof_id     uuid;
  v_admin_id    uuid;
  v_program_id  uuid;
  v_module1_id  uuid;
  v_module2_id  uuid;
  v_module3_id  uuid;
  v_cohort_id   uuid;
  v_session_id  uuid;
  v_student_id  uuid;
begin

  -- ---------------------------------------------------------------------------
  -- 1. PROFESOR · V-10000001 / Prueba123!
  -- ---------------------------------------------------------------------------
  if not exists (select 1 from public.profiles where cedula = 'V-10000001') then

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token,
      reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'V-10000001@estudiante.zrmecademy.com',   -- cedulaAEmail() usa este dominio para TODOS los roles
      crypt('Prueba123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('cedula', 'V-10000001'),
      now(), now(),
      '', '', '', '', '', '', '', ''
    ) returning id into v_prof_id;

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_prof_id, v_prof_id::text, jsonb_build_object('sub', v_prof_id::text, 'email', 'V-10000001@estudiante.zrmecademy.com'), 'email', now(), now(), now());

    -- El disparador handle_new_user pudo haber creado ya el perfil como estudiante.
    insert into public.profiles (id, cedula, full_name, contact_email, role)
    values (v_prof_id, 'V-10000001', 'Prof. Pedro Ramírez', 'pedro@zrmecademy.com', 'profesor')
    on conflict (id) do update set role = 'profesor', full_name = excluded.full_name;

    insert into public.teachers (id, specialties, is_active)
    values (v_prof_id, array['Electricidad Automotriz', 'Diagnóstico'], true)
    on conflict (id) do nothing;
  else
    select id into v_prof_id from public.profiles where cedula = 'V-10000001';
  end if;

  -- ---------------------------------------------------------------------------
  -- 2. ADMINISTRADOR · V-10000002 / Prueba123!
  -- ---------------------------------------------------------------------------
  if not exists (select 1 from public.profiles where cedula = 'V-10000002') then

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token,
      reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'V-10000002@estudiante.zrmecademy.com',
      crypt('Prueba123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('cedula', 'V-10000002'),
      now(), now(),
      '', '', '', '', '', '', '', ''
    ) returning id into v_admin_id;

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_admin_id, v_admin_id::text, jsonb_build_object('sub', v_admin_id::text, 'email', 'V-10000002@estudiante.zrmecademy.com'), 'email', now(), now(), now());

    insert into public.profiles (id, cedula, full_name, contact_email, role)
    values (v_admin_id, 'V-10000002', 'Ana Torres', 'ana@zrmecademy.com', 'super_admin')
    on conflict (id) do update set role = 'super_admin', full_name = excluded.full_name;

    insert into public.admins (id, can_issue_certificates)
    values (v_admin_id, true)
    on conflict (id) do nothing;
  else
    select id into v_admin_id from public.profiles where cedula = 'V-10000002';
  end if;

  -- ---------------------------------------------------------------------------
  -- 3. PROGRAMA Y MÓDULOS
  -- ---------------------------------------------------------------------------
  select id into v_program_id from public.programs limit 1;

  if v_program_id is null then
    insert into public.programs (name, total_modules, total_duration_months)
    values ('Mecánica Automotriz Integral', 13, 13)
    returning id into v_program_id;
  end if;

  insert into public.modules (program_id, order_index, name, description, duration_weeks, inces_homologado)
  values (v_program_id, 1, 'Electricidad Automotriz', 'Fundamentos eléctricos, ley de Ohm, diagnóstico de baterías y alternadores.', 4, true)
  on conflict (program_id, order_index) do nothing;

  insert into public.modules (program_id, order_index, name, description, duration_weeks, inces_homologado)
  values (v_program_id, 2, 'Transmisión', 'Caja de cambios, embrague y tren motriz.', 4, true)
  on conflict (program_id, order_index) do nothing;

  insert into public.modules (program_id, order_index, name, description, duration_weeks, inces_homologado)
  values (v_program_id, 3, 'Suspensión y Frenos', 'Sistemas de amortiguación, frenos hidráulicos y ABS.', 4, true)
  on conflict (program_id, order_index) do nothing;

  select id into v_module1_id from public.modules where program_id = v_program_id and order_index = 1;
  select id into v_module2_id from public.modules where program_id = v_program_id and order_index = 2;
  select id into v_module3_id from public.modules where program_id = v_program_id and order_index = 3;

  -- ---------------------------------------------------------------------------
  -- 4. GUÍAS DE APRENDIZAJE (para «Próximo sábado» y el mapa de dominio)
  -- ---------------------------------------------------------------------------
  insert into public.learning_guides
    (module_id, week_number, order_in_week, sub_competency_name, pre_practice_description, practice_description, digitized)
  values
    (v_module1_id, 1, 1, 'Ley de Ohm aplicada',
     'Investiga qué relación hay entre voltaje, corriente y resistencia. Trae un ejemplo de un circuito de tu casa.',
     'Medición de voltaje y resistencia en un circuito de iluminación real.', true),
    (v_module1_id, 1, 2, 'Uso del multímetro digital',
     'Busca el manual de un multímetro y anota para qué sirve cada escala.',
     'Práctica guiada: medir continuidad, voltaje DC y resistencia.', true),
    (v_module1_id, 2, 1, 'Diagnóstico de batería',
     'Averigua cuál es el voltaje normal de una batería de 12V en reposo y con el motor encendido.',
     'Diagnóstico de tres baterías con estados distintos.', true),
    (v_module1_id, 2, 2, 'Sistema de carga y alternador',
     'Investiga qué pasa si el alternador deja de cargar mientras conduces.',
     'Prueba de carga del alternador con el motor encendido.', false)
  on conflict (module_id, week_number, order_in_week) do nothing;

  -- ---------------------------------------------------------------------------
  -- 5. COHORTE
  -- ---------------------------------------------------------------------------
  select id into v_cohort_id from public.cohorts limit 1;

  if v_cohort_id is null then
    insert into public.cohorts (program_id, name, current_module_id, teacher_id, location, start_date, status)
    values (v_program_id, 'Cohorte 2026-B · Sábado 8:00 am', v_module1_id, v_prof_id, 'Taller 2', current_date - 30, 'activa')
    returning id into v_cohort_id;
  else
    update public.cohorts
       set teacher_id = v_prof_id, current_module_id = v_module1_id
     where id = v_cohort_id;
  end if;

  -- ---------------------------------------------------------------------------
  -- 6. ESTUDIANTES → fila en students + asignación a la cohorte
  -- ---------------------------------------------------------------------------
  -- handle_new_user los creó con 'SIN NOMBRE' porque el registro por SQL directo
  -- no pasa por el formulario que envía full_name en la metadata.
  update public.profiles set full_name = 'Juan Carlos Pérez', contact_email = 'juanc@gmail.com'
   where cedula = 'V-30000001' and full_name = 'SIN NOMBRE';
  update public.profiles set full_name = 'María García López', contact_email = 'mariag@gmail.com'
   where cedula = 'V-30000002' and full_name = 'SIN NOMBRE';

  for v_student_id in
    select id from public.profiles where cedula in ('V-30000001', 'V-30000002')
  loop
    insert into public.students (id, birth_date, cohort_id, enrollment_date, onboarding_status)
    values (v_student_id, current_date - interval '19 years', v_cohort_id, current_date - 30, 'completo')
    on conflict (id) do update set cohort_id = v_cohort_id;
  end loop;

  -- ---------------------------------------------------------------------------
  -- 6b. INSCRIPCIÓN AL MÓDULO
  -- ---------------------------------------------------------------------------
  -- Sin esta fila la pantalla de notas está vacía y, peor, la prueba de RLS
  -- «un estudiante no puede escribir sus propias notas» pasa por la razón
  -- equivocada: el UPDATE no encuentra filas, así que no da error aunque no
  -- exista ninguna política que lo impida.
  for v_student_id in
    select id from public.profiles where cedula in ('V-30000001', 'V-30000002')
  loop
    insert into public.module_enrollments
      (student_id, module_id, cohort_id, passing_threshold, participation_weight, status)
    values (v_student_id, v_module1_id, v_cohort_id, 10, 0.15, 'en_curso')
    on conflict (student_id, module_id) do nothing;
  end loop;

  -- ---------------------------------------------------------------------------
  -- 7. SESIÓN DE CLASE (el próximo sábado)
  -- ---------------------------------------------------------------------------
  -- El sábado que viene: current_date + días que faltan para el sábado (6 = sábado en ISO... dow 6).
  insert into public.class_sessions (cohort_id, module_id, teacher_id, session_date, week_number, status)
  values (
    v_cohort_id,
    v_module1_id,
    v_prof_id,
    current_date + ((6 - extract(dow from current_date)::int + 7) % 7 + case when extract(dow from current_date)::int = 6 then 7 else 0 end),
    2,
    'programada'
  )
  on conflict (cohort_id, session_date) do nothing;

  -- Una sesión pasada, ya cerrada, para probar el feedback.
  insert into public.class_sessions (cohort_id, module_id, teacher_id, session_date, week_number, status, opened_at, closed_at)
  values (v_cohort_id, v_module1_id, v_prof_id, current_date - 7, 1, 'cerrada', now() - interval '7 days', now() - interval '7 days' + interval '4 hours')
  on conflict (cohort_id, session_date) do nothing;

end $$;

-- =============================================================================
-- CREDENCIALES DE PRUEBA
-- =============================================================================
--   Profesor       V-10000001  ·  Prueba123!   → /hoy
--   Super admin    V-10000002  ·  Prueba123!   → /panel
--   Estudiante 1   V-30000001  ·  Prueba123!   → /
--   Estudiante 2   V-30000002  ·  Prueba123!   → /
-- =============================================================================
