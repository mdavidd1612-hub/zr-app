-- =============================================================================
-- ZR APP · MIGRACIÓN 051 · Se quita el bloqueo de menor sin consentimiento
-- =============================================================================
-- Decisión de la academia: un estudiante menor de edad usa la app igual que
-- cualquiera (entra, llena su formulario, etc.) sin ningún bloqueo especial.
-- Lo único que queda de esto es que el VENDEDOR, al inscribir, ve datos de
-- contacto del representante si detecta que es menor — solo como referencia,
-- nunca como requisito para crear la cuenta o para usar la app.
-- =============================================================================

drop trigger if exists trg_check_parental_consent on public.students;
