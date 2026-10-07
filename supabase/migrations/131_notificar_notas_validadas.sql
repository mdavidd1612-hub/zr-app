-- =============================================================================
-- ZR APP · MIGRACIÓN 131 · Avisar al estudiante cuando se validan sus notas
-- =============================================================================
-- Al validar Dirección Académica las notas de un módulo (migración 126), cada
-- estudiante de la cohorte recibe una notificación 'nota_publicada' (tipo que
-- ya existía en el catálogo). Sin esto el estudiante tenía que entrar a mirar.
-- =============================================================================

create or replace function public.validar_notas(p_cohort uuid, p_module uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modulo text;
begin
  if not (select public.is_academico()) then
    raise exception 'Solo Dirección Académica puede validar notas.';
  end if;

  update public.grade_submissions
  set status = 'validado', validated_by = auth.uid(), validated_at = now()
  where cohort_id = p_cohort and module_id = p_module and status = 'enviado';

  if not found then
    raise exception 'No hay notas enviadas para validar.';
  end if;

  select name into v_modulo from public.modules where id = p_module;

  insert into public.notifications (profile_id, type, title, body, payload)
  select s.id,
         'nota_publicada',
         'Ya puedes ver tus notas',
         'Se publicaron tus notas de "' || coalesce(v_modulo, 'tu módulo') || '".',
         jsonb_build_object('module_id', p_module)
  from public.students s
  where s.cohort_id = p_cohort;
end;
$$;
