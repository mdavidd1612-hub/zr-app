-- =============================================================================
-- ZR APP · MIGRACIÓN 018 · Permisos de tabla para service_role
-- =============================================================================
-- La migración 012 otorga privilegios a `authenticated` y se olvida de
-- `service_role`. Son dos cosas distintas y las dos hacen falta:
--
--   · RLS decide QUÉ FILAS ve un rol. service_role se salta las políticas.
--   · GRANT decide si el rol puede TOCAR LA TABLA. Eso no se salta.
--
-- Sin este GRANT, toda Edge Function que use adminClient() muere con
-- «permission denied for table …» (código 42501). Eso incluye validate-scan,
-- que es la función que registra la asistencia del sábado.
--
-- Se detectó al entregar un examen: submit-attempt no podía leer
-- exam_questions para autocalificar.
-- =============================================================================

grant usage on schema public to service_role;

grant select, insert, update, delete
  on all tables in schema public
  to service_role;

grant usage, select on all sequences in schema public to service_role;

grant execute on all functions in schema public to service_role;

-- Para las tablas que se creen en migraciones futuras: que no haya que
-- acordarse de repetir esto.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;

-- student_qr_secrets es la excepción a la inversa: la 012 se lo revoca a anon
-- y authenticated a propósito (el secreto TOTP no puede salir del servidor),
-- pero service_role SÍ lo necesita — provision-qr y validate-scan lo leen.
grant select, insert, update, delete on public.student_qr_secrets to service_role;
