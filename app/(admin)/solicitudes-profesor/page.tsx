'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import type { UserRole } from '@/lib/types'

// Solo Dirección Académica y super_admin llegan aquí (proxy.ts las deja
// entrar al área admin, pero esta pantalla es del trabajo específico de
// Dirección Académica — un admin normal no la ve en su menú).

interface Solicitud {
  id: string
  full_name: string
  cedula: string
  contact_email: string
  phone: string | null
  created_at: string
}

interface Cohorte {
  id: string
  nombre: string
  moduloNombre: string | null
}

export default function SolicitudesProfesor() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)
  const [cohorteElegida, setCohorteElegida] = useState<Record<string, string>>({})
  const [procesando, setProcesando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

      if (!esDireccionAcademica(perfil?.role as UserRole | undefined)) {
        setAutorizado(false)
        return
      }
      setAutorizado(true)

      const [{ data: sols }, { data: cohs }] = await Promise.all([
        supabase
          .from('professor_applications')
          .select('id, full_name, cedula, contact_email, phone, created_at')
          .eq('status', 'pendiente')
          .order('created_at', { ascending: true }),
        supabase
          .from('cohorts')
          .select('id, name, modules(name)')
          .eq('status', 'activa'),
      ])

      if (!vigente) return

      setSolicitudes(sols ?? [])
      setCohortes(
        ((cohs ?? []) as unknown as { id: string; name: string; modules: { name: string } | null }[]).map((c) => ({
          id: c.id,
          nombre: c.name,
          moduloNombre: c.modules?.name ?? null,
        })),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, version])

  async function decidir(id: string, decision: 'aprobado' | 'rechazado') {
    setProcesando(id)
    setError(null)

    const supabase = createClient()
    const { error: fallo } = await supabase.functions.invoke('approve-professor', {
      body: {
        applicationId: id,
        decision,
        cohortId: decision === 'aprobado' ? (cohorteElegida[id] || undefined) : undefined,
      },
    })

    if (fallo) {
      const contexto = (fallo as { context?: { json?: () => Promise<unknown> } }).context
      if (contexto?.json) {
        const cuerpo = (await contexto.json()) as { error?: { message: string } }
        setError(cuerpo.error?.message ?? 'No se pudo procesar la solicitud.')
      } else {
        setError('No se pudo procesar la solicitud. Revisa tu conexión.')
      }
      setProcesando(null)
      return
    }

    setSolicitudes((ss) => ss.filter((s) => s.id !== id))
    setProcesando(null)
  }

  if (autorizado === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg px-5 text-center">
        <p className="text-sm text-zr-text-muted">Esta pantalla es solo para Dirección Académica.</p>
      </div>
    )
  }

  if (cargando || autorizado === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando solicitudes…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <BotonVolver href="/panel" />

      <Encabezado
        sobretitulo="Dirección Académica"
        titulo="Solicitudes de profesor"
        descripcion={
          solicitudes.length === 0
            ? undefined
            : `${solicitudes.length} solicitud${solicitudes.length === 1 ? '' : 'es'} pendiente${solicitudes.length === 1 ? '' : 's'}`
        }
      />

      <Regla delay={60} />

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      {solicitudes.length === 0 ? (
        <EstadoVacio
          titulo="Sin solicitudes pendientes"
          explicacion="Cuando alguien marque «¿Eres profesor?» al iniciar sesión, aparecerá aquí."
        />
      ) : (
        <div className="space-y-4">
          {solicitudes.map((s) => (
            <div key={s.id} className="zr-card space-y-4 p-5">
              <div>
                <p className="text-base font-semibold text-zr-text">{s.full_name}</p>
                <p className="mt-1 text-sm tabular-nums text-zr-text-muted">{s.cedula}</p>
                <p className="text-sm text-zr-text-muted">{s.contact_email}</p>
                {s.phone && <p className="text-sm text-zr-text-muted">{s.phone}</p>}
                <p className="mt-2 text-xs text-zr-text-muted">
                  Solicitó el {new Date(s.created_at).toLocaleDateString('es-VE')}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-zr-text">
                  Cohorte a cargo <span className="font-normal text-zr-text-muted">(opcional)</span>
                </label>
                <select
                  value={cohorteElegida[s.id] ?? ''}
                  onChange={(e) => setCohorteElegida((c) => ({ ...c, [s.id]: e.target.value }))}
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
                >
                  <option value="">Sin asignar por ahora</option>
                  {cohortes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}{c.moduloNombre ? ` · ${c.moduloNombre}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => decidir(s.id, 'rechazado')}
                  disabled={procesando === s.id}
                  className="min-h-14 flex-1 rounded-lg border border-zr-error/40 text-base font-bold text-zr-error disabled:opacity-40"
                >
                  Rechazar
                </button>
                <button
                  onClick={() => decidir(s.id, 'aprobado')}
                  disabled={procesando === s.id}
                  className="min-h-14 flex-[2] rounded-lg bg-zr-success text-base font-bold text-white disabled:opacity-40"
                >
                  {procesando === s.id ? 'Procesando…' : 'Aprobar como profesor'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
