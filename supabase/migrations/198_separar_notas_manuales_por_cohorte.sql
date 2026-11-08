-- 198: separar evaluaciones MANUALES de Notas por cohorte.
--
-- Bug reportado por Dirección Académica (7-nov-2026): al entrar a Notas de
-- PTMA-2026-III aparecían las mismas columnas (evaluaciones) que en
-- PTMA-2026-II. Causa real: manual_exam_definitions solo tenía module_id, y
-- el currículo (módulos) se comparte entre cohortes del mismo programa
-- (§8.3) -- cuando dos cohortes pasan por el mismo módulo (en momentos
-- distintos), comparten también las filas de "Registrar Evaluación" que
-- cualquiera de los dos profesores creó ahí, sin querer.
--
-- Se verificó contra producción antes de escribir esto: ningún módulo tiene
-- notas puestas (manual_exam_scores) de más de una cohorte a la vez, y toda
-- definición existente tiene al menos una nota puesta -- el backfill de
-- abajo es 100% determinístico, no hay mezcla real de datos que resolver a
-- mano.
--
-- cohort_id queda NULLABLE a propósito, mismo patrón que content_items/
-- content_folders (migr. 174/183): NULL = evaluación compartida (hoy la usa
-- la fusión examen/tarea digital -> Notas, migr. 193, un solo examen para
-- todas las cohortes que cursan el módulo); con valor = evaluación manual de
-- ESA cohorte únicamente, como pide Dirección.

alter table public.manual_exam_definitions
  add column cohort_id uuid references public.cohorts(id) on delete cascade;

comment on column public.manual_exam_definitions.cohort_id is
  'NULL = evaluación compartida entre cohortes del módulo (p. ej. examen/tarea digital sincronizado, migr. 193). Con valor = evaluación manual de esa cohorte únicamente (migr. 198).';

-- Backfill: cada definición existente hoy se creó a mano para una sola
-- cohorte -- se le asigna la cohorte de los estudiantes que ya tienen nota
-- puesta ahí (verificado antes de escribir esta migración: nunca hay dos).
update public.manual_exam_definitions med
set cohort_id = (
  select s.cohort_id
  from public.manual_exam_scores mes
  join public.students s on s.id = mes.student_id
  where mes.definition_id = med.id
  limit 1
)
where med.cohort_id is null
  and exists (select 1 from public.manual_exam_scores mes where mes.definition_id = med.id);

-- Limpieza: grade_validated_evals con filas "fantasma" para una cohorte que
-- nunca tuvo esa evaluación (el bug de validar_notas() de abajo, ya
-- corregido, las creaba para TODAS las cohortes del módulo en vez de solo la
-- que se estaba validando). Solo se borran las que de verdad son cruzadas --
-- las de una definición compartida (cohort_id is null) no se tocan, son
-- legítimas para cualquier cohorte.
delete from public.grade_validated_evals v
using public.manual_exam_definitions d
where v.definition_id = d.id
  and d.cohort_id is not null
  and v.cohort_id <> d.cohort_id;

-- RLS: el estudiante solo ve evaluaciones de SU cohorte (o compartidas).
drop policy if exists "estudiante: leer evaluaciones de modulos validados" on public.manual_exam_definitions;
create policy "estudiante: leer evaluaciones de modulos validados"
  on public.manual_exam_definitions for select
  using (
    (select public.estudiante_solvente())
    and (cohort_id is null or cohort_id = (select public.my_cohort_id()))
    and exists (
      select 1 from public.grade_validated_evals v
      where v.cohort_id = (select public.my_cohort_id()) and v.module_id = manual_exam_definitions.module_id
    )
  );

-- validar_notas(): antes marcaba como validadas TODAS las definiciones del
-- módulo (de cualquier cohorte); ahora solo las de esa cohorte o las
-- compartidas -- esto es lo que causaba el bug reportado.
create or replace function public.validar_notas(p_cohort uuid, p_module uuid)
returns void language plpgsql security definer set search_path = public as $$
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

  insert into public.grade_validated_evals (cohort_id, definition_id, module_id, validated_by)
  select p_cohort, d.id, d.module_id, auth.uid()
  from public.manual_exam_definitions d
  where d.module_id = p_module
    and (d.cohort_id is null or d.cohort_id = p_cohort)
  on conflict (cohort_id, definition_id) do nothing;

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

-- Defensa adicional (la fuga real ya se cerró arriba; esto es por si acaso):
-- el profesor solo califica en una definición compartida o de su propia
-- cohorte, nunca en la de otra cohorte aunque comparta el módulo.
drop policy if exists "profesor: calificar examen manual de su cohorte" on public.manual_exam_scores;
create policy "profesor: calificar examen manual de su cohorte"
  on public.manual_exam_scores for all
  using (
    exists (
      select 1 from public.students s
      join public.manual_exam_definitions d on d.id = manual_exam_scores.definition_id
      where s.id = manual_exam_scores.student_id
        and (select public.teaches_cohort_module(s.cohort_id, d.module_id))
        and (d.cohort_id is null or d.cohort_id = s.cohort_id)
    )
  )
  with check (
    exists (
      select 1 from public.students s
      join public.manual_exam_definitions d on d.id = manual_exam_scores.definition_id
      where s.id = manual_exam_scores.student_id
        and (select public.teaches_cohort_module(s.cohort_id, d.module_id))
        and (d.cohort_id is null or d.cohort_id = s.cohort_id)
    )
  );

-- fn_reabrir_envios_nueva_evaluacion(): una evaluación nueva de UNA cohorte
-- (cohort_id con valor) solo debe reabrir el envío de ESA cohorte -- antes
-- reabría el de cualquier cohorte que compartiera el módulo. Una evaluación
-- compartida (cohort_id null, p. ej. examen digital) sigue reabriendo a
-- todas las cohortes del módulo, como corresponde -- de verdad les toca a
-- todas.
create or replace function public.fn_reabrir_envios_nueva_evaluacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.grade_submissions
  where module_id = new.module_id
    and (new.cohort_id is null or cohort_id = new.cohort_id)
    and status in ('enviado', 'validado');
  return new;
end;
$$;
