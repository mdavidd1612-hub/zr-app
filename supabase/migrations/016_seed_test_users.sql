-- =============================================================================
-- Test users para desarrollo local
-- =============================================================================

do $$
declare
  v_id uuid;
  v_cedula text;
  v_email text;
  v_nombre text;
begin
  -- Usuario 1
  v_cedula := 'V-30000001';
  v_email := v_cedula || '@estudiante.zrmecademy.com';
  v_nombre := 'Juan Carlos';

  -- Crear en auth
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
    v_email,
    crypt('Prueba123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('cedula', v_cedula),
    now(), now(),
    '', '', '', '', '', '', '', ''
  ) returning id into v_id;

  -- Crear identidad
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text), 'email', now(), now(), now());

  -- Crear perfil
  insert into public.profiles (id, cedula, full_name, contact_email, role)
  values (v_id, v_cedula, v_nombre, v_email, 'estudiante')
  on conflict do nothing;

  -- Usuario 2
  v_cedula := 'V-30000002';
  v_email := v_cedula || '@estudiante.zrmecademy.com';
  v_nombre := 'María García';

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
    v_email,
    crypt('Prueba123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('cedula', v_cedula),
    now(), now(),
    '', '', '', '', '', '', '', ''
  ) returning id into v_id;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text), 'email', now(), now(), now());

  insert into public.profiles (id, cedula, full_name, contact_email, role)
  values (v_id, v_cedula, v_nombre, v_email, 'estudiante')
  on conflict do nothing;

end $$;
