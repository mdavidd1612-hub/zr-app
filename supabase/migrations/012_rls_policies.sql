-- =============================================================================
-- ZR APP · MIGRACIÓN 012 · Políticas de Row Level Security
-- =============================================================================
-- Este es el archivo más importante del proyecto en términos de seguridad.
-- La base contiene cédulas, fechas de nacimiento y datos de representantes
-- legales de menores de edad. Una fuga aquí no es un incidente técnico: es un
-- incidente legal bajo LOPNNA.
--
-- PRINCIPIO: una tabla sin política no devuelve filas. Ese es el estado por
-- defecto correcto. Si agregas una tabla nueva, agrega su política AQUÍ MISMO,
-- en la misma migración, no "después".
--
-- La clave service_role se salta todas estas políticas. Por eso NUNCA puede
-- estar en código que llegue al navegador.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PERMISOS BASE
-- -----------------------------------------------------------------------------
-- 'anon' (usuario sin sesión) NO recibe ningún permiso sobre las tablas.
-- Aquí no hay nada público: todo el contenido es de una academia con datos de
-- menores de edad. Un permiso que no existe no se puede configurar mal después.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- student_qr_secrets NO es accesible por nadie a través de la API. Ni siquiera
-- por el propio estudiante. El secreto se entrega una sola vez desde una Edge
-- Function y la validación del código siempre ocurre en el servidor.
revoke all on public.student_qr_secrets from anon, authenticated;

-- =============================================================================
-- IDENTIDAD
-- =============================================================================

-- profiles ---------------------------------------------------------------
create policy "perfil propio: leer"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "personal: leer perfiles visibles"
  on public.profiles for select to authenticated
  using ((select public.is_admin_up()) or (select public.can_see_student(id)));

create policy "perfil propio: actualizar"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "admin: escribir perfiles"
  on public.profiles for all to authenticated
  using ((select public.is_admin_up())) with check ((select public.is_admin_up()));

-- students ---------------------------------------------------------------
create policy "estudiante: leer su ficha"
  on public.students for select to authenticated
  using (id = auth.uid());

create policy "personal: leer estudiantes de su cohorte"
  on public.students for select to authenticated
  using ((select public.can_see_student(id)));

create policy "admin: escribir estudiantes"
  on public.students for all to authenticated
  using ((select public.is_admin_up())) with check ((select public.is_admin_up()));

-- teachers / admins ------------------------------------------------------
create policy "personal: leer profesores"
  on public.teachers for select to authenticated
  using ((select public.is_staff()) or id = auth.uid());

create policy "super: escribir profesores"
  on public.teachers for all to authenticated
  using ((select public.is_super())) with check ((select public.is_super()));

create policy "admin: leer admins"
  on public.admins for select to authenticated
  using ((select public.is_admin_up()) or id = auth.uid());

create policy "super: escribir admins"
  on public.admins for all to authenticated
  using ((select public.is_super())) with check ((select public.is_super()));

-- parental_consents ------------------------------------------------------
create policy "estudiante: leer su consentimiento"
  on public.parental_consents for select to authenticated
  using (student_id = auth.uid());

create policy "estudiante: registrar su consentimiento"
  on public.parental_consents for insert to authenticated
  with check (student_id = auth.uid());

create policy "admin: gestionar consentimientos"
  on public.parental_consents for all to authenticated
  using ((select public.is_admin_up())) with check ((select public.is_admin_up()));

-- =============================================================================
-- ESTRUCTURA ACADÉMICA
-- =============================================================================

create policy "todos: leer programas"
  on public.programs for select to authenticated using (true);
create policy "admin: escribir programas"
  on public.programs for all to authenticated
  using ((select public.is_admin_up())) with check ((select public.is_admin_up()));

create policy "todos: leer modulos"
  on public.modules for select to authenticated using (true);
create policy "admin: escribir modulos"
  on public.modules for all to authenticated
  using ((select public.is_admin_up())) with check ((select public.is_admin_up()));

create policy "todos: leer guias"
  on public.learning_guides for select to authenticated using (true);
create policy "personal: escribir guias"
  on public.learning_guides for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- cohorts ----------------------------------------------------------------
create policy "estudiante: leer su cohorte"
  on public.cohorts for select to authenticated
  using (id = (select public.my_cohort_id()));

create policy "personal: leer cohortes que atiende"
  on public.cohorts for select to authenticated
  using ((select public.teaches_cohort(id)));

create policy "admin: escribir cohortes"
  on public.cohorts for all to authenticated
  using ((select public.is_admin_up())) with check ((select public.is_admin_up()));

-- class_sessions ---------------------------------------------------------
create policy "estudiante: leer sesiones de su cohorte"
  on public.class_sessions for select to authenticated
  using (cohort_id = (select public.my_cohort_id()));

