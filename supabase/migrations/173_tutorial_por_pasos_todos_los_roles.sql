-- =============================================================================
-- ZR APP · MIGRACIÓN 173 · Tutorial guiado para todos los roles (menos super_admin)
-- =============================================================================
-- Pedido explícito del coordinador (oct. 2026): el tour guiado que hasta
-- ahora era solo de estudiante (migración 084, students.tour_completed_at)
-- se generaliza a profesor, administración, Dirección Académica, vendedor y
-- ZR Coffee -- nunca a super_admin. Además cambia de forma: en vez de un
-- único timestamp ("ya vio el tour completo, sí/no"), se guarda la lista de
-- PASOS que ya vio. Así, cuando se agrega una función nueva con su propio
-- paso de tutorial, a quien ya había visto el tour no se le repite todo --
-- solo se le ofrece lo nuevo ("Aprende a usar las nuevas funciones de ZR
-- App"), y a quien nunca lo vio le sigue saliendo completo.
--
-- `profiles` en vez de `students`: el tour ahora es de cualquier rol, y
-- `profiles` es la única tabla que todos los roles tienen fila propia.
-- =============================================================================

alter table public.profiles
  add column if not exists tour_pasos_vistos text[] not null default '{}';

comment on column public.profiles.tour_pasos_vistos is
  'IDs de los pasos del tutorial que esta persona ya vio (lib/tour-pasos.ts). No es un booleano: agregar un paso nuevo no reinicia los que ya vio.';

-- A quien ya terminó el tour viejo (students.tour_completed_at) se le marcan
-- como vistos los pasos que existían en ese momento -- si no, al desplegar
-- esto, cada estudiante que ya lo había visto se lo vuelve a encontrar
-- completo en vez de solo ver "funciones nuevas" (ninguna, en este caso).
update public.profiles p
set tour_pasos_vistos = array[
  'estudiante-semana', 'estudiante-accesos', 'estudiante-nav', 'estudiante-modulo',
  'estudiante-malla', 'estudiante-material', 'estudiante-dudas', 'estudiante-carnet'
]
from public.students s
where s.id = p.id and s.tour_completed_at is not null;

-- El estudiante nunca tiene permiso de UPDATE directo sobre `profiles` más
-- allá de sus propios datos de contacto (migración 012) -- una función de
-- servidor, acotada a su propia fila, es la única vía, igual que el resto
-- de "marcar algo visto/hecho" de la app.
create or replace function public.fn_marcar_pasos_tour_vistos(p_pasos text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set tour_pasos_vistos = (
    select coalesce(array_agg(distinct x), '{}')
    from unnest(tour_pasos_vistos || p_pasos) x
  )
  where id = auth.uid();
end;
$$;

grant execute on function public.fn_marcar_pasos_tour_vistos(text[]) to authenticated;
revoke execute on function public.fn_marcar_pasos_tour_vistos(text[]) from anon;
