'use client'

import { BarraFlotante, type ItemBarra } from '@/components/ui/BarraFlotante'
import { BarraLateral } from '@/components/ui/BarraLateral'
import { Campanita } from '@/components/ui/Campanita'

interface Props {
  /** Las secciones visibles en la píldora del teléfono (máximo 5). */
  items: ItemBarra[]
  /** Todas las secciones del rol. En PC se listan enteras en la barra lateral. */
  todasLasSecciones?: ItemBarra[]
  /** Deslizar de lado cambia de sección (solo teléfono). */
  deslizable?: boolean
  /** Pantallas que se comen todo el alto (examen, escáner): sin barras. */
  sinNavegacion?: boolean
  /** La campanita de avisos no aplica a todos los roles. */
  campanita?: boolean
  /** Extra para el caso de impresión de admin. */
  imprimible?: boolean
  children: React.ReactNode
}

/**
 * Marco único de la app para los cuatro roles.
 *
 * Teléfono: columna de hasta 430 px con la píldora flotante abajo.
 * PC (≥1024 px): barra lateral + contenido ancho.
 *
 * Toda la lógica de anchos vive en `.zr-app-shell` / `.zr-app-main`
 * (app/globals.css), no repartida por los layouts, para que cambiar una
 * proporción sea un solo cambio y no cuatro.
 */
export function Marco({
  items,
  todasLasSecciones,
  deslizable = true,
  sinNavegacion = false,
  campanita = true,
  imprimible = false,
  children,
}: Props) {
  return (
    <div className={`zr-app-shell${imprimible ? ' print:bg-white' : ''}`}>
      {!sinNavegacion && <BarraLateral items={todasLasSecciones ?? items} />}

      {!sinNavegacion && campanita && (
        <div
          className={`fixed right-3 z-40 rounded-full border border-white/15 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-2xl lg:absolute lg:right-8 lg:top-8${
            imprimible ? ' print:hidden' : ''
          }`}
          style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <Campanita />
        </div>
      )}

      <main
        className={`zr-app-main${sinNavegacion ? '' : ' pb-28 lg:pb-10'}${
          imprimible ? ' print:pb-0' : ''
        }`}
      >
        {children}
      </main>

      {!sinNavegacion && (
        <div className={imprimible ? 'print:hidden' : undefined}>
          <BarraFlotante
            items={items}
            todasLasSecciones={todasLasSecciones}
            deslizable={deslizable}
          />
        </div>
      )}
    </div>
  )
}
