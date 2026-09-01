-- =============================================================================
-- ZR APP · MIGRACIÓN 052 · "Días y horario" como dato, no como constante
-- =============================================================================
-- especificacion-funcional-zrm-academy.md §3 y §15.1: los "días" y el
-- "horario" NO se le piden al vendedor — se derivan automáticamente de lo que
-- eligió al inscribir, y se imprimen así en la planilla (§4.1).
--
-- Hasta ahora ese texto vivía escrito a mano en el código de la planilla
-- (HORARIO_TURNO en app/(admin)/estudiantes/[id]/planilla/page.tsx), lo cual
-- viola la regla 5 de CLAUDE.md: ningún número ni valor de negocio dentro del
-- código. Cambiar el horario de un turno obligaba a hacer un despliegue.
--
-- La spec dice "cada Module debe tener sus propios days y schedule". En esta
-- app el módulo NO manda el horario: la cohorte sí (es la que tiene turno
-- mañana/tarde y sede). Dos cohortes cursando el mismo módulo tienen horarios
-- distintos. Por eso las columnas van en `cohorts`, que es la traducción fiel
-- del requisito a este modelo de datos.
-- =============================================================================

alter table public.cohorts
  add column days     text,
  add column schedule text;

comment on column public.cohorts.days is
  'Días de clase de esta cohorte, como se imprimen en la planilla. Ej.: "Sábados".';

comment on column public.cohorts.schedule is
  'Horario de esta cohorte, como se imprime en la planilla. Ej.: "9:00 a.m. – 12:00 p.m.".';

-- Relleno inicial con lo que hoy está escrito a mano en la planilla, para que
-- ninguna cohorte existente quede sin horario al desplegar.
update public.cohorts
   set days     = coalesce(days, 'Sábados'),
       schedule = coalesce(
         schedule,
         case turno
           when 'mañana' then '9:00 a.m. – 12:00 p.m.'
           when 'tarde'  then '2:00 p.m. – 5:00 p.m.'
           else null
         end
       );
