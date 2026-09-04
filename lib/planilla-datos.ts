import { createClient } from '@/lib/supabase/client'
import type { DatosPlanilla } from '@/components/planilla/PlanillaDocumento'

/**
 * Misma consulta que antes vivía solo en app/(admin)/estudiantes/[id]/planilla —
 * se separó para poder reusarla también al descargar todas las planillas de
 * un programa de una vez (estudiantes/page.tsx).
 */
export async function cargarDatosPlanilla(id: string): Promise<DatosPlanilla | null> {
  const supabase = createClient()

  const { data: est } = await supabase
    .from('v_students')
    .select('full_name, cedula, phone, address, birth_date, enrollment_date, is_minor')
    .eq('id', id)
    .single()

  if (!est) return null

  const [{ data: student }, { data: consentimiento }] = await Promise.all([
    supabase.from('students').select('student_code, cohorts(days, schedule, current_module_id, modules(name))').eq('id', id).single(),
    supabase.from('parental_consents')
      .select('representative_name, representative_cedula, representative_email, representative_phone, representative_relationship, representative_age, representative_nationality, representative_occupation')
      .eq('student_id', id).eq('consent_type', 'account_creation').maybeSingle(),
  ])

  const cohorteInfo = (student as unknown as {
    student_code: string | null
    cohorts: { days: string | null; schedule: string | null; modules: { name: string } | null } | null
  } | null)

  // "Días y horario" salen de la cohorte (migración 052), nunca escritos
  // en el código: cambiarlos es editar la cohorte, no desplegar.
  const diasYHorario = [cohorteInfo?.cohorts?.days, cohorteInfo?.cohorts?.schedule]
    .filter(Boolean).join(', ') || null

  return {
    nombre: est.full_name ?? '',
    cedula: est.cedula ?? '',
    telefono: est.phone,
    direccion: est.address,
    fechaNacimiento: est.birth_date ?? '',
    fechaInscripcion: est.enrollment_date ?? '',
    esMenor: est.is_minor ?? false,
    studentCode: cohorteInfo?.student_code ?? null,
    moduloActual: cohorteInfo?.cohorts?.modules?.name ?? null,
    diasYHorario,
    representante: consentimiento ? {
      nombre: consentimiento.representative_name,
      cedula: consentimiento.representative_cedula,
      telefono: consentimiento.representative_phone,
      correo: consentimiento.representative_email,
      parentesco: consentimiento.representative_relationship,
      edad: consentimiento.representative_age,
      nacionalidad: consentimiento.representative_nationality,
      profesion: consentimiento.representative_occupation,
    } : null,
  }
}
