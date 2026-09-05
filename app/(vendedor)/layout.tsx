'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esVendedor } from '@/lib/auth-helpers'
import { type ItemBarra } from '@/components/ui/BarraFlotante'
import { Marco } from '@/components/ui/Marco'
import { BannerSimulacion } from '@/components/ui/BannerSimulacion'
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
  // A pedido explícito del coordinador: administración y super_admin pueden
  // entrar a ver cómo es la app para ventas, sin tener que crear una cuenta
  // de prueba aparte (dirección académica NO — esta vista es solo de las
  // dos anteriores). Es solo el menú y las pantallas — los datos que ve y
  // puede tocar siguen siendo los que su propio rol ya permite, así que el
  // banner de abajo deja claro que esto es una vista de recorrido, no una
  // cuenta distinta.
  const [simulando, setSimulando] = useState(false)

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

      const rol = perfil?.role as UserRole | undefined

      if (rol === 'super_admin' || rol === 'admin') {
        setSimulando(true)
      } else if (!esVendedor(rol)) {
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
      {simulando && <BannerSimulacion etiqueta="Ventas" />}
      {children}
    </Marco>
  )
}
