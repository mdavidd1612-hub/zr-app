-- =============================================================================
-- ZR APP · MIGRACIÓN 061 · `cohorts.name` deja de ser obligatorio al insertar
-- =============================================================================
-- Complemento de la 060. Ahí el nombre pasó a generarlo el servidor, pero la
-- columna seguía siendo NOT NULL sin valor por defecto, así que:
--
--   - PostgREST (y los tipos de TypeScript que se generan del esquema) seguían
--     exigiendo `name` en cada INSERT, justo lo que se quería quitar;
--   - la pantalla tenía que mandar un texto vacío a propósito para esquivarlo,
--     que es la clase de truco que después nadie entiende.
--
-- Con un default vacío, quien inserta puede omitir el nombre y el trigger
-- `fn_set_cohort_code_number` lo rellena antes de que la fila toque la tabla.
-- La cadena vacía nunca llega a guardarse: el trigger la trata igual que NULL.
-- =============================================================================

alter table public.cohorts alter column name set default '';

comment on column public.cohorts.name is
  'Se genera solo como SIGLAS-AÑO-ROMANO (ej. PTMA-2026-III) a partir del programa, la fecha de inicio y el número de corte. Se puede editar después si un corte necesita nombre propio.';
