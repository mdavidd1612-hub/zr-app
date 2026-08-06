'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esAdmin } from '@/lib/auth-helpers'
import { BarraFlotante } from '@/components/ui/BarraFlotante'
import { IconoPanel, IconoCandado, IconoPerfil } from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'

const NAV = [
  { href: '/panel',            label: 'Panel',          Icono: IconoPanel },
  { href: '/consentimientos',  label: 'Consentimientos', Icono: IconoCandado },
  { href: '/perfil-admin',     label: 'Perfil',          Icono: IconoPerfil },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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

      if (!esAdmin(perfil?.role as UserRole | undefined)) {
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
      <BarraFlotante items={NAV} />
    </div>
  )
}
