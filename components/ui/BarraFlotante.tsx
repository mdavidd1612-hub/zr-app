'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

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
  items: ItemBarra[]
  /** Deslizar de lado cambia de sección. Se apaga donde estorbe (un examen). */
  deslizable?: boolean
}

export function BarraFlotante({ items, deslizable = true }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const inicioX = useRef(0)
  const inicioY = useRef(0)

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

  return (
    <nav className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="rounded-full border border-white/15 bg-white/10 px-2.5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="flex gap-1">
          {items.map((item) => {
            const on = activo(item.href)
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                aria-label={item.label}
                aria-current={on ? 'page' : undefined}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 ${
                  on
                    ? 'bg-zr-blue/20 text-zr-blue'
                    : 'text-zr-text-muted active:bg-white/10'
                }`}
              >
                <item.Icono size={23} />
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
