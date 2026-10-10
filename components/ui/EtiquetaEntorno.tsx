import { ES_ENTORNO_PRUEBA } from '@/lib/entorno'

/**
 * Cinta fija "ENTORNO DE PRUEBA": solo existe en el entorno de pruebas, nunca
 * en producción. No intercepta toques (pointer-events-none).
 */
export default function EtiquetaEntorno() {
  if (!ES_ENTORNO_PRUEBA) return null
  return (
    <div
      className="pointer-events-none fixed left-1/2 z-[100] -translate-x-1/2 rounded-b-lg bg-zr-warning px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-zr-bg shadow-md"
      style={{ top: 0, paddingTop: 'max(2px, env(safe-area-inset-top))' }}
      aria-label="Estás en el entorno de prueba"
    >
      Entorno de prueba
    </div>
  )
}
