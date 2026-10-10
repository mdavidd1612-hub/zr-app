-- =============================================================================
-- ZR APP · MIGRACIÓN 139 · Puntualidad progresiva y editable (SOLO STAGING)
-- =============================================================================
-- Prueba del 10 oct. 2026: "le puse que vinieron, asistieron, y no apareció
-- nada". Causa: la puntualidad solo se calculaba cuando la sesión estaba
-- CERRADA, y casi nadie cierra las sesiones. Cambios pedidos por el
-- coordinador:
--   1. La puntualidad se calcula sola y SE VA MOSTRANDO sábado a sábado, con
--      el avance ("llevas 3 de 5 sábados").
--   2. El profesor (o Dirección) también puede escribirla a mano; si la borra,
--      vuelve a ser automática.
--
-- Qué sábados cuentan (para cada estudiante):
--   * Si el estudiante TIENE asistencia en la sesión (a tiempo o tarde): cuenta
--     desde el momento en que se registra (tarde resta 0,5).
--   * Si NO tiene asistencia: la falta solo cuenta cuando la sesión se cerró o
--     el sábado ya pasó (no se castiga a nadie mientras la clase sigue).
-- Fórmula igual que antes: 20, -3 falta sin justificar, -2 falta justificada,
-- -0,5 llegada tarde, mínimo 0.
-- =============================================================================

alter table public.module_enrollments
  add column puntualidad_manual numeric(4,2) check (puntualidad_manual between 0 and 20),
  add column puntualidad_sabados int,
  add column puntualidad_sabados_total int;

comment on column public.module_enrollments.puntualidad_manual is
  'Puntualidad escrita a mano por el profesor o Dirección. Si es null, manda el cálculo automático.';

create or replace function public.fn_recalc_puntualidad(p_student_id uuid, p_module_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy      date := (now() at time zone 'America/Caracas')::date;
  v_cohorte  uuid;
  v_manual   numeric;
  v_contados int;
  v_auto     numeric;
  v_total    int;
begin
  select cohort_id into v_cohorte from public.students where id = p_student_id;
  select puntualidad_manual into v_manual
  from public.module_enrollments where student_id = p_student_id and module_id = p_module_id;

  with ses as (
    select cs.id, cs.session_date, cs.closed_at
    from public.class_sessions cs
    where cs.cohort_id = v_cohorte and cs.module_id = p_module_id
      and cs.status not in ('cancelada', 'reprogramada')
  ),
  det as (
    select ae.id as ae_id, ae.status as ae_status, aj.id as aj_id,
           (ses.closed_at is not null or ses.session_date < v_hoy) as resuelta
    from ses
    left join public.attendance_events ae on ae.session_id = ses.id and ae.student_id = p_student_id
    left join public.attendance_justifications aj on aj.session_id = ses.id and aj.student_id = p_student_id
  )
  select
    count(*) filter (where ae_id is not null or resuelta),
    greatest(0, 20
      - 3   * count(*) filter (where ae_id is null and aj_id is null and resuelta)
      - 2   * count(*) filter (where ae_id is null and aj_id is not null and resuelta)
      - 0.5 * count(*) filter (where ae_status = 'tarde'))
  into v_contados, v_auto
  from det;

  -- Sábados que tiene el módulo: del calendario de la cohorte; si no hay, la
  -- duración del módulo.
  select count(*) into v_total
  from public.cohort_module_calendar k
  cross join lateral generate_series(k.start_date, k.end_date, interval '1 day') d
  where k.cohort_id = v_cohorte and k.module_id = p_module_id and extract(dow from d) = 6;
  if v_total = 0 then
    select duration_weeks into v_total from public.modules where id = p_module_id;
  end if;

  update public.module_enrollments
  set participation_score = coalesce(v_manual, case when v_contados > 0 then v_auto end),
      puntualidad_sabados = v_contados,
      puntualidad_sabados_total = v_total
  where student_id = p_student_id and module_id = p_module_id;
end;
$$;

revoke execute on function public.fn_recalc_puntualidad(uuid, uuid) from public, anon, authenticated;

-- Escribir (o borrar) la puntualidad a mano recalcula al instante.
create or replace function public.fn_trg_puntualidad_manual()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.puntualidad_manual is distinct from old.puntualidad_manual then
    perform public.fn_recalc_puntualidad(new.student_id, new.module_id);
  end if;
  return null;
end;
$$;

revoke execute on function public.fn_trg_puntualidad_manual() from public, anon, authenticated;

create trigger trg_puntualidad_manual
  after update of puntualidad_manual on public.module_enrollments
  for each row execute function public.fn_trg_puntualidad_manual();

-- El profesor no toca la puntualidad de notas ya enviadas, igual que el resto.
drop trigger if exists trg_bloquear_notas_enviadas_participacion on public.module_enrollments;
create trigger trg_bloquear_notas_enviadas_participacion
  before update of class_participation_score, puntualidad_manual on public.module_enrollments
  for each row execute function public.fn_bloquear_notas_enviadas();

-- Todas las noches: los sábados que ya pasaron cuentan las faltas aunque
-- nadie haya cerrado la sesión.
create or replace function public.fn_recalc_puntualidad_todos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
begin
  for e in
    select me.student_id, me.module_id
    from public.module_enrollments me
    join public.cohorts c on c.id = me.cohort_id
    where c.status = 'activa'
  loop
    perform public.fn_recalc_puntualidad(e.student_id, e.module_id);
  end loop;
end;
$$;

revoke execute on function public.fn_recalc_puntualidad_todos() from public, anon, authenticated;

select cron.schedule(
  'recalcular-puntualidad-nocturno',
  '40 4 * * *',
  $$ select public.fn_recalc_puntualidad_todos(); $$
);

-- Relleno inicial con la regla nueva.
select public.fn_recalc_puntualidad_todos();
