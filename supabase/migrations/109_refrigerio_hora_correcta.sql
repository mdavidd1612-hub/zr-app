-- =============================================================================
-- ZR APP · MIGRACIÓN 109 · Corrige la hora real del refrigerio
-- =============================================================================
-- Aclaración del coordinador: el refrigerio se da a las 11:00am, no a las
-- 10:00 (valor por defecto que puse en la migración 104 mientras se
-- confirmaba). Nunca se edita una migración ya aplicada (regla 6) -- va como
-- su propia migración.
-- =============================================================================

update public.system_config set value = '"11:00"' where key = 'attendance.refrigerio_hora_inicio';
update public.system_config set value = '"11:30"' where key = 'attendance.refrigerio_hora_fin';
