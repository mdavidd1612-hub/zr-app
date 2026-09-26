'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * `/zr-coffee/refrigerio` -- corrección explícita del coordinador (sept.
 * 2026): esta pantalla NO escanea, MUESTRA el QR. El estudiante lo escanea
 * con su propio teléfono desde `/refrigerio` -- mismo patrón que `/qr`
 * (asistencia) y `daily_checkin_codes` (migración 037), aplicado aquí con
 * `daily_snack_codes` (migración 112).
 *
 * El código rota solo cuando alguien lo usa con éxito (lo hace el servidor,
 * en `claim-snack-checkin`) -- aquí solo se detecta la rotación y se vuelve
 * a dibujar. Nada se valida en el cliente (regla 2 de AGENTS.md).
 */

function nuevoCodigo() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
}

export default function RefrigerioCantina() {
  const router = useRouter()
  const [qrUrl, setQrUrl] = useState('')
  const [entregados, setEntregados] = useState(0)
  const [cargando, setCargando] = useState(true)
  const codigoActual = useRef<string | null>(null)

  const hoyISO = new Date().toISOString().slice(0, 10)

  async function dibujarQR(code: string) {
    codigoActual.current = code
    const url = await QRCode.toDataURL(`ZRSNACK|${code}`, {
      width: 320, margin: 3, color: { dark: '#0F1419', light: '#FFFFFF' },
    })
    setQrUrl(url)
  }

  async function cargarEntregados() {
    const supabase = createClient()
    const { count } = await supabase
      .from('attendance_events')
      .select('id', { count: 'exact', head: true })
      .gte('snack_claimed_at', `${hoyISO}T00:00:00`)
    setEntregados(count ?? 0)
  }

  useEffect(() => {
    async function iniciar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: existente } = await supabase
        .from('daily_snack_codes').select('code').eq('checkin_date', hoyISO).maybeSingle()

      const code = existente?.code ?? nuevoCodigo()
      if (!existente) {
        await supabase.from('daily_snack_codes').insert({ checkin_date: hoyISO, code })
      }
      await dibujarQR(code)
      await cargarEntregados()
      setCargando(false)
    }
    iniciar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    const intervalo = setInterval(async () => {
      const supabase = createClient()
      const [, { data: actual }] = await Promise.all([
        cargarEntregados(),
        supabase.from('daily_snack_codes').select('code').eq('checkin_date', hoyISO).maybeSingle(),
      ])
      if (actual?.code && actual.code !== codigoActual.current) {
        await dibujarQR(actual.code)
      }
    }, 2000)

    return () => clearInterval(intervalo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 px-5 pt-14">
      <BotonVolver href="/zr-coffee" />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">ZR Coffee</p>
        <h1 className="zr-display mt-3 text-4xl text-zr-text">QR de refrigerio</h1>
        <p className="mt-3 text-sm text-zr-text-muted">
          Cada estudiante lo escanea desde su propio teléfono. Solo funciona en el horario de
          refrigerio configurado.
        </p>
      </header>

      <div className="flex flex-col items-center gap-6 rounded-2xl bg-zr-navy p-8 text-center">
        <div className="rounded-xl bg-white p-4">
          <img src={qrUrl} alt="Código QR de refrigerio" className="h-64 w-64" />
        </div>
        <div>
          <p className="zr-metric text-3xl text-white">{entregados}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-white/60">entregados hoy</p>
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-white/50">
          Cada código muere al usarse y aparece otro. Fotografiarlo no sirve.
        </p>
      </div>
    </div>
  )
}
