-- =============================================================================
-- ZR APP · MIGRACIÓN 084 · Tour guiado del primer ingreso (solo estudiante)
-- =============================================================================
-- A pedido explícito del coordinador: la primera vez que un estudiante entra
-- (después de completar su perfil y aceptar términos, si le tocaba), ve un
-- tour corto de la pantalla de Inicio — con "Siguiente" y "Omitir" — que no
-- se le vuelve a mostrar.
--
-- Mismo patrón que fn_marcar_onboarding_completo (migración 047): el
-- estudiante nunca tiene permiso de UPDATE directo sobre `students` (esa
-- tabla es de administración, migración 012) — una función de servidor,
-- acotada a su propia fila, es la única vía. No hace falta una tabla nueva
-- para un solo timestamp.
-- =============================================================================

alter table public.students add column tour_completed_at timestamptz;

create or replace function public.fn_marcar_tour_visto()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.students set tour_completed_at = now() where id = auth.uid();
end;
$$;
