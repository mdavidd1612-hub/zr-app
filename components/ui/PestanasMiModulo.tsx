'use client'

import { usePathname, useRouter } from 'next/navigation'

/**
 * "Mi módulo" del estudiante (19-nov-2026, propuesta C del estudio de unificar
 * pantallas): el módulo, la malla y el progreso son tres vistas del mismo
 * avance; antes eran pantallas sueltas a las que se llegaba por botones.
 */
const PESTANAS = [
  { href: '/clases', label: 'Este módulo' },
  { href: '/malla', label: 'Malla' },
  { href: '/progreso', label: 'Mi progreso' },
]

export function PestanasMiModulo() {
  const pathname = usePathname()
  const router = useRouter()
  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-zr-border bg-zr-surface p-1">
      {PESTANAS.map((p) => {
        const on = pathname === p.href
        return (
          <button
            key={p.href}
            onClick={() => router.replace(p.href)}
            className={`min-h-10 rounded-xl text-xs font-bold transition-colors ${
              on ? 'bg-zr-blue text-white' : 'text-zr-text-muted hover:text-zr-text'
            }`}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
