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
 *
 * Reunión de sept. 2026 (migraciones 129 y 130): el contador se desglosa por
 * programa y ZR Coffee puede abrir/cerrar el refrigerio de cada turno a mano
 * -- la decisión manual manda sobre el horario configurado.
 */

interface ResumenCohorte {
  cohort_id: string
  cohorte: string
  programa: string
  turno: string
  presentes: number
  entregados: number
}

type Estado = 'abierto' | 'cerrado' | null

const TURNOS = ['mañana', 'tarde'] as const

function nuevoCodigo() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
}

export default function RefrigerioCantina() {
  const router = useRouter()
  const [qrUrl, setQrUrl] = useState('')
  const [resumen, setResumen] = useState<ResumenCohorte[]>([])
  const [manual, setManual] = useState<Record<string, Estado>>({})
  const [guardandoTurno, setGuardandoTurno] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  // La cuenta de ZR Coffee no puede leer asistencia directamente: los totales
  // por programa salen de una función del servidor (migración 130).
  async function cargarEntregados() {
    const supabase = createClient()
    const [{ data }, { data: overrides }] = await Promise.all([
      supabase.rpc('resumen_refrigerio_hoy'),
      supabase.from('snack_overrides').select('turno, estado').eq('checkin_date', hoyISO),
    ])
    setResumen((data ?? []) as ResumenCohorte[])
    setManual(Object.fromEntries((overrides ?? []).map((o) => [o.turno, o.estado as Estado])))
  }

  async function fijarEstado(turno: string, estado: Estado) {
    setGuardandoTurno(turno)
    setError(null)
    const supabase = createClient()
    const { error: fallo } = estado === null
      ? await supabase.from('snack_overrides').delete().eq('checkin_date', hoyISO).eq('turno', turno)
      : await supabase.from('snack_overrides').upsert({ checkin_date: hoyISO, turno, estado })
    setGuardandoTurno(null)
    if (fallo) {
      setError('No se pudo cambiar. Intenta de nuevo.')
      return
    }
    setManual((m) => ({ ...m, [turno]: estado }))
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
        <div className="w-full space-y-2">
          <p className="text-xs uppercase tracking-wide text-white/60">entregados hoy</p>
          {resumen.length === 0 ? (
            <p className="text-sm text-white/70">Hoy no hay clases programadas.</p>
          ) : (
            resumen.map((r) => (
              <div key={r.cohort_id} className="flex items-baseline justify-between gap-3 rounded-lg bg-white/10 px-4 py-2.5 text-left">
                <span className="min-w-0 truncate text-sm text-white">{r.cohorte}</span>
                <span className="shrink-0 text-white">
                  <span className="zr-metric text-2xl">{r.entregados}</span>
                  <span className="text-sm text-white/60"> de {r.presentes}</span>
                </span>
              </div>
            ))
          )}
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-white/50">
          Cada código muere al usarse y aparece otro. Fotografiarlo no sirve.
        </p>
      </div>

      {/* Apertura/cierre manual por turno: manda sobre el horario configurado. */}
      <section className="space-y-3 pb-10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-zr-text-muted">Abrir o cerrar a mano</h2>
        <p className="text-xs text-zr-text-muted">
          Por defecto el refrigerio se abre y cierra solo según el horario de cada turno. Si lo
          cambias aquí, manda sobre el horario hasta que vuelvas a &ldquo;Según horario&rdquo;.
        </p>
        {error && <p className="text-sm font-medium text-zr-error">{error}</p>}
        {TURNOS.map((t) => {
          const estado = manual[t] ?? null
          return (
            <div key={t} className="zr-card space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold capitalize text-zr-text">Turno de la {t}</p>
                <span className={`text-xs font-bold ${estado === 'abierto' ? 'text-zr-success' : estado === 'cerrado' ? 'text-zr-error' : 'text-zr-text-muted'}`}>
                  {estado === 'abierto' ? 'Abierto a mano' : estado === 'cerrado' ? 'Cerrado a mano' : 'Según horario'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([['abierto', 'Abrir'], ['cerrado', 'Cerrar'], [null, 'Según horario']] as const).map(([valor, texto]) => (
                  <button
                    key={texto}
                    onClick={() => fijarEstado(t, valor)}
                    disabled={guardandoTurno === t || estado === valor}
                    className={`min-h-11 rounded-lg border text-xs font-bold disabled:opacity-100 ${
                      estado === valor ? 'border-zr-blue bg-zr-blue text-white' : 'border-zr-border text-zr-text'
                    }`}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
