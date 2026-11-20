-- 238 · Al crear una sede con su programa (/catalogo), los módulos se copian
-- de un programa largo, nunca de un curso corto (que tiene un solo módulo).
create or replace function public.crear_sede_con_programa(p_nombre_sede text, p_siglas text, p_nombre_programa text)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare
  v_sede_id     uuid;
  v_programa_id uuid;
  v_origen_id   uuid;
begin
  if not (select public.is_super()) then
    raise exception 'Solo super_admin puede crear sedes y programas.';
  end if;

  insert into public.sedes (nombre) values (trim(p_nombre_sede))
  returning id into v_sede_id;

  insert into public.programs (name, siglas, sede_id, total_modules, total_duration_months)
  values (trim(p_nombre_programa), upper(trim(p_siglas)), v_sede_id, 14, 18)
  returning id into v_programa_id;

  select id into v_origen_id from public.programs
   where id <> v_programa_id and tipo = 'programa'
   order by created_at limit 1;

  if v_origen_id is not null then
    insert into public.modules (program_id, order_index, name, description, duration_weeks, inces_homologado)
    select v_programa_id, order_index, name, description, duration_weeks, inces_homologado
    from public.modules
    where program_id = v_origen_id;
  end if;

  return v_programa_id;
end;
$function$;
