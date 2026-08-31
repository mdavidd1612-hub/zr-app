'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'

// Planilla firmable (Sprint 7, docs/17_PLAN_CONSOLIDADO...): NO reemplaza la
// firma física — se pre-llena con todo lo que ya se capturó digitalmente
// (inscripción + formulario del primer login) para que el estudiante solo
// tenga que revisarla y firmarla en persona, en la academia. "Imprimir" usa
// el diálogo del navegador (Guardar como PDF), sin depender de ninguna
// librería de generación de PDF en el servidor.

interface Datos {
  nombre: string
  cedula: string
  correo: string
  telefono: string | null
  fechaNacimiento: string
  esMenor: boolean
  studentCode: string | null
  cohorte: string | null
  programa: string | null
  sede: string | null
  representante: {
    nombre: string; cedula: string; correo: string; telefono: string | null
  } | null
  perfil: {
    nationality: string
    gender: string
    maritalStatus: string
    employmentStatus: string
    educationLevel: string
    educationStatus: string
    currentSchoolGrade: string | null
  } | null
}

const ETIQUETAS: Record<string, string> = {
  venezolana: 'Venezolana', extranjera: 'Extranjera', otra: 'Otra',
  femenino: 'Femenino', masculino: 'Masculino', otro: 'Otro',
  soltero: 'Soltero(a)', casado: 'Casado(a)', divorciado: 'Divorciado(a)', viudo: 'Viudo(a)', union_estable: 'Unión estable',
  ocupado_dependiente: 'Ocupado(a) dependiente', ocupado_independiente: 'Ocupado(a) independiente', desempleado: 'Desempleado(a)',
  bachillerato: 'Bachillerato', tecnico: 'Técnico', universitario: 'Universitario', postgrado: 'Postgrado',
  en_curso: 'En curso', incompleto: 'Incompleto', completo: 'Completo',
}

