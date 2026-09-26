-- =============================================================================
-- ZR APP · MIGRACIÓN 104 · Refrigerio digital en la cantina (ZR Coffee)
-- =============================================================================
-- Pedido explícito del coordinador (sept. 2026): reemplazar el tiquet físico
-- de refrigerio por uno digital. La mecánica ya existía a medias (attendance_
-- events.snack_claimed_at/by, migración 006; edge function claim-snack) pero
-- pensada para que el PROFESOR escaneara dos veces en su propia aula. Ahora el
-- escaneo de refrigerio se mueve a un dispositivo en la cantina, operado por
-- el rol `zr_coffee` (migración 095), separado de la asistencia.
--
-- No hace falta un "ticket" nuevo: el mismo QR rotatorio del carnet (TOTP,
-- migración 006) sirve para las dos cosas -- ya es lo que impide que alguien
-- lo fotografíe y lo reuse. La cantina simplemente valida ese mismo código con
-- otro propósito.
--
-- Ventana de activación: por horario, leído de system_config (nunca
-- hardcodeado, regla 5 de AGENTS.md) -- se activa sola a la hora de
-- refrigerio, sin que nadie tenga que prender/apagar nada a mano.
-- =============================================================================

insert into public.system_config (key, value, description, is_public)
values
  (
    'attendance.refrigerio_hora_inicio', '"10:00"',
    'Hora (HH:MM, hora de Venezuela) desde la que la cantina puede escanear el QR de refrigerio.',
    true
  ),
  (
    'attendance.refrigerio_hora_fin', '"10:30"',
    'Hora (HH:MM, hora de Venezuela) hasta la que la cantina puede escanear el QR de refrigerio.',
    true
  )
on conflict (key) do nothing;
