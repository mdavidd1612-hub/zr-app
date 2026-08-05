-- Usuarios de Prueba - ZR App
-- Ejecutar con: psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < usuarios_prueba.sql
-- O copiar y pegar en la consola de Supabase

-- ESTUDIANTE 1 (Mayor de edad)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'V-30000001@estudiante.zrmecademy.com',
  crypt('Test123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', 'Luis Hernández', 'cedula', 'V-30000001', 'contact_email', 'luis@correo.test'),
  now(), now(), '', '', '', '', '', '', '', ''
) ON CONFLICT DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111'::text,
  jsonb_build_object('sub', '11111111-1111-1111-1111-111111111111'::text, 'email', 'V-30000001@estudiante.zrmecademy.com'),
  'email', now(), now(), now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, role) VALUES (
  '11111111-1111-1111-1111-111111111111', 'estudiante'
) ON CONFLICT DO NOTHING;

-- PROFESOR (Puede escanear y crear contenido)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'authenticated', 'authenticated',
  'V-20000001@profesor.zrmecademy.com',
  crypt('Test123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', 'Prof. Carlos Rivas', 'cedula', 'V-20000001', 'contact_email', 'carlos@zrmecademy.com'),
  now(), now(), '', '', '', '', '', '', '', ''
) ON CONFLICT DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222'::text,
  jsonb_build_object('sub', '22222222-2222-2222-2222-222222222222'::text, 'email', 'V-20000001@profesor.zrmecademy.com'),
  'email', now(), now(), now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, role) VALUES (
  '22222222-2222-2222-2222-222222222222', 'profesor'
) ON CONFLICT DO NOTHING;

-- ADMIN (Control total)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-3333-3333-333333333333',
  'authenticated', 'authenticated',
  'V-10000001@admin.zrmecademy.com',
  crypt('Test123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', 'María Admin', 'cedula', 'V-10000001', 'contact_email', 'maria@zrmecademy.com'),
  now(), now(), '', '', '', '', '', '', '', ''
) ON CONFLICT DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '33333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333'::text,
  jsonb_build_object('sub', '33333333-3333-3333-3333-333333333333'::text, 'email', 'V-10000001@admin.zrmecademy.com'),
  'email', now(), now(), now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, role) VALUES (
  '33333333-3333-3333-3333-333333333333', 'admin'
) ON CONFLICT DO NOTHING;
