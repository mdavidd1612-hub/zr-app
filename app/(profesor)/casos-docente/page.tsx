'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CASOS_HABILITADO } from '@/lib/flags'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'

/**
 * Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, ajuste): quién trabajó el caso
 * cada día — SIN nombres, solo el % (barra animada, como el HTML de
 * referencia).
 *
 * A pedido explícito: el profesor NO tiene ningún control sobre la
 * generación de casos — ni un botón de prueba. Un cron semanal (migración
 * 076) genera, cada sábado, los 5 casos de la semana (lunes a viernes) de
 * cada módulo activo, todos distintos entre sí. El profesor solo ve el
 * resultado.
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

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      // Apagado a pedido del coordinador (lib/flags.ts) hasta que los
      // profesores revisen los casos generados por IA. Redirige por si
      // alguien llega por un enlace guardado o escribe la URL directo — el
      // menú ya no la ofrece.
      if (!CASOS_HABILITADO) {
        router.replace('/hoy')
        return
      }

      const { data: cohorte } = await supabase
        .from('cohorts')
        .select('id, current_module_id, modules(name)')
        .eq('teacher_id', user.id)
        .limit(1)
        .maybeSingle()

      let cohorteData = cohorte as unknown as {
        id: string; current_module_id: string | null; modules: { name: string } | null
      } | null

      // Vista de recorrido de super_admin (a pedido explícito del
      // coordinador): no tiene ningún programa asignado como profesor, así
      // que no hay nada que mostrarle. En vez de asignarle uno real (eso sí
      // "chocaría" con datos reales, como dijo el coordinador), se le
      // muestra en SOLO LECTURA el programa real más poblado que ya tenga
      // módulo — sin tocar su asignación de profesor.
      if (!cohorteData?.current_module_id) {
        const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (perfil?.role === 'super_admin') {
          const { data: cohortesConModulo } = await supabase
            .from('cohorts')
            .select('id, current_module_id, modules(name), students(id)')
            .not('current_module_id', 'is', null)
            .eq('status', 'activa')

          const filas = (cohortesConModulo ?? []) as unknown as {
            id: string; current_module_id: string; modules: { name: string } | null; students: { id: string }[] | null
          }[]
          const mejor = [...filas].sort((a, b) => (b.students?.length ?? 0) - (a.students?.length ?? 0))[0]

          if (mejor) {
            cohorteData = { id: mejor.id, current_module_id: mejor.current_module_id, modules: mejor.modules }
          }
        }
      }

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
          <p className="text-base font-semibold text-zr-text">Todavía no tienes programa asignado</p>
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
          Los casos se generan solos: cada sábado se prepara toda la semana (lunes a viernes),
          distinta cada día. No hace falta tocar nada aquí.
        </p>
      </div>

      <Seccion numero={1} titulo="Quién trabajó los casos" delay={180}>
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
