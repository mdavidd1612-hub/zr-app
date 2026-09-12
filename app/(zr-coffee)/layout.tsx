'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esZRCoffee, INICIO_POR_ROL } from '@/lib/auth-helpers'
import { type ItemBarra } from '@/components/ui/BarraFlotante'
import { Marco } from '@/components/ui/Marco'
import { IconoTaza, IconoPerfil } from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'

// ZR Coffee (migración 095, pedido explícito del coordinador): dejó de ser
// una sección dentro de administración, visible solo por cuenta
// (zr_coffee_managers), y pasó a ser un rol propio con su propio grupo de
// rutas -- mismo patrón que (vendedor). Cecilia entra como `admin` o como
// `zr_coffee` y cambia entre los dos desde su perfil (CambiarRol.tsx).
const NAV: ItemBarra[] = [
  { href: '/zr-coffee',        label: 'ZR Coffee', Icono: IconoTaza },
  { href: '/perfil-zr-coffee', label: 'Perfil',    Icono: IconoPerfil },
]

export default function ZRCoffeeLayout({ children }: { children: React.ReactNode }) {
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

      const rol = perfil?.role as UserRole | undefined
      if (!esZRCoffee(rol)) {
        router.replace(INICIO_POR_ROL[rol ?? 'estudiante'] ?? '/')
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
