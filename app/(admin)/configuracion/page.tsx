'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * T-411 · Panel de configuración. Solo super_admin — la RLS de la migración
 * 012 ("super: escribir config") es la garantía real, esto solo evita que un
 * admin normal vea un formulario que no puede usar.
 *
 * Toda la aplicación lee de aquí. Cambiar un umbral es editar una fila, no
 * desplegar código — por eso NUNCA se hardcodean estos valores en el código.
 */

interface Config {
  key: string
  value: unknown
  description: string
  isPublic: boolean
  updatedAt: string
  actualizadoPor: string | null
}

interface Cambio {
  id: number
  key: string
  oldValue: unknown
  newValue: unknown
  changedAt: string
  cambiadoPor: string | null
}

export default function Configuracion() {
  const router = useRouter()
  const [esSuperAdmin, setEsSuperAdmin] = useState<boolean | null>(null)
  const [config, setConfig] = useState<Config[]>([])
  const [historial, setHistorial] = useState<Cambio[]>([])
  const [borradores, setBorradores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true

    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!vigente) return

      const esSuper = perfil?.role === 'super_admin'
      setEsSuperAdmin(esSuper)
      if (!esSuper) {
        setCargando(false)
        return
      }

      const [{ data: cfg }, { data: hist }] = await Promise.all([
        supabase.from('system_config').select('key, value, description, is_public, updated_at, profiles(full_name)').order('key'),
        supabase.from('system_config_history').select('id, key, old_value, new_value, changed_at, profiles(full_name)').order('changed_at', { ascending: false }).limit(30),
      ])

      if (!vigente) return

      const filasCfg = cfg as unknown as {
        key: string; value: unknown; description: string; is_public: boolean
        updated_at: string; profiles: { full_name: string } | null
      }[] | null

      setConfig(
        (filasCfg ?? []).map((c) => ({
          key: c.key,
          value: c.value,
          description: c.description,
          isPublic: c.is_public,
          updatedAt: c.updated_at,
          actualizadoPor: c.profiles?.full_name ?? null,
        })),
      )

      const filasHist = hist as unknown as {
        id: number; key: string; old_value: unknown; new_value: unknown
        changed_at: string; profiles: { full_name: string } | null
      }[] | null

      setHistorial(
        (filasHist ?? []).map((h) => ({
          id: h.id,
          key: h.key,
          oldValue: h.old_value,
          newValue: h.new_value,
          changedAt: h.changed_at,
          cambiadoPor: h.profiles?.full_name ?? null,
        })),
      )

      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, version])

  function textoValor(v: unknown): string {
    return typeof v === 'string' ? v : JSON.stringify(v)
  }

  async function guardar(key: string) {
    const texto = borradores[key]
    if (texto === undefined) return

    let nuevoValor: unknown
    try {
      // Un número o "texto" entre comillas se parsea como JSON tal cual;
      // una palabra suelta (ej: true, o un texto sin comillas) se envuelve.
      nuevoValor = JSON.parse(texto)
    } catch {
      nuevoValor = texto
    }

    setGuardando(key)
    setError(null)

    const { error: fallo } = await createClient()
      .from('system_config')
      .update({ value: nuevoValor as never })
      .eq('key', key)

    if (fallo) {
      setError(`${key}: ${fallo.message}`)
      setGuardando(null)
      return
    }

    setBorradores((b) => { const { [key]: _omitido, ...resto } = b; return resto })
    setGuardando(null)
    setVersion((v) => v + 1)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  if (esSuperAdmin === false) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-zr-bg px-5">
        <div className="zr-card max-w-sm p-8 text-center">
          <p className="text-base font-semibold text-zr-text">Solo super_admin</p>
          <p className="mt-2 text-sm text-zr-text-muted">
            Esta pantalla cambia reglas de negocio de toda la academia. Solo super_admin
            puede entrar.
          </p>
        </div>
        <BotonVolver href="/panel" />
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <BotonVolver href="/panel" />

      <Encabezado
        sobretitulo="Dirección académica"
        titulo="Configuración"
        descripcion="Cambiar un valor aquí es editar una fila, no desplegar código."
      />

      <Regla delay={60} />

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      <Seccion numero={1} titulo="Valores" delay={120}>
        <div className="space-y-3">
          {config.map((c) => {
            const enEdicion = borradores[c.key] !== undefined
            const valorMostrado = enEdicion ? borradores[c.key] : textoValor(c.value)
            const cambio = enEdicion && borradores[c.key] !== textoValor(c.value)

            return (
              <div key={c.key} className="zr-card p-5">
                <p className="text-xs font-bold tabular-nums text-zr-blue-mid">{c.key}</p>
                <p className="mt-1.5 text-sm text-zr-text-muted">{c.description}</p>

                <div className="mt-3 flex gap-2">
                  <input
                    value={valorMostrado}
                    onChange={(e) => setBorradores((b) => ({ ...b, [c.key]: e.target.value }))}
                    className="min-w-0 flex-1 rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm tabular-nums text-zr-text focus:border-zr-blue focus:outline-none"
                  />
                  <button
                    onClick={() => guardar(c.key)}
                    disabled={!cambio || guardando === c.key}
                    className="shrink-0 rounded-lg bg-zr-blue px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {guardando === c.key ? '…' : 'Guardar'}
                  </button>
                </div>

                <p className="mt-2 text-xs text-zr-text-muted">
                  {c.actualizadoPor ? `Último cambio: ${c.actualizadoPor}, ` : ''}
                  {new Date(c.updatedAt).toLocaleString('es-VE')}
                </p>
              </div>
            )
          })}
        </div>
      </Seccion>

      {historial.length > 0 && (
        <Seccion numero={2} titulo="Historial de cambios" delay={220}>
          <div className="zr-card divide-y divide-zr-border">
            {historial.map((h) => (
              <div key={h.id} className="p-4">
                <p className="text-xs font-bold tabular-nums text-zr-blue-mid">{h.key}</p>
                <p className="mt-1 text-sm text-zr-text">
                  {textoValor(h.oldValue) || '(vacío)'} → {textoValor(h.newValue)}
                </p>
                <p className="mt-1 text-xs text-zr-text-muted">
                  {h.cambiadoPor ?? 'Sistema'} · {new Date(h.changedAt).toLocaleString('es-VE')}
                </p>
              </div>
            ))}
          </div>
        </Seccion>
      )}
    </div>
  )
}
