'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Etiqueta } from '@/components/ui/Editorial'

/**
 * T-311 · Vista de notas del estudiante.
 *
 * Todo lo que se muestra aquí lo calcula la base (final_score y status son
 * columnas que mantiene un disparador). El navegador no suma nada: si sumara,
 * dos pantallas podrían mostrar notas distintas del mismo estudiante.
 */

type Estado = 'en_curso' | 'aprobado' | 'reprobado' | 'retirado'

interface Nota {
  id: string
  modulo: string
  teoria: number | null
  practica: number | null
  participacion: number | null
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
        .select('id, theory_score, practice_score, participation_score, final_score, passing_threshold, status, modules(name, order_index)')
        .eq('student_id', user.id)

      const filas = data as unknown as {
        id: string
        theory_score: number | null
        practice_score: number | null
        participation_score: number | null
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
              modulo: n.modules?.name ?? 'Módulo',
              orden: n.modules?.order_index ?? 0,
              teoria: n.theory_score === null ? null : Number(n.theory_score),
              practica: n.practice_score === null ? null : Number(n.practice_score),
              participacion: n.participation_score === null ? null : Number(n.participation_score),
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
              Aparecerán cuando tu profesor cargue las calificaciones del módulo que estás
              cursando.
            </p>
          </div>
        ) : (
          notas.map((n, i) => {
            const e = ETIQUETA[n.estado]
            return (
              <Seccion key={n.id} numero={i + 1} titulo={n.modulo} delay={120 + i * 80}>
                <div className="zr-card overflow-hidden">
                  {/* Las tres notas parciales */}
                  <div className="grid grid-cols-3 divide-x divide-zr-border">
                    {[
                      { etiqueta: 'Teoría', valor: n.teoria },
                      { etiqueta: 'Práctica', valor: n.practica },
                      { etiqueta: 'Participación', valor: n.participacion },
                    ].map((p) => (
                      <div key={p.etiqueta} className="px-4 py-5 text-center">
                        <p className="zr-metric text-2xl text-zr-text">{cifra(p.valor)}</p>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zr-text-muted">
                          {p.etiqueta}
                        </p>
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
