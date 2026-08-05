'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconHome, IconClasses, IconExam, IconProfile } from '@/components/ui/NavIcons'

const NAVBAR_ITEMS = [
  { href: '/', label: 'Inicio', Icon: IconHome },
  { href: '/clases', label: 'Clases', Icon: IconClasses },
  { href: '/examenes', label: 'Examen', Icon: IconExam },
  { href: '/perfil', label: 'Perfil', Icon: IconProfile },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && !pathname.includes('/login') && !pathname.includes('/registro')) {
        router.push('/login')
      }
    })

    return () => subscription?.unsubscribe()
  }, [])

  return (
    <div className="fixed inset-0 bg-zr-background flex flex-col" style={{ maxWidth: '375px', margin: '0 auto' }}>
      {/* iPhone status bar */}
      <div className="h-12 bg-zr-background flex items-center justify-between px-4 text-xs text-zr-text-muted">
        <span>9:41</span>
        <span className="text-xs">📶 📡 🔋</span>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto w-full pb-28">
        {children}
      </div>

      {/* Floating navbar with glassmorphism */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-2 py-2">
        {/* Glassmorphism container */}
        <div className="backdrop-blur-2xl bg-white/10 border border-white/20 rounded-full shadow-2xl flex gap-1 px-2 py-2">
          {NAVBAR_ITEMS.map((item) => {
            const isActive = pathname === item.href
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-zr-blue/30 text-zr-blue shadow-lg'
                    : 'text-zr-text-muted hover:text-zr-text'
                }`}
                title={item.label}
              >
                <item.Icon />
                {isActive && (
                  <div className="absolute inset-0 rounded-full bg-zr-blue/10 blur-md -z-10" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
