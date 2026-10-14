-- =============================================================================
-- ZR APP · MIGRACIÓN 167 · El profesor publica sus notas directo, sin pasar por
-- Dirección Académica — con una semana de gracia para corregir tras terminar el módulo
-- =============================================================================
-- Reunión del coordinador con Dirección Académica (13 oct. 2026):
--   1. El profesor ya no "envía y espera validación". Él mismo publica, en dos
--      pasos (revisar y publicar) — el estudiante la ve de inmediato.
--   2. Mientras el módulo está en curso, el profesor corrige sin límite. Al
--      terminar el módulo, tiene UNA SEMANA más para corregir errores. Pasada esa
--      semana, esa nota la corrige solo Dirección Académica (reemplaza la regla
--      "sin límite" de la migración 162).
-- Dirección Académica conserva su pantalla (notas-academicas) para corregir
-- cualquier nota en cualquier momento — eso no cambia.
-- =============================================================================

-- ¿Puede el profesor cargar o publicar notas de este (programa, módulo) ahora
-- mismo? En curso o sin calendario: sí, siempre. Terminado: solo dentro de los 7
-- días siguientes a la fecha de fin del módulo en el calendario de esa cohorte.
create or replace function public.profesor_puede_editar_notas(p_cohort uuid, p_module uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.teaches_cohort_module(p_cohort, p_module)
     and case public.estado_modulo_cohorte(p_cohort, p_module)
           when 'no_empezo' then false
           when 'terminado' then exists (
             select 1 from public.cohort_module_calendar k
             where k.cohort_id = p_cohort and k.module_id = p_module
               and k.end_date >= (now() at time zone 'America/Caracas')::date - 7
           )
           else true
         end;
$$;
grant execute on function public.profesor_puede_editar_notas(uuid, uuid) to authenticated;

-- Reemplaza la regla de módulo terminado de la migración 162 por la ventana de
-- una semana. El resto (módulo que no empieza, notas enviadas/validadas que se
-- reabren al editar) sigue igual.
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

  if not public.profesor_puede_editar_notas(v_cohort, v_module) then
    if public.estado_modulo_cohorte(v_cohort, v_module) = 'no_empezo' then
      raise exception 'Este módulo todavía no empieza: aún no se pueden cargar notas.';
    else
      raise exception 'Ya pasó la semana para corregir este módulo: pídele a Dirección Académica que la corrija.';
    end if;
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

-- El profesor publica directo: lo que antes hacía "validar_notas" de Dirección
-- Académica, pero lo llama el profesor del módulo, sin paso de "enviado" de por
-- medio. Respeta la misma ventana de edición (profesor_puede_editar_notas) y que
-- los porcentajes sumen 100 %.
create or replace function public.publicar_notas_profesor(p_cohort uuid, p_module uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suma numeric;
  v_cohorte text;
  v_modulo text;
begin
  if (select public.auth_role()) <> 'profesor' then
    raise exception 'Solo el profesor publica sus notas desde aquí.';
  end if;
  if not public.profesor_puede_editar_notas(p_cohort, p_module) then
    raise exception 'Ya no puedes publicar este módulo: pídele a Dirección Académica que lo corrija.';
  end if;

  select coalesce(sum(weight_pct), 0) into v_suma from public.manual_exam_definitions where module_id = p_module;
  if v_suma <> 100 then
    raise exception 'Los porcentajes de las evaluaciones del módulo suman % %% y deben sumar 100 %%. Ajústalos en Registrar evaluación.', v_suma;
  end if;

  insert into public.grade_submissions (cohort_id, module_id, status, submitted_by, submitted_at, validated_by, validated_at)
  values (p_cohort, p_module, 'validado', auth.uid(), now(), auth.uid(), now())
  on conflict (cohort_id, module_id) do update
    set status = 'validado', submitted_by = auth.uid(), submitted_at = now(),
        validated_by = auth.uid(), validated_at = now(),
        return_reason = null, returned_at = null, returned_by = null;

  insert into public.grade_validated_evals (cohort_id, definition_id, module_id, validated_by)
  select p_cohort, d.id, d.module_id, auth.uid()
  from public.manual_exam_definitions d
  where d.module_id = p_module
  on conflict (cohort_id, definition_id) do nothing;

  select name into v_cohorte from public.cohorts where id = p_cohort;
  select name into v_modulo from public.modules where id = p_module;

  insert into public.notifications (profile_id, type, title, body, payload, channel)
  select s.id,
         'nota_publicada',
         '¡Salieron tus notas! 📣',
         'Ya puedes ver tus notas de "' || coalesce(v_modulo, 'tu módulo') || '". Entra y mira cómo te fue. 👀',
         jsonb_build_object('module_id', p_module),
         'push'
  from public.students s
  where s.cohort_id = p_cohort;
end;
$$;
grant execute on function public.publicar_notas_profesor(uuid, uuid) to authenticated;
