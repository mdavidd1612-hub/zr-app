'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tarjeta } from '@/components/ui/Tarjeta'
import { Aviso } from '@/components/ui/Aviso'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { Cargando } from '@/components/ui/Cargando'

interface ConsentimientoPendiente {
  id: string
  studentName: string
  studentCedula: string
  birthDate: string
  email: string
  representativeName: string
  representativeCedula: string
  representativeEmail: string
  method: 'fisico' | 'digital'
  documentUrl: string | null
  createdAt: string
}

export default function Consentimientos() {
  const [pendientes, setPendientes] = useState<ConsentimientoPendiente[]>([])
  const [cargando, setCargando] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      try {
        // Estudiantes con onboarding_status = 'en_curso'
        const { data: estudiantesPendientes, error: e1 } = await supabase
          .from('students')
          .select(
            `
            id,
            birth_date,
            profile:id (full_name, cedula, contact_email),
            parental_consents (
              representative_name,
              representative_cedula,
              representative_email,
              method,
              document_url,
              created_at
            )
          `
          )
          .eq('onboarding_status', 'en_curso')

        if (e1) throw e1

        const formateados = (estudiantesPendientes || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((s: any) => {
            const consent = s.parental_consents?.[0]
            return {
              id: s.id,
              studentName: s.profile?.full_name || 'Desconocido',
              studentCedula: s.profile?.cedula || '',
              birthDate: s.birth_date || '',
              email: s.profile?.contact_email || '',
              representativeName: consent?.representative_name || '',
              representativeCedula: consent?.representative_cedula || '',
              representativeEmail: consent?.representative_email || '',
              method: consent?.method || 'fisico',
              documentUrl: consent?.document_url || null,
              createdAt: consent?.created_at || '',
            }
          })
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )

        setPendientes(formateados)
      } catch (err) {
        console.error('Error cargando consentimientos:', err)
      } finally {
        setCargando(false)
      }
    }

    cargar()
  }, [supabase])

  if (cargando) return <Cargando texto="Cargando consentimientos..." />

  if (pendientes.length === 0) {
    return (
      <EstadoVacio
        titulo="Sin consentimientos pendientes"
        explicacion="Todos los estudiantes tienen permisos registrados o son mayores de edad."
      />
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-zr-navy">Cola de consentimientos</h1>
        <p className="text-sm text-zr-text-muted">
          {pendientes.length} estudiante{pendientes.length !== 1 ? 's' : ''} pendiente
          {pendientes.length !== 1 ? 's' : ''} de revisar
        </p>
      </header>

      <Aviso tipo="advertencia">
        Estos estudiantes menores de edad no pueden acceder a la app hasta que el consentimiento de su
        representante legal sea registrado.
      </Aviso>

      <div className="space-y-4">
        {pendientes.map((consentimiento) => (
          <Tarjeta key={consentimiento.id}>
            <div className="space-y-4">
              {/* Estudiante */}
              <div>
                <h3 className="font-bold text-zr-navy">{consentimiento.studentName}</h3>
                <p className="text-sm text-zr-text-muted">{consentimiento.studentCedula}</p>
                <p className="text-xs text-zr-text-muted">
                  {consentimiento.email}
                </p>
              </div>

              {/* Representante */}
              {consentimiento.representativeName && (
                <div className="border-t border-zr-border pt-3">
                  <p className="text-xs font-medium text-zr-text-muted mb-1">REPRESENTANTE</p>
                  <p className="text-sm font-medium text-zr-text">{consentimiento.representativeName}</p>
                  <p className="text-sm text-zr-text-muted">{consentimiento.representativeCedula}</p>
                  <p className="text-xs text-zr-text-muted">{consentimiento.representativeEmail}</p>
                </div>
              )}

              {/* Método y documento */}
              {consentimiento.method && (
                <div className="border-t border-zr-border pt-3">
                  <p className="text-xs font-medium text-zr-text-muted mb-1">MÉTODO</p>
                  <p className="text-sm text-zr-text">
                    {consentimiento.method === 'fisico'
                      ? '📄 Firmó en papel en la sede'
                      : '📎 Documento digital'}
                  </p>
                  {consentimiento.documentUrl && (
                    <a
                      href={`/consentimientos/${consentimiento.documentUrl}`}
                      className="text-xs text-zr-blue-deep underline mt-1 block"
                    >
                      Ver documento →
                    </a>
                  )}
                </div>
              )}

              {/* Fecha */}
              <div className="border-t border-zr-border pt-3">
                <p className="text-xs text-zr-text-muted">
                  Registrado:{' '}
                  {new Date(consentimiento.createdAt).toLocaleDateString('es-VE')}
                </p>
              </div>
            </div>
          </Tarjeta>
        ))}
      </div>
    </div>
  )
}
