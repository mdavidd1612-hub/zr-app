'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { IconCarnet, IconClases, IconExamenes, IconMaterial } from '@/components/ui/Icons'

const ROUTES = [
  { href: '/carnet', label: 'Carnet', icon: IconCarnet },
  { href: '/clases', label: 'Clases', icon: IconClases },
  { href: '/examenes', label: 'Exámenes', icon: IconExamenes },
  { href: '/contenido', label: 'Material', icon: IconMaterial },
]

export default function EstudianteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const currentIndex = ROUTES.findIndex(r => r.href === pathname)

  useEffect(() => {
    function handleTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
    }

    function handleTouchEnd(e: TouchEvent) {
      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      const diffX = touchStartX.current - touchEndX
      const diffY = Math.abs(touchStartY.current - touchEndY)

      // Solo procesar si el movimiento es más horizontal que vertical
      if (Math.abs(diffX) > diffY && Math.abs(diffX) > 50) {
        if (diffX > 0 && currentIndex < ROUTES.length - 1) {
          // Swipe izquierda = siguiente
          router.push(ROUTES[currentIndex + 1].href)
        } else if (diffX < 0 && currentIndex > 0) {
          // Swipe derecha = anterior
          router.push(ROUTES[currentIndex - 1].href)
        }
      }
    }

    window.addEventListener('touchstart', handleTouchStart, false)
    window.addEventListener('touchend', handleTouchEnd, false)

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [currentIndex, router])

  return (
    <div className="flex min-h-dvh flex-col bg-zr-background">
      <main className="flex-1 pb-32 px-4 pt-4 overflow-x-hidden">{children}</main>

      {/* Dock flotante tipo macOS */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="glass rounded-full backdrop-blur-xl border border-white/20 shadow-2xl px-3 py-2.5">
          <div className="flex gap-3">
            {ROUTES.map((route, idx) => {
              const Icon = route.icon
              const isActive = idx === currentIndex
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={`relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200 ${
                    isActive
                      ? 'glass bg-gradient-to-br from-zr-blue/50 to-zr-blue-deep/40 text-zr-blue-deep shadow-lg scale-110'
                      : 'text-zr-text-muted/60 hover:text-zr-text/80 hover:scale-105'
                  }`}
                  title={route.label}
                >
                  {isActive && (
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-zr-blue/30 to-zr-blue-deep/20 blur-md -z-10" />
                  )}
                  <Icon />
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Indicador swipe (visual hint) */}
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 text-xs text-zr-text-muted/40 font-medium">
        {currentIndex > 0 && <span>← </span>}
        {currentIndex < ROUTES.length - 1 && <span> →</span>}
      </div>
    </div>
  )
}
