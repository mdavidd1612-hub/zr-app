-- Resumen semanal por notificacion (18-nov-2026) + registro liviano de errores.
-- Reemplaza la idea del correo de los lunes: cada lunes 7:00 (Caracas) Direccion
-- Academica y super_admin reciben una notificacion con como va lo academico; el
-- super_admin ademas recibe la salud del sistema (errores, avisos sin enviar, espacio).

-- 1) Errores de la app (los reporta el navegador, ver components/ui/ReportarErrores.tsx)
create table if not exists public.app_errors (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users(id) on delete set null,
  ruta       text,
  mensaje    text not null,
  version    text
);
create index if not exists idx_app_errors_fecha on public.app_errors (created_at desc);
alter table public.app_errors enable row level security;
create policy "autenticados: reportar errores" on public.app_errors for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "super: ver errores" on public.app_errors for select to authenticated
  using ((select public.is_super()));

-- 2) Nuevo tipo de notificacion
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'examen_habilitado','nota_publicada','consentimiento_pendiente','feedback_disponible','profesor_pendiente',
  'material_nuevo','modulo_cambiado','hora_clase','hora_refrigerio','notas_registradas','recordatorio_pago',
  'recordatorio_notas','duda_nueva','duda_respondida','tarea_nueva','tarea_calificada','material_aprobado',
  'material_rechazado','examen_por_corregir',
  'tarea_entregada','material_por_aprobar','unidad_desbloqueada','unidad_abierta','recordatorio_entrega',
  'resumen_semanal'
]::text[]));

-- 3) El resumen
create or replace function public.fn_resumen_semanal()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_est int; v_act int; v_pct_act numeric;
  v_dudas_sin int; v_horas numeric;
  v_x numeric; v_y numeric; v_tareas numeric; v_dominio numeric;
  v_asist int; v_desercion numeric;
  v_verdes int := 0; v_medidas int := 0;
  v_acad text; v_titulo text; v_sis text;
  v_err int; v_err_msg text; v_push_pend int; v_mb numeric; v_con_push int;
  v_p record;
begin
  select count(*) into v_est from students s join cohorts c on c.id = s.cohort_id and c.status = 'activa';
  select count(*) into v_act from students s join cohorts c on c.id = s.cohort_id and c.status = 'activa'
    join auth.users u on u.id = s.id where u.last_sign_in_at >= now() - interval '7 days';
  v_pct_act := case when v_est > 0 then round(100.0 * v_act / v_est) end;

  select count(*) into v_dudas_sin from doubts d where d.status = 'abierta' and d.created_at < now() - interval '3 days'
    and not exists (select 1 from doubt_responses r where r.doubt_id = d.id);
  select round((extract(epoch from avg(r.created_at - d.created_at)) / 3600)::numeric, 0)
    into v_horas from doubts d join lateral (select min(created_at) created_at from doubt_responses where doubt_id = d.id) r on r.created_at is not null;

  select count(*) filter (where sb.submitted_at <= a.due_at), count(*) into v_x, v_y
    from submissions sb join assignments a on a.id = sb.assignment_id where a.due_at is not null;
  v_tareas := case when v_y > 0 then round(100.0 * v_x / v_y) end;

  select round(100.0 * count(*) filter (where a.total_score >= e.passing_score) / nullif(count(*), 0), 0)
    into v_dominio from exam_attempts a join exams e on e.id = a.exam_id where a.attempt_number = 1 and a.status = 'calificado';

  select count(*) into v_asist from attendance_events where scanned_at >= now() - interval '7 days' and status in ('presente','tarde');
  select round(100.0 * count(*) filter (where p.status <> 'activo') / nullif(count(*), 0), 0)
    into v_desercion from students s join profiles p on p.id = s.id;

  -- Cuantas metas se cumplen (solo las que tienen dato)
  if v_pct_act is not null then v_medidas := v_medidas + 1; if v_pct_act >= 80 then v_verdes := v_verdes + 1; end if; end if;
  v_medidas := v_medidas + 1; if v_dudas_sin = 0 then v_verdes := v_verdes + 1; end if;
  if v_horas is not null then v_medidas := v_medidas + 1; if v_horas <= 48 then v_verdes := v_verdes + 1; end if; end if;
  if v_tareas is not null then v_medidas := v_medidas + 1; if v_tareas >= 80 then v_verdes := v_verdes + 1; end if; end if;
  if v_dominio is not null then v_medidas := v_medidas + 1; if v_dominio >= 70 then v_verdes := v_verdes + 1; end if; end if;
  if v_desercion is not null then v_medidas := v_medidas + 1; if v_desercion <= 10 then v_verdes := v_verdes + 1; end if; end if;

  v_titulo := 'Resumen de la semana: ' || v_verdes || ' de ' || v_medidas || ' metas en verde';
  v_acad := 'Entraron ' || v_act || ' de ' || v_est || ' estudiantes (' || coalesce(v_pct_act::text, '-') || '%, meta 80%). '
         || 'Dudas sin responder (+3 dias): ' || v_dudas_sin || '. '
         || 'Respuesta a dudas: ' || coalesce(v_horas::text || ' h', 'sin datos') || ' (meta 48 h). '
         || 'Tareas a tiempo: ' || coalesce(v_tareas::text || '%', 'sin datos') || '. '
         || 'Dominio al 1.er intento: ' || coalesce(v_dominio::text || '%', 'sin datos') || '. '
         || 'Asistencias de la semana: ' || v_asist || '. '
         || 'Desercion: ' || coalesce(v_desercion::text || '%', 'sin datos') || '.';

  -- Sistema (solo super_admin)
  select count(*) into v_err from app_errors where created_at >= now() - interval '7 days';
  select left(mensaje, 80) into v_err_msg from (
    select mensaje, count(*) c from app_errors where created_at >= now() - interval '7 days' group by mensaje order by c desc limit 1) q;
  select count(*) into v_push_pend from notifications where channel = 'push' and sent_at is null and created_at >= now() - interval '2 days';
  select round(coalesce(sum((metadata->>'size')::numeric), 0) / 1048576.0, 0) into v_mb from storage.objects;
  select count(distinct profile_id) into v_con_push from push_subscriptions;
  v_sis := ' Sistema: ' || v_err || ' errores en la semana'
        || case when v_err > 0 and v_err_msg is not null then ' (el mas repetido: "' || v_err_msg || '")' else '' end
        || '. Avisos sin enviar: ' || v_push_pend || '. Con avisos activados: ' || v_con_push || ' personas. Espacio usado: ' || v_mb || ' MB.';

  for v_p in select id, role from profiles where role in ('direccion_academica', 'super_admin') and status = 'activo' loop
    insert into notifications (profile_id, type, title, body, payload, channel)
    values (v_p.id, 'resumen_semanal', v_titulo,
            v_acad || case when v_p.role = 'super_admin' then v_sis else '' end,
            jsonb_build_object('ruta', '/monitoreo'), 'push');
  end loop;
end $$;

revoke execute on function public.fn_resumen_semanal() from anon, authenticated, public;

-- Lunes 7:00 a.m. hora de Caracas (UTC-4) = 11:00 UTC
select cron.schedule('resumen-semanal-lunes', '0 11 * * 1', 'select public.fn_resumen_semanal();');
