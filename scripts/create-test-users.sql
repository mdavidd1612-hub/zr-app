-- =============================================================================
-- ZR APP · CREAR USUARIOS DE PRUEBA
-- =============================================================================
-- Ejecutar DESPUÉS de que las migraciones se apliquen correctamente
-- supabase db reset && supabase sql -f scripts/create-test-users.sql

-- Los tres usuarios de prueba simples (sin dependencias complejas)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token,
  reauthentication_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000f101'::uuid,
  'authenticated',
  'authenticated',
  'v12345678@estudiante.zrmecademy.com',
  crypt('Test123!*', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', 'Luis Hernández', 'cedula', 'V-12345678', 'contact_email', 'luis@correo.test'),
  now(), now(),
  '', '', '', '', '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000f102'::uuid,
  'authenticated',
  'authenticated',
  'e87654321@estudiante.zrmecademy.com',
  crypt('Test123!*', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', 'Daniela Ríos', 'cedula', 'E-87654321', 'contact_email', 'daniela@correo.test'),
  now(), now(),
  '', '', '', '', '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000f103'::uuid,
  'authenticated',
  'authenticated',
  'v11111111@estudiante.zrmecademy.com',
  crypt('Test123!*', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', 'Jesús Marcano', 'cedula', 'V-11111111', 'contact_email', 'jesus@correo.test'),
  now(), now(),
  '', '', '', '', '', '', '', ''
);

-- Crear identidades
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-00000000f101'::uuid,
  '00000000-0000-0000-0000-00000000f101'::text,
  jsonb_build_object('sub', '00000000-0000-0000-0000-00000000f101'::text, 'email', 'v12345678@estudiante.zrmecademy.com'),
  'email', now(), now(), now()
),
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-00000000f102'::uuid,
  '00000000-0000-0000-0000-00000000f102'::text,
  jsonb_build_object('sub', '00000000-0000-0000-0000-00000000f102'::text, 'email', 'e87654321@estudiante.zrmecademy.com'),
  'email', now(), now(), now()
),
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-00000000f103'::uuid,
  '00000000-0000-0000-0000-00000000f103'::text,
  jsonb_build_object('sub', '00000000-0000-0000-0000-00000000f103'::text, 'email', 'v11111111@estudiante.zrmecademy.com'),
  'email', now(), now(), now()
);

-- El trigger on_auth_user_created creará los perfiles automáticamente
-- Verificar que los perfiles se crearon:
select id, cedula, full_name from public.profiles where cedula in ('V-12345678', 'E-87654321', 'V-11111111');
