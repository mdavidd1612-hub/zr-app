-- =============================================================================
-- ZR APP · MIGRACIÓN 069 · Revierte R-12: el desplegable de inscribir vuelve
-- a mostrar TODOS los programas activos, sin ventana de 30 días
-- =============================================================================
-- R-12 (migración 064) filtraba el desplegable de inscripción a solo los
-- programas cuya fecha de inicio cayera dentro de los últimos 30 días —
-- la idea era evitar meter un estudiante nuevo a mitad de un módulo que ya
-- llevaba meses corriendo.
--
-- El cliente probó la app después de esa migración y encontró el resultado
-- inaceptable: con la numeración real (7 programas, solo uno arrancando en
-- los próximos días), el desplegable de /inscribir mostraba UN SOLO
-- programa. Su instrucción explícita: el desplegable debe mostrar TODOS los
-- programas activos que existen — la academia sí necesita poder sumar un
-- estudiante a un programa que ya está en marcha, y decide caso por caso,
-- no con una regla automática de "1 mes y se cierra".
--
-- Se revierte por completo, no se deja la infraestructura sin usar dando
-- vueltas: la vista y la fila de configuración se borran. Si en el futuro
-- hace falta un criterio de vigencia, hay que preguntarlo de nuevo — no
-- asumir que este era el correcto.
-- =============================================================================

drop view if exists public.v_cohorts_inscribibles;

delete from public.system_config where key = 'enrollment.ventana_dias';
