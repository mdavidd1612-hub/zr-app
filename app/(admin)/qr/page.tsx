'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { MarcaZR } from '@/components/ui/Iconos'

/**
 * Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, ajuste post-Sprint F): un solo QR
 * universal, válido para todas las cohortes que tengan clase hoy — no uno
 * por cohorte. El estudiante lo escanea desde /asistencia; la Edge Function
 * `checkin-session` decide a qué sesión pertenece según SU propia cohorte.
 * Cada escaneo válido rota el código (regla 2 de AGENTS.md: nada se valida
 * en el cliente).
 */

interface SesionHoy {
  sessionId: string
  cohorteNombre: string
  registrados: number
  total: number
}

function nuevoCodigo() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
}

export default function QRAdmin() {
  const router = useRouter()
  const [sesiones, setSesiones] = useState<SesionHoy[]>([])
  const [hayAlgunaAbierta, setHayAlgunaAbierta] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [cargando, setCargando] = useState(true)
  const [abriendo, setAbriendo] = useState(false)
  const codigoActual = useRef<string | null>(null)

  const hoyISO = new Date().toISOString().slice(0, 10)

  async function cargarSesiones() {
    const supabase = createClient()
    const { data: sesionesHoy } = await supabase
      .from('class_sessions')
      .select('id, status, cohort_id, cohorts(name)')
      .eq('session_date', hoyISO)

    const filas = (sesionesHoy ?? []) as unknown as {
      id: string; status: string; cohort_id: string; cohorts: { name: string } | null
    }[]

    const conteos = await Promise.all(
      filas.map(async (s) => {
        const [{ count: registrados }, { count: total }] = await Promise.all([
          supabase.from('attendance_events').select('id', { count: 'exact', head: true }).eq('session_id', s.id),
          supabase.from('students').select('id', { count: 'exact', head: true }).eq('cohort_id', s.cohort_id),
        ])
        return {
          sessionId: s.id,
          cohorteNombre: s.cohorts?.name ?? 'Cohorte',
          registrados: registrados ?? 0,
          total: total ?? 0,
        }
      }),
    )

    setSesiones(conteos.sort((a, b) => a.cohorteNombre.localeCompare(b.cohorteNombre)))
    setHayAlgunaAbierta(filas.some((s) => s.status === 'abierta'))
    return filas
  }

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      await cargarSesiones()
      setCargando(false)
    }
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function dibujarQR(code: string) {
    codigoActual.current = code
    const url = await QRCode.toDataURL(`ZRADM|${code}`, {
      width: 260, margin: 1, color: { dark: '#0F1419', light: '#FFFFFF' },
    })
    setQrUrl(url)
  }

  async function abrirYMostrar() {
    setAbriendo(true)
    const supabase = createClient()

    // La pantalla se autoabastece: asegura que exista sesión de hoy para
    // CADA cohorte que tenga estudiantes (la crea si falta) y la abre. Así
    // "entrar a QR el sábado" siempre funciona, sin pasos manuales aparte.
    const { data: cohortesConEstudiantes } = await supabase
      .from('students')
      .select('cohort_id, cohorts(id, current_module_id)')
      .not('cohort_id', 'is', null)

    const filas = (cohortesConEstudiantes ?? []) as unknown as {
      cohort_id: string; cohorts: { id: string; current_module_id: string | null } | null
    }[]

    const cohortesUnicas = new Map(
      filas
        .filter((f) => f.cohorts?.current_module_id)
        .map((f) => [f.cohort_id, f.cohorts!.current_module_id!]),
    )

    for (const [cohorteId, moduloId] of cohortesUnicas) {
      const { data: sesion } = await supabase
        .from('class_sessions').select('id, status').eq('cohort_id', cohorteId).eq('session_date', hoyISO).maybeSingle()

      if (!sesion) {
        const { data: ultima } = await supabase
          .from('class_sessions').select('week_number').eq('cohort_id', cohorteId)
          .order('week_number', { ascending: false }).limit(1).maybeSingle()

        await supabase.from('class_sessions').insert({
          cohort_id: cohorteId,
          module_id: moduloId,
          session_date: hoyISO,
          week_number: (ultima?.week_number ?? 0) + 1,
          status: 'abierta',
        })
      } else if (sesion.status === 'programada') {
        await supabase.from('class_sessions').update({ status: 'abierta' }).eq('id', sesion.id)
      }
    }

    const { data: existente } = await supabase
      .from('daily_checkin_codes').select('code').eq('checkin_date', hoyISO).maybeSingle()

    const code = existente?.code ?? nuevoCodigo()
    if (!existente) {
      await supabase.from('daily_checkin_codes').insert({ checkin_date: hoyISO, code })
    }
    await dibujarQR(code)
    await cargarSesiones()
    setAbriendo(false)
  }

  // Refresca conteos y detecta rotación del código cada pocos segundos.
  useEffect(() => {
    if (!qrUrl) return

    const intervalo = setInterval(async () => {
      const supabase = createClient()
      const [, { data: actual }] = await Promise.all([
        cargarSesiones(),
        supabase.from('daily_checkin_codes').select('code').eq('checkin_date', hoyISO).maybeSingle(),
      ])
      if (actual?.code && actual.code !== codigoActual.current) {
        await dibujarQR(actual.code)
      }
    }, 3000)

    return () => clearInterval(intervalo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrUrl])

  async function cerrarTodas() {
    const supabase = createClient()
    await supabase.from('class_sessions').update({ status: 'cerrada' }).eq('session_date', hoyISO).eq('status', 'abierta')
    setQrUrl('')
    await cargarSesiones()
  }

  const totalRegistrados = sesiones.reduce((acc, s) => acc + s.registrados, 0)
  const totalEstudiantes = sesiones.reduce((acc, s) => acc + s.total, 0)

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
        <p className="mt-3 text-sm text-zr-text-muted">
          Un solo código, válido para todas las cohortes que tengan clase hoy.
        </p>
      </header>

      {!qrUrl ? (
        <>
          {sesiones.length === 0 ? (
            <EstadoVacio titulo="Sin clases hoy" explicacion="Todavía no hay ninguna sesión hoy — se crea sola al abrir." />
          ) : (
            <div className="space-y-2">
              {sesiones.map((s) => (
                <div key={s.sessionId} className="zr-card flex items-center justify-between p-4">
                  <p className="text-sm font-semibold text-zr-text">{s.cohorteNombre}</p>
                  <p className="text-xs text-zr-text-muted">{s.registrados}/{s.total}</p>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={abrirYMostrar}
            disabled={abriendo}
            className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-50"
          >
            {abriendo ? 'Abriendo…' : hayAlgunaAbierta ? 'Mostrar QR' : 'Abrir clases de hoy y mostrar QR'}
          </button>
        </>
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
            <p className="zr-metric text-3xl text-white">
              {totalRegistrados}<span className="text-base font-medium text-white/60">/{totalEstudiantes}</span>
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-white/60">ya escanearon, todas las cohortes</p>
          </div>

          <div className="w-full space-y-1.5 border-t border-white/10 pt-4 text-left">
            {sesiones.map((s) => (
              <div key={s.sessionId} className="flex items-center justify-between text-xs">
                <span className="text-white/70">{s.cohorteNombre}</span>
                <span className="font-semibold text-white">{s.registrados}/{s.total}</span>
              </div>
            ))}
          </div>

          <p className="max-w-xs text-xs leading-relaxed text-white/50">
            Cada código muere al usarse y aparece otro. Fotografiarlo no sirve.
          </p>
          <button
            onClick={cerrarTodas}
            className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/80"
          >
            Cerrar clases de hoy
          </button>
        </div>
      )}
    </div>
  )
}
