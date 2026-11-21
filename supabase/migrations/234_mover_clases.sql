-- =============================================================================
-- ZR APP · MIGRACIÓN 234 · Calendario general (parte 2): mover clases
-- =============================================================================
-- Reglas que eligió el coordinador (20-nov-2026,
-- docs/reportes/propuesta_calendario_general_2026-11-20.md):
--  - Mover una clase a OTRA SEMANA posterior (p. ej. feriado) corre esa clase y
--    TODAS las siguientes del corte: los tramos presenciales del calendario de
--    módulos desde esa fecha se corren los mismos días (el módulo termina
--    después y los siguientes empiezan después). El módulo virtual en paralelo
--    no se toca.
--  - Moverla dentro de la MISMA SEMANA (reposición) o a una fecha anterior
--    mueve solo esa clase (una excepción).
--  - "No hay clase este día" = correr la cadena una semana.
--  - Antes de guardar se puede simular (p_simular = true): la función aplica el
--    cambio de verdad, lee cómo quedó (clases, módulos, fin del corte, choques)
--    y lo DESHACE. Así el resumen es exactamente lo que va a pasar.
--  - La clase que se corre deja un hueco en su tramo: el tramo que la contiene se
--    parte en dos (antes de la fecha / desde la fecha nueva), como ya se hace
--    con las vacaciones.
--  - Al guardar: aviso a los estudiantes del corte y a los profesores asignados.
-- Solo Dirección Académica y super_admin (is_academico). Administración ve el
-- calendario pero no mueve (decisión por defecto, 20-nov-2026).
-- =============================================================================

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'examen_habilitado','nota_publicada','consentimiento_pendiente','feedback_disponible','profesor_pendiente',
  'material_nuevo','modulo_cambiado','hora_clase','hora_refrigerio','notas_registradas','recordatorio_pago',
  'recordatorio_notas','duda_nueva','duda_respondida','tarea_nueva','tarea_calificada','material_aprobado',
  'material_rechazado','examen_por_corregir','tarea_entregada','material_por_aprobar','unidad_desbloqueada',
  'unidad_abierta','recordatorio_entrega','resumen_semanal','clase_movida'
]::text[]));

