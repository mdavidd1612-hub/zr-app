'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { IconoMenu, IconoCerrar } from '@/components/ui/Iconos'

/**
 * Barra de navegación flotante, tipo iPhone: una píldora de vidrio esmerilado
 * que va por encima del contenido en lugar de robarle una franja fija.
 *
 * La usan LOS TRES roles. Antes el profesor tenía una barra plana pegada al
 * borde y el estudiante esta; parecían dos aplicaciones distintas, y el botón
 * de la esquina del sistema tapaba la primera pestaña.
 */

export interface ItemBarra {
  href: string
  label: string
  Icono: (p: { size?: number }) => React.ReactElement
}

interface Props {
  /** Los 4 (máximo) que van siempre visibles en la píldora. */
  items: ItemBarra[]
  /**
   * TODAS las secciones del rol, items incluidos. Si se pasa, aparece un
   * quinto botón (☰) que abre una hoja con la lista completa y resalta en
   * cuál estás — incluso si esa pantalla no es una de las 4 visibles.
   * Sin esto, entrar a /cohortes desde la rejilla de accesos de /panel deja
   * al usuario sin ninguna pista de dónde está parado.
   */
  todasLasSecciones?: ItemBarra[]
  /** Deslizar de lado cambia de sección. Se apaga donde estorbe (un examen). */
  deslizable?: boolean
}

export function BarraFlotante({ items, todasLasSecciones, deslizable = true }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const inicioX = useRef(0)
  const inicioY = useRef(0)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [rutaAnterior, setRutaAnterior] = useState(pathname)

  // Se cierra solo al cambiar de página — si no, un enlace del menú deja la
  // hoja anterior abierta encima de la pantalla nueva. Se ajusta durante el
  // render (patrón que React recomienda para "resetear estado cuando cambia
  // algo externo"), no en un efecto, para no arrastrar un render de más.
  if (pathname !== rutaAnterior) {
    setRutaAnterior(pathname)
    setMenuAbierto(false)
  }

  useEffect(() => {
    if (!deslizable) return

    function alTocar(e: TouchEvent) {
      inicioX.current = e.touches[0].clientX
      inicioY.current = e.touches[0].clientY
    }

    function alSoltar(e: TouchEvent) {
      const dx = inicioX.current - e.changedTouches[0].clientX
      const dy = Math.abs(inicioY.current - e.changedTouches[0].clientY)

      // Tiene que ser más horizontal que vertical, o cada scroll cambiaría
      // de sección sin querer.
      if (Math.abs(dx) <= dy || Math.abs(dx) <= 50) return

      const i = items.findIndex((x) => x.href === pathname)
      if (i === -1) return

      if (dx > 0 && i < items.length - 1) router.push(items[i + 1].href)
      else if (dx < 0 && i > 0) router.push(items[i - 1].href)
    }

    window.addEventListener('touchstart', alTocar, { passive: true })
    window.addEventListener('touchend', alSoltar, { passive: true })
    return () => {
      window.removeEventListener('touchstart', alTocar)
      window.removeEventListener('touchend', alSoltar)
    }
  }, [pathname, items, router, deslizable])

  const activo = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  // ¿La pantalla actual es una de las 4 visibles en la píldora? Si no, el
  // botón de menú se marca activo para no dejar la navegación "en blanco".
  const seccionActualFueraDeLaPildora = !items.some((i) => activo(i.href))

  return (
    <>
      {menuAbierto && todasLasSecciones && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60 lg:hidden" onClick={() => setMenuAbierto(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-2xl border-t border-white/15 bg-zr-surface pb-28 pt-2 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]"
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-zr-border" />

            <div className="flex items-center justify-between px-5 pt-4">
              <p className="text-base font-bold text-zr-text">Todas las secciones</p>
              <button
                onClick={() => setMenuAbierto(false)}
                aria-label="Cerrar menú"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zr-text-muted active:bg-zr-border/50"
              >
                <IconoCerrar size={18} />
              </button>
            </div>

            <div className="mt-3 max-h-[55vh] space-y-1 overflow-y-auto px-3">
              {todasLasSecciones.map((s) => {
                const on = activo(s.href)
                return (
                  <button
                    key={s.href}
                    onClick={() => router.push(s.href)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3.5 text-left transition-colors ${
                      on ? 'bg-zr-blue/15 text-zr-blue' : 'text-zr-text active:bg-zr-border/40'
                    }`}
                  >
                    <s.Icono size={20} />
                    <span className="text-base font-medium">{s.label}</span>
                    {on && <span className="ml-auto text-xs font-bold uppercase tracking-wider">Aquí</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Desde 1024 px manda `BarraLateral`: en un monitor esta píldora queda
          descolgada del contenido y sobra ancho para una columna de secciones. */}
      <nav
        className="fixed left-1/2 z-50 -translate-x-1/2 lg:hidden"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="rounded-[28px] border border-white/15 bg-white/10 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="flex gap-0.5">
            {items.map((item) => {
              const on = activo(item.href)
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex w-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 transition-all duration-300 ${
                    on
                      ? 'bg-zr-blue/20 text-zr-blue'
                      : 'text-zr-text-muted active:bg-white/10'
                  }`}
                >
                  <item.Icono size={21} />
                  <span className="max-w-full truncate text-[10px] font-semibold leading-none">
                    {item.label}
                  </span>
                </button>
              )
            })}

            {todasLasSecciones && (
              <button
                onClick={() => setMenuAbierto((v) => !v)}
                aria-label="Ver todas las secciones"
                aria-expanded={menuAbierto}
                className={`flex h-12 w-12 items-center justify-center rounded-full border-l border-white/10 pl-0.5 transition-all duration-300 ${
                  menuAbierto || seccionActualFueraDeLaPildora
                    ? 'text-zr-blue'
                    : 'text-zr-text-muted active:bg-white/10'
                }`}
              >
                <IconoMenu size={22} />
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
