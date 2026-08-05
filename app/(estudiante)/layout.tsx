import Link from 'next/link'

export default function EstudianteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-zr-background">
      <main className="flex-1 pb-20 p-4">{children}</main>

      {/* Navegación fija inferior: 4 botones de 56 px mínimo */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-zr-border bg-white">
        <div className="mx-auto flex max-w-md justify-around gap-1">
          <NavButton href="/carnet" icon="🎫" label="Carnet" />
          <NavButton href="/clases" icon="📚" label="Clases" />
          <NavButton href="/examenes" icon="✏️" label="Exámenes" />
          <NavButton href="/contenido" icon="📖" label="Material" />
        </div>
      </nav>
    </div>
  )
}

function NavButton({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-zr-text transition-colors hover:bg-zr-background active:bg-zr-blue active:text-white"
    >
      <span className="text-2xl">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
