'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Etiqueta } from '@/components/ui/Editorial'

/**
 * T-415 · Mapa de dominio del estudiante.
 *
 * Lo que NO lleva esta pantalla, y no es un olvido:
 *   · Sin porcentajes ni barras de nivel.
 *   · Sin puntos, insignias ni rachas  (eso es Fase 2).
 *   · Sin comparación con otros estudiantes.
 * Solo tres estados por competencia. Ver AGENTS.md §7.
 */

type Estado = 'dominado' | 'en_progreso' | 'no_iniciado'

interface Competencia {
  id: string
  nombre: string
  semana: number
  modulo: string
  estado: Estado
}

const ETIQUETA: Record<Estado, { texto: string; tono: 'exito' | 'info' | 'neutro' }> = {
  dominado:    { texto: 'Dominada',    tono: 'exito'  },
  en_progreso: { texto: 'En progreso', tono: 'info'   },
  no_iniciado: { texto: 'Pendiente',   tono: 'neutro' },
}

export default function Progreso() {
  const router = useRouter()
  const [competencias, setCompetencias] = useState<Competencia[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      // La vista devuelve TODAS las competencias del módulo, tengan o no fila en
      // mastery_map. Una competencia sin fila es 'pendiente', no una que falta.
      const { data } = await supabase
        .from('v_mi_dominio')
        .select('*')
        .eq('student_id', user.id)
        .order('week_number', { ascending: true })
        .order('order_in_week', { ascending: true })

      if (data) {
        setCompetencias(
          data.map((c) => ({
            id: c.learning_guide_id!,
            nombre: c.sub_competency_name!,
            semana: c.week_number!,
            modulo: c.module_name!,
            estado: (c.status ?? 'no_iniciado') as Estado,
          })),
        )
      }

      setCargando(false)
    }

    cargar()
  }, [router])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando competencias…</p>
      </div>
    )
  }

  const dominadas = competencias.filter((c) => c.estado === 'dominado').length

  // Agrupadas por semana: así es como se estudia y como está la guía en papel.
  const porSemana = competencias.reduce<Record<number, Competencia[]>>((acc, c) => {
    ;(acc[c.semana] ??= []).push(c)
    return acc
  }, {})

  const semanas = Object.keys(porSemana).map(Number).sort((a, b) => a - b)

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-11">
        <header className="animate-rise">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
            {competencias[0]?.modulo ?? 'Mi módulo'}
          </p>
          <h1 className="zr-display mt-3 text-4xl text-zr-text">Mi progreso</h1>
          <p className="mt-3 text-base text-zr-text-muted">
            {competencias.length === 0
              ? 'Todavía no hay competencias cargadas para tu módulo.'
              : `Dominas ${dominadas} de ${competencias.length} competencias.`}
          </p>
        </header>

        <Regla delay={60} />

        {competencias.length === 0 ? (
          <div className="zr-card animate-rise p-8" style={{ animationDelay: '120ms' }}>
            <p className="text-base font-semibold text-zr-text">Aún no hay nada que mostrar</p>
            <p className="mt-2 text-sm text-zr-text-muted">
              Las competencias aparecen cuando tu cohorte empieza un módulo y las guías están
              cargadas. Pregúntale a tu profesor si crees que esto es un error.
            </p>
          </div>
        ) : (
          semanas.map((semana, i) => (
            <Seccion
              key={semana}
              numero={i + 1}
              titulo={`Semana ${semana}`}
              delay={120 + i * 70}
            >
              <div className="space-y-3">
                {porSemana[semana].map((c) => {
                  const e = ETIQUETA[c.estado]
                  return (
                    <div
                      key={c.id}
                      className={`zr-card flex items-center justify-between gap-4 p-5 ${
                        c.estado === 'dominado' ? 'border-zr-success/25' : ''
                      }`}
                    >
                      <p
                        className={`min-w-0 text-base font-medium ${
                          c.estado === 'no_iniciado' ? 'text-zr-text-muted' : 'text-zr-text'
                        }`}
                      >
                        {c.nombre}
                      </p>
                      <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>
                    </div>
                  )
                })}
              </div>
            </Seccion>
          ))
        )}

        <p className="pb-4 text-center text-xs leading-relaxed text-zr-text-muted">
          Tu profesor marca una competencia como dominada cuando te ve hacerla en el taller.
          No se compara con nadie más.
        </p>
      </div>
    </div>
  )
}
