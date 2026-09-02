-- =============================================================================
-- ZR APP · MIGRACIÓN 059 · El guard de asistencia deja anonimizar al escaneador
-- =============================================================================
-- SÍNTOMA
-- Borrar la cuenta de un estudiante fallaba con "Database error deleting user"
-- —el mensaje genérico de Supabase Auth cuando la base rechaza el borrado—.
-- No pasaba siempre: solo con quien alguna vez apareció como `scanned_by` de
-- una asistencia, que es el caso del auto-registro con código diario
-- (migración 037), donde el estudiante queda registrado como su propio
-- escaneador.
--
-- CAUSA
-- `attendance_events.scanned_by` tiene ON DELETE SET NULL (migraciones 029/032),
-- así que al borrar la cuenta Postgres primero hace un UPDATE de esa fila para
-- poner la columna en NULL. Y `fn_attendance_guard` (migración 006, ajustada en
-- la 028) trata `scanned_by` como inmutable y lanza excepción. El UPDATE del
-- cascade choca contra el trigger y el DELETE nunca se ejecuta.
--
-- La 028 ya había arreglado la mitad de esto: permitió el DELETE, que era el
-- otro camino que el guard bloqueaba. Quedó pendiente el UPDATE del SET NULL.
--
-- ARREGLO
-- `scanned_by` sigue siendo inmutable para cualquiera: NO se puede reasignar
-- una asistencia a otro profesor. Lo único que ahora se permite es ponerla en
-- NULL, que es exactamente lo que hace la base al borrar una cuenta — y algo
-- que ningún cliente puede provocar de otra forma.
--
-- Se conserva el resto del guard tal cual: la asistencia sigue siendo de
-- solo-inserción en la práctica, y el refrigerio se sigue pudiendo entregar una
-- sola vez.
-- =============================================================================

create or replace function public.fn_attendance_guard()
returns trigger
language plpgsql
as $$
begin
  -- DELETE permitido: la protección real son las políticas de RLS (migración 028).
  if tg_op = 'DELETE' then
    return old;
  end if;

  -- Los datos del hecho en sí no se tocan nunca. `scanned_by` sale de esta
  -- lista y se revisa aparte, justo abajo.
  if (new.id, new.session_id, new.student_id, new.scanned_at, new.method)
     is distinct from
     (old.id, old.session_id, old.student_id, old.scanned_at, old.method)
  then
    raise exception 'Solo se pueden actualizar los campos de refrigerio en attendance_events.';
  end if;

  -- Quién escaneó solo puede pasar a "ya no se sabe" (NULL), nunca a otra
  -- persona: si el nuevo valor no es NULL, es una reasignación y se rechaza.
  if new.scanned_by is distinct from old.scanned_by and new.scanned_by is not null then
    raise exception 'No se puede cambiar quién registró una asistencia.';
  end if;

  if old.snack_claimed_at is not null
     and new.snack_claimed_at is distinct from old.snack_claimed_at
  then
    raise exception 'El refrigerio ya fue entregado a este estudiante en esta sesión.';
  end if;

  return new;
end;
$$;