create or replace function public.fn_mover_clase(
  p_cohort   uuid,
  p_fecha    date,          -- fecha en que se ve hoy la clase en el calendario
  p_nueva    date,          -- null = "no hay clase este día" (corre una semana)
  p_inicio   time default null,
  p_fin      time default null,
  p_room     uuid default null,
  p_motivo   text default null,
  p_simular  boolean default true
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_hoy        date := (now() at time zone 'America/Caracas')::date;
  v_original   date;
  v_nueva      date := coalesce(p_nueva, p_fecha + 7);
  v_cadena     boolean;
  v_delta      int;
  v_corte      text;
  v_mod        uuid;
  v_ini        time;
  v_fin        time;
  v_salon      text;
  v_profes     text;
  v_antes      jsonb;
  v_despues    jsonb;
  v_clases     int;
  v_fin_antes  date;
  v_fin_desp   date;
  v_choques    jsonb;
  r            record;
begin
  if not (select public.is_academico()) then
    raise exception 'Solo Dirección Académica puede mover clases.';
  end if;
  if p_fecha < v_hoy then raise exception 'No se pueden mover clases que ya pasaron.'; end if;
  if v_nueva < v_hoy then raise exception 'La fecha nueva ya pasó.'; end if;
  if v_nueva = p_fecha and p_inicio is null and p_fin is null and p_room is null then
    raise exception 'Elige otra fecha, hora o salón.';
  end if;

  select name into v_corte from public.cohorts where id = p_cohort;

  -- Si la clase ya venía movida, se trabaja sobre su fecha "de calendario".
  select e.original_date into v_original
    from public.cohort_class_exceptions e
   where e.cohort_id = p_cohort and e.new_date = p_fecha limit 1;
  v_original := coalesce(v_original, p_fecha);

  select k.module_id into v_mod
    from public.cohort_module_calendar k
   where k.cohort_id = p_cohort and k.modalidad = 'presencial'
     and v_original between k.start_date and k.end_date
   order by k.start_date limit 1;
  if v_mod is null then raise exception 'Esa fecha no tiene clase en el calendario de módulos.'; end if;

  v_cadena := p_nueva is null
           or (v_nueva > v_original and date_trunc('week', v_nueva) <> date_trunc('week', v_original));
  v_delta := v_nueva - v_original;

  -- Foto de antes (tramos presenciales desde esa fecha).
  select coalesce(jsonb_agg(jsonb_build_object('modulo', m.order_index || '. ' || m.name,
           'desde', k.start_date, 'hasta', k.end_date) order by k.start_date), '[]'::jsonb),
         max(k.end_date)
    into v_antes, v_fin_antes
    from public.cohort_module_calendar k join public.modules m on m.id = k.module_id
   where k.cohort_id = p_cohort and k.modalidad = 'presencial' and k.end_date >= v_original;

  begin
    if v_cadena then
      -- 1) Tramos que empiezan en esa fecha o después: se corren completos.
      update public.cohort_module_calendar
         set start_date = start_date + v_delta, end_date = end_date + v_delta
       where cohort_id = p_cohort and modalidad = 'presencial' and start_date >= v_original;
      -- 2) El tramo que la contiene y empezó antes: se parte en dos.
      for r in select * from public.cohort_module_calendar
                where cohort_id = p_cohort and modalidad = 'presencial'
                  and start_date < v_original and end_date >= v_original loop
        update public.cohort_module_calendar set end_date = v_original - 1 where id = r.id;
        insert into public.cohort_module_calendar (cohort_id, module_id, start_date, end_date, modalidad)
        values (r.cohort_id, r.module_id, v_original + v_delta, r.end_date + v_delta, r.modalidad);
      end loop;
      -- 3) Excepciones posteriores: se corren con su clase.
      delete from public.cohort_class_exceptions where cohort_id = p_cohort and original_date = v_original;
      update public.cohort_class_exceptions
         set original_date = original_date + v_delta,
             new_date = case when new_date is not null then new_date + v_delta end
       where cohort_id = p_cohort and original_date > v_original;
      -- 4) Otra hora o salón para la clase corrida: queda como excepción en su fecha nueva.
      if p_inicio is not null or p_fin is not null or p_room is not null then
        insert into public.cohort_class_exceptions (cohort_id, original_date, new_date, new_start, new_end, room_id, reason, created_by)
        values (p_cohort, v_nueva, v_nueva, p_inicio, p_fin, p_room, p_motivo, auth.uid())
        on conflict (cohort_id, original_date) do update
          set new_date = excluded.new_date, new_start = excluded.new_start, new_end = excluded.new_end,
              room_id = excluded.room_id, reason = excluded.reason;
      end if;
    else
      insert into public.cohort_class_exceptions (cohort_id, original_date, new_date, new_start, new_end, room_id, reason, created_by)
      values (p_cohort, v_original, v_nueva, p_inicio, p_fin, p_room, p_motivo, auth.uid())
      on conflict (cohort_id, original_date) do update
        set new_date = excluded.new_date, new_start = excluded.new_start, new_end = excluded.new_end,
            room_id = excluded.room_id, reason = excluded.reason, created_by = excluded.created_by;
    end if;

    -- Foto de después.
    select coalesce(jsonb_agg(jsonb_build_object('modulo', m.order_index || '. ' || m.name,
             'desde', k.start_date, 'hasta', k.end_date) order by k.start_date), '[]'::jsonb),
           max(k.end_date)
      into v_despues, v_fin_desp
      from public.cohort_module_calendar k join public.modules m on m.id = k.module_id
     where k.cohort_id = p_cohort and k.modalidad = 'presencial' and k.end_date >= v_original - 1;

    -- Clases que cambian de fecha (de la original en adelante).
    select count(*) into v_clases
      from public.fn_calendario_general(v_original, coalesce(v_fin_desp, v_nueva)) g
     where g.cohort_id = p_cohort;
    if not v_cadena then v_clases := 1; end if;

    -- Choques en la fecha nueva, con el estado ya aplicado.
    select g.hora_inicio, g.hora_fin, g.salon, g.profesores into v_ini, v_fin, v_salon, v_profes
      from public.fn_calendario_general(v_nueva, v_nueva) g
     where g.cohort_id = p_cohort limit 1;
    select coalesce(jsonb_agg(jsonb_build_object('corte', g.cohorte,
             'hora', to_char(g.hora_inicio, 'HH12:MI AM'),
             'motivo', case when g.salon is not null and g.salon = v_salon then 'mismo salón (' || g.salon || ')'
                            else 'mismo profesor' end)), '[]'::jsonb)
      into v_choques
      from public.fn_calendario_general(v_nueva, v_nueva) g
     where g.cohort_id <> p_cohort and v_ini is not null
       and g.hora_inicio < v_fin and v_ini < g.hora_fin
       and ((g.salon is not null and g.salon = v_salon)
            or exists (select 1 from unnest(string_to_array(coalesce(g.profesores, ''), ', ')) x
                        where x <> '' and x = any (string_to_array(coalesce(v_profes, ''), ', '))));

    if p_simular then
      raise exception using errcode = 'P0099', message = 'simulacion';
    end if;
  exception when sqlstate 'P0099' then
    null;  -- simulación: se deshace todo lo de este bloque, se quedan las variables
  end;

  if not p_simular then
    insert into public.notifications (profile_id, type, title, body, payload, channel)
    select destinatario, 'clase_movida',
           case when p_nueva is null then 'No hay clase el ' || to_char(p_fecha, 'DD/MM') else 'Tu clase cambió de fecha' end,
           case
             when p_nueva is null then 'La clase del ' || to_char(p_fecha, 'DD/MM') || ' pasa al ' || to_char(v_nueva, 'DD/MM')
                                       || ' y las siguientes se corren una semana.'
             when v_cadena then 'La clase del ' || to_char(p_fecha, 'DD/MM') || ' pasa al ' || to_char(v_nueva, 'DD/MM')
                                || '. Las siguientes también se corren.'
             else 'La clase del ' || to_char(p_fecha, 'DD/MM') || ' pasa al ' || to_char(v_nueva, 'DD/MM')
                  || coalesce(' a las ' || to_char(p_inicio, 'HH12:MI AM'), '') || '.'
           end || coalesce(' Motivo: ' || nullif(trim(p_motivo), '') || '.', ''),
           jsonb_build_object('cohort_id', p_cohort, 'fecha', v_nueva),
           'push'
      from (
        select s.id as destinatario from public.students s where s.cohort_id = p_cohort
        union
        select t.teacher_id from public.teacher_module_assignments t
         where t.cohort_id = p_cohort and t.module_id = v_mod
      ) d;
  end if;

  return jsonb_build_object(
    'corte', v_corte, 'cadena', v_cadena, 'clases', v_clases,
    'fecha_original', p_fecha, 'fecha_nueva', v_nueva, 'dias', v_delta,
    'antes', v_antes, 'despues', v_despues,
    'fin_antes', v_fin_antes, 'fin_despues', v_fin_desp,
    'choques', v_choques, 'guardado', not p_simular
  );
