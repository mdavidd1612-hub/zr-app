-- =============================================================================
-- ZR APP · MIGRACIÓN 133 · Funciones internas no deben poder llamarse desde la API
-- =============================================================================
-- Revisión de seguridad (oct. 2026): varias funciones SECURITY DEFINER de las
-- migraciones 110/111/123/126 eran ejecutables por cualquier usuario por la
-- API (rpc). Las más delicadas: fn_asegurar_enrollment(student, module, cohort)
-- -- permitía a un estudiante crear matrículas arbitrarias -- y
-- fn_recalc_evaluacion_general / fn_recalc_puntualidad. Son piezas internas de
-- disparadores: se les quita el permiso de ejecución a la API (los disparadores
-- siguen funcionando, no necesitan ese permiso).
-- También se fija el search_path de las dos funciones de "mover" (123).
-- =============================================================================

alter function public.fn_validar_mover_item() set search_path = public;
alter function public.fn_validar_mover_carpeta() set search_path = public;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'fn_asegurar_enrollment',
        'fn_asegurar_enrollments_cohorte',
        'fn_asegurar_enrollment_estudiante',
        'fn_recalc_evaluacion_general',
        'fn_recalc_puntualidad',
        'fn_trg_recalc_evaluacion_general',
        'fn_trg_recalc_puntualidad_asistencia',
        'fn_trg_recalc_puntualidad_cierre_sesion',
        'fn_validar_escala_examen_manual',
        'fn_bloquear_notas_enviadas',
        'fn_notify_notas_registradas_directo',
        'fn_notify_notas_registradas_extra',
        'fn_validar_mover_item',
        'fn_validar_mover_carpeta',
        'fn_recordar_solvencia_pendiente',
        'fn_restringir_payment_status'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.firma);
  end loop;
end $$;
