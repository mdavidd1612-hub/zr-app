'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esAdmin } from '@/lib/auth-helpers'
import { BarraFlotante, type ItemBarra } from '@/components/ui/BarraFlotante'
import {
  IconoPanel, IconoEstudiantes, IconoCandado, IconoPerfil, IconoCalendario, IconoNotas,
} from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'

// Cuatro botones, igual que en los otros dos roles: spec/04 §0 pide que toda
// acción principal quede a un toque del pulgar.
const NAV: ItemBarra[] = [
  { href: '/panel',            label: 'Panel',          Icono: IconoPanel },
  { href: '/estudiantes',      label: 'Estudiantes',    Icono: IconoEstudiantes },
  { href: '/consentimientos',  label: 'Consentimientos', Icono: IconoCandado },
  { href: '/perfil-admin',     label: 'Perfil',          Icono: IconoPerfil },
]

// Cohortes, Reportes y Configuración se alcanzan desde la rejilla de accesos
// de /panel — pero eso las deja invisibles en la barra: entrar a /cohortes
// desde ahí no dejaba ningún rastro de "estás aquí". El botón ☰ de
// BarraFlotante muestra esta lista completa y resalta la actual.
const TODAS: ItemBarra[] = [
  ...NAV.slice(0, 3),
  { href: '/cohortes',   label: 'Cohortes', Icono: IconoCalendario },
  { href: '/reportes',   label: 'Reportes', Icono: IconoNotas },
  NAV[3],
]

const TODAS_SUPER: ItemBarra[] = [
  ...TODAS.slice(0, 5),
  { href: '/configuracion', label: 'Configuración', Icono: IconoPanel },
  TODAS[5],
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)
  const [esSuper, setEsSuper] = useState(false)

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

      setEsSuper(perfil?.role === 'super_admin')
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
      <BarraFlotante items={NAV} todasLasSecciones={esSuper ? TODAS_SUPER : TODAS} />
    </div>
  )
}
