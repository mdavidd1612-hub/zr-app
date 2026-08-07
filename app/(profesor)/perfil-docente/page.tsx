'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla } from '@/components/ui/Editorial'
import { BloqueCuenta } from '@/components/ui/BloqueCuenta'
import { BotonActivarPush } from '@/components/ui/BotonActivarPush'
import type { UserRole } from '@/lib/types'

/**
 * La ruta se llama /perfil-docente y no /perfil porque (app) y (profesor) son
 * dos grupos de rutas del mismo árbol: dos /perfil se resolverían a la misma
 * URL y Next se niega a compilar.
 */

interface Perfil {
  nombre: string
  cedula: string
  rol: UserRole
  correo: string | null
}

interface Cohorte {
  id: string
  nombre: string
  modulo: string
  estudiantes: number
}

export default function PerfilDocente() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
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
        setPerfil({
          nombre: p.full_name,
          cedula: p.cedula,
          rol: p.role as UserRole,
          correo: p.contact_email,
        })
      }

      const { data: cs } = await supabase
        .from('cohorts')
        .select('id, name, modules(name), students(id)')
        .eq('teacher_id', user.id)
        .eq('status', 'activa')

      const filas = cs as unknown as {
        id: string; name: string
        modules: { name: string } | null
        students: { id: string }[] | null
      }[] | null

      if (filas) {
        setCohortes(
          filas.map((c) => ({
            id: c.id,
            nombre: c.name,
            modulo: c.modules?.name ?? 'Módulo',
            estudiantes: c.students?.length ?? 0,
          })),
        )
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
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
          Mi cuenta
        </p>
        <h1 className="zr-display mt-3 text-4xl text-zr-text">{perfil.nombre}</h1>
      </header>

      <Regla delay={60} />

      <Seccion numero={1} titulo="Mis cohortes" delay={120}>
        {cohortes.length === 0 ? (
          <div className="zr-card p-6">
            <p className="text-base font-semibold text-zr-text">Sin cohortes asignadas</p>
            <p className="mt-2 text-sm text-zr-text-muted">
              Administración es quien asigna las cohortes. Habla con ellos si crees que esto
              es un error.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cohortes.map((c) => (
              <div key={c.id} className="zr-card p-5">
                <p className="text-base font-semibold text-zr-text">{c.nombre}</p>
                <p className="mt-1.5 text-sm text-zr-text-muted">
                  {c.modulo} · {c.estudiantes} estudiante{c.estudiantes === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      <Seccion numero={2} titulo="Cuenta" delay={200}>
        <BloqueCuenta
          nombre={perfil.nombre}
          cedula={perfil.cedula}
          rol={perfil.rol}
          correo={perfil.correo}
        />
        <BotonActivarPush />
      </Seccion>
    </div>
  )
}
