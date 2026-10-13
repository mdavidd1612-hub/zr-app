-- 162: aclaración del coordinador (12 oct. 2026): cuando un módulo ya terminó, tanto
-- Dirección Académica como el profesor de ese módulo pueden seguir registrando y
-- calificando evaluaciones, cargando notas y subiendo material. Lo único que se
-- cierra es un módulo que AÚN NO EMPIEZA.
--
-- Reemplaza la regla de la 150/161: ya no hay bloqueo por módulo terminado, ni
-- siquiera con las notas validadas (si el profesor cambia algo ya validado, el
-- envío se reabre y vuelve a enviarlo, como siempre).
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

  v_estado := public.estado_modulo_cohorte(v_cohort, v_module);
  if v_estado = 'no_empezo' then
    raise exception 'Este módulo todavía no empieza: aún no se pueden cargar notas.';
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

-- Subir material: módulo en curso, sin calendario o ya terminado; no uno que no empieza.
create or replace function public.profesor_dicta(p_cohort uuid, p_module uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_cohort is not null
     and exists (
           select 1 from public.mis_asignaciones_docente() x
            where x.module_id = p_module and x.cohort_id = p_cohort
         )
     and public.estado_modulo_cohorte(p_cohort, p_module) in ('en_curso', 'sin_calendario', 'terminado');
$$;
