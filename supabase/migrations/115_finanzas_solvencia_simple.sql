-- =============================================================================
-- ZR APP · MIGRACIÓN 115 · Finanzas -- rehecho: solo un estado de solvencia
-- =============================================================================
-- Corrección explícita del coordinador (sept. 2026) sobre la migración 113:
-- se quita por completo la idea de inscripción/mensualidad con montos. En su
-- lugar, un solo campo de solvencia por estudiante, tres estados:
--
--   'solvente'            -- al día, verde, accede sin problema
--   'solvente_pendiente'  -- la administradora dio chance mientras se resuelve
--                            algo con el estudiante -- accede igual que 'solvente'
--   'no_solvente'         -- bloquea el botón de tomar asistencia
--
-- Default 'solvente': si defaulteara a 'no_solvente', todos los estudiantes
-- ya inscritos quedarían bloqueados el día que se despliegue esto, sin que
-- nadie lo haya decidido -- la administradora debe marcar a mano a quién
-- bloquear, nunca al revés.
--
-- El bloqueo de asistencia se aplica también del lado servidor
-- (checkin-session), no solo ocultando el botón -- regla 2 de AGENTS.md.
-- =============================================================================

drop table if exists public.student_payments;

alter table public.students
  add column payment_status text not null default 'solvente'
    check (payment_status in ('solvente', 'solvente_pendiente', 'no_solvente'));

comment on column public.students.payment_status is
  'Excepción explícita de Fase 1 (finanzas básico). No lo pone Dirección Académica -- solo admin/super_admin.';

-- Solo admin/super_admin pueden CAMBIAR este campo específico, aunque la
-- política general de escritura de `students` (is_admin_up()) sea más
-- amplia e incluya a Dirección Académica para el resto de columnas.
create or replace function public.fn_restringir_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status is distinct from old.payment_status
     and (select public.auth_role()) not in ('admin', 'super_admin')
  then
    raise exception 'Solo Administración puede cambiar el estado de solvencia.';
  end if;
  return new;
end;
$$;

create trigger trg_restringir_payment_status
  before update of payment_status on public.students
  for each row execute function public.fn_restringir_payment_status();
