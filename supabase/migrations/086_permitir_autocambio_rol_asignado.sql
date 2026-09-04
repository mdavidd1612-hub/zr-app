-- =============================================================================
-- ZR APP · MIGRACIÓN 086 · fn_profiles_guard deja cambiar de rol activo
-- =============================================================================
-- Bug encontrado probando el selector de rol de la migración 085: el guardia
-- de public.profiles (trg_profiles_guard / fn_profiles_guard) bloquea CUALQUIER
-- cambio de role/cedula/status hecho por el propio dueño de la fila, salvo
-- que ya sea admin_up -- exactamente lo que necesita fn_cambiar_mi_rol para
-- pasar a Erika de vendedor a admin (ella no es admin_up mientras sigue
-- siendo vendedor, así que la guarda la frenaba con "No puedes modificar tu
-- rol, tu cédula ni tu estado.").
--
-- La guarda seguía siendo necesaria -- solo hacía falta una excepción exacta:
-- un cambio que SOLO toca role (cedula y status intactos) Y ese role nuevo
-- ya está en profile_roles para esa misma cuenta (o sea, ya lo aprobó un
-- admin desde Personal). Cédula y estado se los sigue sin poder tocar el
-- propio dueño bajo ninguna circunstancia.
-- =============================================================================

create or replace function public.fn_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() es null cuando escribe el servidor (service_role) o un
  -- disparador interno. Esos casos ya pasaron por su propia validación.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin_up() then
    return new;
  end if;

  -- Autoservicio legítimo (migración 085): elegir cuál de los roles que un
  -- admin ya le asignó (profile_roles) usar ahora mismo. No es "modificar tu
  -- rol" en el sentido que esta guarda prohíbe -- es elegir entre opciones ya
  -- aprobadas, nunca inventarse una. Cédula y estado deben seguir intactos.
  if new.cedula is not distinct from old.cedula
     and new.status is not distinct from old.status
     and new.role is distinct from old.role
     and exists (
       select 1 from public.profile_roles
       where profile_id = old.id and role = new.role
     )
  then
    return new;
  end if;

  if (new.role, new.cedula, new.status) is distinct from (old.role, old.cedula, old.status) then
    raise exception 'No puedes modificar tu rol, tu cédula ni tu estado.';
  end if;

  return new;
end;
$$;
