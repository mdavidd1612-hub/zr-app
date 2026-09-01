'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'

// Planilla firmable (Sprint 7, docs/17_PLAN_CONSOLIDADO...): réplica fiel de
// planilla_modulo1_ejemplo.pdf (2 páginas) que ya usa la academia en papel —
// mismo encabezado, mismos campos, mismo texto legal. NO reemplaza la firma
// física — se pre-llena con lo que ya se capturó digitalmente (inscripción
// del vendedor + formulario del primer login) para que solo haga falta
// revisarla y firmarla en persona. "Imprimir" usa el diálogo del navegador
// (Guardar como PDF), sin depender de ninguna librería de PDF en el servidor.

const INSTITUCION = {
  nombre: 'ACADEMIA DE FORMACIÓN ZR MECADEMY',
  rif: 'J-506479885',
  direccion: 'C.C. La Morita, Nivel Sótano, San Antonio de los Altos, Estado Miranda',
  telAdmin: '0412-8217792',
  telAcademico: '0414-2345140',
  correo: 'academiazrmacademy@gmail.com',
  horario: 'Sábados',
}

const HORARIO_TURNO: Record<string, string> = {
  'mañana': 'Sábados, 9:00 a.m. – 12:00 p.m.',
  tarde: 'Sábados, 2:00 p.m. – 5:00 p.m.',
}

interface Datos {
  nombre: string
  cedula: string
  telefono: string | null
  direccion: string | null
  fechaNacimiento: string
  fechaInscripcion: string
  esMenor: boolean
  studentCode: string | null
  moduloActual: string | null
  turno: string | null
  representante: {
    nombre: string; cedula: string; telefono: string | null; correo: string
  } | null
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
        .select('full_name, cedula, phone, address, birth_date, enrollment_date, is_minor')
        .eq('id', id)
        .single()

      if (!est) {
        setCargando(false)
        return
      }

      const [{ data: student }, { data: consentimiento }] = await Promise.all([
        supabase.from('students').select('student_code, cohorts(turno, current_module_id, modules(name))').eq('id', id).single(),
        supabase.from('parental_consents')
          .select('representative_name, representative_cedula, representative_email, representative_phone')
          .eq('student_id', id).eq('consent_type', 'account_creation').maybeSingle(),
      ])

      const cohorteInfo = (student as unknown as {
        student_code: string | null
        cohorts: { turno: string | null; modules: { name: string } | null } | null
      } | null)

