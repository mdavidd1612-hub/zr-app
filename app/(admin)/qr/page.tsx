'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { MarcaZR } from '@/components/ui/Iconos'

/**
 * Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, Sprint F): administración muestra
 * este QR en pantalla. El estudiante lo escanea desde /asistencia. Cada
 * escaneo válido rota el código — la Edge Function `checkin-session` es la
 * única que decide si vale (regla 2 de AGENTS.md).
 */

interface Cohorte {
  id: string
  nombre: string
}

function nuevoCodigo() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
}

export default function QRAdmin() {
  const router = useRouter()
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [cohorteId, setCohorteId] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [registrados, setRegistrados] = useState(0)
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [abriendo, setAbriendo] = useState(false)
  const codigoActual = useRef<string | null>(null)

  const hoyISO = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: cohs } = await supabase.from('cohorts').select('id, name').order('name')
      const lista = (cohs ?? []).map((c) => ({ id: c.id, nombre: c.name }))
      setCohortes(lista)
      if (lista.length) setCohorteId(lista[0].id)
      setCargando(false)
    }
    cargar()
  }, [router])

  // Sesión de hoy para la cohorte elegida
  useEffect(() => {
    if (!cohorteId) return

    async function cargarSesion() {
      setSessionId(null)
      setSessionStatus(null)
      setQrUrl('')

      const supabase = createClient()
      const { data: sesion } = await supabase
        .from('class_sessions')
        .select('id, status')
        .eq('cohort_id', cohorteId)
        .eq('session_date', hoyISO)
        .maybeSingle()
      setSessionId(sesion?.id ?? null)
      setSessionStatus(sesion?.status ?? null)

      const { count } = await supabase
        .from('students').select('id', { count: 'exact', head: true }).eq('cohort_id', cohorteId)
      setTotal(count ?? 0)
    }
    cargarSesion()
  }, [cohorteId, hoyISO])

  async function dibujarQR(code: string, sesId: string) {
    codigoActual.current = code
    const url = await QRCode.toDataURL(`ZRADM|${sesId}|${code}`, {
      width: 260, margin: 1, color: { dark: '#0F1419', light: '#FFFFFF' },
    })
    setQrUrl(url)
  }

  async function abrirYMostrar() {
    if (!sessionId) return
    setAbriendo(true)
    const supabase = createClient()

    if (sessionStatus !== 'abierta') {
      await supabase.from('class_sessions').update({ status: 'abierta' }).eq('id', sessionId)
      setSessionStatus('abierta')
    }

    const { data: existente } = await supabase
      .from('session_checkin_codes').select('code').eq('session_id', sessionId).maybeSingle()

    const code = existente?.code ?? nuevoCodigo()
    if (!existente) {
      await supabase.from('session_checkin_codes').insert({ session_id: sessionId, code })
    }
    await dibujarQR(code, sessionId)
    setAbriendo(false)
  }

  // Refresca el conteo y detecta rotación del código cada pocos segundos.
  useEffect(() => {
    if (!sessionId || sessionStatus !== 'abierta') return

    const intervalo = setInterval(async () => {
      const supabase = createClient()
      const [{ count }, { data: actual }] = await Promise.all([
        supabase.from('attendance_events').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
        supabase.from('session_checkin_codes').select('code').eq('session_id', sessionId).maybeSingle(),
      ])
      setRegistrados(count ?? 0)
      if (actual?.code && actual.code !== codigoActual.current) {
        await dibujarQR(actual.code, sessionId)
      }
    }, 3000)

    return () => clearInterval(intervalo)
  }, [sessionId, sessionStatus])

  async function cerrarClase() {
    if (!sessionId) return
    await createClient().from('class_sessions').update({ status: 'cerrada' }).eq('id', sessionId)
    setSessionStatus('cerrada')
    setQrUrl('')
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 px-5 pt-14">
      <BotonVolver href="/panel" />

      <header className="animate-rise">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Administración</p>
        <h1 className="zr-display mt-3 text-4xl text-zr-text">QR de asistencia</h1>
      </header>

      {cohortes.length === 0 ? (
        <EstadoVacio titulo="Sin cohortes" explicacion="Todavía no hay cohortes creadas." />
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cohortes.map((c) => (
              <button
                key={c.id}
                onClick={() => setCohorteId(c.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  cohorteId === c.id ? 'border-zr-blue bg-zr-blue/15 text-zr-blue' : 'border-zr-border text-zr-text-muted'
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>

          {!sessionId ? (
            <EstadoVacio titulo="Sin clase hoy" explicacion="Esta cohorte no tiene sesión programada para hoy." />
          ) : sessionStatus === 'cerrada' ? (
            <div className="zr-card p-6 text-center">
              <p className="text-base font-semibold text-zr-text">La clase ya cerró</p>
              <p className="mt-1 text-sm text-zr-text-muted">{registrados}/{total} registrados</p>
            </div>
          ) : !qrUrl ? (
            <button
              onClick={abrirYMostrar}
              disabled={abriendo}
              className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-50"
            >
              {abriendo ? 'Abriendo…' : 'Abrir clase y mostrar QR'}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-6 rounded-2xl bg-zr-navy p-8 text-center">
              <div className="flex items-center gap-2 text-white/60">
                <MarcaZR size={20} />
                <p className="text-xs font-bold uppercase tracking-[0.18em]">ZR Mecademy</p>
              </div>
              <div className="rounded-xl bg-white p-3">
                <img src={qrUrl} alt="Código QR de asistencia" className="h-56 w-56" />
              </div>
              <div>
                <p className="zr-metric text-3xl text-white">{registrados}<span className="text-base font-medium text-white/60">/{total}</span></p>
                <p className="mt-1 text-xs uppercase tracking-wide text-white/60">ya escanearon</p>
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-white/50">
                Cada código muere al usarse y aparece otro. Fotografiarlo no sirve.
              </p>
              <button
                onClick={cerrarClase}
                className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/80"
              >
                Cerrar clase
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
