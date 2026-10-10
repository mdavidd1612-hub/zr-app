'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

/**
 * T-311 · Vista de notas del estudiante.
 *
 * Todo lo que se muestra aquí lo calcula la base (función mis_notas_modulos):
 * el navegador no suma nada, si sumara dos pantallas podrían mostrar notas
 * distintas del mismo estudiante.
 *
 * Reunión de Dirección Académica (oct. 2026, migraciones 143-145): la
 * validación es POR EVALUACIÓN. El estudiante ve, durante todo el módulo, lo
 * que Dirección ya validó y lo va acumulando ("para que se pongan las pilas");
 * lo que aún no se valida aparece en rayitas. La nota final llega cuando el
 * módulo está 100 % evaluado.
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
}

interface Nota {
  moduloId: string
  modulo: string
  orden: number
  puntos: number
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

      const { data: resumen } = await supabase.rpc('mis_notas_modulos')
      const filas = resumen ?? []
      if (filas.length === 0) {
        setCargando(false)
        return
      }
      const ids = filas.map((f) => f.module_id)

      const [{ data: mods }, { data: defs }, { data: scores }] = await Promise.all([
        supabase.from('modules').select('id, name, order_index').in('id', ids),
        supabase
          .from('manual_exam_definitions')
          .select('id, module_id, title, kind, kind_detail, exam_date, scale_max, passing_min, weight_pct')
          .in('module_id', ids)
          .order('exam_date'),
        supabase.from('manual_exam_scores').select('definition_id, score').eq('student_id', user.id),
      ])
      const infoModulo = new Map((mods ?? []).map((m) => [m.id, m]))

      setNotas(
        filas
          .map((f) => ({
            moduloId: f.module_id,
            modulo: infoModulo.get(f.module_id)?.name ?? 'Módulo',
            orden: infoModulo.get(f.module_id)?.order_index ?? 0,
            puntos: Number(f.puntos),
            evaluadoPct: Number(f.evaluado_pct),
            umbral: Number(f.umbral),
            estado: f.estado as Estado,
          }))
          .sort((a, b) => a.orden - b.orden),
      )

      const porDef = new Map((scores ?? []).map((x) => [x.definition_id, Number(x.score)]))
      const porModulo: Record<string, Detalle[]> = {}
      for (const e of defs ?? []) {
        ;(porModulo[e.module_id] ??= []).push({
          id: e.id,
          titulo: e.title,
          tipo: e.kind === 'otro' && e.kind_detail ? e.kind_detail : (ETIQUETA_TIPO[e.kind] ?? 'Otro'),
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

  if (cargando) return <PantallaEsqueleto />

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
            const lista = detalles[n.moduloId] ?? []
            const completo = n.estado === 'aprobado' || n.estado === 'reprobado'
            // Puntos que se podían ganar con lo ya evaluado (50 % evaluado = 10 de 20).
            const posibles = n.evaluadoPct * 20 / 100
            const promedio = n.evaluadoPct > 0 ? n.puntos * 100 / n.evaluadoPct : 0
            return (
              <Seccion key={n.moduloId} numero={i + 1} titulo={n.modulo} delay={120 + i * 80}>
                <div className="zr-card overflow-hidden">
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

                  {/* Nota acumulada: la calcula la base con lo ya validado */}
                  <div className="flex items-center justify-between gap-4 border-t border-zr-border bg-zr-bg/50 px-6 py-5">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-text-muted">
                        {completo ? 'Nota final' : 'Llevas'}
                      </p>
                      <p className={`zr-metric mt-1 text-4xl ${tono(promedio, n.umbral)}`}>{cifra(n.puntos)}</p>
                      {!completo && (
                        <p className="mt-1 text-sm text-zr-text-muted">
                          de {cifra(Math.round(posibles * 100) / 100)} puntos evaluados · {cifra(n.evaluadoPct)} % del módulo
                        </p>
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
