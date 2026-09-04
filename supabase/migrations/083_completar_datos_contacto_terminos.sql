-- =============================================================================
-- ZR APP · MIGRACIÓN 083 · Completa dirección y contacto en los términos
-- =============================================================================
-- Los dos datos reales que faltaban en la migración 082, ya confirmados por
-- el coordinador: dirección de la sede y correo/teléfono de contacto.
-- =============================================================================

update public.system_config set
  value = to_jsonb(replace(replace(
    value #>> '{}',
    '[dirección de la sede — pendiente de completar]',
    'Centro Comercial La Morita, San Antonio de los Altos, Estado Miranda'
  ),
    '[correo o teléfono de contacto de la academia — pendiente de completar]',
    'academiazrmecademy@gmail.com o +58 414-2345140'
  ))
where key = 'terms.text';
