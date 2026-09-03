-- =============================================================================
-- ZR APP · MIGRACIÓN 066 · is_academico(): separar lo académico de is_admin_up()
-- =============================================================================
-- Cierra R-14 de docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md — con un ajuste de
-- alcance importante frente al borrador del plan, que hay que dejar por
-- escrito para quien retome esto:
--
-- El plan (§3.5) proponía una matriz donde Dirección Académica y
-- Administración son dos carriles SEPARADOS, sin solape. Al auditar
-- `app/(admin)/layout.tsx` para hacer R-15 (alinear la interfaz), resultó que
-- el modelo que YA está construido y en uso es otro, documentado en el propio
-- código (comentario de esa migración anterior a esta sesión):
--
--   "admin es todo lo de ESTUDIANTES, Dirección Académica es todo lo de
--   PROFESORES/notas/evaluaciones" — pero el menú (`TODAS_DIRECCION`) le da a
--   Dirección Académica TODO lo que ve un admin (Estudiantes, Consentimientos,
--   Asistencia, QR, Material) MÁS Personal/Notas/Exámenes encima. No son dos
--   carriles separados: Dirección Académica es un SUPERCONJUNTO de admin.
--
-- Por la regla de `AGENTS.md` §5 ("código gana sobre spec gana sobre docs") y
-- porque este es un modelo ya construido y probablemente acordado con el
-- cliente en una sesión anterior (no algo que yo pueda inventar de nuevo sin
-- pisar una decisión tomada), esta migración sigue ESE modelo, no el de la
-- matriz nueva. Efecto práctico: no hace falta un `is_administracion()`
-- separado — no hay ninguna capacidad que tenga `admin` y NO tenga
-- `direccion_academica` hoy. Solo hace falta `is_academico()`, para las
-- capacidades que SÍ son exclusivas de Dirección Académica y que hasta ahora
-- un `admin` normal también tenía por culpa de `is_admin_up()`.
--
-- QUÉ SE ANGOSTA (de is_admin_up() a is_academico(), es decir: se le quita a
-- `admin` plano, se lo conserva `direccion_academica` y `super_admin`):
--   - exams:       borrar exámenes (ya era acción de supervisión académica)
--   - feedback_macro / feedback_micro: leer feedback de clase
--   - modules:     escribir el catálogo de módulos (currículo)
--   - teacher_module_assignments: la política ya se llamaba "direccion: ..."
--     pero estaba implementada con is_admin_up() — el nombre decía una cosa,
--     el código hacía otra. Esto cierra ese desajuste puntual.
--
-- QUÉ SE ANGOSTA a super_admin exclusivamente (`is_super()`, ya existía):
--   - programs:              crear/editar programas — no hay pantalla todavía
--     (eso es R-21), así que angostar esto ahora no rompe nada existente.
--   - system_config (lectura no pública) y system_config_history: la pantalla
--     de Configuración ya solo se le muestra a super_admin en el menú
--     (`TODAS_SUPER`); esto es blindar en la base lo que la interfaz ya
--     ocultaba, no un cambio de comportamiento visible.
--
-- QUÉ SE DEJA IGUAL a propósito (con is_admin_up(), sin tocar): admins
-- (lectura), attendance_justifications, audit_log, class_sessions, cohorts,
-- parental_consents, profiles (las dos políticas), student_profile_details,
-- students, terms_acceptances. Un `admin` normal y `direccion_academica`
-- llegan hoy a esas pantallas por el mismo menú (`TODAS.slice(0,6)` es común
-- a ambos) — angostarlas rompería el modelo ya construido sin que nadie lo
-- haya pedido.
-- =============================================================================

create or replace function public.is_academico()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() in ('direccion_academica', 'super_admin'), false);
$$;

-- -----------------------------------------------------------------------------
-- exams
-- -----------------------------------------------------------------------------
drop policy "admin: borrar examenes" on public.exams;
create policy "academico: borrar examenes"
  on public.exams for delete to authenticated
  using ((select public.is_academico()));

-- -----------------------------------------------------------------------------
-- feedback_macro / feedback_micro
-- -----------------------------------------------------------------------------
drop policy "admin: leer feedback macro" on public.feedback_macro;
create policy "academico: leer feedback macro"
  on public.feedback_macro for select to authenticated
  using ((select public.is_academico()));

drop policy "admin: leer feedback" on public.feedback_micro;
create policy "academico: leer feedback"
  on public.feedback_micro for select to authenticated
  using ((select public.is_academico()));

-- -----------------------------------------------------------------------------
-- modules
-- -----------------------------------------------------------------------------
drop policy "admin: escribir modulos" on public.modules;
create policy "academico: escribir modulos"
  on public.modules for all to authenticated
  using ((select public.is_academico()))
  with check ((select public.is_academico()));

-- -----------------------------------------------------------------------------
-- teacher_module_assignments — el nombre ya decía "direccion", el código no
-- -----------------------------------------------------------------------------
drop policy "direccion: gestionar asignaciones" on public.teacher_module_assignments;
create policy "academico: gestionar asignaciones"
  on public.teacher_module_assignments for all to authenticated
  using ((select public.is_academico()))
  with check ((select public.is_academico()));

-- -----------------------------------------------------------------------------
-- programs — sin pantalla todavía (R-21), angostar aquí no rompe nada activo
-- -----------------------------------------------------------------------------
drop policy "admin: escribir programas" on public.programs;
create policy "super: escribir programas"
  on public.programs for all to authenticated
  using ((select public.is_super()))
  with check ((select public.is_super()));

-- -----------------------------------------------------------------------------
-- system_config / system_config_history — blindar lo que el menú ya ocultaba
-- -----------------------------------------------------------------------------
drop policy "todos: leer config publica" on public.system_config;
create policy "todos: leer config publica"
  on public.system_config for select to authenticated
  using (is_public or (select public.is_super()));

drop policy "admin: leer historial de config" on public.system_config_history;
create policy "super: leer historial de config"
  on public.system_config_history for select to authenticated
  using ((select public.is_super()));
