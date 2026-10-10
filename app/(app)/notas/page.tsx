'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * T-311 · Vista de notas del estudiante.
 *
 * Todo lo que se muestra aquí lo calcula la base (final_score y status son
 * columnas que mantiene un disparador). El navegador no suma nada: si sumara,
 * dos pantallas podrían mostrar notas distintas del mismo estudiante.
 *
 * Corrección (sept. 2026, junto con la migración 110/111): lo que antes era
 * "participación" ahora se llama Puntualidad y se calcula solo de la
 * asistencia -- "Participación" pasó a ser un campo nuevo y distinto
 * (`class_participation_score`), el único de los cuatro que pone el
 * profesor a mano.
 */

type Estado = 'en_curso' | 'aprobado' | 'reprobado' | 'retirado'

interface Detalle {
  id: string
  titulo: string
  tipo: string
  fecha: string
  escala: number
  minimo: number
  nota: number | null
}

interface Nota {
  id: string
  moduloId: string
  modulo: string
  teoria: number | null
  practica: number | null
  puntualidad: number | null
  sabadosContados: number | null
  sabadosTotal: number | null
  participacionClase: number | null
  final: number | null
  umbral: number
  estado: Estado
}

const ETIQUETA: Record<Estado, { texto: string; tono: 'exito' | 'error' | 'info' | 'neutro' }> = {
  aprobado:  { texto: 'Aprobado',  tono: 'exito'  },
  reprobado: { texto: 'Reprobado', tono: 'error'  },
  en_curso:  { texto: 'En curso',  tono: 'info'   },
  retirado:  { texto: 'Retirado',  tono: 'neutro' },
}

