'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CASOS, diaSemanaISO, fechaISO, type Caso, type PasoCaso } from '@/lib/casos-fase0'
import { CASOS_HABILITADO } from '@/lib/flags'
import { IconoFlechaAtras, IconoCheck } from '@/components/ui/Iconos'

// Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, Sprint D): si el profesor ya
// generó los casos de la semana con IA para el módulo del estudiante, se
// usan esos — si no, se cae al banco fijo de Fase 0 estudiante.
async function cargarCaso(dia: number): Promise<Caso | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return CASOS[dia] ?? null

  const { data: est } = await supabase
    .from('students').select('cohorts(current_module_id)').eq('id', user.id).single()
  const moduloId = (est as unknown as { cohorts: { current_module_id: string | null } | null } | null)
    ?.cohorts?.current_module_id

  if (moduloId) {
    const { data: casoIA } = await supabase
      .from('ai_cases')
      .select('titulo, escenario, preguntas, reflexion, referencia')
      .eq('module_id', moduloId)
      .eq('weekday', dia)
      .maybeSingle()

    if (casoIA) {
      return {
        dia: ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'][dia] ?? '',
        titulo: casoIA.titulo,
        escenario: casoIA.escenario,
        pasos: casoIA.preguntas as unknown as PasoCaso[],
        reflexion: casoIA.reflexion,
        referencia: casoIA.referencia as unknown as Caso['referencia'],
      }
    }
  }

  return CASOS[dia] ?? null
}