create policy "personal: leer sesiones que atiende"
  on public.class_sessions for select to authenticated
  using ((select public.teaches_cohort(cohort_id)));

create policy "personal: escribir sesiones que atiende"
  on public.class_sessions for insert to authenticated
  with check ((select public.teaches_cohort(cohort_id)));

create policy "personal: actualizar sesiones que atiende"
  on public.class_sessions for update to authenticated
  using ((select public.teaches_cohort(cohort_id)))
  with check ((select public.teaches_cohort(cohort_id)));

create policy "admin: borrar sesiones"
  on public.class_sessions for delete to authenticated
  using ((select public.is_admin_up()));

-- module_enrollments -----------------------------------------------------
-- El estudiante LEE sus notas. Nunca las escribe.
create policy "estudiante: leer sus notas"
  on public.module_enrollments for select to authenticated
  using (student_id = auth.uid());

create policy "personal: leer notas de su cohorte"
  on public.module_enrollments for select to authenticated
  using ((select public.teaches_cohort(cohort_id)));

create policy "personal: escribir notas de su cohorte"
  on public.module_enrollments for insert to authenticated
  with check ((select public.teaches_cohort(cohort_id)));

create policy "personal: actualizar notas de su cohorte"
  on public.module_enrollments for update to authenticated
  using ((select public.teaches_cohort(cohort_id)))
  with check ((select public.teaches_cohort(cohort_id)));

-- =============================================================================
-- ASISTENCIA
-- =============================================================================

create policy "estudiante: leer su asistencia"
  on public.attendance_events for select to authenticated
  using (student_id = auth.uid());

create policy "personal: leer asistencia de su cohorte"
  on public.attendance_events for select to authenticated
  using (exists (
    select 1 from public.class_sessions s
    where s.id = session_id and (select public.teaches_cohort(s.cohort_id))
  ));

create policy "personal: registrar asistencia"
  on public.attendance_events for insert to authenticated
  with check (exists (
    select 1 from public.class_sessions s
    where s.id = session_id and (select public.teaches_cohort(s.cohort_id))
  ));

create policy "personal: marcar refrigerio"
  on public.attendance_events for update to authenticated
  using (exists (
    select 1 from public.class_sessions s
    where s.id = session_id and (select public.teaches_cohort(s.cohort_id))
  ))
  with check (exists (
    select 1 from public.class_sessions s
    where s.id = session_id and (select public.teaches_cohort(s.cohort_id))
  ));

-- =============================================================================
-- EVALUACIONES
-- =============================================================================

-- El estudiante solo ve exámenes ya habilitados y de su propio módulo.
create policy "estudiante: leer examenes habilitados"
  on public.exams for select to authenticated
  using (
    status in ('habilitado','cerrado','calificado')
    and (
      cohort_id = (select public.my_cohort_id())
      or (cohort_id is null and module_id = (select public.my_module_id()))
    )
  );

create policy "personal: leer examenes"
  on public.exams for select to authenticated
  using ((select public.is_staff()));

create policy "personal: escribir examenes"
  on public.exams for insert to authenticated
  with check ((select public.is_staff()));

create policy "personal: actualizar examenes"
  on public.exams for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "admin: borrar examenes"
  on public.exams for delete to authenticated
  using ((select public.is_admin_up()));

-- exam_questions: SIN política para estudiantes.
-- Esto es deliberado: el estudiante NO puede leer esta tabla porque contiene
-- correct_answer. Accede únicamente por la vista v_exam_questions_student.
create policy "personal: gestionar preguntas"
  on public.exam_questions for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Se redefine la vista como SECURITY DEFINER (security_invoker = false) para
-- que funcione aunque el estudiante no tenga acceso a la tabla base.
-- El filtrado de qué puede ver va dentro de la propia vista.
drop view if exists public.v_exam_questions_student;
create view public.v_exam_questions_student
with (security_invoker = false)
as
select
  q.id,
  q.exam_id,
  q.order_index,
  q.type,
  q.statement,
  q.options,
  q.points
from public.exam_questions q
join public.exams e on e.id = q.exam_id
where
  public.is_staff()
  or (
    e.status in ('habilitado','cerrado','calificado')
    and (
      e.cohort_id = public.my_cohort_id()
      or (e.cohort_id is null and e.module_id = public.my_module_id())
    )
  );

grant select on public.v_exam_questions_student to authenticated;

-- exam_attempts ----------------------------------------------------------
create policy "estudiante: leer sus intentos"
  on public.exam_attempts for select to authenticated
  using (student_id = auth.uid());

create policy "estudiante: iniciar su intento"
  on public.exam_attempts for insert to authenticated
  with check (student_id = auth.uid());

