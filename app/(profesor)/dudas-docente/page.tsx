'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'

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

export default function DudasDocente() {
  const router = useRouter()
  const [dudas, setDudas] = useState<Duda[]>([])
  const [digest, setDigest] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoDigest, setCargandoDigest] = useState(false)
  const [errorDigest, setErrorDigest] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('doubts')
        .select('id, body, created_at')
        .order('created_at', { ascending: false })

      setDudas((data ?? []).map((d) => ({ id: d.id, body: d.body, createdAt: d.created_at })))
      setCargando(false)
    }
    cargar()
  }, [router])

  async function pedirResumen() {
    setCargandoDigest(true)
    setErrorDigest(null)
    const supabase = createClient()
    const { data, error } = await supabase.functions.invoke('resumir-dudas')

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
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <Encabezado sobretitulo="Panel del profesor" titulo="Dudas" descripcion="Insumo para la clínica del sábado." />

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
    </div>
  )
}
