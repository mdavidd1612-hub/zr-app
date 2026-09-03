'use client'

import { FormularioInscripcion } from '@/components/inscripcion/FormularioInscripcion'

// R-17 (docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md): mismo formulario que
// /(vendedor)/carga-ventas, como respaldo del vendedor desde administración
// y Dirección Académica. La lógica vive una sola vez en el componente
// compartido — esta página solo decide qué sobretítulo mostrar.
export default function InscribirDesdeAdmin() {
  return <FormularioInscripcion sobretitulo="Administración" />
}
