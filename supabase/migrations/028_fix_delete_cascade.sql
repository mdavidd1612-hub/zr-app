-- =============================================================================
-- ZR APP · MIGRACIÓN 028 · Habilitar cascade delete de usuarios
-- =============================================================================
-- Dos bloqueadores impedían borrar cuentas de forma limpia:
--
-- 1. fn_attendance_guard lanzaba excepción en DELETE, lo que bloqueaba el
--    cascade desde students → attendance_events al borrar un estudiante.
--    RLS ya impide que clientes no autorizados borren asistencia directamente,
--    así que el guard de trigger era redundante para el DELETE.
--
-- 2. exams.teacher_id no tenía acción ON DELETE, por lo que borrar un profesor
--    con exámenes propios fallaba por FK violation. Se cambia a SET NULL para
--    que el examen quede huérfano de profesor en vez de bloquear el borrado.
-- =============================================================================

-- 1. Modificar trigger de attendance para permitir DELETE (solo bloquea UPDATE)
create or replace function public.fn_attendance_guard()
returns trigger
language plpgsql
as $$
begin
  -- DELETE permitido: la protección real son las políticas de RLS.
  -- Bloquear el DELETE aquí impedía el cascade al borrar estudiantes.
  if tg_op = 'DELETE' then
    return old;
  end if;

  if (new.id, new.session_id, new.student_id, new.scanned_at, new.scanned_by, new.method)
     is distinct from
     (old.id, old.session_id, old.student_id, old.scanned_at, old.scanned_by, old.method)
  then
    raise exception 'Solo se pueden actualizar los campos de refrigerio en attendance_events.';
  end if;

  if old.snack_claimed_at is not null
     and new.snack_claimed_at is distinct from old.snack_claimed_at
  then
    raise exception 'El refrigerio ya fue entregado a este estudiante en esta sesión.';
  end if;

  return new;
end;
$$;

-- 2. Hacer teacher_id nullable en exams para poder borrar profesores
--    (sus exámenes quedan con teacher_id = NULL en vez de bloquear el borrado)
alter table public.exams
  drop constraint if exists exams_teacher_id_fkey;

alter table public.exams
  alter column teacher_id drop not null;

alter table public.exams
  add constraint exams_teacher_id_fkey
    foreign key (teacher_id) references public.teachers(id)
    on delete set null;
