'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { APP_VERSION } from '@/lib/version'

/**
 * Pantalla de "actualización obligatoria" del estudiante (21-nov-2026, pedido del
 * coordinador). Es solo una presentación: la app ya está actualizada, nada se
 * descarga ni se instala. Existe para que el estudiante tome en serio lo nuevo y
 * no se salte el tutorial (antes tocaban "Omitir" o pasaban todo rapidísimo).
 *
 * Recorrido: aviso que no se puede cerrar → "Actualizar" → animación del logo
 * subiendo entre partículas y la versión al final → "Listo" → "Importante: mira
 * este tutorial" → "Siguiente" (onTerminar abre el tutorial obligatorio).
 * Quién la ve y cuándo lo decide el layout del estudiante (lib/version.ts,
 * ACTUALIZACION_OBLIGATORIA).
 */

type Fase = 'aviso' | 'instalando' | 'version' | 'tutorial'

interface Props {
  onTerminar: () => void | Promise<void>
}

const DURACION_MS = 7200

const MENSAJES: [number, string][] = [
  [0, 'Preparando la actualización…'],
  [18, 'Descargando las funciones nuevas…'],
  [46, 'Instalando Unidades y tu calendario…'],
  [72, 'Ordenando tu material…'],
  [90, 'Casi listo…'],
]

/** Avance con pausas, como una instalación de verdad (no una barra lineal). */
function avance(t: number): number {
  const tramos: [number, number][] = [[0, 0], [0.18, 31], [0.42, 58], [0.6, 74], [0.78, 89], [0.9, 96], [1, 100]]
  for (let i = 1; i < tramos.length; i++) {
    const [t0, v0] = tramos[i - 1]
    const [t1, v1] = tramos[i]
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0)
      const suave = k * k * (3 - 2 * k)
      return v0 + (v1 - v0) * suave
    }
  }
  return 100
}

/** Números pseudoaleatorios fijos, para que las partículas no cambien en cada render. */
function semilla(n: number) {
  let a = n
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function Particulas({ cantidad, rapidas }: { cantidad: number; rapidas: boolean }) {
  const lista = useMemo(() => {
    const r = semilla(1998)
    return Array.from({ length: cantidad }, (_, i) => {
      const tam = 3 + Math.round(r() * 12)
      const dur = (rapidas ? 3.2 : 6) + r() * (rapidas ? 3 : 6)
      return {
        i,
        left: `${Math.round(r() * 100)}%`,
        tam,
        dur,
        delay: -r() * dur,
        dx: Math.round((r() - 0.5) * 120),
        op: 0.25 + r() * 0.6,
        blanca: r() > 0.7,
        borrosa: tam > 10,
      }
    })
  }, [cantidad, rapidas])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {lista.map((p) => (
        <span
          key={p.i}
          className={`zr-act-particula absolute -bottom-6 rounded-full ${p.blanca ? 'bg-white' : 'bg-[#5b8fe0]'} ${p.borrosa ? 'blur-[2px]' : ''}`}
          style={{
            left: p.left,
            width: p.tam,
            height: p.tam,
            ['--dur' as string]: `${p.dur}s`,
            ['--delay' as string]: `${p.delay}s`,
            ['--dx' as string]: `${p.dx}px`,
            ['--op' as string]: p.op,
          }}
        />
      ))}
    </div>
  )
}

