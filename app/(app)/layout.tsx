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
      <div className="flex-1 overflow-y-auto w-full pb-20">
        {children}
      </div>

      {/* Floating navbar - Standard size like Instagram */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zr-background border-t border-zr-border z-50">
        <div className="flex justify-around">
          {NAVBAR_ITEMS.map((item) => {
            const isActive = pathname === item.href
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex-1 flex flex-col items-center justify-center py-3 px-2 transition-colors duration-200 ${
                  isActive
                    ? 'text-zr-blue border-t-2 border-zr-blue'
                    : 'text-zr-text-muted hover:text-zr-text'
                }`}
                title={item.label}
              >
                <div className="w-6 h-6">
                  <item.Icon />
                </div>
                <span className="text-xs font-medium mt-1">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
