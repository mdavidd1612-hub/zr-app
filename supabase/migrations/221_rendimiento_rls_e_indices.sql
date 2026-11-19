-- Rendimiento para escalar (19-nov-2026, revision masiva).
-- 1) Politicas RLS: auth.uid()/auth.jwt()/auth.role() se evaluaban fila por fila
--    (advisor auth_rls_initplan, 69 politicas). Envolverlas en (select ...) hace que
--    Postgres las calcule una sola vez por consulta. No cambia QUIEN ve que.
-- 2) Llaves foraneas de una sola columna sin indice (advisor unindexed_foreign_keys):
--    se les crea su indice para que joins y borrados en cascada no recorran tablas enteras.
do $$
declare
  p record; q text; c text; fn text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') ~ 'auth\.(uid|jwt|role)\(\)' or coalesce(with_check,'') ~ 'auth\.(uid|jwt|role)\(\)')
  loop
    q := p.qual; c := p.with_check;
    foreach fn in array array['uid','jwt','role'] loop
      q := replace(q, '( SELECT auth.' || fn || '() AS ' || fn || ')', '@@' || fn || '@@');
      c := replace(c, '( SELECT auth.' || fn || '() AS ' || fn || ')', '@@' || fn || '@@');
      q := replace(q, 'auth.' || fn || '()', '(select auth.' || fn || '())');
      c := replace(c, 'auth.' || fn || '()', '(select auth.' || fn || '())');
      q := replace(q, '@@' || fn || '@@', '(select auth.' || fn || '())');
      c := replace(c, '@@' || fn || '@@', '(select auth.' || fn || '())');
    end loop;
    if q is distinct from p.qual or c is distinct from p.with_check then
      execute format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename)
        || case when q is not null then format(' using (%s)', q) else '' end
        || case when c is not null then format(' with check (%s)', c) else '' end;
    end if;
  end loop;
end $$;

do $$
declare r record;
begin
  for r in
    select con.conrelid::regclass as tabla, a.attname as col, cl.relname as tnombre
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    where con.contype = 'f' and array_length(con.conkey, 1) = 1
      and not exists (
        select 1 from pg_index i
        where i.indrelid = con.conrelid and i.indkey[0] = con.conkey[1]
      )
  loop
    execute format('create index if not exists %I on %s (%I)',
      left('idx_fk_' || r.tnombre || '_' || r.col, 63), r.tabla, r.col);
  end loop;
end $$;
