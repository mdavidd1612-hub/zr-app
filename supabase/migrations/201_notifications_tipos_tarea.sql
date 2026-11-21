-- Bug real reportado en vivo (8-nov-2026): crear una tarea en Unidades fallaba con
-- "new row for relation notifications violates check constraint notifications_type_check".
-- La migración 199 agregó los triggers fn_notify_tarea_nueva/fn_notify_tarea_calificada
-- pero nunca se agregaron esos 2 valores al check de notifications.type.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check check (
  type = any (array[
    'examen_habilitado','nota_publicada','consentimiento_pendiente','feedback_disponible',
    'profesor_pendiente','material_nuevo','modulo_cambiado','hora_clase','hora_refrigerio',
    'notas_registradas','recordatorio_pago','recordatorio_notas','duda_nueva','duda_respondida',
    'tarea_nueva','tarea_calificada'
  ])
);
