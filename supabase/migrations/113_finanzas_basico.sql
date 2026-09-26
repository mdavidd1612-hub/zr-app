-- =============================================================================
-- ZR APP · MIGRACIÓN 113 · Finanzas -- versión básica, EXCEPCIÓN explícita de Fase 1
-- =============================================================================
-- AGENTS.md §7 prohíbe pantallas de pagos/cuotas en Fase 1. Esta es una
-- excepción explícita, aprobada directamente por el coordinador (sept.
-- 2026) mientras se espera la integración de Moodle -- mismo mecanismo que
-- ya se usó para ZR Coffee (migración 090).
--
-- Deliberadamente MUY básico, tal como se pidió: solo permite marcar si un
-- estudiante pagó o debe la inscripción o la mensualidad de su módulo
-- actual. NO es el módulo de financiamiento completo -- ese ya existe
-- diseñado y confirmado en docs/02_MODULO_FINANCIAMIENTO.md (estilo Cashea,
-- fraccionamiento, niveles de confianza) y sigue siendo la versión real de
-- Fase 2. Esta tabla no debe crecer para intentar cubrir eso -- cuando se
-- decida activar el módulo completo, se reemplaza, no se expande esta.
--
-- Los MONTOS (cuánto es la inscripción, cuánto la mensualidad) quedaron
-- explícitamente sin decidir ("eso lo dejamos al final") -- por eso `amount`
-- es un campo libre que la administradora llena caso por caso, nunca un
-- número fijo en el código (regla 5 de AGENTS.md).
--
-- Solo admin y super_admin -- pedido explícito de que Dirección Académica no
-- entra aquí (distinto de is_admin_up(), que sí la incluye).
-- =============================================================================

create table public.student_payments (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  concept       text not null check (concept in ('inscripcion', 'mensualidad')),
  module_id     uuid references public.modules(id),  -- solo para 'mensualidad'; null en 'inscripcion'
  status        text not null default 'pendiente' check (status in ('pagado', 'pendiente')),
  amount        numeric(10,2),
  paid_at       date,
  notes         text,
  registered_by uuid references public.profiles(id),
  updated_at    timestamptz not null default now(),

  constraint chk_mensualidad_con_modulo
    check ((concept = 'mensualidad' and module_id is not null) or (concept = 'inscripcion' and module_id is null)),

  unique (student_id, concept, module_id)
);

create index idx_student_payments_student on public.student_payments (student_id);

create trigger trg_student_payments_updated
  before update on public.student_payments
  for each row execute function public.set_updated_at();

alter table public.student_payments enable row level security;

create policy "admin: administra pagos"
  on public.student_payments for all
  to authenticated
  using ((select public.auth_role()) in ('admin', 'super_admin'))
  with check ((select public.auth_role()) in ('admin', 'super_admin'));

create policy "estudiante: leer sus propios pagos"
  on public.student_payments for select
  to authenticated
  using (student_id = auth.uid());
