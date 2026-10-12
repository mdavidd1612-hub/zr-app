'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { useEsqueletoVisible } from '@/lib/useEsqueletoVisible'
import { Seccion, Regla } from '@/components/ui/Editorial'
import { BloqueCuenta } from '@/components/ui/BloqueCuenta'
import { BotonActivarPush } from '@/components/ui/BotonActivarPush'
import { leerSimulacionSabado, guardarSimulacionSabado } from '@/lib/demo-sabado'
import { ordenarCohortesPorPrioridad } from '@/lib/cohortes'
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

      // Módulos que Dirección le asignó (migración 150): son los que dicta, y
      // el programa es el de esos módulos. Sin ninguno asignado se muestra lo de
      // siempre (el módulo vigente de la cohorte que tenga a su cargo).
      const { data: asig } = await supabase
        .from('teacher_module_assignments')
        .select('cohort_id, modules!inner(id, name, order_index, program_id)')
        .eq('teacher_id', user.id)
      const mios = ((asig ?? []) as unknown as { cohort_id: string | null; modules: { id: string; name: string; order_index: number; program_id: string } }[])
        .map((a) => ({ ...a.modules, cohort_id: a.cohort_id }))
        .sort((x, y) => x.order_index - y.order_index)

      // Sin filtrar por dueño: la base entrega las cohortes de los programas donde
      // este profesor tiene módulos asignados.
      const { data: cs } = await supabase
        .from('cohorts')
        .select('id, name, program_id, modules(name), students(id)')
        .eq('status', 'activa')

      const filas = cs as unknown as {
        id: string; name: string; program_id: string
        modules: { name: string } | null
        students: { id: string }[] | null
      }[] | null

      if (filas) {
        setCohortes(
          ordenarCohortesPorPrioridad(filas).map((c) => {
            // Una asignación con cohorte vale solo para esa cohorte; sin cohorte, para todas.
            const dePrograma = mios.filter((m) => m.program_id === c.program_id && (m.cohort_id === null || m.cohort_id === c.id))
            return {
              id: c.id,
              nombre: c.name,
              modulo: dePrograma.length > 0
                ? dePrograma.map((m) => `Módulo ${m.order_index} · ${m.name}`).join(' y ')
                : c.modules?.name ?? 'Módulo',
              estudiantes: c.students?.length ?? 0,
            }
          }),
        )
      }

      setCargando(false)
    }

    cargar()
  }, [router])

  const mostrarEsqueleto = useEsqueletoVisible(cargando)
  if (mostrarEsqueleto || !perfil) {
    return <PantallaEsqueleto />
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

      <Seccion numero={3} titulo="Temario" delay={180}>
        <Link href="/temario-docente" className="zr-card zr-card-interactive flex items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <p className="text-base font-semibold text-zr-text">Qué debo impartir</p>
            <p className="mt-0.5 text-sm text-zr-text-muted">Temas de cada semana de tus módulos vigentes</p>
          </div>
          <span aria-hidden className="shrink-0 text-zr-text-muted">›</span>
        </Link>
      </Seccion>

      <Seccion numero={4} titulo="Cuenta" delay={220}>
        <BloqueCuenta
          nombre={perfil.nombre}
          cedula={perfil.cedula}
          rol={perfil.rol}
          correo={perfil.correo}
          onActualizado={(d) => setPerfil((p) => p && { ...p, nombre: d.nombre, correo: d.correo })}
        />
        <BotonActivarPush />
      </Seccion>

      {/* Interruptor de simulación de sábado: solo para super_admin
          recorriendo la app como si fuera profesor (vista de recorrido). Un
          profesor real nunca lo ve. */}
      {perfil.rol === 'super_admin' && (
        <Seccion numero={5} titulo="Prueba" delay={280}>
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
              <p className="mt-0.5 text-xs text-zr-text-muted">Solo para probar pantallas en la vista de recorrido.</p>
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
      )}
    </div>
  )
}
