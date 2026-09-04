// Planilla firmable (Sprint 7, docs/17_PLAN_CONSOLIDADO...): réplica fiel de
// planilla_modulo1_ejemplo.pdf (2 páginas) que ya usa la academia en papel —
// mismo encabezado, mismos campos, mismo texto legal. Se separó de
// app/(admin)/estudiantes/[id]/planilla/page.tsx para poder reusar
// exactamente el mismo diseño al descargar una por una (esa pantalla,
// imprimir del navegador) y al descargar todas las de un programa de una vez
// (estudiantes/page.tsx, con html2canvas + jsPDF — ver lib/planilla-pdf.ts).

const INSTITUCION = {
  nombre: 'ACADEMIA DE FORMACIÓN ZR MECADEMY',
  rif: 'J-506479885',
  direccion: 'C.C. La Morita, Nivel Sótano, San Antonio de los Altos, Estado Miranda',
  telAdmin: '0412-8217792',
  telAcademico: '0414-2345140',
  correo: 'academiazrmacademy@gmail.com',
  horario: 'Sábados',
}

// Mismo azul de marca que usa el resto de la app (--zr-blue en globals.css) —
// la planilla tiene que verse de la misma identidad, no en blanco y negro.
const AZUL = '#3869B1'

export interface DatosPlanilla {
  nombre: string
  cedula: string
  telefono: string | null
  direccion: string | null
  fechaNacimiento: string
  fechaInscripcion: string
  esMenor: boolean
  studentCode: string | null
  moduloActual: string | null
  diasYHorario: string | null
  representante: {
    nombre: string; cedula: string; telefono: string | null; correo: string
    parentesco: string | null; edad: number | null
    nacionalidad: string | null; profesion: string | null
  } | null
}

function fecha(iso: string) {
  if (!iso) return '__ / __ / ____'
  const d = new Date(iso + 'T12:00:00')
  return `${String(d.getDate()).padStart(2, '0')} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${d.getFullYear()}`
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

/** Página 1: datos del participante (y del representante, si es menor). */
export function PlanillaPagina1({ datos }: { datos: DatosPlanilla }) {
  return (
    <div className="mx-auto mt-8 max-w-[700px] rounded-lg bg-white p-8 text-black print:mt-0 print:max-w-none print:rounded-none print:p-8 print:shadow-none print:break-after-page">
      <header className="flex items-center gap-3 border-b-4 pb-3 text-left" style={{ borderColor: AZUL }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-zr-mecademy.png" alt="ZR Mecademy" style={{ height: 40, width: 'auto' }} className="shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase leading-snug" style={{ color: AZUL }}>{INSTITUCION.nombre}</p>
          <p className="text-[11px] text-neutral-700">
            RIF: {INSTITUCION.rif} &nbsp;|&nbsp; {INSTITUCION.direccion}
          </p>
          <p className="text-[11px] text-neutral-700">
            Tel. Adm: {INSTITUCION.telAdmin} &nbsp;&nbsp; Tel. Acad: {INSTITUCION.telAcademico} &nbsp;&nbsp;
            {INSTITUCION.correo} &nbsp;&nbsp; Horario de atención: {INSTITUCION.horario}
          </p>
        </div>
      </header>

      <p className="mt-4 text-center text-sm font-bold uppercase tracking-wide" style={{ color: AZUL }}>
        Planilla de inscripción – Comprobante Módulo 1
      </p>
      <p className="mt-1 text-center text-[11px] leading-relaxed text-neutral-600">
        Documento generado automáticamente por el sistema a partir de los datos cargados al momento
        del pago. Los campos no incluidos aquí (perfil académico, condiciones, correo, etc.) se
        completan luego dentro de la aplicación.
      </p>

      <div className="mt-5 rounded p-4 text-center text-white" style={{ backgroundColor: AZUL }}>
        <p className="text-[11px] font-bold uppercase tracking-wide">
          Código de estudiante — consérvelo, lo necesitará para su primer ingreso a la app
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{datos.studentCode ?? 'PENDIENTE'}</p>
      </div>

      <p className="mt-6 border-b-2 pb-1 text-xs font-bold uppercase tracking-wide" style={{ borderColor: AZUL, color: AZUL }}>
        Datos del participante
      </p>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <CampoAncho etiqueta="Nombre y apellido" valor={datos.nombre} />
        <Campo etiqueta="C.I." valor={datos.cedula} />
        <Campo etiqueta="Módulo a cursar" valor={datos.moduloActual ?? '—'} />
        <Campo etiqueta="Días y horario" valor={datos.diasYHorario ?? '—'} />
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
          <p className="mt-6 border-b-2 pb-1 text-xs font-bold uppercase tracking-wide" style={{ borderColor: AZUL, color: AZUL }}>
            Datos del representante
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <CampoAncho etiqueta="Nombre y apellido del representante" valor={datos.representante.nombre || '—'} />
            <Campo etiqueta="C.I." valor={datos.representante.cedula || '—'} />
            <Campo etiqueta="Parentesco" valor={datos.representante.parentesco || '—'} />
            <Campo etiqueta="Edad" valor={datos.representante.edad ? String(datos.representante.edad) : '—'} />
            <Campo etiqueta="Nacionalidad" valor={datos.representante.nacionalidad || '—'} />
            <Campo etiqueta="Profesión u ocupación" valor={datos.representante.profesion || '—'} />
            <Campo etiqueta="Nro. celular" valor={datos.representante.telefono ?? '—'} />
            <Campo etiqueta="Correo" valor={datos.representante.correo || '—'} />
          </div>
        </>
      )}
    </div>
  )
}

/** Página 2: política administrativa y académica, con las firmas. */
export function PlanillaPagina2({ datos }: { datos: DatosPlanilla }) {
  return (
    <div className="mx-auto mt-6 max-w-[700px] rounded-lg bg-white p-8 text-black print:mt-0 print:max-w-none print:rounded-none print:p-8 print:shadow-none">
      <header className="flex items-center gap-3 border-b-4 pb-3" style={{ borderColor: AZUL }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-zr-mecademy.png" alt="ZR Mecademy" style={{ height: 32, width: 'auto' }} className="shrink-0" />
        <p className="flex-1 text-sm font-bold uppercase" style={{ color: AZUL }}>{INSTITUCION.nombre}</p>
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

      <div className={`mt-10 grid ${datos.esMenor ? 'grid-cols-2' : 'grid-cols-1 justify-items-center'} gap-10 pt-6 text-center text-sm print:break-inside-avoid`}>
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
  )
}

export function PlanillaDocumento({ datos }: { datos: DatosPlanilla }) {
  return (
    <>
      <PlanillaPagina1 datos={datos} />
      <PlanillaPagina2 datos={datos} />
    </>
  )
}
