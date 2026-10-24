'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { ContextoDocente, type ContextoSel } from '@/components/ui/ContextoDocente'

/**
 * Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, Sprint C): dudas de los
 * estudiantes tal cual las escribieron — no se responden desde aquí, son
 * insumo para la clínica del sábado. "Dudas de la semana" las agrupa una
 * Edge Function (`resumir-dudas`) que llama a NVIDIA NIM con los textos,
 * nunca con nombres ni cédulas.
 */

interface Duda {
  id: string
  body: string
  createdAt: string
}

interface RespuestaUnidad {
  id: string
  body: string
  isOfficial: boolean
}

interface DudaUnidad {
  id: string
  body: string
  unitTitle: string
  isFaq: boolean
  respuestas: RespuestaUnidad[]
}

function DudasInterno({ ctx }: { ctx: ContextoSel }) {
  const router = useRouter()
  const [dudas, setDudas] = useState<Duda[]>([])
  const [digest, setDigest] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoDigest, setCargandoDigest] = useState(false)
  const [errorDigest, setErrorDigest] = useState<string | null>(null)

  // Aula Virtual (180): dudas ligadas a una unidad de este módulo -- aquí sí
  // se responde por escrito, a diferencia de las de arriba (insumo para la
  // clínica del sábado). userId propio para el responder_id del insert.
  const [dudasUnidad, setDudasUnidad] = useState<DudaUnidad[]>([])
  const [respuestaTexto, setRespuestaTexto] = useState<Record<string, string>>({})
  const [enviandoRespuesta, setEnviandoRespuesta] = useState<string | null>(null)
  const [miId, setMiId] = useState('')

  async function cargarDudasUnidad() {
    const supabase = createClient()
    const { data: unidades } = await supabase.from('units').select('id, title').eq('module_id', ctx.moduleId)
    const idsUnidad = (unidades ?? []).map((u) => u.id)
    if (idsUnidad.length === 0) { setDudasUnidad([]); return }

    const { data } = await supabase
      .from('doubts')
      .select('id, body, unit_id, is_faq, doubt_responses(id, body, is_official)')
      .in('unit_id', idsUnidad)
      .order('created_at', { ascending: false })

    const nombreUnidad = new Map((unidades ?? []).map((u) => [u.id, u.title]))
    setDudasUnidad(
      (data ?? []).map((d) => ({
        id: d.id, body: d.body, isFaq: d.is_faq,
        unitTitle: nombreUnidad.get(d.unit_id as string) ?? '',
        respuestas: ((d.doubt_responses ?? []) as unknown as Array<{ id: string; body: string; is_official: boolean }>)
          .map((r) => ({ id: r.id, body: r.body, isOfficial: r.is_official })),
      })),
    )
  }

  async function responderDuda(doubtId: string, oficial: boolean) {
    const texto = respuestaTexto[doubtId]
    if (!texto?.trim() || !miId) return
    setEnviandoRespuesta(doubtId)
    const supabase = createClient()
    const { error } = await supabase.from('doubt_responses').insert({
      doubt_id: doubtId, responder_id: miId, body: texto.trim(), is_official: oficial,
    })
    if (!error) {
      setRespuestaTexto((r) => ({ ...r, [doubtId]: '' }))
      await cargarDudasUnidad()
    }
    setEnviandoRespuesta(null)
  }

  async function alternarFaq(doubtId: string, actual: boolean) {
    const supabase = createClient()
    await supabase.from('doubts').update({ is_faq: !actual }).eq('id', doubtId)
    await cargarDudasUnidad()
  }

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      setMiId(user.id)

      // Solo las dudas del programa y módulo elegidos (migración 164).
      const { data: alumnos } = await supabase.from('students').select('id').eq('cohort_id', ctx.cohortId)
      const ids = (alumnos ?? []).map((a) => a.id)
      const { data } = ids.length
        ? await supabase
            .from('doubts')
            .select('id, body, created_at')
            .in('student_id', ids)
            .eq('module_id', ctx.moduleId)
            .order('created_at', { ascending: false })
        : { data: [] }

      setDudas((data ?? []).map((d) => ({ id: d.id, body: d.body, createdAt: d.created_at })))
      await cargarDudasUnidad()
      setCargando(false)
    }
    cargar()
  }, [router, ctx.cohortId, ctx.moduleId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function pedirResumen() {
    setCargandoDigest(true)
    setErrorDigest(null)
    const supabase = createClient()
    const { data, error } = await supabase.functions.invoke('resumir-dudas', { body: { cohort_id: ctx.cohortId, module_id: ctx.moduleId } })

    if (error) {
      const contexto = (error as { context?: Response }).context
      let mensaje = 'No se pudo generar el resumen.'
      if (contexto) {
        try {
          const cuerpo = await contexto.json()
          mensaje = cuerpo.error?.message ?? mensaje
        } catch {
          // se queda con el mensaje genérico
        }
      }
      setErrorDigest(mensaje)
    } else if (data?.digest?.length) {
      setDigest(data.digest)
    } else {
      setErrorDigest(data?.mensaje ?? 'Todavía no hay suficientes dudas para resumir.')
    }
    setCargandoDigest(false)
  }

  if (cargando) {
    return (
      <PantallaEsqueleto />
    )
  }

  return (
    <div className="space-y-11 px-5 pt-8">
      <Encabezado sobretitulo="Panel del profesor" titulo="Dudas" descripcion={`${ctx.cohorteNombre}${ctx.sede ? ` · ${ctx.sede}` : ''} · Módulo ${ctx.moduloOrden} — insumo para la clínica del sábado.`} />

      <Regla delay={60} />

      <Seccion numero={1} titulo="Dudas de la semana" delay={120}>
        {digest.length === 0 ? (
          <div className="zr-card space-y-4 p-6">
            <p className="text-sm text-zr-text-muted">
              Agrupa las {dudas.length} dudas de la semana en 3 preguntas generales, con IA.
            </p>
            {errorDigest && <p className="text-sm font-medium text-zr-error">{errorDigest}</p>}
            <button
              onClick={pedirResumen}
              disabled={cargandoDigest || dudas.length < 3}
              className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
            >
              {cargandoDigest ? 'Generando…' : 'Generar resumen'}
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-gradient-to-br from-zr-blue-deep to-zr-blue p-6 text-white">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
              De {dudas.length} dudas, estas cubren la mayoría
            </p>
            <ol className="list-decimal space-y-3 pl-5">
              {digest.map((d, i) => (
                <li key={i} className="text-sm leading-relaxed">{d}</li>
              ))}
            </ol>
          </div>
        )}
      </Seccion>

      <Seccion numero={2} titulo="Tal cual las escribieron" delay={200}>
        {dudas.length === 0 ? (
          <p className="text-sm text-zr-text-muted">Todavía no hay dudas esta semana.</p>
        ) : (
          <div className="space-y-3">
            {dudas.map((d) => (
              <div key={d.id} className="zr-card p-4">
                <p className="text-sm leading-relaxed text-zr-text">{d.body}</p>
                <p className="mt-2 text-xs text-zr-text-muted">
                  {new Date(d.createdAt).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      {dudasUnidad.length > 0 && (
        <>
          <Regla delay={240} />
          <Seccion numero={3} titulo="Dudas de Aula Virtual (por unidad)" delay={280}>
            <div className="space-y-3">
              {dudasUnidad.map((d) => (
                <div key={d.id} className="zr-card space-y-3 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-zr-blue-mid">{d.unitTitle}</p>
                  <p className="text-sm leading-relaxed text-zr-text">{d.body}</p>

                  {d.respuestas.map((r) => (
                    <p key={r.id} className="rounded-lg border border-zr-border bg-zr-bg px-3 py-2 text-sm text-zr-text-muted">
                      {r.isOfficial && <span className="mr-2 font-bold text-zr-success">Oficial ·</span>}
                      {r.body}
                    </p>
                  ))}

                  <textarea
                    value={respuestaTexto[d.id] ?? ''}
                    onChange={(e) => setRespuestaTexto((t) => ({ ...t, [d.id]: e.target.value }))}
                    placeholder="Escribe tu respuesta…"
                    className="min-h-[64px] w-full rounded-lg border border-zr-border bg-zr-bg p-3 text-sm text-zr-text outline-none focus:border-zr-blue"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => responderDuda(d.id, true)}
                      disabled={!respuestaTexto[d.id]?.trim() || enviandoRespuesta === d.id}
                      className="rounded-lg bg-zr-blue px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                    >
                      Responder como oficial
                    </button>
                    <button
                      onClick={() => alternarFaq(d.id, d.isFaq)}
                      className="rounded-lg border border-zr-border px-4 py-2 text-xs font-bold text-zr-text"
                    >
                      {d.isFaq ? 'Quitar de FAQ' : 'Marcar como FAQ'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Seccion>
        </>
      )}
    </div>
  )
}

export default function DudasDocente() {
  return (
    <ContextoDocente sobretitulo="Panel del profesor" titulo="Dudas">
      {(ctx) => <DudasInterno ctx={ctx} />}
    </ContextoDocente>
  )
}
