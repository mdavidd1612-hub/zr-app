-- 169: las funciones nuevas de las migraciones 167-168 quedaron ejecutables por
-- `anon` (el permiso por defecto de Postgres al crear una función). Usan
-- auth.uid()/auth_role(), así que anon no obtenía datos reales, pero se cierran
-- igual (mismo criterio que la migración 160 y 133).
revoke execute on function public.profesor_puede_editar_notas(uuid, uuid) from public, anon;
grant execute on function public.profesor_puede_editar_notas(uuid, uuid) to authenticated;

revoke execute on function public.publicar_notas_profesor(uuid, uuid) from public, anon;
grant execute on function public.publicar_notas_profesor(uuid, uuid) to authenticated;

-- Esta la llama solo el cron, nadie la necesita vía la API.
revoke execute on function public.fn_recordar_cargar_notas() from public, anon, authenticated;
