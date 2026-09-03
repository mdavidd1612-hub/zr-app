'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, ajuste): el QR es universal y
 * SIEMPRE está disponible — administración no abre, cierra ni crea ninguna
 * sesión desde aquí. Si un estudiante lo escanea y no tiene clase hoy en su
 * cohorte, la Edge Function `checkin-session` se lo dice a él, no aquí.
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
  const [qrUrl, setQrUrl] = useState('')
  const [cargando, setCargando] = useState(true)
  const codigoActual = useRef<string | null>(null)

  const hoyISO = new Date().toISOString().slice(0, 10)

  async function cargarSesiones() {
    const supabase = createClient()
    const { data: sesionesHoy } = await supabase
      .from('class_sessions')
      .select('id, cohort_id, cohorts(name)')
      .eq('session_date', hoyISO)

    const filas = (sesionesHoy ?? []) as unknown as {
      id: string; cohort_id: string; cohorts: { name: string } | null
    }[]

    const conteos = await Promise.all(
      filas.map(async (s) => {
        const supa = createClient()
        const [{ count: registrados }, { count: total }] = await Promise.all([
          supa.from('attendance_events').select('id', { count: 'exact', head: true }).eq('session_id', s.id),
          supa.from('students').select('id', { count: 'exact', head: true }).eq('cohort_id', s.cohort_id),
        ])
        return {
          sessionId: s.id,
          cohorteNombre: s.cohorts?.name ?? 'Programa',
          registrados: registrados ?? 0,
          total: total ?? 0,
        }
      }),
    )

    setSesiones(conteos.sort((a, b) => a.cohorteNombre.localeCompare(b.cohorteNombre)))
  }

  async function dibujarQR(code: string) {
    codigoActual.current = code
    // Margen generoso (zona de silencio) para que la cámara lo detecte
    // apenas apunte al cuadro, sin necesitar nada alrededor.
    const url = await QRCode.toDataURL(`ZRADM|${code}`, {
      width: 320, margin: 3, color: { dark: '#0F1419', light: '#FFFFFF' },
    })
    setQrUrl(url)
  }

  useEffect(() => {
    async function iniciar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      // El código de hoy siempre existe: se crea la primera vez que alguien
      // entra a esta pantalla. Ningún botón lo "abre".
      const { data: existente } = await supabase
        .from('daily_checkin_codes').select('code').eq('checkin_date', hoyISO).maybeSingle()

      const code = existente?.code ?? nuevoCodigo()
      if (!existente) {
        await supabase.from('daily_checkin_codes').insert({ checkin_date: hoyISO, code })
      }
      await dibujarQR(code)
      await cargarSesiones()
      setCargando(false)
    }
    iniciar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Refresca conteos y detecta rotación del código cada pocos segundos.
  useEffect(() => {
    const intervalo = setInterval(async () => {
      const supabase = createClient()
      const [, { data: actual }] = await Promise.all([
        cargarSesiones(),
        supabase.from('daily_checkin_codes').select('code').eq('checkin_date', hoyISO).maybeSingle(),
      ])
      if (actual?.code && actual.code !== codigoActual.current) {
        await dibujarQR(actual.code)
      }
    }, 2000)

    return () => clearInterval(intervalo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          Siempre disponible. Cada estudiante lo escanea desde su propio teléfono; si no tiene
          clase hoy, se lo dice a él.
        </p>
      </header>

      <div className="flex flex-col items-center gap-6 rounded-2xl bg-zr-navy p-8 text-center">
        {/* Solo el cuadro del QR — nada alrededor que haya que incluir para
            que la cámara lo detecte (ajuste pedido: antes confundía). */}
        <div className="rounded-xl bg-white p-4">
          <img src={qrUrl} alt="Código QR de asistencia" className="h-64 w-64" />
        </div>
        {sesiones.length > 0 && (
          <div>
            <p className="zr-metric text-3xl text-white">
              {totalRegistrados}<span className="text-base font-medium text-white/60">/{totalEstudiantes}</span>
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-white/60">ya escanearon hoy</p>
          </div>
        )}

        {sesiones.length > 0 && (
          <div className="w-full space-y-1.5 border-t border-white/10 pt-4 text-left">
            {sesiones.map((s) => (
              <div key={s.sessionId} className="flex items-center justify-between text-xs">
                <span className="text-white/70">{s.cohorteNombre}</span>
                <span className="font-semibold text-white">{s.registrados}/{s.total}</span>
              </div>
            ))}
          </div>
        )}

        <p className="max-w-xs text-xs leading-relaxed text-white/50">
          Cada código muere al usarse y aparece otro. Fotografiarlo no sirve.
        </p>
      </div>
    </div>
  )
}
