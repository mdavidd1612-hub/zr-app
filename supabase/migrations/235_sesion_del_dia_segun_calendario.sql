-- =============================================================================
-- ZR APP · MIGRACIÓN 235 · La sesión de asistencia sigue al calendario (con clases movidas)
-- =============================================================================
-- Consecuencia de mover clases (migración 234): la sesión de asistencia del día
-- se creaba "todos los sábados" (cron 077) o según el texto "Sábados" del corte
-- (pantalla Asistencia). Con una clase corrida o una reposición en domingo eso
-- fallaba: sesión en el sábado cancelado y "hoy no hay clase" el domingo de la
-- reposición (el QR no funcionaba).
--
-- `fn_clase_del_dia(corte, fecha)` responde de qué módulo es la clase de ese
-- día (o null si no hay): reposición/movida → la excepción; cancelada → null;
-- normal → día de clase dentro de un tramo presencial; corte sin calendario de
-- módulos → como antes (días de clase + módulo actual).
-- La generación de sesiones corre ahora todos los días y solo crea la sesión
-- cuando ese día hay clase, con el módulo correcto.
-- =============================================================================

create or replace function public.fn_clase_del_dia(p_cohort uuid, p_fecha date)
returns uuid
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  c record;
  v_mod uuid;
  v_orig date;
begin
  select id, class_weekdays, current_module_id into c from public.cohorts where id = p_cohort;
  if c.id is null then return null; end if;

  -- Una clase movida o repuesta a esta fecha.
  select e.original_date into v_orig from public.cohort_class_exceptions e
   where e.cohort_id = p_cohort and e.new_date = p_fecha limit 1;
  if v_orig is not null then
    select k.module_id into v_mod from public.cohort_module_calendar k
     where k.cohort_id = p_cohort and k.modalidad = 'presencial' and v_orig between k.start_date and k.end_date
     order by k.start_date limit 1;
    return coalesce(v_mod, c.current_module_id);
  end if;

  -- La clase de esta fecha se movió a otra o se canceló.
  if exists (select 1 from public.cohort_class_exceptions e
              where e.cohort_id = p_cohort and e.original_date = p_fecha) then
    return null;
  end if;

  if not (extract(dow from p_fecha)::smallint = any (coalesce(c.class_weekdays, array[6]::smallint[]))) then
    return null;
  end if;

  if exists (select 1 from public.cohort_module_calendar k where k.cohort_id = p_cohort and k.modalidad = 'presencial') then
    select k.module_id into v_mod from public.cohort_module_calendar k
     where k.cohort_id = p_cohort and k.modalidad = 'presencial' and p_fecha between k.start_date and k.end_date
     order by k.start_date limit 1;
    return v_mod;  -- null = semana sin clase (vacaciones o corrida)
  end if;

  return c.current_module_id;
end $$;

revoke execute on function public.fn_clase_del_dia(uuid, date) from public, anon;
grant execute on function public.fn_clase_del_dia(uuid, date) to authenticated;

create or replace function public.fn_generar_sesion_semanal()
returns void
language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_c   record;
  v_mod uuid;
  v_ultima int;
begin
  for v_c in select id, teacher_id from public.cohorts where status = 'activa' loop
    v_mod := public.fn_clase_del_dia(v_c.id, v_hoy);
    if v_mod is not null and not exists (
      select 1 from public.class_sessions where cohort_id = v_c.id and session_date = v_hoy
    ) then
      select max(week_number) into v_ultima from public.class_sessions where cohort_id = v_c.id;
      insert into public.class_sessions (cohort_id, module_id, teacher_id, session_date, week_number, status)
      values (v_c.id, v_mod, v_c.teacher_id, v_hoy, coalesce(v_ultima, 0) + 1, 'programada');
    end if;
  end loop;
end;
$function$;

-- Antes corría solo los sábados; ahora todos los días (crea sesión solo si hay clase).
select cron.schedule('generar-sesion-del-sabado', '0 8 * * *', 'select public.fn_generar_sesion_semanal();');
