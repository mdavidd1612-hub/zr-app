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
 * Reunión de Dirección Académica (oct. 2026, migración 143): el estudiante ve
 * el detalle COMPLETO de cada evaluación (nota y cuánto vale) durante todo el
 * módulo, apenas Dirección valida; ya no hay Teoría / Práctica / Puntualidad.
 * La participación y la nota final del módulo solo aparecen cuando el módulo
 * ya está completamente evaluado.
 */

type Estado = 'en_curso' | 'aprobado' | 'reprobado' | 'retirado'

interface Detalle {
  id: string
  titulo: string
  tipo: string
  fecha: string
  escala: number
  minimo: number
  peso: number
  nota: number | null
  esParticipacion: boolean
}

interface Nota {
  id: string
  moduloId: string
  modulo: string
  final: number | null
  evaluadoPct: number
  umbral: number
  estado: Estado
}

const ETIQUETA: Record<Estado, { texto: string; tono: 'exito' | 'error' | 'info' | 'neutro' }> = {
  aprobado:  { texto: 'Aprobado',  tono: 'exito'  },
  reprobado: { texto: 'Reprobado', tono: 'error'  },
  en_curso:  { texto: 'En curso',  tono: 'info'   },
  retirado:  { texto: 'Retirado',  tono: 'neutro' },
}

const ETIQUETA_TIPO: Record<string, string> = {
  examen: 'Examen', practica: 'Práctica', prepractica: 'Pre-práctica', exposicion: 'Exposición', participacion: 'Participación', otro: 'Otro',
}

export default function Notas() {
  const router = useRouter()
  const [notas, setNotas] = useState<Nota[]>([])
  const [detalles, setDetalles] = useState<Record<string, Detalle[]>>({})
  const [cargando, setCargando] = useState(true)

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
        .select('id, module_id, final_score, evaluated_pct, passing_threshold, status, modules(name, order_index)')
        .eq('student_id', user.id)

      const filas = data as unknown as {
        id: string
        module_id: string
        final_score: number | null
        evaluated_pct: number
        passing_threshold: number
        status: Estado
        modules: { name: string; order_index: number } | null
      }[] | null

      if (!filas) {
        setCargando(false)
        return
      }

      setNotas(
        filas
          .map((n) => ({
            id: n.id,
            moduloId: n.module_id,
            modulo: n.modules?.name ?? 'Módulo',
            orden: n.modules?.order_index ?? 0,
            final: n.final_score === null ? null : Number(n.final_score),
            evaluadoPct: Number(n.evaluated_pct),
            umbral: Number(n.passing_threshold),
            estado: n.status,
          }))
          .sort((a, b) => a.orden - b.orden),
      )

      // El detalle de todos los módulos de una vez: la base solo entrega las
      // evaluaciones de módulos ya validados por Dirección.
      const ids = filas.map((f) => f.module_id)
      const [{ data: defs }, { data: scores }] = await Promise.all([
        supabase
          .from('manual_exam_definitions')
          .select('id, module_id, title, kind, kind_detail, exam_date, scale_max, passing_min, weight_pct')
          .in('module_id', ids)
          .order('exam_date'),
        supabase.from('manual_exam_scores').select('definition_id, score').eq('student_id', user.id),
      ])
      const porDef = new Map((scores ?? []).map((x) => [x.definition_id, Number(x.score)]))
      const porModulo: Record<string, Detalle[]> = {}
      for (const e of defs ?? []) {
        ;(porModulo[e.module_id] ??= []).push({
          id: e.id,
          titulo: e.title,
          tipo: e.kind === 'otro' && e.kind_detail ? e.kind_detail : (ETIQUETA_TIPO[e.kind] ?? 'Otro'),
          esParticipacion: e.kind === 'participacion',
          fecha: e.exam_date,
          escala: Number(e.scale_max),
          minimo: Number(e.passing_min),
          peso: Number(e.weight_pct),
          nota: porDef.get(e.id) ?? null,
        })
      }
      setDetalles(porModulo)
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
  // Menos del mínimo en rojo, el mínimo o más en verde.
  const tono = (v: number, min: number) => (v < min ? 'text-zr-error' : 'text-zr-success')

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
            // La participación y el total solo se ven cuando el módulo ya está completo.
            const completo = n.evaluadoPct >= 100 && n.final !== null
            const lista = (detalles[n.moduloId] ?? []).filter((d) => completo || !d.esParticipacion)
            return (
              <Seccion key={n.id} numero={i + 1} titulo={n.modulo} delay={120 + i * 80}>
                <div className="zr-card overflow-hidden">
                  {lista.length === 0 ? (
                    <p className="px-6 py-5 text-sm text-zr-text-muted">
                      Tus notas de este módulo aparecerán cuando Dirección Académica las valide.
                    </p>
                  ) : (
                    <div className="divide-y divide-zr-border">
                      {lista.map((d) => (
                        <div key={d.id} className="flex items-center justify-between gap-3 px-6 py-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zr-text">{d.titulo}</p>
                            <p className="text-xs text-zr-text-muted">
                              {d.tipo} · vale {cifra(d.peso)} % · {new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-VE')}
                            </p>
                          </div>
                          <p className={`shrink-0 text-lg font-bold ${d.nota === null ? 'text-zr-text-muted' : tono(d.nota, d.minimo)}`}>
                            {d.nota === null ? '—' : cifra(d.nota)}
                            <span className="text-xs font-normal text-zr-text-muted"> / {d.escala}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Nota final: la calcula la base, aquí solo se muestra */}
                  <div className="flex items-center justify-between gap-4 border-t border-zr-border bg-zr-bg/50 px-6 py-5">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-text-muted">
                        Nota final
                      </p>
                      {completo ? (
                        <p className={`zr-metric mt-1 text-4xl ${tono(n.final as number, n.umbral)}`}>{cifra(n.final)}</p>
                      ) : (
                        <p className="mt-2 text-sm text-zr-text-muted">Se muestra cuando termine el módulo.</p>
                      )}
                      {/* El umbral siempre visible: cambia por módulo. */}
                      <p className="mt-2 text-sm text-zr-text-muted">Aprueba con {n.umbral}</p>
                    </div>
                    <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>
                  </div>
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
