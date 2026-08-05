INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token,
  reauthentication_token
) VALUES
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
);
