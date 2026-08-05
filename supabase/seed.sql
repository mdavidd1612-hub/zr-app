-- =============================================================================
-- ZR APP · DATOS DE PRUEBA (SOLO DESARROLLO)
-- =============================================================================
-- NUNCA ejecutes este archivo contra producción.
--
-- Crea: 1 programa, 13 módulos, 3 cohortes, 12 guías, 1 super admin, 1 admin,
-- 2 profesores y 12 estudiantes (4 de ellos menores de edad).
--
-- Contraseña de todos los usuarios de prueba: Prueba123!
-- Los estudiantes inician sesión con su cédula; el correo interno es sintético.
--
-- Ejecutar:  supabase db reset      (aplica migraciones + este seed)
-- =============================================================================

-- Función de apoyo para crear usuarios de prueba
-- -----------------------------------------------
create or replace function public.seed_user(
  p_id        uuid,
  p_cedula    text,
  p_full_name text,
  p_email     text,
  p_role      text
) returns uuid
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token,
    reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_cedula || '@estudiante.zrmecademy.com',
    crypt('Prueba123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'cedula', p_cedula, 'contact_email', p_email),
    now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_cedula || '@estudiante.zrmecademy.com'),
    'email', now(), now(), now()
  );

  update public.profiles set role = p_role::public.user_role where id = p_id;

  return p_id;
end;
$$;

-- Personal
select public.seed_user('00000000-0000-0000-0000-0000000000a1','V-10000001','Dirección Académica','direccion@zrmecademy.com','super_admin');
select public.seed_user('00000000-0000-0000-0000-0000000000a2','V-10000002','María Administración','admin@zrmecademy.com','admin');
select public.seed_user('00000000-0000-0000-0000-0000000000b1','V-10000003','Prof. Carlos Rivas','crivas@zrmecademy.com','profesor');
select public.seed_user('00000000-0000-0000-0000-0000000000b2','V-10000004','Prof. Ana Peña','apena@zrmecademy.com','profesor');

insert into public.admins (id, can_issue_certificates) values
  ('00000000-0000-0000-0000-0000000000a1', true),
  ('00000000-0000-0000-0000-0000000000a2', false);

insert into public.teachers (id, specialties) values
  ('00000000-0000-0000-0000-0000000000b1', '{electricidad,transmision}'),
  ('00000000-0000-0000-0000-0000000000b2', '{frenos,suspension}');

-- Programa y módulos
insert into public.programs (id, name) values
  ('00000000-0000-0000-0000-00000000c001', 'Técnico Automotriz');

insert into public.modules (id, program_id, order_index, name, duration_weeks, inces_homologado) values
  ('00000000-0000-0000-0000-00000000d001','00000000-0000-0000-0000-00000000c001', 1,'Introducción y Herramientas',4,false),
  ('00000000-0000-0000-0000-00000000d002','00000000-0000-0000-0000-00000000c001', 2,'Motores de Combustión Interna',4,false),
  ('00000000-0000-0000-0000-00000000d003','00000000-0000-0000-0000-00000000c001', 3,'Electricidad Automotriz',4,true),
  ('00000000-0000-0000-0000-00000000d004','00000000-0000-0000-0000-00000000c001', 4,'Sistema de Encendido',4,false),
  ('00000000-0000-0000-0000-00000000d005','00000000-0000-0000-0000-00000000c001', 5,'Sistema de Alimentación',3,false),
  ('00000000-0000-0000-0000-00000000d006','00000000-0000-0000-0000-00000000c001', 6,'Transmisión',4,true),
  ('00000000-0000-0000-0000-00000000d007','00000000-0000-0000-0000-00000000c001', 7,'Suspensión y Frenos',4,true),
  ('00000000-0000-0000-0000-00000000d008','00000000-0000-0000-0000-00000000c001', 8,'Dirección',4,true),
  ('00000000-0000-0000-0000-00000000d009','00000000-0000-0000-0000-00000000c001', 9,'Refrigeración y Lubricación',3,false),
  ('00000000-0000-0000-0000-00000000d010','00000000-0000-0000-0000-00000000c001',10,'Diagnóstico Electrónico',8,false),
  ('00000000-0000-0000-0000-00000000d011','00000000-0000-0000-0000-00000000c001',11,'Aire Acondicionado',4,false),
  ('00000000-0000-0000-0000-00000000d012','00000000-0000-0000-0000-00000000c001',12,'Mantenimiento Preventivo',4,false),
  ('00000000-0000-0000-0000-00000000d013','00000000-0000-0000-0000-00000000c001',13,'Taller Integrador',4,false);

