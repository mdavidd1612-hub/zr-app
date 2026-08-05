'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esPersonal } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * El profesor trabaja en una tablet apoyada en el banco de trabajo, no en un
 * teléfono en la mano. Por eso barra lateral en pantalla ancha; pero el mismo
 * profesor revisa la cola de calificación desde su teléfono el domingo, así que
 * en pantalla angosta la navegación baja a una fila de pestañas.
 */

const NAV = [
  { href: '/hoy',          label: 'Hoy',       glifo: '◆' },
  { href: '/sesiones',     label: 'Sesiones',  glifo: '◈' },
  { href: '/crear-examen', label: 'Exámenes',  glifo: '◇' },
  { href: '/calificar',    label: 'Calificar', glifo: '◉' },
]

export default function ProfesorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [nombre, setNombre] = useState('')
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function verificarRol() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

      // Un estudiante que escribe /calificar en la barra de direcciones se va a
      // su propia pantalla. La RLS ya lo bloquea en la base; esto solo evita que
      // vea un panel vacío y crea que la app está rota.
      if (!esPersonal(perfil?.role as UserRole | undefined)) {
        router.replace('/')
        return
      }

      setNombre(perfil?.full_name ?? '')
      setVerificando(false)
    }

    verificarRol()
  }, [router])

  if (verificando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Verificando acceso…</p>
      </div>
    )
  }

  const activo = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="min-h-dvh bg-zr-bg lg:flex">
      {/* Barra lateral · solo en pantalla ancha */}
      <aside className="hidden w-72 shrink-0 border-r border-zr-border px-6 py-10 lg:block">
        <div className="mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
            ZR Mecademy
          </p>
          <p className="zr-display mt-2 text-2xl text-zr-text">Docencia</p>
          {nombre && <p className="mt-3 text-sm text-zr-text-muted">{nombre}</p>}
        </div>

        <nav className="space-y-1">
          {NAV.map((item, i) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-base font-medium transition-all ${
                activo(item.href)
                  ? 'bg-zr-blue/12 text-zr-blue'
                  : 'text-zr-text-muted hover:bg-zr-surface hover:text-zr-text'
              }`}
            >
              <span className="w-4 text-center text-xs opacity-70">
                {String(i + 1).padStart(2, '0')}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        <button
          onClick={async () => {
            await createClient().auth.signOut()
            router.replace('/login')
          }}
          className="mt-10 w-full rounded-lg border border-zr-border px-4 py-3 text-sm font-medium text-zr-text-muted transition-colors hover:border-zr-error/40 hover:text-zr-error"
        >
          Cerrar sesión
        </button>
      </aside>

      {/* Contenido */}
      <main className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</main>

      {/* Pestañas · solo en pantalla angosta */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zr-border bg-zr-surface/95 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg">
          {NAV.map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                activo(item.href) ? 'text-zr-blue' : 'text-zr-text-muted'
              }`}
            >
              <span className="text-base leading-none">{item.glifo}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
