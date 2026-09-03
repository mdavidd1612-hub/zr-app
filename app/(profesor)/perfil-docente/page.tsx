'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla } from '@/components/ui/Editorial'
import { BloqueCuenta } from '@/components/ui/BloqueCuenta'
import { BotonActivarPush } from '@/components/ui/BotonActivarPush'
import { leerSimulacionSabado, guardarSimulacionSabado } from '@/lib/demo-sabado'
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
  const [simulado, setSimulado] = useState(false)

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

      {/* Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, Sprint F): mini carnet —
          nombre, cédula y módulo actual, nada más. */}
      <Seccion numero={1} titulo="Carnet" delay={100}>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zr-navy via-zr-navy to-zr-blue-deep p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">ZR Mecademy · Profesor</p>
          <p className="mt-2 text-base font-bold text-white">{perfil.nombre}</p>
          <p className="mt-0.5 text-xs tabular-nums text-white/60">{perfil.cedula}</p>
          <p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/70">
            {cohortes[0]?.modulo ?? 'Sin módulo asignado'}
          </p>
        </div>
      </Seccion>

      <Seccion numero={2} titulo="Mis programas" delay={140}>
        {cohortes.length === 0 ? (
          <div className="zr-card p-6">
            <p className="text-base font-semibold text-zr-text">Sin programas asignados</p>
            <p className="mt-2 text-sm text-zr-text-muted">
              Administración es quien asigna los programas. Habla con ellos si crees que esto
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

      <Seccion numero={3} titulo="Cuenta" delay={220}>
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
      <Seccion numero={4} titulo="Prueba" delay={280}>
        <button
          onClick={() => {
            const nuevo = !simulado
            setSimulado(nuevo)
            guardarSimulacionSabado(nuevo)
          }}
          className="zr-card flex w-full items-center justify-between gap-4 p-5 text-left"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zr-text">Simular que hoy es sábado</p>
            <p className="mt-0.5 text-xs text-zr-text-muted">Solo para probar pantallas sin esperar al sábado real.</p>
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
