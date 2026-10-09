-- =============================================================================
-- ZR APP · MIGRACIÓN 135 · REVERTIR "Notas nuevas" -- SOLO PRODUCCIÓN
-- =============================================================================
-- ⚠ NO aplicar en staging: staging conserva todo el sistema nuevo de Notas
-- (migraciones 108, 110, 111, 125, 126, 127, 131, 132, 134) para probarlo.
--
-- Decisión del coordinador (oct. 2026): lo de Notas se subió a producción el
-- 6 oct. junto con lo de Material, pero hay que probarlo antes. Se deshace en
-- producción dejando el sistema de notas como estaba el 5 oct. (teoría /
-- práctica / participación en module_enrollments, sin evaluaciones, sin envío
-- ni validación).
--
-- Verificado antes de aplicar: 0 evaluaciones, 0 notas por evaluación, 0
-- envíos, 0 notificaciones nuevas y 0 valores de puntualidad/participación;
-- las únicas filas tocadas son 18 matrículas vacías creadas por la 110.
--
-- Material (migraciones 119-124, 132 parcial) NO se toca.
--
-- Para volver a subir Notas más adelante: aplicar de nuevo el contenido de
-- 108, 110, 111, 125, 126, 127, 131, 132 y 134 (con migraciones nuevas, nunca
-- editando estas).
-- =============================================================================

-- 1. Política original del estudiante sobre sus notas
drop policy if exists "estudiante: leer sus notas validadas" on public.module_enrollments;
create policy "estudiante: leer sus notas"
  on public.module_enrollments for select
  to authenticated
  using (student_id = auth.uid());

-- 2. Disparadores del sistema nuevo
drop trigger if exists trg_bloquear_notas_enviadas_participacion on public.module_enrollments;
drop trigger if exists trg_notify_notas_general on public.module_enrollments;
drop trigger if exists trg_asegurar_enrollments_cohorte on public.cohorts;
drop trigger if exists trg_asegurar_enrollment_estudiante on public.students;
drop trigger if exists trg_recalc_puntualidad_asistencia on public.attendance_events;
drop trigger if exists trg_recalc_puntualidad_justificacion on public.attendance_justifications;
drop trigger if exists trg_recalc_puntualidad_cierre_sesion on public.class_sessions;

-- 3. Tablas nuevas (llevan consigo sus políticas y disparadores)
drop table if exists public.manual_exam_scores;
drop table if exists public.manual_exam_definitions;
drop table if exists public.grade_submissions;

-- 4. Funciones nuevas
drop function if exists public.enviar_notas(uuid, uuid);
drop function if exists public.validar_notas(uuid, uuid);
drop function if exists public.devolver_notas(uuid, uuid);
drop function if exists public.fn_bloquear_notas_enviadas();
drop function if exists public.fn_asegurar_enrollment(uuid, uuid, uuid);
drop function if exists public.fn_asegurar_enrollments_cohorte();
drop function if exists public.fn_asegurar_enrollment_estudiante();
drop function if exists public.fn_recalc_evaluacion_general(uuid, uuid);
drop function if exists public.fn_trg_recalc_evaluacion_general();
drop function if exists public.fn_recalc_puntualidad(uuid, uuid);
drop function if exists public.fn_trg_recalc_puntualidad_asistencia();
drop function if exists public.fn_trg_recalc_puntualidad_cierre_sesion();
drop function if exists public.fn_validar_escala_examen_manual();
drop function if exists public.fn_notify_notas_registradas_directo();
drop function if exists public.fn_notify_notas_registradas_extra();

-- 5. Columna nueva
alter table public.module_enrollments drop column if exists class_participation_score;

-- 6. Matrículas vacías que creó la migración 110 (las 2 anteriores se conservan)
delete from public.module_enrollments
where created_at >= '2026-10-06'
  and theory_score is null and practice_score is null and participation_score is null;

-- 7. Tolerancia de "tarde" como estaba (15 min)
update public.system_config set value = '15' where key = 'attendance.tarde_umbral_minutos';

-- 8. Catálogo de notificaciones original
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'examen_habilitado',
    'nota_publicada',
    'consentimiento_pendiente',
    'feedback_disponible',
    'profesor_pendiente'
  ));
