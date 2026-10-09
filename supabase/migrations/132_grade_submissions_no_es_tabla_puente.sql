-- =============================================================================
-- ZR APP · MIGRACIÓN 132 · grade_submissions dejaba de funcionar las consultas con módulos
-- =============================================================================
-- ERROR GRAVE introducido por la migración 126 (y presente en producción desde
-- el 6 oct.): grade_submissions tenía clave primaria (cohort_id, module_id) y
-- claves foráneas a cohorts y modules. PostgREST la tomó por una TABLA PUENTE
-- y empezó a ver DOS caminos entre cohorts y modules (current_module_id y la
-- tabla puente) -> toda consulta del estilo cohorts(... modules(name)) fallaba
-- con PGRST201 "relación ambigua" y las pantallas se quedaban con listas
-- vacías (Material, Notas, Finanzas, Horario, Perfil, etc.).
--
-- Arreglo: clave primaria propia (id) y la pareja pasa a ser UNIQUE, así ya no
-- es una tabla puente. enviar_notas() sigue funcionando (ON CONFLICT usa la
-- restricción única).
-- =============================================================================

alter table public.grade_submissions drop constraint grade_submissions_pkey;
alter table public.grade_submissions add column id uuid not null default gen_random_uuid();
alter table public.grade_submissions add constraint grade_submissions_pkey primary key (id);
alter table public.grade_submissions add constraint grade_submissions_cohort_module_key unique (cohort_id, module_id);
