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
export function BarraLateral({ items }: { items: ItemBarra[] }) {
  const pathname = usePathname()
  const router = useRouter()

  const activo = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-zr-border bg-zr-surface/40 px-3 py-6 lg:flex xl:w-64">
      <p className="zr-display px-3 pb-4 text-xl text-zr-text">ZR App</p>

      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const on = activo(item.href)
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              aria-current={on ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                on
                  ? 'bg-zr-blue/15 text-zr-blue'
                  : 'text-zr-text-muted hover:bg-white/5 hover:text-zr-text'
              }`}
            >
              <item.Icono size={20} />
              <span className="truncate text-sm font-semibold">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
