-- =============================================================================
-- ZR APP · MIGRACIÓN 134 · Un solo aviso a Dirección cuando el profesor ENVÍA las notas
-- =============================================================================
-- La migración 108 avisaba a Dirección Académica y super_admin cada vez que se
-- guardaba (o corregía) la nota de UN estudiante en UNA evaluación: con una
-- cohorte de 20 y 3 evaluaciones eran 60+ avisos por persona. Con el flujo de
-- envío y validación (migración 126) el aviso útil es uno: "el profesor envió
-- las notas del módulo, falta validar". Se quita el disparador por nota y el
-- aviso sale desde enviar_notas().
-- =============================================================================

drop trigger if exists trg_notify_notas_examen_manual on public.manual_exam_scores;

create or replace function public.enviar_notas(p_cohort uuid, p_module uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohorte text;
  v_modulo text;
begin
  if not (select public.teaches_cohort(p_cohort)) then
    raise exception 'No tienes a cargo esta cohorte.';
  end if;
  if (select public.auth_role()) not in ('profesor', 'direccion_academica', 'super_admin', 'admin') then
    raise exception 'Solo el personal académico puede enviar notas.';
  end if;
  if exists (select 1 from public.grade_submissions where cohort_id = p_cohort and module_id = p_module and status = 'validado') then
    raise exception 'Estas notas ya fueron validadas.';
  end if;

  insert into public.grade_submissions (cohort_id, module_id, status, submitted_by)
  values (p_cohort, p_module, 'enviado', auth.uid())
  on conflict (cohort_id, module_id) do update
    set status = 'enviado', submitted_by = auth.uid(), submitted_at = now(),
        validated_by = null, validated_at = null;

  select name into v_cohorte from public.cohorts where id = p_cohort;
  select name into v_modulo from public.modules where id = p_module;

  insert into public.notifications (profile_id, type, title, body, payload)
  select prof.id,
         'notas_registradas',
         'Notas por validar',
         'El profesor envió las notas de ' || coalesce(v_cohorte, 'una cohorte') || ' · ' || coalesce(v_modulo, 'módulo') || '. Falta tu validación.',
         jsonb_build_object('cohort_id', p_cohort, 'module_id', p_module)
  from public.profiles prof
  where prof.role in ('direccion_academica', 'super_admin');
end;
$$;
