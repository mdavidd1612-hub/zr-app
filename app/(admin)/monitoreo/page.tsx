'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { TarjetaHero } from '@/components/ui/TarjetaHero'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { IconoProgreso, IconoCerrar } from '@/components/ui/Iconos'
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

const COMO_SE_MIDE: Record<string, string> = {
  activos7: 'Estudiantes de cohortes activas que iniciaron sesión en los últimos 7 días, entre el total de estudiantes de esas cohortes.',
  sin14: 'Estudiantes de cohortes activas que no han iniciado sesión en 14 días o nunca lo han hecho.',
  push: 'Personas activas que aceptaron recibir avisos en su teléfono (tienen al menos un dispositivo registrado). Si es 0, nadie ha activado las notificaciones.',
  leidas: 'Notificaciones de los últimos 30 días que la persona abrió, entre todas las enviadas.',
  material: 'Materiales que algún estudiante terminó de ver (progreso completado) en cada semana.',
  tareas: 'Entregas hechas antes de la fecha límite, entre todas las entregas de tareas que tienen fecha límite.',
  examenes: 'Exámenes entregados por los estudiantes en cada semana (todos los intentos).',
  dudas: 'Dudas nuevas que mandaron los estudiantes cada semana.',
  dudas_sin: 'Dudas abiertas hace más de 3 días y que ningún profesor ha respondido.',
  dudas_tiempo: 'Promedio de horas entre que se manda una duda y llega la primera respuesta.',
  i1: 'Aproximación: estudiantes que vieron material o entregaron una tarea en los últimos 7 días. La versión exacta (completar antes del sábado) llega con el ciclo semanal.',
  i2: 'Estudiantes sin actividad en los últimos 7 días. Es una señal para el profesor; nadie queda sin entrar a clase.',
  i3: 'De los exámenes calificados en su primer intento, cuántos alcanzaron la nota mínima del examen.',
  i4: 'Entre quienes aprobaron, en qué intento lo lograron en promedio. Cerca de 1 es lo ideal.',
  i5: 'Porcentaje de estudiantes que fallan cada ítem crítico. Se mide cuando exista la evaluación práctica digital.',
  i6: 'Promedio 1-4 de la defensa técnica oral. Se mide cuando exista la evaluación práctica digital.',
  i7: 'Qué tanto recuerdan en la semana 6 lo visto en la semana 2. Se mide cuando exista ese cuestionario.',
  i8a: 'Asistencias (presente o tarde) registradas con QR o manualmente en cada semana.',
  i8b: 'Estudiantes cuyo perfil ya no está activo, entre todos los estudiantes.',
  push_pend: 'Avisos creados en los últimos 2 días que todavía no se enviaron al teléfono. Si es alto, revisar la función de envío o que haya claves de notificaciones.',
  storage: 'Espacio total que ocupan los archivos subidos (material, tareas, fotos).',
}

function etiquetasSemanas(n: number) {
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() - (n - 1 - i) * 7)
    return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })
  })
}

function Detalle({ m, onCerrar }: { m: Metrica; onCerrar: () => void }) {
  const s = semaforo(m)
  const c = COLOR[s]
  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [onCerrar])
  const semanas = m.serie ? etiquetasSemanas(m.serie.length) : []
  const max = m.serie ? Math.max(1, ...m.serie) : 1
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={m.nombre}
        onClick={(e) => e.stopPropagation()}
        className="zr-card max-h-[90dvh] w-full max-w-xl space-y-5 overflow-y-auto rounded-b-none p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-b-[var(--zr-radius)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">{m.grupo}</p>
            <h2 className="zr-display mt-1 text-xl text-zr-text [overflow-wrap:anywhere]">{m.nombre}</h2>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zr-surface text-zr-text-muted">
            <IconoCerrar size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          {m.valor === null ? (
            <span className="text-lg font-bold text-zr-text-muted">Sin datos todavía</span>
          ) : (
            <span className="zr-metric text-5xl text-zr-text">
              {Number(m.valor).toLocaleString('es-VE')}<span className="ml-1 text-2xl text-zr-text-muted">{m.unidad}</span>
            </span>
          )}
          {c.etiqueta && (
            <span className={`mb-1 inline-flex items-center gap-2 text-sm font-bold ${c.texto}`}>
              <span className={`h-3 w-3 rounded-full ${c.punto}`} />{c.etiqueta}
            </span>
          )}
        </div>

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">Meta</dt>
            <dd className="mt-0.5 text-zr-text">
              {m.meta === null ? 'Sin meta definida todavía' : `${m.mejor === 'alto' ? 'Igual o mayor a' : 'Igual o menor a'} ${m.meta}${m.unidad}`}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">Cómo se mide</dt>
            <dd className="mt-0.5 leading-relaxed text-zr-text-muted">{COMO_SE_MIDE[m.clave] ?? m.detalle}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">Dato</dt>
            <dd className="mt-0.5 text-zr-text-muted">{m.detalle}</dd>
          </div>
        </dl>

        {m.serie && (
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">Últimas {m.serie.length} semanas</p>
            <div className="flex h-32 items-end gap-2">
              {m.serie.map((v, i) => (
                <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[11px] font-bold text-zr-text">{v}</span>
                  <div className="w-full rounded-t-md bg-zr-blue-mid" style={{ height: `${Math.max(4, (v / max) * 80)}%`, opacity: i === m.serie!.length - 1 ? 1 : 0.55 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-2">
              {semanas.map((l, i) => (
                <span key={i} className="min-w-0 flex-1 truncate text-center text-[10px] text-zr-text-muted">{l}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
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

function Tarjeta({ m, onAbrir }: { m: Metrica; onAbrir: () => void }) {
  const s = semaforo(m)
  const c = COLOR[s]
  return (
    <button type="button" onClick={onAbrir} className="zr-card zr-card-interactive flex w-full flex-col gap-3 p-5 text-left">
      <div className="flex w-full items-start justify-between gap-3">
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
    </button>
  )
}

export default function Monitoreo() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [metricas, setMetricas] = useState<Metrica[]>([])
  const [generado, setGenerado] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)

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
              {metricas.filter((m) => m.grupo === g).map((m) => <Tarjeta key={m.clave} m={m} onAbrir={() => setAbierta(m.clave)} />)}
            </div>
          </Seccion>
        ))
      )}
      {abierta && metricas.find((m) => m.clave === abierta) && (
        <Detalle m={metricas.find((m) => m.clave === abierta)!} onCerrar={() => setAbierta(null)} />
      )}
    </div>
  )
}