// El caso no se califica ni se envía a ningún lado más allá de marcarlo
// hecho — en el teléfono (para pintar el calendario al instante) y en la
// base (para que el profesor vea el % agregado, sin nombres).
async function marcarCasoHecho(fecha: string, dia: number) {
  try {
    localStorage.setItem(`zr_caso_${fecha}`, '1')
  } catch {
    // localStorage puede fallar en modo privado; no es crítico para Fase 0.
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('case_completions').upsert(
    { student_id: user.id, case_date: fecha, weekday: dia },
    { onConflict: 'student_id,case_date' },
  )
}

export default function TrabajarCaso() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [caso, setCaso] = useState<Caso | null>(null)
  const [respuestas, setRespuestas] = useState<number[]>([])
  const [reflexionTxt, setReflexionTxt] = useState('')
  const [revelado, setRevelado] = useState(false)

  const hoy = new Date()
  const dia = diaSemanaISO(hoy)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/login')
        return
      }
      // Apagado a pedido del coordinador (lib/flags.ts) hasta que los
      // profesores revisen los casos generados por IA. Redirige por si
      // alguien llega por un enlace guardado — Inicio ya no ofrece el botón.
      if (!CASOS_HABILITADO) {
        router.replace('/')
        return
      }
      setCaso(await cargarCaso(dia))
      setCargando(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  if (!caso) {
    return (
      <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
        <button onClick={() => router.push('/')} className="mb-6 text-zr-blue-mid">
          <IconoFlechaAtras size={22} />
        </button>
        <p className="text-sm text-zr-text-muted">Hoy no hay caso: es sábado, día de clase.</p>
      </div>
    )
  }

  const listo = respuestas.length === caso.pasos.length && respuestas.every((r) => r !== undefined)

  function elegir(pasoIdx: number, opcionIdx: number) {
    setRespuestas((prev) => {
      const nuevo = [...prev]
      nuevo[pasoIdx] = opcionIdx
      return nuevo
    })
  }

  function revelar() {
    setRevelado(true)
    void marcarCasoHecho(fechaISO(hoy), dia)
  }

  return (
    <div className="min-h-dvh bg-zr-bg pb-28">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-zr-border bg-zr-bg/95 px-5 py-4 backdrop-blur">
        <button onClick={() => router.push('/')} aria-label="Volver" className="text-zr-text">
          <IconoFlechaAtras size={22} />
        </button>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-zr-text-muted">
          Caso del {caso.dia.toLowerCase()}
        </p>
      </div>

      <div className="space-y-8 px-5 pt-6">
        <div className="rounded-xl bg-gradient-to-br from-zr-blue-deep to-zr-blue p-6 text-white">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">El caso</p>
          <p className="zr-display text-xl">{caso.titulo}</p>
          <p className="mt-3 text-sm leading-relaxed text-white/90">{caso.escenario}</p>
        </div>

        {caso.pasos.map((paso, pi) => (
          <div key={pi} className="space-y-3">
            <p className="text-base font-semibold text-zr-text">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-zr-blue text-xs text-white">
                {pi + 1}
              </span>
              {paso.pregunta}
            </p>
            <div className="space-y-2">
              {paso.opciones.map((op, oi) => {
                const elegida = respuestas[pi] === oi
                const esCorrecta = oi === paso.correcta

                let estilo = 'border-zr-border bg-zr-surface text-zr-text'
                if (elegida && !revelado) estilo = 'border-zr-blue bg-zr-blue/10 text-zr-text'
                if (revelado) {
                  if (esCorrecta) estilo = 'border-zr-success bg-zr-success/10 text-zr-text'
                  else if (elegida) estilo = 'border-zr-error bg-zr-error/10 text-zr-text'
                  else estilo = 'border-zr-border bg-zr-surface text-zr-text-muted opacity-70'
                }

                return (
                  <button
                    key={oi}
                    onClick={() => !revelado && elegir(pi, oi)}
                    disabled={revelado}
                    className={`flex w-full items-center justify-between gap-3 rounded-zr border-2 px-4 py-3.5 text-left text-sm transition-colors ${estilo} ${revelado ? 'cursor-default' : ''}`}
                  >
                    <span>{op}</span>
                    {revelado && esCorrecta && <IconoCheck size={16} className="shrink-0 text-zr-success" />}
                    {revelado && elegida && !esCorrecta && (
                      <span className="shrink-0 text-xs font-bold text-zr-error">Tu respuesta</span>
                    )}
                  </button>
                )
              })}
            </div>
            {revelado && respuestas[pi] !== paso.correcta && (
              <p className="text-xs font-semibold text-zr-error">
                Esa no era — la correcta está marcada en verde arriba.
              </p>
            )}
          </div>
        ))}

        <div className="space-y-2">
          <p className="text-base font-semibold text-zr-text">Para pensar</p>
          <p className="text-sm text-zr-text-muted">{caso.reflexion}</p>
          <textarea
            value={reflexionTxt}
            onChange={(e) => setReflexionTxt(e.target.value)}
            placeholder="Escribe tu razonamiento, aunque sea breve…"
            className="min-h-[96px] w-full rounded-lg border border-zr-border bg-zr-surface p-4 text-sm text-zr-text outline-none focus:border-zr-blue"
          />
        </div>

        {!revelado ? (
          <button
            onClick={revelar}
            disabled={!listo}
            className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white transition-colors active:bg-zr-blue-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            Revisar mis respuestas
          </button>
        ) : (
          <div className="space-y-4">
            <div className="zr-card p-5 text-center">
              <p className="zr-metric text-3xl text-zr-text">
                {respuestas.filter((r, i) => r === caso.pasos[i].correcta).length}/{caso.pasos.length}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-zr-text-muted">
                Respuestas correctas
              </p>
            </div>

            <div className="rounded-xl border border-zr-success/30 bg-zr-success/10 p-5">
              <div className="mb-2 flex items-center gap-2 text-zr-success">
                <IconoCheck size={18} />
                <p className="text-sm font-bold uppercase tracking-wide">Respuesta de referencia</p>
              </div>
              <p className="text-sm leading-relaxed text-zr-text">{caso.referencia.que}</p>
            </div>

            <div className="zr-card p-5">
              <p className="mb-3 text-sm font-bold text-zr-text">Por qué no las otras</p>
              <ul className="space-y-2">
                {caso.referencia.porQueNo.map((r, i) => (
                  <li key={i} className="text-sm leading-relaxed text-zr-text-muted">
                    • {r}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-zr-border pt-4 text-sm leading-relaxed text-zr-text">
                {caso.referencia.quedaClaro}
              </p>
            </div>

            <button
              onClick={() => router.push('/')}
              className="min-h-14 w-full rounded-lg border border-zr-blue text-base font-bold text-zr-blue transition-colors active:bg-zr-blue/10"
            >
              Volver al inicio
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