end $$;

revoke execute on function public.fn_mover_clase(uuid, date, date, time, time, uuid, text, boolean) from public, anon;
grant execute on function public.fn_mover_clase(uuid, date, date, time, time, uuid, text, boolean) to authenticated;

-- 234b (mismo día): el calendario del estudiante y del profesor (`fn_agenda_clases`,
-- migración 217) ponía TODOS los sábados por su cuenta y no conocía las
-- excepciones: una clase movida seguía en la fecha vieja y la reposición no
-- aparecía. Ahora usa la misma regla que el calendario general: días de clase
-- del corte dentro de los tramos presenciales, menos/más las excepciones. Si un
-- corte todavía no tiene calendario de módulos, se mantiene lo de antes (todos
-- los sábados con su módulo actual). Misma firma y mismas columnas.
create or replace function public.fn_agenda_clases(p_semanas integer default 8)
returns table(class_date date, hora text, modulo text, profesor text, salon text, cohort_id uuid, cohort_name text)
language sql stable security definer set search_path to 'public'
as $function$
  with yo as (select auth.uid() as id, (select auth_role()::text) as rol),
  visibles as (
    select c.* from public.cohorts c, yo
    where c.status = 'activa' and (
      (yo.rol = 'estudiante' and c.id = (select s.cohort_id from public.students s where s.id = yo.id))
      or (yo.rol = 'profesor' and (c.teacher_id = yo.id or exists (
            select 1 from public.teacher_module_assignments t where t.cohort_id = c.id and t.teacher_id = yo.id)))
      or yo.rol in ('admin', 'direccion_academica', 'super_admin')
    )
  ),
  rango as (
    select current_date as desde, current_date + greatest(p_semanas, 1) * 7 as hasta
  ),
  con_calendario as (
    select v.* from visibles v
     where exists (select 1 from public.cohort_module_calendar k where k.cohort_id = v.id and k.modalidad = 'presencial')
  ),
  normales as (
    select v.id as cohort_id, d::date as fecha, k.module_id
      from con_calendario v
      join public.cohort_module_calendar k on k.cohort_id = v.id and k.modalidad = 'presencial'
      cross join rango
      cross join lateral generate_series(greatest(k.start_date, rango.desde - 14), least(k.end_date, rango.hasta), interval '1 day') d
     where extract(dow from d)::smallint = any (coalesce(v.class_weekdays, array[6]::smallint[]))
  ),
  clases as (
    select n.cohort_id, n.fecha, n.module_id, null::time as ini, null::time as fin, null::uuid as room_id
      from normales n
     where not exists (select 1 from public.cohort_class_exceptions e
                        where e.cohort_id = n.cohort_id and e.original_date = n.fecha)
    union all
    select n.cohort_id, e.new_date, n.module_id, e.new_start, e.new_end, e.room_id
      from normales n
      join public.cohort_class_exceptions e
        on e.cohort_id = n.cohort_id and e.original_date = n.fecha and e.new_date is not null
    union all
    -- Cortes sin calendario de módulos: como antes, cada sábado con su módulo actual.
    select v.id, d::date, v.current_module_id, null::time, null::time, null::uuid
      from visibles v cross join rango
      cross join lateral generate_series(
        rango.desde + ((6 - extract(dow from rango.desde)::int + 7) % 7), rango.hasta, interval '7 days') d
     where not exists (select 1 from con_calendario cc where cc.id = v.id)
       and v.current_module_id is not null
  )
  select c.fecha,
         case when c.ini is not null
              then to_char(c.ini, 'FMHH12:MI') || ' ' || case when c.ini < '12:00' then 'a.m.' else 'p.m.' end
                   || coalesce(' – ' || to_char(c.fin, 'FMHH12:MI') || ' ' || case when c.fin < '12:00' then 'a.m.' else 'p.m.' end, '')
              else v.schedule end,
         m.name,
         coalesce(
           (select p.full_name from public.teacher_module_assignments t join public.profiles p on p.id = t.teacher_id
             where t.cohort_id = v.id and t.module_id = m.id order by t.assigned_at desc limit 1),
           (select p.full_name from public.profiles p where p.id = v.teacher_id)),
         coalesce((select r.nombre from public.rooms r where r.id = c.room_id),
                  (select r.nombre from public.cohort_room_days d join public.rooms r on r.id = d.room_id
                    where d.cohort_id = v.id and d.class_date <= c.fecha order by d.class_date desc limit 1)),
         v.id, v.name
    from clases c
    join visibles v on v.id = c.cohort_id
    join public.modules m on m.id = c.module_id
    cross join rango
   where c.fecha between rango.desde and rango.hasta
   order by c.fecha, v.name;
$function$;