-- Cohortes
insert into public.cohorts (id, program_id, name, current_module_id, teacher_id, location, start_date) values
  ('00000000-0000-0000-0000-00000000e001','00000000-0000-0000-0000-00000000c001','Cohorte 2026-A · Sábado 8am','00000000-0000-0000-0000-00000000d003','00000000-0000-0000-0000-0000000000b1','Taller 1','2026-01-11'),
  ('00000000-0000-0000-0000-00000000e002','00000000-0000-0000-0000-00000000c001','Cohorte 2026-B · Sábado 8am','00000000-0000-0000-0000-00000000d001','00000000-0000-0000-0000-0000000000b2','Taller 2','2026-07-04'),
  ('00000000-0000-0000-0000-00000000e003','00000000-0000-0000-0000-00000000c001','Cohorte 2026-C · Sábado 1pm','00000000-0000-0000-0000-00000000d006','00000000-0000-0000-0000-0000000000b1','Taller 1','2025-10-05');

-- Guías de aprendizaje
insert into public.learning_guides (module_id, week_number, order_in_week, sub_competency_name, pre_practice_description, practice_description, digitized) values
  ('00000000-0000-0000-0000-00000000d001',1,1,'Identificación de herramientas manuales','Investigar tipos de llaves y su uso','Reconocer y clasificar 20 herramientas del taller',true),
  ('00000000-0000-0000-0000-00000000d001',2,1,'Normas de seguridad en taller','Leer el reglamento de seguridad','Aplicar el protocolo de izado de vehículo',true),
  ('00000000-0000-0000-0000-00000000d001',3,1,'Torque y ajuste','Investigar tablas de torque','Ajustar tornillos con torquímetro a especificación',true),
  ('00000000-0000-0000-0000-00000000d001',4,1,'Lectura de manual de servicio','Buscar un manual de servicio real','Ubicar 5 especificaciones en el manual',true),
  ('00000000-0000-0000-0000-00000000d003',1,1,'Ley de Ohm aplicada','Repasar voltaje, corriente y resistencia','Medir con multímetro en un circuito real',true),
  ('00000000-0000-0000-0000-00000000d003',2,1,'Diagnóstico de batería','Investigar tipos de batería','Probar carga y densidad de una batería',true),
  ('00000000-0000-0000-0000-00000000d003',3,1,'Sistema de carga: alternador','Estudiar el funcionamiento del alternador','Medir salida del alternador en marcha',true),
  ('00000000-0000-0000-0000-00000000d003',4,1,'Lectura de diagramas eléctricos','Estudiar simbología eléctrica','Trazar un circuito de luces en el diagrama',true);

-- Estudiantes
do $$
declare
  v_data record;
begin
  for v_data in
    select * from (values
      ('00000000-0000-0000-0000-00000000f001'::uuid,'V-30000001','Luis Hernández','2005-03-15'::date,'00000000-0000-0000-0000-00000000e001'::uuid),
      ('00000000-0000-0000-0000-00000000f002'::uuid,'V-30000002','Daniela Ríos','2004-07-22'::date,'00000000-0000-0000-0000-00000000e001'::uuid),
      ('00000000-0000-0000-0000-00000000f003'::uuid,'V-30000003','Jesús Marcano','2003-11-02'::date,'00000000-0000-0000-0000-00000000e001'::uuid),
      ('00000000-0000-0000-0000-00000000f004'::uuid,'V-30000004','Andrea Salas','2010-05-30'::date,'00000000-0000-0000-0000-00000000e001'::uuid),
      ('00000000-0000-0000-0000-00000000f005'::uuid,'V-30000005','Miguel Ortega','2009-09-18'::date,'00000000-0000-0000-0000-00000000e002'::uuid),
      ('00000000-0000-0000-0000-00000000f006'::uuid,'V-30000006','Carla Bermúdez','2002-01-09'::date,'00000000-0000-0000-0000-00000000e002'::uuid),
      ('00000000-0000-0000-0000-00000000f007'::uuid,'V-30000007','Pedro Guillén','2010-12-01'::date,'00000000-0000-0000-0000-00000000e002'::uuid),
      ('00000000-0000-0000-0000-00000000f008'::uuid,'V-30000008','Rosa Villalba','2001-06-14'::date,'00000000-0000-0000-0000-00000000e002'::uuid),
      ('00000000-0000-0000-0000-00000000f009'::uuid,'V-30000009','Iván Contreras','2009-02-28'::date,'00000000-0000-0000-0000-00000000e003'::uuid),
      ('00000000-0000-0000-0000-00000000f010'::uuid,'V-30000010','Yorman Perdomo','2000-08-08'::date,'00000000-0000-0000-0000-00000000e003'::uuid),
      ('00000000-0000-0000-0000-00000000f011'::uuid,'V-30000011','Keila Márquez','2003-04-19'::date,'00000000-0000-0000-0000-00000000e003'::uuid),
      ('00000000-0000-0000-0000-00000000f012'::uuid,'V-30000012','Samuel Aguilar','2002-10-25'::date,'00000000-0000-0000-0000-00000000e003'::uuid)
    ) as t(id, cedula, nombre, nacimiento, cohorte)
  loop
    perform public.seed_user(v_data.id, v_data.cedula, v_data.nombre,
                             lower(replace(v_data.cedula,'-','')) || '@correo.test', 'estudiante');

    insert into public.students (id, birth_date, cohort_id, onboarding_status)
    values (v_data.id, v_data.nacimiento, v_data.cohorte, 'en_curso');
  end loop;