      setDatos({
        nombre: est.full_name ?? '',
        cedula: est.cedula ?? '',
        telefono: est.phone,
        direccion: est.address,
        fechaNacimiento: est.birth_date ?? '',
        fechaInscripcion: est.enrollment_date ?? '',
        esMenor: est.is_minor ?? false,
        studentCode: cohorteInfo?.student_code ?? null,
        moduloActual: cohorteInfo?.cohorts?.modules?.name ?? null,
        turno: cohorteInfo?.cohorts?.turno ?? null,
        representante: consentimiento ? {
          nombre: consentimiento.representative_name,
          cedula: consentimiento.representative_cedula,
          telefono: consentimiento.representative_phone,
          correo: consentimiento.representative_email,
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

  const fecha = (iso: string) => {
    if (!iso) return '__ / __ / ____'
    const d = new Date(iso + 'T12:00:00')
    return `${String(d.getDate()).padStart(2, '0')} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${d.getFullYear()}`
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

      {/* ============================= PÁGINA 1 ============================= */}
      <div className="mx-auto mt-8 max-w-[700px] rounded-lg bg-white p-8 text-black print:mt-0 print:max-w-none print:min-h-screen print:rounded-none print:p-0 print:shadow-none print:break-after-page">
        <header className="border-b-2 border-black pb-3 text-center">
          <p className="text-base font-bold uppercase">{INSTITUCION.nombre}</p>
          <p className="text-[11px] text-neutral-700">
            RIF: {INSTITUCION.rif} &nbsp;|&nbsp; {INSTITUCION.direccion}
          </p>
          <p className="text-[11px] text-neutral-700">
            Tel. Adm: {INSTITUCION.telAdmin} &nbsp;&nbsp; Tel. Acad: {INSTITUCION.telAcademico} &nbsp;&nbsp;
            {INSTITUCION.correo} &nbsp;&nbsp; Horario de atención: {INSTITUCION.horario}
          </p>
        </header>

        <p className="mt-4 text-center text-sm font-bold uppercase tracking-wide">
          Planilla de inscripción – Comprobante Módulo 1
        </p>
        <p className="mt-1 text-center text-[11px] leading-relaxed text-neutral-600">
          Documento generado automáticamente por el sistema a partir de los datos cargados al momento
          del pago. Los campos no incluidos aquí (perfil académico, condiciones, correo, etc.) se
          completan luego dentro de la aplicación.
        </p>

        <div className="mt-5 rounded border-2 border-black p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wide">
            Código de estudiante — consérvelo, lo necesitará para su primer ingreso a la app
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{datos.studentCode ?? 'PENDIENTE'}</p>
        </div>

        <p className="mt-6 border-b border-black pb-1 text-xs font-bold uppercase tracking-wide">
          Datos del participante
        </p>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <CampoAncho etiqueta="Nombre y apellido" valor={datos.nombre} />
          <Campo etiqueta="C.I." valor={datos.cedula} />
          <Campo etiqueta="Módulo a cursar" valor={datos.moduloActual ?? '—'} />
          <Campo etiqueta="Días y horario" valor={datos.turno ? HORARIO_TURNO[datos.turno] : '—'} />
          <Campo etiqueta="Fecha de inscripción" valor={fecha(datos.fechaInscripcion)} />
          <Campo etiqueta="Nro. celular del participante" valor={datos.telefono ?? '—'} />
          <CampoAncho etiqueta="Dirección" valor={datos.direccion ?? '—'} />
        </div>
        <p className="mt-2 text-[10px] italic text-neutral-500">
          Los &quot;Días y Horario&quot; se muestran automáticamente según el módulo seleccionado; no se
          solicitan como dato aparte al vendedor.
        </p>

        {datos.esMenor && datos.representante && (
          <>
            <p className="mt-6 border-b border-black pb-1 text-xs font-bold uppercase tracking-wide">
              Contacto del representante
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <CampoAncho etiqueta="Nombre y apellido del representante" valor={datos.representante.nombre || '—'} />
              <Campo etiqueta="C.I." valor={datos.representante.cedula || '—'} />
              <Campo etiqueta="Nro. celular" valor={datos.representante.telefono ?? '—'} />
              <Campo etiqueta="Correo" valor={datos.representante.correo || '—'} />
            </div>
          </>
        )}
      </div>

      {/* ============================= PÁGINA 2 ============================= */}
      <div className="mx-auto mt-6 max-w-[700px] rounded-lg bg-white p-8 text-black print:mt-0 print:max-w-none print:min-h-screen print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-black pb-3 text-center">
          <p className="text-base font-bold uppercase">{INSTITUCION.nombre}</p>
        </header>

        <p className="mt-4 text-center text-sm font-bold uppercase tracking-wide">
          Política administrativa y académica completa — lea detenidamente
        </p>

        <div className="mt-4 space-y-2.5 text-[12px] leading-relaxed text-neutral-800">
          <p><b>Servicio.</b> Nuestro programa comprende clases en vivo, acompañamiento logístico-académico, evaluación continua y feedback periódico.</p>
          <p><b>Inversión.</b> Los pagos son mensuales y por adelantado, los primeros días de cada mes.</p>
          <p><b>Tarifas.</b> El monto de su tarifa dependerá del programa o curso en el que esté participando.</p>
          <p><b>Pagos obligatorios.</b> Los meses se cancelan corridos, incluyendo diciembre y enero.</p>
          <p><b>Recesos colectivos.</b> Desde la tercera semana de diciembre hasta la segunda semana de enero.</p>
          <p><b>Inasistencias y tutorías.</b> Acumular inasistencias genera la obligación de tutorías, las cuales tienen un costo adicional. La inasistencia a la tutoría no genera reembolso.</p>
          <p><b>Suspensión disciplinaria.</b> La institución podrá suspender el servicio si el participante: a) incurre en faltas graves contra el personal o compañeros (aplica también a su representante); b) incumple reiteradamente con las normativas internas.</p>
          <p><b>Pertenencias.</b> La Academia no asume responsabilidad ni reposiciones por extravío, daño o pérdida de celulares, bolsos o prendas dentro de las instalaciones.</p>
          <p><b>Reembolsos.</b> Como regla general, no se efectuarán reembolsos por niveles no aprobados, clases no asistidas o retiros voluntarios.</p>
          <p><b>Fuerza mayor y reposos.</b> Las enfermedades (con justificativo médico) o el fallecimiento de un familiar directo serán evaluadas de manera individual, sujetas a disponibilidad.</p>
          <p><b>Actualizaciones.</b> La Academia se reserva el derecho de actualizar sus políticas, informando por canales oficiales (cartelera, mensajería de WhatsApp, correo electrónico, otros).</p>
          <p><b>Aceptación de las normas.</b> Confirmo que he leído y acepto la normativa de la institución. Entiendo el Manual de Convivencia de la Academia y me comprometo a respetar tanto mis estudios como el comportamiento y los pagos. Sé que puedo pedir el Manual completo en la recepción siempre que lo necesite.</p>
        </div>

        <div className={`mt-16 grid ${datos.esMenor ? 'grid-cols-2' : 'grid-cols-1 justify-items-center'} gap-10 pt-8 text-center text-sm`}>
          {datos.esMenor && (
            <div>
              <div className="mb-1 border-t border-black pt-2 w-56 mx-auto">Firma del Representante</div>
            </div>
          )}
          <div>
            <div className="mb-1 border-t border-black pt-2 w-56 mx-auto">Firma del Participante</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <span className="block text-[10px] font-bold uppercase text-neutral-500">{etiqueta}</span>
      <span>{valor}</span>
    </div>
  )
}

function CampoAncho({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="col-span-2">
      <span className="block text-[10px] font-bold uppercase text-neutral-500">{etiqueta}</span>
      <span>{valor}</span>
    </div>
  )
}
