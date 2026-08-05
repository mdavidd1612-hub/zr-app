'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconHome, IconExam, IconProgress, IconProfile } from '@/components/ui/NavIcons'

// Cuatro botones, ni uno más: spec/04 §1. Clases, Material y Notas se alcanzan
// desde la rejilla de accesos del inicio — están a un toque igual, y meterlos
// aquí dejaría cada botón por debajo del área táctil mínima de 48 px.
const NAVBAR_ITEMS = [
  { href: '/',          label: 'Inicio',   Icon: IconHome },
  { href: '/examenes',  label: 'Exámenes', Icon: IconExam },
  { href: '/progreso',  label: 'Progreso', Icon: IconProgress },
  { href: '/perfil',    label: 'Perfil',   Icon: IconProfile },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && !pathname.includes('/login') && !pathname.includes('/registro')) {
        router.push('/login')
      }
    })

    return () => subscription?.unsubscribe()
  }, [])

  // Swipe handler
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

      if (Math.abs(diffX) > diffY && Math.abs(diffX) > 50) {
        const currentIndex = NAVBAR_ITEMS.findIndex(item => item.href === pathname)

        if (diffX > 0 && currentIndex < NAVBAR_ITEMS.length - 1) {
          router.push(NAVBAR_ITEMS[currentIndex + 1].href)
        } else if (diffX < 0 && currentIndex > 0) {
          router.push(NAVBAR_ITEMS[currentIndex - 1].href)
        }
      }
    }

    window.addEventListener('touchstart', handleTouchStart, false)
    window.addEventListener('touchend', handleTouchEnd, false)

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [pathname])

  const isActive = (href: string) => pathname === href

  return (
    <div className="fixed inset-0 bg-zr-background flex flex-col" style={{ maxWidth: '375px', margin: '0 auto' }}>
      {/* Main content */}
      <div className="flex-1 overflow-y-auto w-full pb-24 scroll-smooth">
        {children}
      </div>

      {/* Floating navbar with glassmorphism */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="backdrop-blur-2xl bg-white/10 border border-white/20 rounded-full shadow-xl px-3 py-3 hover:bg-white/15 transition-all">
          <div className="flex gap-2">
            {NAVBAR_ITEMS.map((item) => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300 ${
                  isActive(item.href)
                    ? 'text-zr-blue bg-zr-blue/10'
                    : 'text-zr-text-muted hover:text-zr-text hover:bg-white/5'
                }`}
                title={item.label}
              >
                <item.Icon />
              </button>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}
