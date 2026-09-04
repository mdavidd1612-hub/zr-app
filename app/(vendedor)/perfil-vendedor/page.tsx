'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla } from '@/components/ui/Editorial'
import { BloqueCuenta } from '@/components/ui/BloqueCuenta'
import { CambiarRol } from '@/components/ui/CambiarRol'
import type { UserRole } from '@/lib/types'

interface Perfil {
  nombre: string
  cedula: string
  rol: UserRole
  correo: string | null
}

export default function PerfilVendedor() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, cedula, role, contact_email')
        .eq('id', user.id)
        .single()

      if (p) {
        setPerfil({ nombre: p.full_name, cedula: p.cedula, rol: p.role as UserRole, correo: p.contact_email })
      }

      setCargando(false)
    }

    cargar()
  }, [router])

  if (cargando || !perfil) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <header className="animate-rise">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Mi cuenta</p>
        <h1 className="zr-display mt-3 text-4xl text-zr-text">{perfil.nombre}</h1>
      </header>

      <Regla delay={60} />

      <Seccion numero={1} titulo="Cuenta" delay={120}>
        <BloqueCuenta
          nombre={perfil.nombre}
          cedula={perfil.cedula}
          rol={perfil.rol}
          correo={perfil.correo}
          onActualizado={(d) => setPerfil((p) => p && { ...p, nombre: d.nombre, correo: d.correo })}
        />
      </Seccion>

      <CambiarRol rolActual={perfil.rol} numero={2} />
    </div>
  )
}
