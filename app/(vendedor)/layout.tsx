'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esVendedor } from '@/lib/auth-helpers'
import { type ItemBarra } from '@/components/ui/BarraFlotante'
import { Marco } from '@/components/ui/Marco'
import { IconoEstudiantes, IconoNotas, IconoPanel, IconoPerfil } from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'

// El rol Vendedor solo inscribe estudiantes al cobrar — nunca ve notas,
// asistencia ni configuración. Por eso vive en su propio grupo de rutas con
// su propia barra (docs/17_PLAN_CONSOLIDADO..., ajuste post-Sprint 7):
// Inscribir, Mis inscripciones (filtradas por programa) y Programas
// (cohortes de PTMA/PFTA, puede dar de alta una nueva) son secciones aparte.
const NAV: ItemBarra[] = [
  { href: '/carga-ventas',       label: 'Inscribir',      Icono: IconoEstudiantes },
  { href: '/mis-inscripciones',  label: 'Inscripciones',  Icono: IconoNotas },
  { href: '/programas',          label: 'Programas',      Icono: IconoPanel },
  { href: '/perfil-vendedor',    label: 'Perfil',         Icono: IconoPerfil },
]

export default function VendedorLayout({ children }: { children: React.ReactNode }) {
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

      if (!esVendedor(perfil?.role as UserRole | undefined)) {
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
    <Marco items={NAV} deslizable={false} campanita={false}>
      {children}
    </Marco>
  )
}