end $$;

-- Consentimientos
insert into public.parental_consents
  (student_id, consent_type, representative_name, representative_cedula, representative_email, method, verified_at)
values
  ('00000000-0000-0000-0000-00000000f005','account_creation','Rosa Ortega','V-8000005','rortega@correo.test','fisico', now()),
  ('00000000-0000-0000-0000-00000000f007','account_creation','Luis Guillén','V-8000007','lguillen@correo.test','digital', now()),
  ('00000000-0000-0000-0000-00000000f009','account_creation','Nelly Contreras','V-8000009','ncontreras@correo.test','fisico', null);

update public.students set onboarding_status = 'completo'
where id not in ('00000000-0000-0000-0000-00000000f004');

-- Secretos QR
insert into public.student_qr_secrets (student_id, secret)
select id, 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' from public.students;

-- Sesiones de clase
insert into public.class_sessions (cohort_id, module_id, teacher_id, session_date, week_number, status)
select c.id, c.current_module_id, c.teacher_id, d.fecha, row_number() over (partition by c.id order by d.fecha), 'programada'
from public.cohorts c
cross join (values ('2026-08-01'::date),('2026-08-08'),('2026-08-15'),('2026-08-22'),('2026-08-29'),('2026-09-05')) as d(fecha);

-- Inscripciones
insert into public.module_enrollments (student_id, module_id, cohort_id, passing_threshold)
select s.id, c.current_module_id, c.id, 0
from public.students s
join public.cohorts c on c.id = s.cohort_id;

-- Examen de ejemplo
insert into public.exams (id, module_id, cohort_id, teacher_id, title, status, max_score)
values ('00000000-0000-0000-0000-000000009001',
        '00000000-0000-0000-0000-00000000d003',
        '00000000-0000-0000-0000-00000000e001',
        '00000000-0000-0000-0000-0000000000b1',
        'Evaluación 1 · Electricidad Automotriz', 'oculto', 20);

insert into public.exam_questions (exam_id, order_index, type, statement, options, correct_answer, points, rubric) values
  ('00000000-0000-0000-0000-000000009001',1,'opcion_multiple',
   '¿Qué instrumento se usa para medir resistencia eléctrica?',
   '[{"key":"a","text":"Torquímetro"},{"key":"b","text":"Multímetro"},{"key":"c","text":"Calibrador"}]'::jsonb,
   '{"key":"b"}'::jsonb, 8, null),
  ('00000000-0000-0000-0000-000000009001',2,'verdadero_falso',
   'El alternador carga la batería mientras el motor está en marcha.',
   null, '{"value":true}'::jsonb, 6, null),
  ('00000000-0000-0000-0000-000000009001',3,'redaccion_abierta',
   'Explica con tus palabras cómo diagnosticarías una batería descargada.',
   null, null, 6,
   '6 pts: menciona medición de voltaje, prueba de carga y revisión del alternador. 3 pts: menciona solo una. 0 pts: no responde.');

-- Mapa de dominio
insert into public.mastery_map (student_id, learning_guide_id, status, dominated_via, marked_by)
select s.id, lg.id,
       case lg.week_number when 1 then 'dominado'
                           when 2 then 'dominado'
                           when 3 then 'en_progreso'
                           else 'no_iniciado' end::public.mastery_status,
       case when lg.week_number <= 2 then 'evaluacion_practica'::public.mastery_source else null end,
       case when lg.week_number <= 2 then '00000000-0000-0000-0000-0000000000b1'::uuid else null end
from public.students s
join public.cohorts c          on c.id = s.cohort_id
join public.learning_guides lg on lg.module_id = c.current_module_id
where c.id = '00000000-0000-0000-0000-00000000e001'
on conflict (student_id, learning_guide_id) do nothing;
