'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Métricas del material (pedido de Dirección Académica, oct. 2026): medir con
 * datos si "Ver" y "Descargar" están haciendo su trabajo. Lee la bitácora
 * content_access_events (migración 120). "Fallo reportado" = el estudiante
 * abrió un visor externo y dijo que no se abrió o se veía mal.
 */

interface Evento {
  id: string
  event: 'ver' | 'descargar'
  outcome: 'abierto' | 'error_url' | 'visor_fallo'
  viewer: string | null
  fileType: string | null
  userAgent: string | null
}

function dispositivo(ua: string | null): string {
  if (!ua) return 'Desconocido'
  const marca = /TECNO|Infinix/i.test(ua) ? 'Tecno/Infinix'
    : /Redmi|Xiaomi|POCO|MI /i.test(ua) ? 'Xiaomi'
    : /SM-|Samsung/i.test(ua) ? 'Samsung'
    : /iPhone|iPad/i.test(ua) ? 'iPhone/iPad'
    : /Android/i.test(ua) ? 'Android (otro)'
    : /Windows|Macintosh|Linux/i.test(ua) ? 'Computador'
    : 'Otro'
  const nav = /SamsungBrowser/i.test(ua) ? 'Samsung Internet'
    : /Edg\//i.test(ua) ? 'Edge'
    : /Firefox/i.test(ua) ? 'Firefox'
    : /Chrome|CriOS/i.test(ua) ? 'Chrome'
    : /Safari/i.test(ua) ? 'Safari'
    : 'Otro navegador'
  return `${marca} · ${nav}`
}

function Tarjeta({ valor, etiqueta }: { valor: string | number; etiqueta: string }) {
  return (
    <div className="zr-card p-4">
      <p className="zr-display text-3xl text-zr-text">{valor}</p>
      <p className="mt-1 text-xs text-zr-text-muted">{etiqueta}</p>
    </div>
  )
}

function porcentaje(a: number, b: number): string {
  return b === 0 ? '—' : `${Math.round((a / b) * 100)}%`
}

function agrupar(filas: Evento[], clave: (e: Evento) => string): [string, number][] {
  const m = new Map<string, number>()
  for (const e of filas) m.set(clave(e), (m.get(clave(e)) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

export default function MetricasMaterial() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [dias, setDias] = useState(30)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!vigente) return
      if (perfil?.role !== 'admin' && perfil?.role !== 'super_admin') {
        setAutorizado(false)
        return
      }
      setAutorizado(true)

      const desde = new Date(Date.now() - dias * 86400000).toISOString()
      const { data } = await supabase
        .from('content_access_events')
        .select('id, event, outcome, viewer, file_type, user_agent')
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(5000)
      if (!vigente) return
      setEventos(
        (data ?? []).map((e) => ({
          id: e.id,
          event: e.event as Evento['event'],
          outcome: e.outcome as Evento['outcome'],
          viewer: e.viewer,
          fileType: e.file_type,
          userAgent: e.user_agent,
        })),
      )
    }

    cargar()
    return () => { vigente = false }
  }, [router, dias])

  if (autorizado === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg px-5 text-center">
        <p className="text-sm text-zr-text-muted">Esta pantalla es solo para Administración.</p>
      </div>
    )
  }
  if (autorizado === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  const vistas = eventos.filter((e) => e.event === 'ver' && e.outcome !== 'visor_fallo')
  const vistasExternas = vistas.filter((e) => e.viewer === 'pdfjs' || e.viewer === 'office')
  const fallos = eventos.filter((e) => e.outcome === 'visor_fallo')
  const descargas = eventos.filter((e) => e.event === 'descargar')
  const erroresUrl = eventos.filter((e) => e.outcome === 'error_url')

  const aperturasPorDisp = new Map(agrupar(vistasExternas, (e) => dispositivo(e.userAgent)))
  const fallosPorDisp = agrupar(fallos, (e) => dispositivo(e.userAgent))
  const porTipo = agrupar(vistas, (e) => e.fileType ?? 'desconocido')

  return (
    <div className="space-y-8 px-5 pt-14 pb-10">
      <BotonVolver href="/panel" />
      <Encabezado
        sobretitulo="Administración"
        titulo="Métricas del material"
        descripcion="Si los archivos se abren y en qué dispositivos fallan."
      />
      <Regla delay={60} />

      <div className="flex gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDias(d)}
            className={`min-h-11 flex-1 rounded-lg border text-sm font-bold ${dias === d ? 'border-zr-blue bg-zr-blue text-white' : 'border-zr-border text-zr-text'}`}
          >
            {d} días
          </button>
        ))}
      </div>

      {eventos.length === 0 ? (
        <EstadoVacio titulo="Todavía no hay datos" explicacion="Aparecerán cuando los estudiantes usen Ver o Descargar." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Tarjeta valor={vistas.length} etiqueta="Veces que se tocó Ver" />
            <Tarjeta valor={descargas.length} etiqueta="Descargas" />
            <Tarjeta valor={fallos.length} etiqueta="Fallos reportados por estudiantes" />
            <Tarjeta valor={porcentaje(fallos.length, vistasExternas.length)} etiqueta="Fallo en visores externos (PDF/Office)" />
            <Tarjeta valor={erroresUrl.length} etiqueta="Errores al generar el enlace" />
            <Tarjeta valor={porcentaje(vistas.length, vistas.length + descargas.length)} etiqueta="Prefieren Ver sobre Descargar" />
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zr-text-muted">Fallos por dispositivo</h2>
            {fallosPorDisp.length === 0 ? (
              <p className="text-sm text-zr-text-muted">Nadie ha reportado fallos en este periodo.</p>
            ) : fallosPorDisp.map(([disp, n]) => (
              <div key={disp} className="zr-card flex items-center justify-between p-3 text-sm">
                <span className="text-zr-text">{disp}</span>
                <span className="font-bold text-zr-error">
                  {n} de {aperturasPorDisp.get(disp) ?? n} ({porcentaje(n, aperturasPorDisp.get(disp) ?? n)})
                </span>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zr-text-muted">Qué tipo de archivo se abre</h2>
            {porTipo.map(([tipo, n]) => (
              <div key={tipo} className="zr-card flex items-center justify-between p-3 text-sm">
                <span className="text-zr-text">{tipo}</span>
                <span className="font-bold text-zr-text">{n}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
