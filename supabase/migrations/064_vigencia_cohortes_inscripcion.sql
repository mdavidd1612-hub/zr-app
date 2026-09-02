-- =============================================================================
-- ZR APP · MIGRACIÓN 064 · Vigencia de cohortes en el desplegable de inscripción
-- =============================================================================
-- Cierra R-12 de docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md.
--
-- El bug que reportó la directiva ("el dropdown muestra programas de 2025")
-- no era el año: `carga-ventas` ya filtraba `status = 'activa'`, el problema
-- eran los DATOS — cohortes de 2025 que seguían marcadas activas a mano.
--
-- Esta migración resuelve la causa de raíz, no el síntoma puntual: una
-- cohorte deja de ofrecerse para inscripción nueva pasado un margen desde su
-- fecha de inicio — sin que nadie tenga que acordarse de terminarla a mano.
-- Es la misma regla que la reunión pidió como "mejora futura" (ocultar el
-- programa 1 mes después de iniciar): con esta expresión, esa mejora queda
-- hecha de una vez, sin trabajo adicional.
--
-- El margen es un valor de negocio y vive en `system_config`
-- (`enrollment.ventana_dias`), nunca escrito en el código — regla 5 de
-- AGENTS.md. Cambiarlo es editar una fila desde Configuración, no desplegar.
-- =============================================================================

insert into public.system_config (key, value, description, is_public) values
  ('enrollment.ventana_dias', '30'::jsonb,
   'Días después de que empieza una cohorte durante los que todavía se puede inscribir en ella. Pasado ese margen, deja de aparecer en el desplegable de Inscribir — evita meter un estudiante nuevo a mitad de módulo.',
   true)
on conflict (key) do nothing;

-- `security_invoker = true`: la vista hereda las políticas de RLS de
-- `cohorts` de quien la consulta, no las del dueño de la vista (convención de
-- este proyecto — ver v_students, v_mi_dominio). No hace falta repetir la
-- lógica de permisos aquí: un vendedor sigue viendo lo que ya podía ver,
-- solo que además filtrado por vigencia.
create or replace view public.v_cohorts_inscribibles
with (security_invoker = true)
as
select c.*
from public.cohorts c
where c.status = 'activa'
  and c.start_date > (
    current_date - make_interval(days => public.cfg_num('enrollment.ventana_dias', 30)::int)
  );

comment on view public.v_cohorts_inscribibles is
  'Cohortes que se pueden ofrecer para una inscripción NUEVA: activas y dentro de la ventana desde su fecha de inicio (system_config[''enrollment.ventana_dias'']). Es la fuente que debe usar cualquier pantalla de inscripción — nunca `cohorts` directo, que sigue teniendo todas, incluidas las que ya no admiten estudiantes nuevos.';
