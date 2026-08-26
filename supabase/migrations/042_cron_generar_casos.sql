-- =============================================================================
-- ZR APP · MIGRACIÓN 042 · Generación automática diaria de casos con IA
-- =============================================================================
-- Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, ajuste): el profesor ya NO tiene
-- que tocar ningún botón para que exista el caso del día. Un cron diario
-- genera el caso del día siguiente hábil, con un día de margen:
--   sábado  → genera el de lunes
--   lunes   → genera el de martes
--   martes  → genera el de miércoles
--   miércoles → genera el de jueves
--   jueves  → genera el de viernes
--   viernes y domingo → no hace nada (ya está generado desde el día antes)
--
-- Solo se genera si todavía no existe ese caso para ese módulo — no pisa
-- casos que el profesor ya haya regenerado a mano.
-- =============================================================================

create or replace function public.fn_generar_caso_del_dia()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hoy_dow int := extract(dow from (now() at time zone 'America/Caracas'))::int; -- 0=domingo … 6=sábado
  v_objetivo int;
  v_secret text;
  v_modulo record;
begin
  v_objetivo := case v_hoy_dow
    when 6 then 1  -- sábado -> lunes
    when 1 then 2  -- lunes -> martes
    when 2 then 3  -- martes -> miércoles
    when 3 then 4  -- miércoles -> jueves
    when 4 then 5  -- jueves -> viernes
    else null      -- viernes y domingo: nada que hacer
  end;

  if v_objetivo is null then
    return;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'cron_secret_generar_casos';

  if v_secret is null then
    raise notice 'fn_generar_caso_del_dia: falta el secreto en Vault, no se genera nada';
    return;
  end if;

  for v_modulo in
    select distinct c.current_module_id as module_id
    from public.cohorts c
    where c.status = 'activa' and c.current_module_id is not null
  loop
    if not exists (
      select 1 from public.ai_cases
      where module_id = v_modulo.module_id and weekday = v_objetivo
    ) then
      perform net.http_post(
        url := 'https://hagbqhnittynxebdssua.supabase.co/functions/v1/generar-casos',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZ2JxaG5pdHR5bnhlYmRzc3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MDc5MDEsImV4cCI6MjEwMTE4MzkwMX0.JKM097XB6fe5bI-OVPm2YQa82lSwnGCqZiJR6Cb_SiI',
          'x-cron-secret', v_secret
        ),
        body := jsonb_build_object('moduleId', v_modulo.module_id, 'weekday', v_objetivo)
      );
    end if;
  end loop;
end;
$$;

-- Todos los días a las 10:00 UTC (6:00 am hora de Venezuela).
select cron.schedule(
  'generar-caso-del-dia',
  '0 10 * * *',
  $$select public.fn_generar_caso_del_dia();$$
);
