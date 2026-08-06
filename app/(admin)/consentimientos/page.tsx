'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Etiqueta } from '@/components/ui/Editorial'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { IconoDocumento, IconoCandado } from '@/components/ui/Iconos'

interface ConsentimientoPendiente {
  id: string
  studentName: string
  studentCedula: string
  email: string
  representativeName: string
  representativeCedula: string
  representativeEmail: string
  method: 'fisico' | 'digital'
  documentUrl: string | null
  createdAt: string
}

interface FilaEstudiante {
  id: string
  birth_date: string | null
  profile: { full_name: string; cedula: string; contact_email: string } | null
  parental_consents: {
    representative_name: string
    representative_cedula: string
    representative_email: string
    method: 'fisico' | 'digital'
    document_url: string | null
    created_at: string
  }[] | null
}

export default function Consentimientos() {
  const [pendientes, setPendientes] = useState<ConsentimientoPendiente[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data, error } = await supabase
        .from('students')
        .select(`
          id, birth_date,
          profile:id (full_name, cedula, contact_email),
          parental_consents (representative_name, representative_cedula, representative_email, method, document_url, created_at)
        `)
        .eq('onboarding_status', 'en_curso')

      if (error) {
        console.error('Error cargando consentimientos:', error.message)
        setCargando(false)
        return
      }

      const filas = data as unknown as FilaEstudiante[]

      setPendientes(
        filas
          .map((s) => {
            const c = s.parental_consents?.[0]
            return {
              id: s.id,
              studentName: s.profile?.full_name ?? 'Desconocido',
              studentCedula: s.profile?.cedula ?? '',
              email: s.profile?.contact_email ?? '',
              representativeName: c?.representative_name ?? '',
              representativeCedula: c?.representative_cedula ?? '',
              representativeEmail: c?.representative_email ?? '',
              method: c?.method ?? 'fisico',
              documentUrl: c?.document_url ?? null,
              createdAt: c?.created_at ?? '',
            }
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      )
      setCargando(false)
    }

    cargar()
  }, [])

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
            : `${pendientes.length} estudiante${pendientes.length === 1 ? '' : 's'} pendiente${pendientes.length === 1 ? '' : 's'} de revisar`
        }
      />

      <Regla delay={60} />

      {pendientes.length === 0 ? (
        <EstadoVacio
          titulo="Sin consentimientos pendientes"
          explicacion="Todos los estudiantes tienen permisos registrados o son mayores de edad."
        />
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-lg border border-zr-warning/30 bg-zr-warning/10 p-4">
            <IconoCandado size={18} className="mt-0.5 shrink-0 text-zr-warning" />
            <p className="text-sm text-zr-text">
              Estos estudiantes menores de edad no pueden entrar a la app hasta que el
              consentimiento de su representante legal quede registrado.
            </p>
          </div>

          <div className="space-y-4">
            {pendientes.map((c) => (
              <div key={c.id} className="zr-card divide-y divide-zr-border">
                <div className="p-5">
                  <p className="text-base font-semibold text-zr-text">{c.studentName}</p>
                  <p className="mt-1 text-sm tabular-nums text-zr-text-muted">{c.studentCedula}</p>
                  {c.email && <p className="text-sm text-zr-text-muted">{c.email}</p>}
                </div>

                {c.representativeName && (
                  <div className="p-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">
                      Representante
                    </p>
                    <p className="mt-2 text-sm font-medium text-zr-text">{c.representativeName}</p>
                    <p className="text-sm tabular-nums text-zr-text-muted">{c.representativeCedula}</p>
                    {c.representativeEmail && (
                      <p className="text-sm text-zr-text-muted">{c.representativeEmail}</p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 p-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">
                      Método
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-zr-text">
                      <IconoDocumento size={16} className="text-zr-text-muted" />
                      {c.method === 'fisico' ? 'Firmó en papel en la sede' : 'Documento digital'}
                    </p>
                    {c.documentUrl && (
                      <a
                        href={`/consentimientos/${c.documentUrl}`}
                        className="mt-2 inline-block text-xs font-semibold text-zr-blue underline underline-offset-2"
                      >
                        Ver documento
                      </a>
                    )}
                  </div>
                  {c.createdAt && (
                    <Etiqueta tono="neutro">
                      {new Date(c.createdAt).toLocaleDateString('es-VE')}
                    </Etiqueta>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
