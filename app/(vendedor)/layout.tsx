'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esVendedor } from '@/lib/auth-helpers'
import { BarraFlotante, type ItemBarra } from '@/components/ui/BarraFlotante'
import { IconoEstudiantes, IconoPerfil } from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'

// El rol Vendedor solo inscribe estudiantes al cobrar — nunca ve notas,
// asistencia ni configuración. Por eso vive en su propio grupo de rutas con
// su propia barra, de solo 2 secciones (docs/17_PLAN_CONSOLIDADO..., Sprint 5).
const NAV: ItemBarra[] = [
  { href: '/carga-ventas',     label: 'Inscribir', Icono: IconoEstudiantes },
  { href: '/perfil-vendedor',  label: 'Perfil',    Icono: IconoPerfil },
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
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-zr-bg">
      <div className="pb-28">{children}</div>
      <BarraFlotante items={NAV} deslizable={false} />
    </div>
  )
}
