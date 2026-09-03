-- =============================================================================
-- ZR APP · MIGRACIÓN 070 · Un programa (currículo) pertenece a una sede, 1 a 1
-- =============================================================================
-- Segunda corrección de terminología del mismo día, después de que el cliente
-- explicó el modelo completo: "PTMA" y "PFTA" no son un tercer concepto
-- aparte ("plan de estudio") — son, literalmente, la sede. "PTMA es de La
-- Morita, PFTA es de la UCV: son agrupaciones o nombres de los programas por
-- sede." Cada sede tiene su propia sigla, y esa sigla ES el programa
-- (currículo de 14 módulos) que se dicta ahí. No hay caso de una sede con dos
-- siglas, ni de dos sedes compartiendo una.
--
-- Por eso `programs.sede_id` es 1 a 1 con `sedes`, y de aquí en adelante
-- crear una sede nueva y crear su programa (currículo) es LA MISMA acción —
-- ver la función `crear_sede_con_programa` más abajo, que reemplaza al
-- formulario separado "Plan de estudio nuevo" que se había construido antes
-- de esta aclaración.
-- =============================================================================

alter table public.programs
  add column sede_id uuid references public.sedes(id);

update public.programs set sede_id = (select id from public.sedes where nombre = 'La Morita') where siglas = 'PTMA';
update public.programs set sede_id = (select id from public.sedes where nombre = 'UCV') where siglas = 'PFTA';

alter table public.programs
  alter column sede_id set not null;

alter table public.programs
  add constraint programs_sede_id_key unique (sede_id);

comment on column public.programs.sede_id is
  'La sede donde se dicta este programa. 1 a 1: cada sede tiene exactamente un programa (currículo), y su sigla es la de la sede.';

-- -----------------------------------------------------------------------------
-- Crear sede + programa en un solo paso
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER porque hace tres inserts (sede, programa, y los 14
-- módulos copiados de un programa existente — todos comparten el mismo
-- currículo, confirmado por el cliente) que deben quedar juntos o ninguno:
-- si el cliente los hiciera uno por uno desde el navegador y el segundo
-- fallara, quedaría una sede sin programa. La comprobación de rol va DENTRO
-- de la función porque no hay una sola tabla cuya política de RLS pueda
-- cubrir la operación completa.
create or replace function public.crear_sede_con_programa(
  p_nombre_sede text,
  p_siglas text,
  p_nombre_programa text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  -- Todos los programas comparten hoy el mismo currículo de 14 módulos
  -- (verificado: PTMA y PFTA tienen exactamente los mismos nombres, mismo
  -- orden). Se copian desde cualquier programa existente como punto de
  -- partida — administración los ajusta después si el currículo nuevo
  -- necesita ser distinto.
  select id into v_origen_id from public.programs where id <> v_programa_id limit 1;

  if v_origen_id is not null then
    insert into public.modules (program_id, order_index, name, description, duration_weeks, inces_homologado)
    select v_programa_id, order_index, name, description, duration_weeks, inces_homologado
    from public.modules
    where program_id = v_origen_id;
  end if;

  return v_programa_id;
end;
$$;
