'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'

/**
 * Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, Sprint D): quién trabajó el caso
 * cada día — SIN nombres, solo el % (barra animada, como el HTML de
 * referencia). Los casos en sí los genera una Edge Function con IA
 * (`generar-casos`), 5 por semana (lunes a viernes) para el módulo actual.
 */

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

interface DiaProgreso {
  dia: string
  hechos: number
  total: number
  futuro: boolean
}

function lunesDeEstaSemana() {
  const hoy = new Date()
  const diaISO = hoy.getDay() === 0 ? 7 : hoy.getDay()
  const l = new Date(hoy)
  l.setDate(l.getDate() - (diaISO - 1))
  l.setHours(0, 0, 0, 0)
  return l
}

export default function CasosDocente() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [modulo, setModulo] = useState<{ id: string; nombre: string } | null>(null)
  const [dias, setDias] = useState<DiaProgreso[]>([])
  const [generando, setGenerando] = useState(false)
  const [avisoIA, setAvisoIA] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: cohorte } = await supabase
        .from('cohorts')
        .select('id, current_module_id, modules(name)')
        .eq('teacher_id', user.id)
        .limit(1)
        .maybeSingle()

      const cohorteData = cohorte as unknown as {
        id: string; current_module_id: string | null; modules: { name: string } | null
      } | null

      if (!cohorteData?.current_module_id) {
        setCargando(false)
        return
      }

      setModulo({ id: cohorteData.current_module_id, nombre: cohorteData.modules?.name ?? 'Módulo' })

      const { data: estudiantesCohorte } = await supabase
        .from('students').select('id').eq('cohort_id', cohorteData.id)
      const ids = (estudiantesCohorte ?? []).map((e) => e.id)
      const totalEstudiantes = ids.length

      const lunes = lunesDeEstaSemana()
      const hoyISO = new Date().toISOString().slice(0, 10)

      const conteos = await Promise.all(
        DIAS.map(async (dia, i) => {
          const fecha = new Date(lunes)
          fecha.setDate(fecha.getDate() + i)
          const fechaISO = fecha.toISOString().slice(0, 10)

          if (fechaISO > hoyISO || ids.length === 0) {
            return { dia, hechos: 0, total: totalEstudiantes, futuro: fechaISO > hoyISO }
          }

          const { count } = await supabase
            .from('case_completions')
            .select('id', { count: 'exact', head: true })
            .eq('case_date', fechaISO)
            .in('student_id', ids)

          return { dia, hechos: count ?? 0, total: totalEstudiantes, futuro: false }
        }),
      )

      setDias(conteos)
      setCargando(false)
    }

    cargar()
  }, [router])

  async function generarConIA() {
    if (!modulo) return
    setGenerando(true)
    setAvisoIA(null)
    const supabase = createClient()
    const { error } = await supabase.functions.invoke('generar-casos', { body: { moduleId: modulo.id } })

    if (error) {
      const contexto = (error as { context?: Response }).context
      let mensaje = 'No se pudieron generar los casos.'
      if (contexto) {
        try {
          const cuerpo = await contexto.json()
          mensaje = cuerpo.error?.message ?? mensaje
        } catch {
          // se queda con el mensaje genérico
        }
      }
      setAvisoIA(mensaje)
    } else {
      setAvisoIA('Casos de la semana generados. Ya están disponibles para los estudiantes.')
    }
    setGenerando(false)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  if (!modulo) {
    return (
      <div className="space-y-11 px-5 pt-14">
        <Encabezado sobretitulo="Panel del profesor" titulo="Casos" />
        <div className="zr-card p-8 text-center">
          <p className="text-base font-semibold text-zr-text">Todavía no tienes cohorte asignada</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <Encabezado
        sobretitulo="Panel del profesor"
        titulo="Casos"
        descripcion={`Módulo ${modulo.nombre}`}
      />

      <Regla delay={60} />

      <Seccion numero={1} titulo="Casos de la semana con IA" delay={100}>
        <div className="zr-card space-y-3 p-6">
          <p className="text-sm text-zr-text-muted">
            Genera los 5 casos de lunes a viernes para este módulo, con IA. Si ya existen, se
            reemplazan.
          </p>
          {avisoIA && <p className="text-sm font-medium text-zr-text">{avisoIA}</p>}
          <button
            onClick={generarConIA}
            disabled={generando}
            className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-50"
          >
            {generando ? 'Generando…' : 'Generar casos de la semana'}
          </button>
        </div>
      </Seccion>

      <Seccion numero={2} titulo="Quién trabajó los casos" delay={180}>
        <div className="space-y-3">
          {dias.map((d) => {
            const pct = d.total > 0 ? Math.round((d.hechos / d.total) * 100) : 0
            return (
              <div key={d.dia} className="zr-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zr-text">{d.dia}</p>
                  {d.futuro ? (
                    <span className="text-xs text-zr-text-muted">Todavía no llega</span>
                  ) : (
                    <span className="text-xs font-bold text-zr-blue-mid">{d.hechos}/{d.total}</span>
                  )}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zr-border/60">
                  <div
                    className="h-full rounded-full bg-zr-blue transition-all duration-700 ease-out"
                    style={{ width: d.futuro ? '0%' : `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-3 rounded-lg border border-zr-blue/25 bg-zr-blue/10 p-4">
          <p className="text-sm leading-relaxed text-zr-text">
            Solo ves el número, no los nombres. En esta fase el caso no tiene nota, y una lista de
            nombres solo produciría presión.
          </p>
        </div>
      </Seccion>
    </div>
  )
}
