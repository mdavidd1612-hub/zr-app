-- =============================================================================
-- ZR APP · MIGRACIÓN 088 · Subir el límite de tamaño de la foto de perfil
-- =============================================================================
-- Reportado por el coordinador: "una foto normal no se puede subir al perfil
-- porque pesa mucho". El bucket 'avatars' (migración 071) tenía el límite en
-- 3 MB — una foto sin comprimir de una cámara de teléfono moderna ronda
-- 4-10 MB fácil, así que casi ninguna pasaba. Se sube a 10 MB, igual que el
-- límite del lado del cliente (components/ui/FotoPerfil.tsx).
-- =============================================================================

update storage.buckets
set file_size_limit = 10485760
where id = 'avatars';
