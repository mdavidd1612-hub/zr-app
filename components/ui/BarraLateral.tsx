'use client'

import { usePathname, useRouter } from 'next/navigation'
import type { ItemBarra } from '@/components/ui/BarraFlotante'

/**
 * Navegación de escritorio. En un teléfono la píldora flotante es lo correcto
 * (el pulgar llega abajo); en un monitor de 24" esa misma píldora queda a un
 * palmo del borde inferior, lejísimos del contenido, y encima sobra ancho.
 *
 * Aquí las secciones se despliegan en una columna fija a la izquierda —
 * sin ☰, porque en PC caben todas — y el contenido usa el resto del ancho.
 * Solo se muestra desde 1024 px; por debajo manda `BarraFlotante`.
 *
 * Mismas rutas, mismos iconos, mismo resaltado que la barra del teléfono: es
 * la misma app, no una versión de escritorio aparte.
 */
export function BarraLateral({ items, alTocarBloqueado }: { items: ItemBarra[]; alTocarBloqueado?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

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
    <aside data-tour-target="tour-nav" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-zr-border bg-zr-surface/40 px-3 py-6 lg:flex xl:w-64 print:hidden">
      <p className="zr-display px-3 pb-4 text-xl text-zr-text">ZR App</p>

      <nav className="flex flex-col gap-1">
        {items.map((item, i) => {
          const on = activo(item.href)
          const grupoNuevo = item.grupo && item.grupo !== items[i - 1]?.grupo
          return (
            <div key={item.href}>
              {grupoNuevo && (
                <p className={`truncate px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zr-text-muted/70 ${i === 0 ? '' : 'pt-3'}`}>
                  {item.grupo}
                </p>
              )}
              <button
                onClick={() => (item.bloqueado ? alTocarBloqueado?.() : router.push(item.href))}
                aria-current={on ? 'page' : undefined}
                aria-disabled={item.bloqueado || undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                  item.bloqueado
                    ? 'text-zr-text-muted/40 grayscale'
                    : on
                      ? 'bg-zr-blue/15 text-zr-blue'
                      : 'text-zr-text-muted hover:bg-white/5 hover:text-zr-text'
                }`}
              >
                <item.Icono size={20} />
                <span className="truncate text-sm font-semibold">{item.label}</span>
              </button>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