create policy "estudiante: entregar su intento"
  on public.exam_attempts for update to authenticated
  using (student_id = auth.uid() and status = 'en_progreso')
  with check (student_id = auth.uid());

create policy "personal: leer intentos"
  on public.exam_attempts for select to authenticated
  using ((select public.is_staff()));

create policy "personal: actualizar intentos"
  on public.exam_attempts for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- exam_answers -----------------------------------------------------------
create policy "estudiante: leer sus respuestas"
  on public.exam_answers for select to authenticated
  using (exists (
    select 1 from public.exam_attempts a
    where a.id = attempt_id and a.student_id = auth.uid()
  ));

create policy "estudiante: responder antes de entregar"
  on public.exam_answers for insert to authenticated
  with check (exists (
    select 1 from public.exam_attempts a
    where a.id = attempt_id and a.student_id = auth.uid() and a.status = 'en_progreso'
  ));

create policy "estudiante: corregir antes de entregar"
  on public.exam_answers for update to authenticated
  using (exists (
    select 1 from public.exam_attempts a
    where a.id = attempt_id and a.student_id = auth.uid() and a.status = 'en_progreso'
  ))
  with check (exists (
    select 1 from public.exam_attempts a
    where a.id = attempt_id and a.student_id = auth.uid() and a.status = 'en_progreso'
  ));

create policy "personal: leer y calificar respuestas"
  on public.exam_answers for select to authenticated
  using ((select public.is_staff()));

create policy "personal: asignar puntaje"
  on public.exam_answers for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- =============================================================================
-- CONTENIDO Y FEEDBACK
-- =============================================================================

create policy "estudiante: leer contenido publicado de su modulo"
  on public.content_items for select to authenticated
  using (
    is_published
    and (visible_from is null or visible_from <= now())
    and module_id = (select public.my_module_id())
  );

create policy "personal: leer todo el contenido"
  on public.content_items for select to authenticated
  using ((select public.is_staff()));

create policy "personal: escribir contenido"
  on public.content_items for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "estudiante: registrar vista"
  on public.content_views for insert to authenticated
  with check (student_id = auth.uid());

create policy "estudiante: leer sus vistas"
  on public.content_views for select to authenticated
  using (student_id = auth.uid());

create policy "personal: leer vistas"
  on public.content_views for select to authenticated
  using ((select public.is_staff()));

-- feedback_micro ---------------------------------------------------------
-- El profesor NO tiene política de lectura individual. A propósito.
-- Solo accede al agregado por la vista v_feedback_session_summary.
create policy "estudiante: escribir su feedback"
  on public.feedback_micro for insert to authenticated
  with check (student_id = auth.uid());

create policy "estudiante: leer su feedback"
  on public.feedback_micro for select to authenticated
  using (student_id = auth.uid());

create policy "admin: leer feedback"
  on public.feedback_micro for select to authenticated
  using ((select public.is_admin_up()));

drop view if exists public.v_feedback_session_summary;
create view public.v_feedback_session_summary
with (security_invoker = false)
as
select
  f.session_id,
  ans->>'q'                            as question,
  count(*)                             as response_count,
  round(avg((ans->>'a')::numeric), 2)  as avg_score
from public.feedback_micro f
cross join lateral jsonb_array_elements(f.answers) as ans
join public.class_sessions s on s.id = f.session_id
where public.teaches_cohort(s.cohort_id)
group by f.session_id, ans->>'q'
having count(*) >= public.cfg_int('feedback.min_responses_to_show', 3);

grant select on public.v_feedback_session_summary to authenticated;

create policy "estudiante: escribir feedback macro"
  on public.feedback_macro for insert to authenticated
  with check (student_id = auth.uid());
create policy "estudiante: leer feedback macro"
  on public.feedback_macro for select to authenticated
  using (student_id = auth.uid());
create policy "admin: leer feedback macro"
  on public.feedback_macro for select to authenticated
  using ((select public.is_admin_up()));

-- =============================================================================
-- TRANSVERSALES
-- =============================================================================

create policy "todos: leer config publica"
  on public.system_config for select to authenticated
  using (is_public or (select public.is_admin_up()));

create policy "super: escribir config"
  on public.system_config for all to authenticated
  using ((select public.is_super())) with check ((select public.is_super()));

create policy "admin: leer historial de config"
  on public.system_config_history for select to authenticated
  using ((select public.is_admin_up()));

create policy "admin: leer auditoria"
  on public.audit_log for select to authenticated
  using ((select public.is_admin_up()));

create policy "propias: leer notificaciones"
  on public.notifications for select to authenticated
  using (profile_id = auth.uid());

create policy "propias: marcar leidas"
  on public.notifications for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "propias: gestionar suscripcion push"
  on public.push_subscriptions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
