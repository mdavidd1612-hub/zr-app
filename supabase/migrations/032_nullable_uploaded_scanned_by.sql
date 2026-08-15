-- =============================================================================
-- ZR APP · MIGRACIÓN 032 · Hacer nullable columnas bloqueaban cascade delete
-- =============================================================================
-- content_items.uploaded_by y attendance_events.scanned_by tenían NOT NULL
-- pero sus FKs usan ON DELETE SET NULL → conflicto que bloqueaba borrar al
-- profesor que subió contenido o que registró asistencia.

ALTER TABLE public.content_items ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.attendance_events ALTER COLUMN scanned_by DROP NOT NULL;
