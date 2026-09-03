-- Encontrado en el chequeo a fondo de la Fase 5: la pantalla de Configuración
-- (solo super_admin) siempre mostraba la lista de valores vacía. Causa: el
-- código pide `system_config.select('...,profiles(full_name)')` — un embed
-- de PostgREST — pero `updated_by` y `changed_by` nunca tuvieron llave
-- foránea hacia `profiles`. Sin esa llave, PostgREST no puede resolver el
-- join y devuelve un error 400 en cada carga; la pantalla, en el peor
-- momento posible (justo la que cambia los números de negocio de toda la
-- academia, regla 5 de AGENTS.md), llevaba así desde que se creó.
--
-- Un registro histórico ya apunta a un usuario borrado (la cuenta de prueba
-- V-10000001 eliminada esta misma semana) — se limpia antes de poder crear
-- la llave, y se usa ON DELETE SET NULL (mismo patrón que uploaded_by,
-- scanned_by, assigned_by, etc.) para que un borrado futuro de personal no
-- rompa la auditoría, solo pierda la atribución.
update public.system_config_history
set changed_by = null
where changed_by is not null
  and not exists (select 1 from public.profiles p where p.id = system_config_history.changed_by);

alter table public.system_config
  add constraint system_config_updated_by_fkey
  foreign key (updated_by) references public.profiles(id) on delete set null;

alter table public.system_config_history
  add constraint system_config_history_changed_by_fkey
  foreign key (changed_by) references public.profiles(id) on delete set null;
