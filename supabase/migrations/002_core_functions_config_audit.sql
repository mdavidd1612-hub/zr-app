-- =============================================================================
-- ZR APP · MIGRACIÓN 002 · Funciones base, configuración del sistema y auditoría
-- =============================================================================
-- Se crea PRIMERO, antes que cualquier tabla de negocio, porque el resto del
-- esquema depende de estas funciones y de poder leer parámetros configurables.
--
-- Referencia: docs/09_DECISIONES_ARQUITECTONICAS.md · ADR-010
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Función de apoyo: mantener updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Función de apoyo: bloquear escritura en tablas append-only
-- -----------------------------------------------------------------------------
create or replace function public.fn_block_update_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'La tabla % es de solo-inserción. Operación % rechazada. Para corregir, inserta un registro nuevo.',
    tg_table_name, tg_op;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. system_config — TODOS los parámetros de negocio viven aquí
-- -----------------------------------------------------------------------------
-- Regla absoluta: ningún umbral, porcentaje ni ventana de tiempo se escribe
-- en el código. Se lee de esta tabla. Cambiar una política de la academia debe
-- ser editar una fila, no desplegar código.
create table public.system_config (
  key         text primary key,
  value       jsonb not null,
  description text not null,
  is_public   boolean not null default false,  -- true = legible por cualquier usuario autenticado
  updated_by  uuid,                            -- FK a profiles, se agrega en migración 003
  updated_at  timestamptz not null default now()
);

create table public.system_config_history (
  id         bigserial primary key,
  key        text not null,
  old_value  jsonb,
  new_value  jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create or replace function public.fn_config_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.system_config_history (key, old_value, new_value, changed_by)
  values (
    new.key,
    case when tg_op = 'UPDATE' then old.value else null end,
    new.value,
    auth.uid()
  );
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_config_history
  before insert or update on public.system_config
  for each row execute function public.fn_config_history();

-- Lectores de configuración. Úsalos siempre en vez de escribir el número.
create or replace function public.cfg(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select value from public.system_config where key = p_key;
$$;

create or replace function public.cfg_num(p_key text, p_default numeric)
returns numeric
language sql
stable
as $$
  select coalesce((public.cfg(p_key) #>> '{}')::numeric, p_default);
$$;

create or replace function public.cfg_int(p_key text, p_default int)
returns int
language sql
stable
as $$
  select coalesce((public.cfg(p_key) #>> '{}')::int, p_default);
$$;

-- -----------------------------------------------------------------------------
-- 4. audit_log — append-only, alimentado por disparadores
-- -----------------------------------------------------------------------------
-- Se llena por triggers de base de datos, NUNCA por código de aplicación.
-- Lo que depende de que un programador se acuerde de escribirlo, se olvida.
create table public.audit_log (
  id               bigserial primary key,
  actor_profile_id uuid,          -- null si lo hizo un proceso del sistema
  action           text not null, -- insert | update | delete
  entity           text not null, -- nombre de la tabla
  entity_id        uuid,
  before           jsonb,
  after            jsonb,
  created_at       timestamptz not null default now()
);

create index idx_audit_entity on public.audit_log (entity, entity_id);
create index idx_audit_actor  on public.audit_log (actor_profile_id);
create index idx_audit_date   on public.audit_log (created_at desc);

-- Disparador genérico de auditoría.
-- Requisito: la tabla auditada debe tener una columna 'id' de tipo uuid.
create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id uuid;
begin
  if tg_op = 'DELETE' then
    v_entity_id := old.id;
  else
    v_entity_id := new.id;
  end if;

  insert into public.audit_log (actor_profile_id, action, entity, entity_id, before, after)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- audit_log es inmutable: solo se inserta.
create trigger trg_audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function public.fn_block_update_delete();

alter table public.system_config          enable row level security;
alter table public.system_config_history  enable row level security;
alter table public.audit_log              enable row level security;
