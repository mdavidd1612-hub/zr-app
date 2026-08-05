'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function EstudianteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-dvh flex-col bg-zr-background">
      <main className="flex-1 pb-24 px-4 pt-4">{children}</main>

      {/* Navegación fija inferior: glassmorphism profesional */}
      <nav className="fixed bottom-0 left-0 right-0 z-50">
        {/* Backdrop blur layer */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent h-32 pointer-events-none" />

        {/* Glass container */}
        <div className="glass backdrop-blur-2xl border-t border-white/30 shadow-2xl">
          <div className="mx-auto flex max-w-md justify-around gap-2 p-2">
            <NavButton href="/carnet" icon="🎫" label="Carnet" isActive={pathname === '/carnet'} />
            <NavButton href="/clases" icon="📚" label="Clases" isActive={pathname === '/clases'} />
            <NavButton href="/examenes" icon="✏️" label="Exámenes" isActive={pathname === '/examenes'} />
            <NavButton href="/contenido" icon="📖" label="Material" isActive={pathname === '/contenido'} />
          </div>
        </div>
      </nav>
    </div>
  )
}

interface NavButtonProps {
  href: string
  icon: string
  label: string
  isActive: boolean
}

function NavButton({ href, icon, label, isActive }: NavButtonProps) {
  return (
    <Link
      href={href}
      className={`relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold transition-all duration-300 ${
        isActive
          ? 'glass bg-gradient-to-br from-zr-blue/40 to-zr-blue-deep/30 text-zr-blue-deep shadow-lg scale-110'
          : 'text-zr-text-muted hover:text-zr-text active:scale-95'
      }`}
    >
      {isActive && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-zr-blue/20 to-zr-blue-deep/10 blur-lg -z-10" />
      )}
      <span className="text-2xl">{icon}</span>
      <span className="tracking-tight">{label}</span>
    </Link>
  )
}
