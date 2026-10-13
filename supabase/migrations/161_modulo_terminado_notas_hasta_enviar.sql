-- 161: un módulo terminado NO bloquea al profesor de golpe. Hallazgo en producción
-- (12 oct. 2026): el módulo 1 (Isaac) terminó el 19-sep y sus notas aún no se
-- habían enviado; la regla de la 150 le quitaba la edición antes de poder
-- cargarlas y enviarlas.
--
-- Ahora, con el módulo terminado, el profesor sigue pudiendo cargar y enviar sus
-- notas HASTA que Dirección las valida. Ya validadas, solo Dirección corrige.
-- (Con las notas enviadas esperando validación ya se bloqueaba, igual que antes.)
-- Un módulo que aún no empieza sigue sin permitir cargar notas.
create or replace function public.fn_bloquear_notas_enviadas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_module uuid;
  v_cohort uuid;
  v_def uuid;
  v_status text;
  v_estado text;
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

  if v_rol <> 'profesor' then
    if v_def is not null then
      delete from public.grade_validated_evals where cohort_id = v_cohort and definition_id = v_def;
    end if;
    return coalesce(new, old);
  end if;

  select status into v_status from public.grade_submissions
  where cohort_id = v_cohort and module_id = v_module;

  v_estado := public.estado_modulo_cohorte(v_cohort, v_module);
  if v_estado = 'no_empezo' then
    raise exception 'Este módulo todavía no empieza: aún no se pueden cargar notas.';
  elsif v_estado = 'terminado' and v_status = 'validado' then
    raise exception 'Este módulo ya terminó y sus notas están validadas: solo Dirección Académica puede cambiarlas.';
  end if;

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
