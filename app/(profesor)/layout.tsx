'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esPersonal } from '@/lib/auth-helpers'
import { BarraFlotante } from '@/components/ui/BarraFlotante'
import {
  IconoPanel, IconoCalendario, IconoExamen, IconoCalificar, IconoPerfil, IconoDocumento,
} from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'

/**
 * El profesor también usa el teléfono. Revisa la cola de calificación el
 * domingo desde el sofá y abre la asistencia el sábado de pie en el taller.
 * Mismo ancho de referencia y misma barra flotante que el estudiante: son la
 * misma aplicación, no dos.
 */

const NAV = [
  { href: '/hoy',          label: 'Hoy',       Icono: IconoPanel },
  { href: '/sesiones',     label: 'Sesiones',  Icono: IconoCalendario },
  { href: '/crear-examen', label: 'Exámenes',  Icono: IconoExamen },
  { href: '/calificar',    label: 'Calificar', Icono: IconoCalificar },
  { href: '/perfil-docente', label: 'Perfil',  Icono: IconoPerfil },
]

const TODAS = [
  ...NAV.slice(0, 4),
  { href: '/contenido-docente', label: 'Material', Icono: IconoDocumento },
  NAV[4],
]

export default function ProfesorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
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
      <div className="pb-28">{children}</div>
      <BarraFlotante items={NAV} todasLasSecciones={TODAS} />
    </div>
  )
}
