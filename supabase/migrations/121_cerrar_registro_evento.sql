-- =============================================================================
-- ZR APP · MIGRACIÓN 121 · Se cierra el registro público del evento
-- =============================================================================
-- El evento ya pasó (4 oct. 2026) y se retiró la página /evento. Se quita la
-- política que permitía insertar sin sesión para que nadie pueda seguir
-- escribiendo en la tabla desde la API. Los registros existentes se
-- CONSERVAN (solo los lee admin/super_admin) -- borrarlos es irreversible y
-- no fue pedido.
-- =============================================================================

drop policy if exists "publico: registrarse al evento" on public.event_registrations;
