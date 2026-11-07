'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { ItemBarra } from '@/components/ui/BarraFlotante'
import { IconoChevron } from '@/components/ui/Iconos'

/**
 * Navegación de escritorio. En un teléfono la píldora flotante es lo correcto
 * (el pulgar llega abajo); en un monitor de 24" esa misma píldora queda a un
 * palmo del borde inferior, lejísimos del contenido, y encima sobra ancho.
 *
 * Aquí las secciones se despliegan en una columna fija a la izquierda y el
 * contenido usa el resto del ancho. Solo se muestra desde 1024 px; por debajo
 * manda `BarraFlotante`.
 *
 * Colapsable (pedido de Dirección Académica, nov. 2026): en módulos con muchas
 * evaluaciones el cuadro de notas es muy ancho y hay que barrer de lado hasta
 * la nota final y devolverse. Con la flechita de arriba la barra se recoge a
 * solo iconos (72 px) y el contenido se estira hasta el borde de la pantalla.
 * El estado se guarda en localStorage, así que queda recogida/abierta como la
 * dejó cada quien. Es solo de escritorio (toda la barra ya es `lg:`), el
 * teléfono no se toca.
 *
 * Mismas rutas, mismos iconos, mismo resaltado que la barra del teléfono: es
 * la misma app, no una versión de escritorio aparte.
 */
const CLAVE_COLAPSADA = 'zr-barra-colapsada'

export function BarraLateral({ items, alTocarBloqueado }: { items: ItemBarra[]; alTocarBloqueado?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const [colapsada, setColapsada] = useState(false)

  // Se lee en un efecto (no en el estado inicial) para no desincronizar el
  // HTML del servidor con el del navegador en la primera pintada.
  useEffect(() => {
    try {
      setColapsada(localStorage.getItem(CLAVE_COLAPSADA) === '1')
    } catch { /* localStorage puede no estar disponible */ }
  }, [])

  function alternar() {
    setColapsada((v) => {
      const nuevo = !v
      try { localStorage.setItem(CLAVE_COLAPSADA, nuevo ? '1' : '0') } catch { /* no-op */ }
      return nuevo
    })
  }

  const activo = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    // `data-tour-target="tour-nav"` (bug real de producción, reportado por
    // el coordinador): el tour apunta a esta misma clave para resaltar
    // "cómo moverte por la app" -- antes solo la tenía el `<nav>` de
    // BarraFlotante (la píldora del teléfono), que en escritorio sigue
    // existiendo en el DOM con `lg:hidden` (oculto, no desmontado). Tour.tsx
    // encontraba ESE elemento oculto, medía un rectángulo de 0x0 en la
    // esquina superior izquierda y lo mostraba como si fuera el resaltado
    // real -- "aparece en una esquina y no selecciona nada". No se repite el
    // mismo `id` en los dos (un id duplicado en el HTML es inválido y
    // `getElementById` devolvería siempre el primero en el DOM sin
    // importar cuál es el visible -- habría roto el teléfono en vez de
    // arreglar la computadora). Con el mismo `data-tour-target` en ambos,
    // Tour.tsx elige el que de verdad se ve en cada tamaño de pantalla.
    <aside
      data-tour-target="tour-nav"
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 overflow-y-auto border-r border-zr-border bg-zr-surface/40 py-6 transition-[width] duration-200 lg:flex print:hidden ${
        colapsada ? 'w-[72px] px-2' : 'w-60 px-3 xl:w-64'
      }`}
    >
      <div className={`flex items-center pb-4 ${colapsada ? 'justify-center' : 'justify-between px-3'}`}>
        {!colapsada && <p className="zr-display text-xl text-zr-text">ZR App</p>}
        <button
          onClick={alternar}
          title={colapsada ? 'Expandir menú' : 'Recoger menú'}
          aria-label={colapsada ? 'Expandir menú' : 'Recoger menú'}
          aria-expanded={!colapsada}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zr-text-muted transition-colors hover:bg-white/5 hover:text-zr-text"
        >
          <IconoChevron size={18} className={colapsada ? '-rotate-90' : 'rotate-90'} />
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {items.map((item, i) => {
          const on = activo(item.href)
          const grupoNuevo = item.grupo && item.grupo !== items[i - 1]?.grupo
          return (
            <div key={item.href}>
              {grupoNuevo && (
                colapsada ? (
                  // Recogida: no cabe el texto del grupo, se marca con una
                  // rayita (salvo el primero) para no perder la separación.
                  i > 0 && <div className="mx-2 my-2 border-t border-zr-border/60" />
                ) : (
                  <p className={`truncate px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zr-text-muted/70 ${i === 0 ? '' : 'pt-3'}`}>
                    {item.grupo}
                  </p>
                )
              )}
              <button
                onClick={() => (item.bloqueado ? alTocarBloqueado?.() : router.push(item.href))}
                aria-current={on ? 'page' : undefined}
                aria-disabled={item.bloqueado || undefined}
                title={colapsada ? item.label : undefined}
                className={`flex w-full items-center gap-3 rounded-xl py-3 text-left transition-colors ${
                  colapsada ? 'justify-center px-0' : 'px-3'
                } ${
                  item.bloqueado
                    ? 'text-zr-text-muted/40 grayscale'
                    : on
                      ? 'bg-zr-blue/15 text-zr-blue'
                      : 'text-zr-text-muted hover:bg-white/5 hover:text-zr-text'
                }`}
              >
                <item.Icono size={20} />
                {!colapsada && <span className="truncate text-sm font-semibold">{item.label}</span>}
              </button>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