export function ActualizacionObligatoria({ onTerminar }: Props) {
  const [fase, setFase] = useState<Fase>('aviso')
  const [porcentaje, setPorcentaje] = useState(0)
  const [mostrarListo, setMostrarListo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const raf = useRef<number | null>(null)

  // Nada detrás se mueve mientras está abierta.
  useEffect(() => {
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previo }
  }, [])

  useEffect(() => {
    if (fase !== 'instalando') return
    const inicio = performance.now()
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / DURACION_MS)
      setPorcentaje(Math.round(avance(t)))
      if (t < 1) raf.current = requestAnimationFrame(paso)
      else setTimeout(() => setFase('version'), 350)
    }
    raf.current = requestAnimationFrame(paso)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [fase])

  useEffect(() => {
    if (fase !== 'version') return
    const t = setTimeout(() => setMostrarListo(true), 1600)
    return () => clearTimeout(t)
  }, [fase])

  const mensaje = [...MENSAJES].reverse().find(([desde]) => porcentaje >= desde)?.[1] ?? MENSAJES[0][1]
  const radio = 64
  const circunferencia = 2 * Math.PI * radio

  async function terminar() {
    setGuardando(true)
    await onTerminar()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="zr-act-titulo"
      className="fixed inset-0 z-[190] overflow-hidden bg-[radial-gradient(120%_80%_at_50%_110%,#163a72_0%,#0b1a33_45%,#070d18_100%)] text-white"
    >
      <Particulas cantidad={fase === 'aviso' ? 18 : 40} rapidas={fase === 'instalando'} />

      <div className="relative mx-auto flex h-full max-w-md flex-col px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(3rem+env(safe-area-inset-top))]">
        {fase === 'aviso' && (
          <div key="aviso" className="zr-act-entrar flex flex-1 flex-col">
            <span className="self-start rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#9cc3ff]">
              Actualización obligatoria
            </span>

            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="relative">
                <span aria-hidden="true" className="zr-act-halo absolute inset-[-28px] rounded-full bg-[#3869b1]/40 blur-2xl" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon-512.png"
                  alt="ZR App"
                  width={104}
                  height={104}
                  className="zr-act-flotar relative h-[104px] w-[104px] rounded-[26px] shadow-[0_18px_50px_rgba(56,105,177,0.55)]"
                />
              </div>
              <h1 id="zr-act-titulo" className="zr-display mt-9 text-[28px] leading-tight">
                Llegó la nueva actualización de ZR App
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Es obligatoria para seguir usando la app. Toma menos de un minuto.
              </p>
              <ul className="mt-7 w-full space-y-3 text-left">
                {[
                  'Unidades: tu material, exámenes y tareas en un solo lugar',
                  'Calendario con tus clases, entregas y exámenes',
                  'Tus notas llegan solas al calificarte',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/90">
                    <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3869b1] text-[11px] font-bold">✓</span>
                    <span className="leading-snug">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => setFase('instalando')}
              className="mt-6 min-h-14 w-full rounded-2xl bg-white text-base font-bold text-[#0b1a33] shadow-[0_10px_30px_rgba(0,0,0,0.35)] active:scale-[0.98]"
            >
              Actualizar
            </button>
          </div>
        )}

        {(fase === 'instalando' || fase === 'version') && (
          <div key="instalando" className="flex flex-1 flex-col items-center text-center">
            <div className="flex w-full flex-1 flex-col items-center justify-center">
            <div className="relative flex h-[180px] w-[180px] items-center justify-center">
              <span aria-hidden="true" className="zr-act-halo absolute inset-2 rounded-full bg-[#3869b1]/45 blur-2xl" />
              {fase === 'instalando' ? (
                <svg aria-hidden="true" viewBox="0 0 160 160" className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx="80" cy="80" r={radio} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
                  <circle
                    cx="80" cy="80" r={radio} fill="none" stroke="#9cc3ff" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={circunferencia}
                    strokeDashoffset={circunferencia * (1 - porcentaje / 100)}
                  />
                </svg>
              ) : (
                <>
                  <span aria-hidden="true" className="zr-act-onda absolute inset-6 rounded-full border-2 border-[#9cc3ff]" />
                  <span aria-hidden="true" className="zr-act-onda absolute inset-6 rounded-full border border-white/60" style={{ animationDelay: '0.18s' }} />
                </>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon-512.png"
                alt=""
                width={96}
                height={96}
                className="zr-act-logo relative h-24 w-24 rounded-[24px] shadow-[0_18px_50px_rgba(56,105,177,0.6)]"
              />
            </div>

            {fase === 'instalando' ? (
              <div className="mt-10 space-y-2" aria-live="polite">
                <p className="zr-display text-4xl tabular-nums">{porcentaje}%</p>
                <p className="text-sm text-white/65">{mensaje}</p>
              </div>
            ) : (
              <div className="mt-10">
                <p className="zr-act-version text-[11px] font-bold uppercase tracking-[0.3em] text-white/55">ZR App · versión</p>
                <p className="zr-act-version zr-display mt-3 whitespace-nowrap text-[88px] leading-none" style={{ animationDelay: '0.15s' }}>
                  <span className="zr-act-brillo">{APP_VERSION}</span>
                </p>
                <p className="zr-act-version mt-3 text-sm text-white/65" style={{ animationDelay: '0.35s' }}>
                  Actualización instalada
                </p>
              </div>
            )}

            </div>

            <div className="min-h-14 w-full">
              {mostrarListo && (
                <button
                  onClick={() => setFase('tutorial')}
                  className="zr-act-entrar min-h-14 w-full rounded-2xl bg-white text-base font-bold text-[#0b1a33] active:scale-[0.98]"
                >
                  Listo
                </button>
              )}
            </div>
          </div>
        )}

        {fase === 'tutorial' && (
          <div key="tutorial" className="zr-act-entrar flex flex-1 flex-col">
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5b942]/15 text-3xl font-bold text-[#f5b942]" aria-hidden="true">!</span>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-[#f5b942]">Importante</p>
              <h2 className="zr-display mt-3 text-[26px] leading-tight">Mira este tutorial antes de seguir</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Te explica cómo funcionan las nuevas funciones y dónde quedó todo lo que ya usabas.
                Son pocos pasos: léelos con calma.
              </p>
            </div>
            <button
              onClick={terminar}
              disabled={guardando}
              className="mt-6 min-h-14 w-full rounded-2xl bg-white text-base font-bold text-[#0b1a33] active:scale-[0.98] disabled:opacity-60"
            >
              {guardando ? 'Un momento…' : 'Siguiente'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
