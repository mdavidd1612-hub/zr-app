'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esPersonal } from '@/lib/auth-helpers'
import { BarraFlotante } from '@/components/ui/BarraFlotante'
import { Campanita } from '@/components/ui/Campanita'
import {
  IconoPanel, IconoDuda, IconoProgreso, IconoDocumento, IconoPerfil,
} from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'

/**
 * El profesor también usa el teléfono. Fase 0
 * (docs/16_FASE0_PLAN_PROFESOR.md, Sprint A): Sesiones, Exámenes y Calificar
 * se retiran del menú (código intacto, se retoman en la fase siguiente).
 * Las 5 secciones que quedan caben todas en la barra fija — no hace falta
 * menú ☰.
 */

const NAV = [
  { href: '/hoy',                label: 'Hoy',      Icono: IconoPanel },
  { href: '/dudas-docente',      label: 'Dudas',    Icono: IconoDuda },
  { href: '/casos-docente',      label: 'Casos',    Icono: IconoProgreso },
  { href: '/contenido-docente',  label: 'Material',  Icono: IconoDocumento },
  { href: '/perfil-docente',     label: 'Perfil',    Icono: IconoPerfil },
]

export default function ProfesorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [verificando, setVerificando] = useState(true)

  // La pantalla de escaneo necesita cada centímetro: es la que se usa de
  // pie, con una mano, mientras entran los estudiantes. La barra flotante
  // encima le robaría espacio a la cámara y a la franja de resultado.
  const escaneando = /^\/escanear\//.test(pathname)

  useEffect(() => {
    const supabase = createClient()

    async function verificarRol() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()

      // Un estudiante que escriba /calificar en la barra de direcciones se va a
      // su pantalla. La RLS ya lo bloquea en la base; esto solo evita que vea
      // un panel vacío y crea que la app está rota.
      if (!esPersonal(perfil?.role as UserRole | undefined)) {
        router.replace('/')
        return
      }

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

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-zr-bg">
      {!escaneando && (
        <div className="fixed right-3 top-3 z-40 rounded-full border border-white/15 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <Campanita />
        </div>
      )}
      <div className={escaneando ? '' : 'pb-28'}>{children}</div>
      {!escaneando && <BarraFlotante items={NAV} />}
    </div>
  )
}
