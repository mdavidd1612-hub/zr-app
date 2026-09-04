-- =============================================================================
-- ZR APP · MIGRACIÓN 076 · Casos: toda la semana de una vez, el sábado
-- =============================================================================
-- A pedido explícito: el profesor NO debe poder generar casos a mano —
-- "ese caso se tiene que generar solo". El diseño anterior (migración 042)
-- ya no exponía ningún botón obligatorio, pero SÍ dejaba uno de prueba en
-- /casos-docente, y generaba un solo día por vez (sábado→lunes, lunes→
-- martes...), no toda la semana junta. Se cambia a: el sábado, de una sola
-- vez, se generan los 5 casos (lunes a viernes) de cada módulo activo,
-- cada uno distinto, ya generado por IA como antes (NVIDIA, ver
-- supabase/functions/generar-casos). El botón de prueba se quita del
-- código en este mismo cambio (app/(profesor)/casos-docente/page.tsx).
--
-- pg_sleep(2) entre cada llamada: son varias decenas de llamadas de golpe
-- (módulos activos × 5 días) contra una API de IA en capa gratuita: sin
-- espaciarlas se arriesga a que la ráfaga sature el límite de peticiones y
-- fallen varias. No afecta a nadie: corre en el worker en segundo plano de
-- pg_cron, no en ninguna conexión de la app.
-- =============================================================================

create or replace function public.fn_generar_caso_del_dia()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hoy_dow int := extract(dow from (now() at time zone 'America/Caracas'))::int; -- 0=domingo … 6=sábado
  v_secret text;
  v_modulo record;
  v_dia int;
begin
  if v_hoy_dow <> 6 then
    return; -- Todo se genera el sábado, de una vez, para toda la semana.
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
    for v_dia in 1..5 loop
      if not exists (
        select 1 from public.ai_cases
        where module_id = v_modulo.module_id and weekday = v_dia
      ) then
        perform net.http_post(
          url := 'https://hagbqhnittynxebdssua.supabase.co/functions/v1/generar-casos',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZ2JxaG5pdHR5bnhlYmRzc3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MDc5MDEsImV4cCI6MjEwMTE4MzkwMX0.JKM097XB6fe5bI-OVPm2YQa82lSwnGCqZiJR6Cb_SiI',
            'x-cron-secret', v_secret
          ),
          body := jsonb_build_object('moduleId', v_modulo.module_id, 'weekday', v_dia)
        );
        perform pg_sleep(2);
      end if;
    end loop;
  end loop;
end;
$$;

select cron.unschedule('generar-caso-del-dia');

-- Sábados a las 10:00 UTC (6:00 am hora de Venezuela).
select cron.schedule(
  'generar-casos-de-la-semana',
  '0 10 * * 6',
  $$select public.fn_generar_caso_del_dia();$$
);
