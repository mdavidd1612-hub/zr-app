-- =============================================================================
-- ZR APP · MIGRACIÓN 077 · La sesión del sábado se crea sola
-- =============================================================================
-- Chequeo previo al sábado real: no existía NINGUNA forma de que la sesión
-- de clase del sábado (class_sessions) apareciera — ni el profesor ni
-- administración tenían pantalla para crearla, y sin esa fila el escaneo de
-- asistencia con QR no tiene contra qué registrarse (regla 9 de AGENTS.md).
-- La única vía que existía era el interruptor de prueba de
-- app/(admin)/perfil-admin/page.tsx, marcado explícitamente como temporal, y
-- que además nunca guardaba `teacher_id` — así que la sesión que creaba
-- jamás aparecía en la lista del profesor real (que filtra por
-- `teacher_id = auth.uid()` en app/(profesor)/sesiones y app/(profesor)/hoy).
--
-- Mismo patrón que la migración 076 (casos): un cron corre temprano el
-- sábado y crea, para cada cohorte activa con módulo asignado, la sesión de
-- HOY si todavía no existe — con `teacher_id` tomado de `cohorts.teacher_id`
-- para que sí aparezca donde el profesor la busca. Si la cohorte todavía no
-- tiene profesor asignado, la sesión se crea igual (teacher_id nulo, la
-- columna lo permite) para no bloquear la asistencia por ese motivo; en
-- cuanto se asigne un profesor desde /personal o /cohortes, hay que abrir la
-- sesión desde /(admin)/asistencias como ya se hacía.
-- =============================================================================

create or replace function public.fn_generar_sesion_semanal()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hoy_dow  int  := extract(dow from (now() at time zone 'America/Caracas'))::int; -- 0=domingo … 6=sábado
  v_hoy      date := (now() at time zone 'America/Caracas')::date;
  v_cohorte  record;
  v_ultima_semana int;
begin
  if v_hoy_dow <> 6 then
    return; -- Las clases son los sábados (CLAUDE.md §1); no se crea nada otro día.
  end if;

  for v_cohorte in
    select c.id, c.current_module_id, c.teacher_id
    from public.cohorts c
    where c.status = 'activa' and c.current_module_id is not null
  loop
    if not exists (
      select 1 from public.class_sessions
      where cohort_id = v_cohorte.id and session_date = v_hoy
    ) then
      select max(week_number) into v_ultima_semana
      from public.class_sessions
      where cohort_id = v_cohorte.id;

      insert into public.class_sessions (cohort_id, module_id, teacher_id, session_date, week_number, status)
      values (
        v_cohorte.id,
        v_cohorte.current_module_id,
        v_cohorte.teacher_id,
        v_hoy,
        coalesce(v_ultima_semana, 0) + 1,
        'programada'
      );
    end if;
  end loop;
end;
$$;

-- 08:00 UTC = 4:00 am hora de Venezuela: antes de que llegue cualquier
-- estudiante, y antes del cron de casos (076, a las 10:00 UTC) por si algún
-- día llegan a depender uno del otro.
select cron.schedule(
  'generar-sesion-del-sabado',
  '0 8 * * 6',
  $$select public.fn_generar_sesion_semanal();$$
);
