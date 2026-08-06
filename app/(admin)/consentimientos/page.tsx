'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Etiqueta } from '@/components/ui/Editorial'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { IconoDocumento, IconoCandado } from '@/components/ui/Iconos'

/**
 * T-114 · Cola de consentimientos.
 *
 * Lee de v_students_blocked (migración 010): SOLO menores de edad a quienes
 * les falta el consentimiento o les falta verificarlo. Un estudiante mayor de
 * edad, o uno cuyo consentimiento ya está verificado, no aparece aquí — no
 * porque se filtre en el cliente, sino porque la vista ya no lo trae.
 *
 * Esta es la pantalla que evita que la academia incumpla la LOPNNA.
 */

interface FilaBloqueada {
  id: string
  full_name: string
  cedula: string
  contact_email: string
  age_years: number
  missing_consent: boolean
  consent_unverified: boolean
}

interface DetalleConsentimiento {
  representative_name: string
  representative_cedula: string
  representative_email: string
  method: 'fisico' | 'digital'
  document_url: string | null
  created_at: string
}

interface Pendiente extends FilaBloqueada {
  detalle: DetalleConsentimiento | null
}

export default function Consentimientos() {
  const router = useRouter()
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [cargando, setCargando] = useState(true)
  const [verificando, setVerificando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

      const { data: bloqueados, error: e1 } = await supabase
        .from('v_students_blocked')
        .select('*')
        .order('full_name')

      if (!vigente) return

      if (e1 || !bloqueados) {
        setError(e1?.message ?? 'No se pudo cargar la cola')
        setCargando(false)
        return
      }

      const filas = bloqueados as unknown as FilaBloqueada[]

      // El consentimiento (si existe, aunque sin verificar) trae el detalle
      // para mostrarlo. Uno solo por estudiante: consent_type='account_creation'.
      const ids = filas.map((f) => f.id)
      const { data: consentimientos } = ids.length
        ? await supabase
            .from('parental_consents')
            .select('student_id, representative_name, representative_cedula, representative_email, method, document_url, created_at')
            .in('student_id', ids)
            .eq('consent_type', 'account_creation')
        : { data: [] }

      if (!vigente) return

      const porEstudiante = new Map((consentimientos ?? []).map((c) => [c.student_id, c]))

      setPendientes(filas.map((f) => ({ ...f, detalle: porEstudiante.get(f.id) ?? null })))
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, version])

  async function verificar(estudianteId: string) {
    setVerificando(estudianteId)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // verified_by es admins.id, no profiles.id — pero son el mismo uuid
    // (admins.id referencia a profiles.id 1 a 1).
    const { error: fallo } = await supabase
      .from('parental_consents')
      .update({ verified_by: user.id, verified_at: new Date().toISOString() })
      .eq('student_id', estudianteId)
      .eq('consent_type', 'account_creation')

    if (fallo) {
      setError(fallo.message)
      setVerificando(null)
      return
    }

    setPendientes((ps) => ps.filter((p) => p.id !== estudianteId))
    setVerificando(null)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando consentimientos…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <Encabezado
        sobretitulo="Administración"
        titulo="Consentimientos"
        descripcion={
          pendientes.length === 0
            ? undefined
            : `${pendientes.length} menor${pendientes.length === 1 ? '' : 'es'} de edad pendiente${pendientes.length === 1 ? '' : 's'}`
        }
      />

      <Regla delay={60} />

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      {pendientes.length === 0 ? (
        <EstadoVacio
          titulo="Sin consentimientos pendientes"
          explicacion="Todos los estudiantes menores de edad tienen su consentimiento registrado y verificado."
        />
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-lg border border-zr-warning/30 bg-zr-warning/10 p-4">
            <IconoCandado size={18} className="mt-0.5 shrink-0 text-zr-warning" />
            <p className="text-sm text-zr-text">
              Ninguno de estos estudiantes puede entrar a la app hasta que verifiques su
              consentimiento. Es la ley (LOPNNA), no una preferencia de diseño.
            </p>
          </div>

          <div className="space-y-4">
            {pendientes.map((p) => (
              <div key={p.id} className="zr-card divide-y divide-zr-border">
                <div className="flex items-start justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-zr-text">{p.full_name}</p>
                    <p className="mt-1 text-sm tabular-nums text-zr-text-muted">{p.cedula}</p>
                    <p className="text-sm text-zr-text-muted">{p.age_years} años</p>
                  </div>
                  <Etiqueta tono={p.missing_consent ? 'error' : 'aviso'}>
                    {p.missing_consent ? 'Sin consentimiento' : 'Sin verificar'}
                  </Etiqueta>
                </div>

                {p.detalle ? (
                  <>
                    <div className="p-5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">
                        Representante
                      </p>
                      <p className="mt-2 text-sm font-medium text-zr-text">{p.detalle.representative_name}</p>
                      <p className="text-sm tabular-nums text-zr-text-muted">{p.detalle.representative_cedula}</p>
                      <p className="text-sm text-zr-text-muted">{p.detalle.representative_email}</p>
                    </div>

                    <div className="p-5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">
                        Método
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-sm text-zr-text">
                        <IconoDocumento size={16} className="text-zr-text-muted" />
                        {p.detalle.method === 'fisico' ? 'Firmó en papel en la sede' : 'Documento digital'}
                      </p>
                      {p.detalle.document_url && (
                        <a
                          href={`/consentimientos/${p.detalle.document_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs font-semibold text-zr-blue underline underline-offset-2"
                        >
                          Ver documento
                        </a>
                      )}
                      <p className="mt-2 text-xs text-zr-text-muted">
                        Registrado el {new Date(p.detalle.created_at).toLocaleDateString('es-VE')}
                      </p>
                    </div>

                    <div className="p-4">
                      <button
                        onClick={() => verificar(p.id)}
                        disabled={verificando === p.id}
                        className="min-h-14 w-full rounded-lg bg-zr-success px-4 text-base font-bold text-white transition-colors active:bg-zr-success/90 disabled:opacity-50"
                      >
                        {verificando === p.id ? 'Verificando…' : 'Verificar'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-5">
                    <p className="text-sm text-zr-text-muted">
                      Todavía no ha llegado ningún consentimiento de este representante. No hay
                      nada que verificar aún.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
