-- Panel de monitoreo del super admin (18-nov-2026): una sola funcion que calcula
-- las metricas del documento maestro (§7) con los datos que ya existen, mas uso
-- de la app, Aula Virtual y salud tecnica. Solo lectura, solo super_admin.
-- Cada metrica: clave, grupo, valor (null = sin datos), meta, si mas alto es
-- mejor, y una serie de las ultimas 8 semanas cuando tiene sentido.
-- Nunca se calcula en el navegador (regla §6.2): aqui se calcula, la pantalla solo pinta.

create or replace function public.fn_metricas_app()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_res jsonb := '[]'::jsonb;
  v_est int; v_act7 int; v_sin7 int; v_sin14 int;
  v_asist numeric; v_x numeric; v_y numeric;
  v_semanas date[];
  v_serie jsonb;
begin
  if (select auth_role()) is distinct from 'super_admin' then
    raise exception 'Solo super_admin';
  end if;

  select array_agg((date_trunc('week', now()) - (n || ' weeks')::interval)::date order by n desc)
    into v_semanas from generate_series(0, 7) n;

  select count(*) into v_est from students s join cohorts c on c.id = s.cohort_id and c.status = 'activa';

  -- Actividad = entro a la app (auth) en los ultimos N dias
  select count(*) filter (where u.last_sign_in_at >= now() - interval '7 days'),
         count(*) filter (where coalesce(u.last_sign_in_at, 'epoch') < now() - interval '7 days'),
         count(*) filter (where coalesce(u.last_sign_in_at, 'epoch') < now() - interval '14 days')
    into v_act7, v_sin7, v_sin14
    from students s join cohorts c on c.id = s.cohort_id and c.status = 'activa'
    join auth.users u on u.id = s.id;

  -- ===== USO DE LA APP =====
  v_res := v_res || jsonb_build_array(
    jsonb_build_object('clave','activos7','grupo','Uso de la app','nombre','Estudiantes que entraron esta semana','valor',
      case when v_est > 0 then round(100.0 * v_act7 / v_est, 0) end,'unidad','%','meta',80,'mejor','alto',
      'detalle', v_act7 || ' de ' || v_est || ' estudiantes'),
    jsonb_build_object('clave','sin14','grupo','Uso de la app','nombre','Estudiantes sin entrar en 14 días','valor',v_sin14,'unidad','','meta',0,'mejor','bajo',
      'detalle','Con ellos hay que hablar'),
    jsonb_build_object('clave','push','grupo','Uso de la app','nombre','Personas con avisos al teléfono activados','valor',
      (select round(100.0 * count(distinct profile_id) / nullif((select count(*) from profiles where status = 'activo'), 0), 0) from push_subscriptions),
      'unidad','%','meta',70,'mejor','alto','detalle', (select count(distinct profile_id) from push_subscriptions) || ' personas'),
    jsonb_build_object('clave','leidas','grupo','Uso de la app','nombre','Notificaciones leídas','valor',
      (select round(100.0 * count(*) filter (where read_at is not null) / nullif(count(*), 0), 0) from notifications where created_at >= now() - interval '30 days'),
      'unidad','%','meta',60,'mejor','alto','detalle','Últimos 30 días')
  );

  -- ===== AULA VIRTUAL =====
  select jsonb_agg(coalesce(n, 0) order by w) into v_serie from (
    select w, (select count(*) from material_progress m where m.completed_at >= w and m.completed_at < w + 7) n
      from unnest(v_semanas) w) q;
  v_res := v_res || jsonb_build_array(jsonb_build_object('clave','material','grupo','Aula Virtual','nombre','Materiales completados por semana',
    'valor',(select count(*) from material_progress where completed_at >= date_trunc('week', now())),'unidad','','meta',null,'mejor','alto',
    'detalle','Esta semana','serie',v_serie));

  select jsonb_agg(coalesce(n, 0) order by w) into v_serie from (
    select w, (select count(*) from submissions s where s.submitted_at >= w and s.submitted_at < w + 7) n from unnest(v_semanas) w) q;
  select count(*) into v_x from submissions sb join assignments a on a.id = sb.assignment_id where a.due_at is not null and sb.submitted_at <= a.due_at;
  select count(*) into v_y from submissions sb join assignments a on a.id = sb.assignment_id where a.due_at is not null;
  v_res := v_res || jsonb_build_array(jsonb_build_object('clave','tareas','grupo','Aula Virtual','nombre','Tareas entregadas a tiempo',
    'valor',case when v_y > 0 then round(100.0 * v_x / v_y, 0) end,'unidad','%','meta',80,'mejor','alto',
    'detalle', v_y || ' entregas con fecha límite','serie',v_serie));

  select jsonb_agg(coalesce(n, 0) order by w) into v_serie from (
    select w, (select count(*) from exam_attempts e where e.submitted_at >= w and e.submitted_at < w + 7) n from unnest(v_semanas) w) q;
  v_res := v_res || jsonb_build_array(jsonb_build_object('clave','examenes','grupo','Aula Virtual','nombre','Exámenes presentados por semana',
    'valor',(select count(*) from exam_attempts where submitted_at >= date_trunc('week', now())),'unidad','','meta',null,'mejor','alto',
    'detalle','Esta semana','serie',v_serie));

  select jsonb_agg(coalesce(n, 0) order by w) into v_serie from (
    select w, (select count(*) from doubts d where d.created_at >= w and d.created_at < w + 7) n from unnest(v_semanas) w) q;
  v_res := v_res || jsonb_build_array(
    jsonb_build_object('clave','dudas','grupo','Aula Virtual','nombre','Dudas enviadas por semana',
      'valor',(select count(*) from doubts where created_at >= date_trunc('week', now())),'unidad','','meta',null,'mejor','alto','detalle','Esta semana','serie',v_serie),
    jsonb_build_object('clave','dudas_sin','grupo','Aula Virtual','nombre','Dudas sin responder (más de 3 días)',
      'valor',(select count(*) from doubts d where d.status = 'abierta' and d.created_at < now() - interval '3 days'
                 and not exists (select 1 from doubt_responses r where r.doubt_id = d.id)),'unidad','','meta',0,'mejor','bajo','detalle','Meta: cero'),
    jsonb_build_object('clave','dudas_tiempo','grupo','Aula Virtual','nombre','Tiempo promedio de respuesta a una duda',
      'valor',(select round((extract(epoch from avg(r.created_at - d.created_at)) / 3600)::numeric, 1)
                 from doubts d join lateral (select min(created_at) created_at from doubt_responses where doubt_id = d.id) r on r.created_at is not null),
      'unidad','h','meta',48,'mejor','bajo','detalle','Horas hasta la primera respuesta')
  );

  -- ===== INDICADORES DEL MODELO (documento maestro §7.3) =====
  -- 1. Completitud: estudiantes con actividad (material o entrega) en los ultimos 7 dias
  select count(distinct s.id) into v_x from students s join cohorts c on c.id = s.cohort_id and c.status = 'activa'
   where exists (select 1 from material_progress m where m.student_id = s.id and m.last_viewed_at >= now() - interval '7 days')
      or exists (select 1 from submissions b where b.student_id = s.id and b.submitted_at >= now() - interval '7 days');
  v_res := v_res || jsonb_build_array(
    jsonb_build_object('clave','i1','grupo','Indicadores del modelo','nombre','1 · Completitud antes del sábado (aprox.)',
      'valor',case when v_est > 0 then round(100.0 * v_x / v_est, 0) end,'unidad','%','meta',70,'mejor','alto',
      'detalle','Estudiantes con actividad esta semana'),
    jsonb_build_object('clave','i2','grupo','Indicadores del modelo','nombre','2 · Señalados por no prepararse',
      'valor',case when v_est > 0 then v_est - v_x end,'unidad','','meta',null,'mejor','bajo','detalle','Sin actividad en 7 días; no se les prohíbe entrar')
  );

  -- 3 y 4. Dominio al primer intento / intentos hasta el dominio
  select round(100.0 * count(*) filter (where a.total_score >= e.passing_score) / nullif(count(*), 0), 0)
    into v_x from exam_attempts a join exams e on e.id = a.exam_id
   where a.attempt_number = 1 and a.status = 'calificado';
  select round(avg(m)::numeric, 1) into v_y from (
    select min(a.attempt_number) m from exam_attempts a join exams e on e.id = a.exam_id
     where a.status = 'calificado' and a.total_score >= e.passing_score group by a.student_id, a.exam_id) q;
  v_res := v_res || jsonb_build_array(
    jsonb_build_object('clave','i3','grupo','Indicadores del modelo','nombre','3 · Dominio al primer intento',
      'valor',v_x,'unidad','%','meta',70,'mejor','alto','detalle','Exámenes calificados, 1.er intento'),
    jsonb_build_object('clave','i4','grupo','Indicadores del modelo','nombre','4 · Intentos hasta aprobar',
      'valor',v_y,'unidad','','meta',2,'mejor','bajo','detalle','Promedio entre quienes aprobaron')
  );

  -- 5, 6, 7: dependen de la evaluacion practica / retencion, aun no construidas
  v_res := v_res || jsonb_build_array(
    jsonb_build_object('clave','i5','grupo','Indicadores del modelo','nombre','5 · Fallo en ítems críticos','valor',null,'unidad','','meta',null,'mejor','bajo','detalle','Falta la evaluación práctica digital (Sprint 6)'),
    jsonb_build_object('clave','i6','grupo','Indicadores del modelo','nombre','6 · Nivel de defensa técnica','valor',null,'unidad','','meta',null,'mejor','alto','detalle','Falta la evaluación práctica digital (Sprint 6)'),
    jsonb_build_object('clave','i7','grupo','Indicadores del modelo','nombre','7 · Retención diferida','valor',null,'unidad','','meta',null,'mejor','alto','detalle','Falta el cuestionario de la semana 6')
  );

  -- 8. Asistencia y desercion
  select count(*) filter (where e.status in ('presente','tarde')), count(*)
    into v_x, v_y from attendance_events e;
  select jsonb_agg(coalesce(n, 0) order by w) into v_serie from (
    select w, (select count(*) from attendance_events e where e.scanned_at >= w and e.scanned_at < w + 7 and e.status in ('presente','tarde')) n
      from unnest(v_semanas) w) q;
  v_res := v_res || jsonb_build_array(
    jsonb_build_object('clave','i8a','grupo','Indicadores del modelo','nombre','8 · Asistencias registradas por semana',
      'valor',(select count(*) from attendance_events where scanned_at >= date_trunc('week', now()) and status in ('presente','tarde')),
      'unidad','','meta',null,'mejor','alto','detalle','Esta semana','serie',v_serie),
    jsonb_build_object('clave','i8b','grupo','Indicadores del modelo','nombre','8 · Deserción',
      'valor',(select round(100.0 * count(*) filter (where p.status <> 'activo') / nullif(count(*), 0), 0)
                 from students s join profiles p on p.id = s.id),'unidad','%','meta',10,'mejor','bajo','detalle','Estudiantes que ya no están activos')
  );

  -- ===== SALUD TECNICA =====
  v_res := v_res || jsonb_build_array(
    jsonb_build_object('clave','push_pend','grupo','Salud técnica','nombre','Avisos push sin enviar',
      'valor',(select count(*) from notifications where channel = 'push' and sent_at is null and created_at >= now() - interval '2 days'),
      'unidad','','meta',0,'mejor','bajo','detalle','Creados en los últimos 2 días'),
    jsonb_build_object('clave','storage','grupo','Salud técnica','nombre','Archivos guardados (Storage)',
      'valor',(select round(coalesce(sum((metadata->>'size')::numeric), 0) / 1048576.0, 0) from storage.objects),
      'unidad','MB','meta',null,'mejor','bajo','detalle','Espacio ocupado por material y entregas')
  );

  return jsonb_build_object('generado', now(), 'metricas', v_res);
end $$;

revoke execute on function public.fn_metricas_app() from public, anon;
grant execute on function public.fn_metricas_app() to authenticated;
