'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esAdmin, esDireccionAcademica } from '@/lib/auth-helpers'
import { salirDeVistaRecorrido } from '@/lib/vista-recorrido'
import { Marco } from '@/components/ui/Marco'
import { Tour } from '@/components/ui/Tour'
import { useTour } from '@/lib/useTour'
import { rolDeTour, PASOS_POR_ROL, SIN_PASOS_DE_TOUR } from '@/lib/tour-pasos'
import { NAV, TODAS, NAV_DIRECCION, NAV_SUPER, TODAS_DIRECCION, TODAS_SUPER } from '@/lib/nav-direccion'
import type { UserRole } from '@/lib/types'

// Los menús viven en lib/nav-direccion.ts (fuente única, compartida con el
// layout de Unidades) -- no se redefinen aquí.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)
  const [rol, setRol] = useState<UserRole | null>(null)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    // Mismo bug que en app/(profesor)/layout.tsx (7-nov-2026): una falla
    // transitoria al leer el rol (perfil llega vacío por un hiccup de red,
    // no porque el rol de verdad no califique) se trataba como "no es
    // admin" y expulsaba a mitad de uso. Se distingue "todavía no se pudo
    // confirmar" (reintenta) de "se confirmó que no es admin" (ahí sí sale).
    async function verificarRol(intento = 0) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!vigente) return
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil, error: errorPerfil } = await supabase
        .from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (!vigente) return

      if ((errorPerfil || !perfil) && intento < 2) {
        setTimeout(() => { if (vigente) verificarRol(intento + 1) }, 400)
        return
      }

      if (!perfil) return
      if (!esAdmin(perfil.role as UserRole | undefined)) {
        router.replace('/')
        return
      }

      // Llegar aquí (a su propia área real, no de recorrido) significa que
      // ya no está "viendo como" nadie más — se apaga la cookie por si
      // había quedado prendida de una vista de recorrido anterior sin
      // haber tocado "Salir a mi panel" (p. ej. navegó para atrás en vez de
      // usar el botón). Sin esto, la próxima vez que abriera la app podía
      // volver a caer en esa vista vieja en vez de en su panel real.
      salirDeVistaRecorrido()

      setRol((perfil?.role as UserRole) ?? null)
      setVerificando(false)
    }

    verificarRol()
    return () => { vigente = false }
  }, [router])

  if (verificando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Verificando acceso…</p>
      </div>
    )
  }

  const secciones = rol === 'super_admin' ? TODAS_SUPER : esDireccionAcademica(rol) ? TODAS_DIRECCION : TODAS

  return (
    <AdminLayoutConTour rol={rol}>
      <Marco
        items={rol === 'super_admin' ? NAV_SUPER : esDireccionAcademica(rol) ? NAV_DIRECCION : NAV}
        todasLasSecciones={secciones}
        // Bug real de producción (sept. 2026): `deslizable` viene en `true`
        // por defecto (pensado para la barra del estudiante, donde deslizar
        // cambia de sección). Nadie lo apagó aquí, así que cualquier gesto
        // horizontal en una pantalla de administración -- por ejemplo
        // deslizar la fila de programas (PTMA/PFTA) en Asistencia -- se
        // interpretaba como "cambiar de sección" y mandaba a otra pantalla
        // sin que nadie lo pidiera. El personal nunca pidió deslizar para
        // navegar; se apaga.
        deslizable={false}
        imprimible
      >
        {children}
      </Marco>
    </AdminLayoutConTour>
  )
}

// Tour guiado (migración 173, pedido explícito del coordinador): admin y
// Dirección Académica comparten el mismo tour (mismo panel) -- super_admin
// nunca tiene tour (rolDeTour() devuelve null para ese rol).
function AdminLayoutConTour({ rol, children }: { rol: UserRole | null; children: React.ReactNode }) {
  const grupo = rolDeTour(rol)
  const { pasos: pasosTour, incremental: tourIncremental, terminar: terminarTour } =
    useTour(grupo ? PASOS_POR_ROL[grupo] : SIN_PASOS_DE_TOUR, grupo !== null)

  return (
    <>
      {children}
      {pasosTour && <Tour pasos={pasosTour} incremental={tourIncremental} onTerminado={terminarTour} />}
    </>
  )
}

