'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla } from '@/components/ui/Editorial'
import { BloqueCuenta } from '@/components/ui/BloqueCuenta'
import { BotonActivarPush } from '@/components/ui/BotonActivarPush'
import { leerSimulacionSabado, guardarSimulacionSabado } from '@/lib/demo-sabado'
import type { UserRole } from '@/lib/types'

/** Ruta /perfil-admin: (app), (profesor) y (admin) son grupos del mismo
 *  árbol de rutas, así que no pueden compartir /perfil sin chocar. */

interface Perfil {
  nombre: string
  cedula: string
  rol: UserRole
  correo: string | null
}

export default function PerfilAdmin() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)
  const [simulado, setSimulado] = useState(false)
  const [preparando, setPreparando] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      setSimulado(leerSimulacionSabado())

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

      setCargando(false)
    }

    cargar()
  }, [router])

  // PRUEBA TEMPORAL: al activar, además de marcar el interruptor, asegura
  // que exista una sesión de clase para HOY (fecha real) en TODAS las
  // cohortes que ya tengan algún estudiante — si no, el estudiante de
  // prueba puede quedar en una cohorte sin sesión de hoy y el QR le dice
  // "no tienes clase programada hoy" aunque el interruptor esté encendido.
  // Se quita del todo cuando la academia lo pida (docs/15_FASE0_PLAN_ADMIN.md).
  async function alternarSimulacion() {
    const nuevo = !simulado
    setSimulado(nuevo)
    guardarSimulacionSabado(nuevo)
    if (!nuevo) return

    setPreparando(true)
    const supabase = createClient()
    const hoyISO = new Date().toISOString().slice(0, 10)

    const { data: cohortesConEstudiantes } = await supabase
      .from('students')
      .select('cohort_id, cohorts(id, current_module_id)')
      .not('cohort_id', 'is', null)

    const filas = (cohortesConEstudiantes ?? []) as unknown as {
      cohort_id: string; cohorts: { id: string; current_module_id: string | null } | null
    }[]

    const cohortesUnicas = new Map(
      filas
        .filter((f) => f.cohorts?.current_module_id)
        .map((f) => [f.cohort_id, f.cohorts!.current_module_id!]),
    )

    for (const [cohorteId, moduloId] of cohortesUnicas) {
      const { data: existente } = await supabase
        .from('class_sessions').select('id').eq('cohort_id', cohorteId).eq('session_date', hoyISO).maybeSingle()
      if (existente) continue

      const { data: ultima } = await supabase
        .from('class_sessions').select('week_number').eq('cohort_id', cohorteId)
        .order('week_number', { ascending: false }).limit(1).maybeSingle()

      await supabase.from('class_sessions').insert({
        cohort_id: cohorteId,
        module_id: moduloId,
        session_date: hoyISO,
        week_number: (ultima?.week_number ?? 0) + 1,
        status: 'programada',
      })
    }
    setPreparando(false)
  }

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

      <Seccion numero={1} titulo="Cuenta" delay={120}>
        <BloqueCuenta
          nombre={perfil.nombre}
          cedula={perfil.cedula}
          rol={perfil.rol}
          correo={perfil.correo}
          onActualizado={(d) => setPerfil((p) => p && { ...p, nombre: d.nombre, correo: d.correo })}
        />
        <BotonActivarPush />
      </Seccion>

      {/* PRUEBA TEMPORAL — se quita del todo cuando la academia lo pida. */}
      <Seccion numero={2} titulo="Prueba" delay={200}>
        <button
          onClick={alternarSimulacion}
          disabled={preparando}
          className="zr-card flex w-full items-center justify-between gap-4 p-5 text-left disabled:opacity-60"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zr-text">Simular que hoy es sábado</p>
            <p className="mt-0.5 text-xs text-zr-text-muted">
              {preparando
                ? 'Preparando una sesión de hoy…'
                : 'Activa el calendario de sábado y crea una clase de hoy si hace falta'}
            </p>
          </div>
          <span
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              simulado ? 'bg-zr-blue' : 'bg-zr-border'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                simulado ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
      </Seccion>
    </div>
  )
}
