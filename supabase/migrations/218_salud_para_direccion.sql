-- Salud/Monitoreo tambien para Direccion Academica (18-nov-2026): la misma funcion de
-- metricas, ahora permitida a direccion_academica ademas de super_admin.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.fn_metricas_app()'::regprocedure);
  v_def := replace(v_def, 'if (select auth_role()) is distinct from ''super_admin'' then',
                          'if (select auth_role()::text) not in (''super_admin'', ''direccion_academica'') then');
  if v_def not like '%direccion_academica%' then raise exception 'no se encontro la condicion a reemplazar'; end if;
  execute v_def;
end $$;
