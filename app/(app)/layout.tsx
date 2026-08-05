'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAVBAR_ITEMS = [
  { href: '/', label: 'Inicio', icon: '🏠' },
  { href: '/clases', label: 'Clases', icon: '📚' },
  { href: '/examenes', label: 'Examen', icon: '✅' },
  { href: '/perfil', label: 'Perfil', icon: '👤' },
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
      <div className="h-12 bg-zr-background flex items-center justify-between px-4 text-xs text-zr-text">
        <span>9:41</span>
        <span>📶 📡 🔋</span>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto w-full">
        {children}
      </div>

      {/* Bottom navbar */}
      <nav className="bg-zr-background border-t border-white/10 px-4 py-3 flex justify-around">
        {NAVBAR_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center gap-1 py-2 transition-colors ${
                isActive ? 'text-zr-blue' : 'text-zr-text-muted hover:text-zr-text'
              }`}
              title={item.label}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
