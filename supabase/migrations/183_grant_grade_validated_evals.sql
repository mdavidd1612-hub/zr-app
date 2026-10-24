-- La migración 145 creó grade_validated_evals con RLS y políticas, pero
-- nunca le dio GRANT a 'authenticated' -- en producción y en staging esto
-- ya funcionaba porque alguien lo otorgó a mano fuera de las migraciones
-- (probablemente desde el dashboard), nunca quedó escrito. Cualquier entorno
-- nuevo que solo corra las migraciones (supabase db reset local, un entorno
-- de prueba nuevo) queda roto: todo lo que consulta module_enrollments bajo
-- RLS falla con "permission denied for table grade_validated_evals", porque
-- la política de esa tabla hace join contra esta (migración 145, línea 223).
-- Encontrado al correr npm run test:rls contra una base local recién creada.

grant select on public.grade_validated_evals to authenticated;
