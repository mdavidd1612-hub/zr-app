'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'

/**
 * Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, ajuste): quién trabajó el caso
 * cada día — SIN nombres, solo el % (barra animada, como el HTML de
 * referencia). Los casos ya no se generan por botón: un cron diario
 * (migración 042) genera el caso del día siguiente hábil solo, con un día
 * de margen — el profesor no tiene que hacer nada.
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
  const [diaPrueba, setDiaPrueba] = useState(1)
  const [generando, setGenerando] = useState(false)
  const [avisoPrueba, setAvisoPrueba] = useState<string | null>(null)

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

  // La IA a veces tarda más de un minuto en responder (NVIDIA en capa
  // gratuita), y algunas redes cortan una conexión que lleva mucho tiempo
  // esperando. Un reintento silencioso cubre esos casos sin que el
  // profesor tenga que darse cuenta ni volver a tocar nada.
  async function probarGeneracion() {
    if (!modulo) return
    setGenerando(true)
    setAvisoPrueba(null)
    const supabase = createClient()

    let ultimoError: string | null = null
    for (let intento = 1; intento <= 2; intento++) {
      const { error } = await supabase.functions.invoke('generar-casos', {
        body: { moduleId: modulo.id, weekday: diaPrueba },
      })

      if (!error) {
        setAvisoPrueba(`Listo — ya puedes verlo como estudiante ese día (${DIAS[diaPrueba - 1]}).`)
        setGenerando(false)
        return
      }

      const contexto = (error as { context?: Response }).context
      if (contexto) {
        try {
          const cuerpo = await contexto.json()
          ultimoError = cuerpo.error?.message ?? error.message
        } catch {
          ultimoError = error.message
        }
      } else {
        // Sin "context": la conexión se cortó antes de que el servidor
        // respondiera — probablemente todavía estaba generando.
        ultimoError = `Se tardó demasiado (${error.message || 'sin respuesta'}).`
      }

      if (intento === 1) setAvisoPrueba('Está tardando más de lo normal, reintentando…')
    }

    setAvisoPrueba(`${ultimoError} Intenta de nuevo en un momento.`)
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

      <div className="flex gap-3 rounded-lg border border-zr-blue/25 bg-zr-blue/10 p-4">
        <p className="text-sm leading-relaxed text-zr-text">
          Los casos se generan solos: cada mañana se prepara el del siguiente día hábil, con un
          día de margen. No hace falta tocar nada aquí.
        </p>
      </div>

      {/* PRUEBA TEMPORAL: dispara la misma función que usa el cron, pero
          a mano y para el día que quieras — para confirmar que la IA
          está generando bien, sin esperar al horario automático. */}
      <Seccion numero={1} titulo="Prueba" delay={100}>
        <div className="zr-card space-y-3 p-6">
          <p className="text-sm text-zr-text-muted">
            Genera un caso ahora mismo, para el día que elijas — la misma función que usa el cron
            todos los días.
          </p>
          <select
            value={diaPrueba}
            onChange={(e) => setDiaPrueba(Number(e.target.value))}
            className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
          >
            {DIAS.map((d, i) => (
              <option key={d} value={i + 1}>{d}</option>
            ))}
          </select>
          {avisoPrueba && <p className="text-sm font-medium text-zr-text">{avisoPrueba}</p>}
          <button
            onClick={probarGeneracion}
            disabled={generando}
            className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-50"
          >
            {generando ? 'Generando… (hasta 1 minuto)' : `Generar caso de ${DIAS[diaPrueba - 1]}`}
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
