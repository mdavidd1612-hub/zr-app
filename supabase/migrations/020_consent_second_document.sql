-- =============================================================================
-- ZR APP · MIGRACIÓN 020 · Segundo documento del consentimiento parental
-- =============================================================================
-- El consentimiento digital pedía un solo documento. Ahora se piden dos:
-- la cédula del representante y el consentimiento firmado, por separado.
-- document_url sigue siendo el consentimiento firmado (sin cambio de sentido);
-- representative_id_document_url es la cédula del representante.
-- =============================================================================

alter table public.parental_consents
  add column representative_id_document_url text;