export default function Notas() {
  const router = useRouter()
  const [notas, setNotas] = useState<Nota[]>([])
  const [cargando, setCargando] = useState(true)
  // Segundo nivel (reunión de sept. 2026): primero lo general; el detalle por
  // evaluación solo si el estudiante lo abre.
  const [abierto, setAbierto] = useState<string | null>(null)
  const [detalles, setDetalles] = useState<Record<string, Detalle[]>>({})
  const [cargandoDetalle, setCargandoDetalle] = useState<string | null>(null)

  async function alternarDetalle(n: Nota) {
    if (abierto === n.moduloId) {
      setAbierto(null)
      return
    }
    setAbierto(n.moduloId)
    if (detalles[n.moduloId]) return

    setCargandoDetalle(n.moduloId)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: defs }, { data: scores }] = await Promise.all([
      supabase
        .from('manual_exam_definitions')
        .select('id, title, kind, kind_detail, exam_date, scale_max, passing_min')
        .eq('module_id', n.moduloId)
        .order('exam_date'),
      supabase.from('manual_exam_scores').select('definition_id, score').eq('student_id', user?.id ?? ''),
    ])
    const porDef = new Map((scores ?? []).map((x) => [x.definition_id, Number(x.score)]))
    setDetalles((d) => ({
      ...d,
      [n.moduloId]: (defs ?? []).map((e) => ({
        id: e.id,
        titulo: e.title,
        tipo: e.kind === 'otro' && e.kind_detail ? e.kind_detail : e.kind === 'practica' ? 'Práctica' : e.kind === 'examen' ? 'Examen' : 'Otro',
        fecha: e.exam_date,
        escala: Number(e.scale_max),
        minimo: Number(e.passing_min),
        nota: porDef.get(e.id) ?? null,
      })),
    }))
    setCargandoDetalle(null)
  }

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('module_enrollments')
        .select('id, module_id, puntualidad_sabados, puntualidad_sabados_total, theory_score, practice_score, participation_score, class_participation_score, final_score, passing_threshold, status, modules(name, order_index)')
        .eq('student_id', user.id)

      const filas = data as unknown as {
        id: string
        module_id: string
        puntualidad_sabados: number | null
        puntualidad_sabados_total: number | null
        theory_score: number | null
        practice_score: number | null
        participation_score: number | null
        class_participation_score: number | null
        final_score: number | null
        passing_threshold: number
        status: Estado
        modules: { name: string; order_index: number } | null
      }[] | null

      if (filas) {
        setNotas(
          filas
            .map((n) => ({
              id: n.id,
              moduloId: n.module_id,
              modulo: n.modules?.name ?? 'Módulo',
              orden: n.modules?.order_index ?? 0,
              teoria: n.theory_score === null ? null : Number(n.theory_score),
              practica: n.practice_score === null ? null : Number(n.practice_score),
              puntualidad: n.participation_score === null ? null : Number(n.participation_score),
              sabadosContados: n.puntualidad_sabados,
              sabadosTotal: n.puntualidad_sabados_total,
              participacionClase: n.class_participation_score === null ? null : Number(n.class_participation_score),
              final: n.final_score === null ? null : Number(n.final_score),
              umbral: Number(n.passing_threshold),
              estado: n.status,
            }))
            .sort((a, b) => a.orden - b.orden),
        )
      }

      setCargando(false)
    }

    cargar()
  }, [router])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando notas…</p>
      </div>
    )
  }

  const cifra = (v: number | null) => (v === null ? '—' : v.toFixed(v % 1 === 0 ? 0 : 1))

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-11">
        <BotonVolver href="/" />

        <header className="animate-rise">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
            Académico
          </p>
          <h1 className="zr-display mt-3 text-4xl text-zr-text">Mis notas</h1>
        </header>

        <Regla delay={60} />

        {notas.length === 0 ? (
          <div className="zr-card animate-rise p-8" style={{ animationDelay: '120ms' }}>
            <p className="text-base font-semibold text-zr-text">Todavía no tienes notas</p>
            <p className="mt-2 text-sm text-zr-text-muted">
              Aparecerán cuando tu profesor las cargue y Dirección Académica las valide.
            </p>
          </div>
        ) : (
          notas.map((n, i) => {
            const e = ETIQUETA[n.estado]
            return (
              <Seccion key={n.id} numero={i + 1} titulo={n.modulo} delay={120 + i * 80}>
                <div className="zr-card overflow-hidden">
                  {/* Las cuatro notas parciales */}
                  <div className="grid grid-cols-4 divide-x divide-zr-border">
                    {[
                      { etiqueta: 'Teoría', valor: n.teoria, sub: null as string | null },
                      { etiqueta: 'Práctica', valor: n.practica, sub: null },
                      { etiqueta: 'Puntualidad', valor: n.puntualidad, sub: n.sabadosTotal ? `${n.sabadosContados ?? 0} de ${n.sabadosTotal} sáb.` : null },
                      { etiqueta: 'Participación', valor: n.participacionClase, sub: null },
                    ].map((p) => (
                      <div key={p.etiqueta} className="px-1.5 py-5 text-center">
                        <p className="zr-metric text-xl text-zr-text">{cifra(p.valor)}</p>
                        <p className="mt-2 text-[9px] font-semibold uppercase leading-tight tracking-wider text-zr-text-muted">
                          {p.etiqueta}
                        </p>
                        {p.sub && <p className="mt-1 text-[9px] leading-tight text-zr-text-muted">{p.sub}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Nota final: la calcula la base, aquí solo se muestra */}
                  <div className="flex items-center justify-between gap-4 border-t border-zr-border bg-zr-bg/50 px-6 py-5">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-text-muted">
                        Nota final
                      </p>
                      <p className="zr-metric mt-1 text-4xl text-zr-blue">{cifra(n.final)}</p>
                      {/* El umbral siempre visible: cambia por módulo. */}
                      <p className="mt-2 text-sm text-zr-text-muted">Aprueba con {n.umbral}</p>
                    </div>
                    <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>
                  </div>

                  {/* Segundo nivel: detalle por evaluación, solo si lo abre */}
                  <button
                    onClick={() => alternarDetalle(n)}
                    className="flex min-h-11 w-full items-center justify-center border-t border-zr-border text-sm font-bold text-zr-blue-mid"
                  >
                    {abierto === n.moduloId ? 'Ocultar detalle' : 'Ver detalle por evaluación'}
                  </button>
                  {abierto === n.moduloId && (
                    <div className="space-y-2 border-t border-zr-border bg-zr-bg/50 px-5 py-4">
                      {cargandoDetalle === n.moduloId ? (
                        <p className="text-sm text-zr-text-muted">Cargando…</p>
                      ) : (detalles[n.moduloId] ?? []).length === 0 ? (
                        <p className="text-sm text-zr-text-muted">Este módulo no tiene evaluaciones registradas.</p>
                      ) : (
                        (detalles[n.moduloId] ?? []).map((d) => (
                          <div key={d.id} className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-zr-text">{d.titulo}</p>
                              <p className="text-xs text-zr-text-muted">
                                {d.tipo} · {new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-VE')}
                              </p>
                            </div>
                            <p className={`shrink-0 text-base font-bold ${d.nota !== null && d.nota < d.minimo ? 'text-zr-error' : 'text-zr-text'}`}>
                              {d.nota === null ? '—' : cifra(d.nota)}
                              <span className="text-xs font-normal text-zr-text-muted"> / {d.escala}</span>
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </Seccion>
            )
          })
        )}

        <p className="pb-4 text-center text-xs leading-relaxed text-zr-text-muted">
          Las faltas no reprueban. Si algo no cuadra, háblalo con tu profesor.
        </p>
      </div>
    </div>
  )
}
