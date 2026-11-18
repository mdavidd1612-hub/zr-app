'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { TarjetaHero } from '@/components/ui/TarjetaHero'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { IconoProgreso } from '@/components/ui/Iconos'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import type { UserRole } from '@/lib/types'

/**
 * Monitoreo de la app (solo super_admin, 18-nov-2026): mide las métricas del
 * documento maestro (§7) con los datos que ya existen. Todo se calcula en el
 * servidor (`fn_metricas_app`, migración 214); aquí solo se pinta el semáforo
 * contra la meta y la tendencia de las últimas 8 semanas.
 */

interface Metrica {
  clave: string
  grupo: string
  nombre: string
  valor: number | null
  unidad: string
  meta: number | null
  mejor: 'alto' | 'bajo'
  detalle: string
  serie?: number[]
}

type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'gris'

function semaforo(m: Metrica): Semaforo {
  if (m.valor === null || m.meta === null) return 'gris'
  if (m.mejor === 'alto') {
    if (m.valor >= m.meta) return 'verde'
    return m.valor >= m.meta * 0.8 ? 'amarillo' : 'rojo'
  }
  if (m.valor <= m.meta) return 'verde'
  return m.valor <= m.meta * 1.25 + 1 ? 'amarillo' : 'rojo'
}

const COLOR: Record<Semaforo, { punto: string; texto: string; etiqueta: string }> = {
  verde:    { punto: 'bg-zr-success', texto: 'text-zr-success', etiqueta: 'En meta' },
  amarillo: { punto: 'bg-amber-400',  texto: 'text-amber-400',  etiqueta: 'Cerca' },
  rojo:     { punto: 'bg-zr-error',   texto: 'text-zr-error',   etiqueta: 'Atención' },
  gris:     { punto: 'bg-zr-text-muted/50', texto: 'text-zr-text-muted', etiqueta: '' },
}

function Tendencia({ serie }: { serie: number[] }) {
  const max = Math.max(1, ...serie)
  const w = 120, h = 36
  const pts = serie.map((v, i) => `${(i / Math.max(1, serie.length - 1)) * w},${h - 3 - (v / max) * (h - 8)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="text-zr-blue-mid" />
    </svg>
  )
}

function Tarjeta({ m }: { m: Metrica }) {
  const s = semaforo(m)
  const c = COLOR[s]
  return (
    <div className="zr-card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-bold leading-snug text-zr-text [overflow-wrap:anywhere]">{m.nombre}</p>
        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${c.punto}`} aria-label={c.etiqueta || 'Sin meta'} />
      </div>
      {m.valor === null ? (
        <p className="text-sm font-semibold text-zr-text-muted">Sin datos todavía</p>
      ) : (
        <p className="flex items-baseline gap-1">
          <span className="zr-metric text-3xl text-zr-text">{Number(m.valor).toLocaleString('es-VE')}</span>
          {m.unidad && <span className="text-sm font-semibold text-zr-text-muted">{m.unidad}</span>}
          {m.meta !== null && (
            <span className="ml-auto text-xs text-zr-text-muted">
              meta {m.mejor === 'alto' ? '≥' : '≤'} {m.meta}{m.unidad}
            </span>
          )}
        </p>
      )}
      {m.serie && m.serie.some((v) => v > 0) && <Tendencia serie={m.serie} />}
      <p className="text-xs leading-relaxed text-zr-text-muted">
        {c.etiqueta && <b className={c.texto}>{c.etiqueta} · </b>}
        {m.detalle}
      </p>
    </div>
  )
}

export default function Monitoreo() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [metricas, setMetricas] = useState<Metrica[]>([])
  const [generado, setGenerado] = useState<string | null>(null)
  const [error, setError] = useState(false)

  async function cargar() {
    const { data, error: e } = await createClient().rpc('fn_metricas_app' as never)
    if (e || !data) { setError(true); return }
    const d = data as unknown as { generado: string; metricas: Metrica[] }
    setMetricas(d.metricas)
    setGenerado(d.generado)
    setError(false)
  }

  useEffect(() => {
    async function iniciar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if ((perfil?.role as UserRole | undefined) !== 'super_admin') { setCargando(false); return }
      setAutorizado(true)
      await cargar()
      setCargando(false)
    }
    iniciar()
  }, [router])

  if (cargando) return <PantallaEsqueleto />

  if (!autorizado) {
    return (
      <div className="space-y-5 px-5 pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <BotonVolver href="/panel" />
        <p className="text-sm text-zr-text-muted">Solo el super admin puede entrar aquí.</p>
      </div>
    )
  }

  const grupos = [...new Set(metricas.map((m) => m.grupo))]
  const evaluables = metricas.filter((m) => semaforo(m) !== 'gris')
  const enMeta = evaluables.filter((m) => semaforo(m) === 'verde').length
  const atencion = evaluables.filter((m) => semaforo(m) === 'rojo').length

  return (
    <div className="space-y-8 px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <BotonVolver href="/panel" />

      <div className="animate-rise">
        <TarjetaHero
          sobretitulo="Super admin"
          titulo="Monitoreo de la app"
          texto={`${enMeta} de ${evaluables.length} métricas en meta${atencion ? ` · ${atencion} necesitan atención` : ''}.`}
          icono={<IconoProgreso size={24} />}
        >
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-white/70">
              {generado ? `Calculado ${new Date(generado).toLocaleString('es-VE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
            </p>
            <button onClick={cargar} className="min-h-10 rounded-xl bg-white/15 px-4 text-sm font-bold text-white">Actualizar</button>
          </div>
        </TarjetaHero>
      </div>

      {error || metricas.length === 0 ? (
        <EstadoVacio titulo="No se pudieron calcular las métricas" explicacion="Intenta actualizar de nuevo en unos segundos." />
      ) : (
        grupos.map((g, i) => (
          <Seccion key={g} numero={i + 1} titulo={g} delay={60 + i * 50}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {metricas.filter((m) => m.grupo === g).map((m) => <Tarjeta key={m.clave} m={m} />)}
            </div>
          </Seccion>
        ))
      )}
    </div>
  )
}