export default function PlanillaEstudiante() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: est } = await supabase
        .from('v_students')
        .select('full_name, cedula, contact_email, phone, birth_date, is_minor, cohort_id')
        .eq('id', id)
        .single()

      if (!est) {
        setCargando(false)
        return
      }

      const [{ data: student }, { data: consentimiento }, { data: perfilDetalle }] = await Promise.all([
        supabase.from('students').select('student_code, cohorts(name, sede, programs(name))').eq('id', id).single(),
        supabase.from('parental_consents').select('representative_name, representative_cedula, representative_email, representative_phone')
          .eq('student_id', id).eq('consent_type', 'account_creation').maybeSingle(),
        supabase.from('student_profile_details')
          .select('nationality, gender, marital_status, employment_status, education_level, education_status, current_school_grade')
          .eq('student_id', id).maybeSingle(),
      ])

      const cohorteInfo = (student as unknown as {
        student_code: string | null
        cohorts: { name: string; sede: string | null; programs: { name: string } | null } | null
      } | null)

      setDatos({
        nombre: est.full_name ?? '',
        cedula: est.cedula ?? '',
        correo: est.contact_email ?? '',
        telefono: est.phone,
        fechaNacimiento: est.birth_date ?? '',
        esMenor: est.is_minor ?? false,
        studentCode: cohorteInfo?.student_code ?? null,
        cohorte: cohorteInfo?.cohorts?.name ?? null,
        programa: cohorteInfo?.cohorts?.programs?.name ?? null,
        sede: cohorteInfo?.cohorts?.sede ?? null,
        representante: consentimiento ? {
          nombre: consentimiento.representative_name,
          cedula: consentimiento.representative_cedula,
          correo: consentimiento.representative_email,
          telefono: consentimiento.representative_phone,
        } : null,
        perfil: perfilDetalle ? {
          nationality: ETIQUETAS[perfilDetalle.nationality] ?? perfilDetalle.nationality,
          gender: ETIQUETAS[perfilDetalle.gender] ?? perfilDetalle.gender,
          maritalStatus: ETIQUETAS[perfilDetalle.marital_status] ?? perfilDetalle.marital_status,
          employmentStatus: ETIQUETAS[perfilDetalle.employment_status] ?? perfilDetalle.employment_status,
          educationLevel: ETIQUETAS[perfilDetalle.education_level] ?? perfilDetalle.education_level,
          educationStatus: ETIQUETAS[perfilDetalle.education_status] ?? perfilDetalle.education_status,
          currentSchoolGrade: perfilDetalle.current_school_grade,
        } : null,
      })
      setCargando(false)
    }

    cargar()
  }, [id, router])

  if (cargando || !datos) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando planilla…</p>
      </div>
    )
  }

  return (
    <div className="px-5 pb-16 pt-14 print:px-0 print:pt-0">
      <div className="print:hidden">
        <BotonVolver href={`/estudiantes/${id}`} />
        <button
          onClick={() => window.print()}
          className="mt-6 min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white"
        >
          Imprimir / Guardar como PDF
        </button>
      </div>

      <div className="mx-auto mt-8 max-w-[700px] space-y-6 rounded-lg bg-white p-8 text-black print:mt-0 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-black pb-4 text-center">
          <p className="text-lg font-bold">ZR Mecademy</p>
          <p className="text-sm">Planilla de inscripción · {datos.programa ?? '—'}</p>
          <p className="text-xs text-neutral-600">Sede: {datos.sede ?? '—'} · Código: {datos.studentCode ?? 'pendiente'}</p>
        </header>

        <Bloque titulo="Datos del estudiante">
          <Campo etiqueta="Nombre completo" valor={datos.nombre} />
          <Campo etiqueta="Cédula" valor={datos.cedula} />
          <Campo etiqueta="Fecha de nacimiento" valor={datos.fechaNacimiento} />
          <Campo etiqueta="Correo de contacto" valor={datos.correo} />
          <Campo etiqueta="Teléfono" valor={datos.telefono ?? '—'} />
          <Campo etiqueta="Cohorte" valor={datos.cohorte ?? '—'} />
        </Bloque>

        {datos.perfil && (
          <Bloque titulo="Datos del perfil (primer login)">
            <Campo etiqueta="Nacionalidad" valor={datos.perfil.nationality} />
            <Campo etiqueta="Género" valor={datos.perfil.gender} />
            <Campo etiqueta="Estado civil" valor={datos.perfil.maritalStatus} />
            <Campo etiqueta="Condición laboral" valor={datos.perfil.employmentStatus} />
            <Campo etiqueta="Escolaridad" valor={`${datos.perfil.educationLevel} · ${datos.perfil.educationStatus}`} />
            {datos.perfil.currentSchoolGrade && (
              <Campo etiqueta="Colegio/liceo actual" valor={datos.perfil.currentSchoolGrade} />
            )}
          </Bloque>
        )}

        {datos.esMenor && (
          <Bloque titulo="Representante legal (obligatorio, menor de edad)">
            {datos.representante ? (
              <>
                <Campo etiqueta="Nombre" valor={datos.representante.nombre} />
                <Campo etiqueta="Cédula" valor={datos.representante.cedula} />
                <Campo etiqueta="Correo" valor={datos.representante.correo} />
                <Campo etiqueta="Teléfono" valor={datos.representante.telefono ?? '—'} />
              </>
            ) : (
              <p className="text-sm font-semibold text-red-700">
                Falta el consentimiento parental — no imprimir hasta completarlo.
              </p>
            )}
          </Bloque>
        )}

        <section className="space-y-2 border-t border-neutral-300 pt-4 text-xs leading-relaxed text-neutral-700">
          <p className="font-bold uppercase tracking-wide text-neutral-900">Términos y condiciones</p>
          <p>
            [Espacio reservado para el texto legal de políticas, términos y condiciones de la
            academia — pendiente de redacción por administración/asesoría legal.]
          </p>
        </section>

        <footer className="mt-10 grid grid-cols-2 gap-10 pt-8 text-center text-sm">
          <div>
            <div className="mb-2 border-t border-black pt-2">Firma del estudiante</div>
          </div>
          <div>
            <div className="mb-2 border-t border-black pt-2">
              {datos.esMenor ? 'Firma del representante legal' : 'Firma de administración'}
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{titulo}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded border border-neutral-300 p-4 text-sm">
        {children}
      </div>
    </section>
  )
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <span className="block text-[11px] font-semibold uppercase text-neutral-500">{etiqueta}</span>
      <span>{valor}</span>
    </div>
  )
}
