-- 146_direccion_publica_sus_cambios.sql
-- Pedido del coordinador (oct. 2026): cuando Dirección Académica modifica una
-- nota, el cambio NO le llega de una vez al estudiante. La evaluación que ella
-- toca queda "por validar" y solo se vuelve a ver cuando ella pulsa
-- "Validar y publicar" (así, si se equivoca, el estudiante no ve el error).

create or replace function public.fn_bloquear_notas_enviadas()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_student uuid;
  v_module uuid;
  v_cohort uuid;
  v_def uuid;
  v_status text;
  v_rol text := (select public.auth_role());
begin
  if v_rol is null then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'manual_exam_scores' then
    v_student := coalesce(new.student_id, old.student_id);
    v_def := coalesce(new.definition_id, old.definition_id);
    select module_id into v_module from public.manual_exam_definitions where id = v_def;
  else
    v_student := coalesce(new.student_id, old.student_id);
    v_module := coalesce(new.module_id, old.module_id);
  end if;
  select cohort_id into v_cohort from public.students where id = v_student;

  -- Dirección / admin: el cambio queda por validar hasta que ella lo publique.
  if v_rol <> 'profesor' then
    if v_def is not null then
      delete from public.grade_validated_evals where cohort_id = v_cohort and definition_id = v_def;
    end if;
    return coalesce(new, old);
  end if;

  select status into v_status from public.grade_submissions
  where cohort_id = v_cohort and module_id = v_module;

  if v_status = 'enviado' then
    raise exception 'Las notas están enviadas y esperan la validación de Dirección Académica. Pide que te las devuelvan para corregir.';
  elsif v_status = 'validado' then
    delete from public.grade_submissions where cohort_id = v_cohort and module_id = v_module;
  end if;

  if v_def is not null then
    delete from public.grade_validated_evals where cohort_id = v_cohort and definition_id = v_def;
  end if;
  return coalesce(new, old);
end;
$$;

-- Validar y publicar lo que Dirección corrigió (sin necesidad de un envío del profesor).
create or replace function public.publicar_cambios(p_cohort uuid, p_module uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select public.is_academico()) then
    raise exception 'Solo Dirección Académica puede publicar notas.';
  end if;

  insert into public.grade_validated_evals (cohort_id, definition_id, module_id, validated_by)
  select p_cohort, d.id, d.module_id, auth.uid()
  from public.manual_exam_definitions d
  where d.module_id = p_module
  on conflict (cohort_id, definition_id) do nothing;

  update public.grade_submissions
  set status = 'validado', validated_by = auth.uid(), validated_at = now()
  where cohort_id = p_cohort and module_id = p_module and status = 'enviado';
end;
$$;
grant execute on function public.publicar_cambios(uuid, uuid) to authenticated;
