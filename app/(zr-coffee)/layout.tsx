'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esZRCoffee, INICIO_POR_ROL } from '@/lib/auth-helpers'
import { type ItemBarra } from '@/components/ui/BarraFlotante'
import { Marco } from '@/components/ui/Marco'
import { Tour } from '@/components/ui/Tour'
import { useTour } from '@/lib/useTour'
import { PASOS_POR_ROL } from '@/lib/tour-pasos'
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

  // Tour guiado (migración 173, pedido explícito del coordinador): este
  // layout solo se entra como zr_coffee de verdad (esZRCoffee() arriba
  // manda a cualquier otro rol a lo suyo), así que no hace falta distinguir
  // vista de recorrido aquí.
  const { pasos: pasosTour, incremental: tourIncremental, terminar: terminarTour } =
    useTour(PASOS_POR_ROL.zr_coffee, !verificando)

  if (verificando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Verificando acceso…</p>
      </div>
    )
  }

  return (
    // `imprimible`: el QR de refrigerio ahora se puede imprimir (pedido
    // explícito del coordinador, oct. 2026) -- sin esto, la barra de
    // navegación y la campanita salían en la hoja impresa.
    <Marco items={NAV} deslizable={false} campanita={false} imprimible>
      {children}
      {pasosTour && <Tour pasos={pasosTour} incremental={tourIncremental} onTerminado={terminarTour} />}
    </Marco>
  )
}
