import { ES_ENTORNO_PRUEBA } from '@/lib/entorno'
import { APP_VERSION } from '@/lib/version'

/**
 * Cinta fija "ENTORNO DE PRUEBA": solo existe en el entorno de pruebas, nunca
 * en producción. No intercepta toques (pointer-events-none).
 */
export default function EtiquetaEntorno() {
  if (!ES_ENTORNO_PRUEBA) return null
  return (
    <div
      className="pointer-events-none fixed left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-full bg-zr-warning px-3 py-[3px] text-[9px] font-extrabold uppercase leading-none tracking-[0.12em] text-zr-bg shadow-md"
      // Debajo de la barra de estado (notch / isla dinámica del iPhone, barra del Android): antes iba pegada arriba, se montaba sobre el notch y se veía difuminada.
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3px)' }}
      aria-label="Estás en el entorno de prueba"
    >
      Prueba · V {APP_VERSION}
    </div>
  )
}
