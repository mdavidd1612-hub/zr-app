-- =============================================================================
-- ZR APP · MIGRACIÓN 029 · FK referencias a personal → SET NULL ON DELETE
-- =============================================================================
-- Todas las columnas "quién hizo X" (scanned_by, graded_by, uploaded_by, etc.)
-- tenían ON DELETE NO ACTION, bloqueando borrar cualquier usuario que hubiera
-- hecho algo en el sistema. Se cambian a SET NULL para que el historial quede
-- pero sin bloquear la eliminación de la cuenta.
-- =============================================================================

ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_actor_profile_id_fkey;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_actor_profile_id_fkey
    FOREIGN KEY (actor_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.attendance_events
  DROP CONSTRAINT IF EXISTS attendance_events_scanned_by_fkey;
ALTER TABLE public.attendance_events
  ADD CONSTRAINT attendance_events_scanned_by_fkey
    FOREIGN KEY (scanned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.attendance_events
  DROP CONSTRAINT IF EXISTS attendance_events_snack_claimed_by_fkey;
ALTER TABLE public.attendance_events
  ADD CONSTRAINT attendance_events_snack_claimed_by_fkey
    FOREIGN KEY (snack_claimed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.content_items
  DROP CONSTRAINT IF EXISTS content_items_uploaded_by_fkey;
ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.exam_answers
  DROP CONSTRAINT IF EXISTS exam_answers_graded_by_fkey;
ALTER TABLE public.exam_answers
  ADD CONSTRAINT exam_answers_graded_by_fkey
    FOREIGN KEY (graded_by) REFERENCES public.teachers(id) ON DELETE SET NULL;

ALTER TABLE public.exam_rehabilitation_requests
  DROP CONSTRAINT IF EXISTS exam_rehabilitation_requests_responded_by_fkey;
ALTER TABLE public.exam_rehabilitation_requests
  ADD CONSTRAINT exam_rehabilitation_requests_responded_by_fkey
    FOREIGN KEY (responded_by) REFERENCES public.teachers(id) ON DELETE SET NULL;

ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_published_by_fkey;
ALTER TABLE public.exams
  ADD CONSTRAINT exams_published_by_fkey
    FOREIGN KEY (published_by) REFERENCES public.teachers(id) ON DELETE SET NULL;

ALTER TABLE public.mastery_map
  DROP CONSTRAINT IF EXISTS mastery_map_marked_by_fkey;
ALTER TABLE public.mastery_map
  ADD CONSTRAINT mastery_map_marked_by_fkey
    FOREIGN KEY (marked_by) REFERENCES public.teachers(id) ON DELETE SET NULL;

ALTER TABLE public.parental_consents
  DROP CONSTRAINT IF EXISTS parental_consents_verified_by_fkey;
ALTER TABLE public.parental_consents
  ADD CONSTRAINT parental_consents_verified_by_fkey
    FOREIGN KEY (verified_by) REFERENCES public.admins(id) ON DELETE SET NULL;

ALTER TABLE public.professor_applications
  DROP CONSTRAINT IF EXISTS professor_applications_reviewed_by_fkey;
ALTER TABLE public.professor_applications
  ADD CONSTRAINT professor_applications_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.system_config
  DROP CONSTRAINT IF EXISTS system_config_updated_by_fkey;
ALTER TABLE public.system_config
  ADD CONSTRAINT system_config_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.class_sessions
  DROP CONSTRAINT IF EXISTS class_sessions_teacher_id_fkey;
ALTER TABLE public.class_sessions
  ADD CONSTRAINT class_sessions_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

ALTER TABLE public.cohorts
  DROP CONSTRAINT IF EXISTS cohorts_teacher_id_fkey;
ALTER TABLE public.cohorts
  ADD CONSTRAINT cohorts_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
