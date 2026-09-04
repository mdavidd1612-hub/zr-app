import { jsPDF } from 'jspdf'
import type { DatosPlanilla } from '@/components/planilla/PlanillaDocumento'
import { cargarDatosPlanilla } from '@/lib/planilla-datos'

/**
 * Descarga todas las planillas de un programa de un solo golpe (pedido
 * explícito del coordinador — antes tocaba entrar estudiante por
 * estudiante y descargar/imprimir una por una).
 *
 * Primer intento: renderizar el mismo componente de la vista individual
 * (components/planilla/PlanillaDocumento.tsx) fuera de pantalla y
 * capturarlo con html2canvas. Se descartó — html2canvas no entiende los
 * colores oklch() que Tailwind 4 usa por defecto en su hoja de estilos
 * global, y se quedaba colgado para siempre intentando parsearla (nunca
 * tira error, simplemente nunca termina). En su lugar, el PDF se arma
 * directo con jsPDF (dibujando texto y líneas), igual que ya hace
 * lib/consent-pdf.ts en este mismo proyecto — sin depender de capturar
 * nada en pantalla. El texto legal es el mismo que ve el estudiante en la
 * vista individual; el diseño es más simple (una columna) porque no hace
 * falta que sea pixel-por-pixel igual, solo completo y presentable.
 */

const AZUL: [number, number, number] = [56, 105, 177] // #3869B1, mismo azul de marca
const GRIS_TEXTO: [number, number, number] = [60, 60, 60]
const GRIS_ETIQUETA: [number, number, number] = [120, 120, 120]

const INSTITUCION = {
  nombre: 'ACADEMIA DE FORMACIÓN ZR MECADEMY',
  rif: 'J-506479885',
  direccion: 'C.C. La Morita, Nivel Sótano, San Antonio de los Altos, Estado Miranda',
  telAdmin: '0412-8217792',
  telAcademico: '0414-2345140',
  correo: 'academiazrmacademy@gmail.com',
}

const POLITICA: { titulo: string; texto: string }[] = [
  { titulo: 'Servicio.', texto: 'Nuestro programa comprende clases en vivo, acompañamiento logístico-académico, evaluación continua y feedback periódico.' },
  { titulo: 'Inversión.', texto: 'Los pagos son mensuales y por adelantado, los primeros días de cada mes.' },
  { titulo: 'Tarifas.', texto: 'El monto de su tarifa dependerá del programa o curso en el que esté participando.' },
  { titulo: 'Pagos obligatorios.', texto: 'Los meses se cancelan corridos, incluyendo diciembre y enero.' },
  { titulo: 'Recesos colectivos.', texto: 'Desde la tercera semana de diciembre hasta la segunda semana de enero.' },
  { titulo: 'Inasistencias y tutorías.', texto: 'Acumular inasistencias genera la obligación de tutorías, las cuales tienen un costo adicional. La inasistencia a la tutoría no genera reembolso.' },
  { titulo: 'Suspensión disciplinaria.', texto: 'La institución podrá suspender el servicio si el participante: a) incurre en faltas graves contra el personal o compañeros (aplica también a su representante); b) incumple reiteradamente con las normativas internas.' },
  { titulo: 'Pertenencias.', texto: 'La Academia no asume responsabilidad ni reposiciones por extravío, daño o pérdida de celulares, bolsos o prendas dentro de las instalaciones.' },
  { titulo: 'Reembolsos.', texto: 'Como regla general, no se efectuarán reembolsos por niveles no aprobados, clases no asistidas o retiros voluntarios.' },
  { titulo: 'Fuerza mayor y reposos.', texto: 'Las enfermedades (con justificativo médico) o el fallecimiento de un familiar directo serán evaluadas de manera individual, sujetas a disponibilidad.' },
  { titulo: 'Actualizaciones.', texto: 'La Academia se reserva el derecho de actualizar sus políticas, informando por canales oficiales (cartelera, mensajería de WhatsApp, correo electrónico, otros).' },
  { titulo: 'Aceptación de las normas.', texto: 'Confirmo que he leído y acepto la normativa de la institución. Entiendo el Manual de Convivencia de la Academia y me comprometo a respetar tanto mis estudios como el comportamiento y los pagos. Sé que puedo pedir el Manual completo en la recepción siempre que lo necesite.' },
]

function fecha(iso: string) {
  if (!iso) return '__ / __ / ____'
  const d = new Date(iso + 'T12:00:00')
  return `${String(d.getDate()).padStart(2, '0')} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${d.getFullYear()}`
}

let logoCache: string | null = null

/** Se pide una sola vez y se reusa para todas las planillas del lote. */
export async function obtenerLogoDataUrl(): Promise<string | null> {
  if (logoCache) return logoCache
  try {
    const res = await fetch('/logo-zr-mecademy.png')
    const blob = await res.blob()
    logoCache = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return logoCache
  } catch {
    return null
  }
}

export function generarPdfEstudiante(datos: DatosPlanilla, logoDataUrl: string | null): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const margen = 18
  const anchoPagina = doc.internal.pageSize.getWidth()
  const altoPagina = doc.internal.pageSize.getHeight()
  const anchoUtil = anchoPagina - margen * 2
  let y = margen

  function encabezado(conTitulo: boolean) {
    if (logoDataUrl) {
      try { doc.addImage(logoDataUrl, 'PNG', margen, y - 2, 14, 14) } catch { /* logo opcional */ }
    }
    const xTexto = margen + (logoDataUrl ? 18 : 0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...AZUL)
    doc.text(INSTITUCION.nombre, xTexto, y + 3)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRIS_TEXTO)
    doc.text(`RIF: ${INSTITUCION.rif}  ·  ${INSTITUCION.direccion}`, xTexto, y + 7.5)
    doc.text(
      `Tel. Adm: ${INSTITUCION.telAdmin}   Tel. Acad: ${INSTITUCION.telAcademico}   ${INSTITUCION.correo}`,
      xTexto, y + 11.5,
    )
    y += 16
    doc.setDrawColor(...AZUL)
    doc.setLineWidth(0.8)
    doc.line(margen, y, margen + anchoUtil, y)
    y += 7

    if (conTitulo) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...AZUL)
      doc.text('PLANILLA DE INSCRIPCIÓN – COMPROBANTE MÓDULO 1', anchoPagina / 2, y, { align: 'center' })
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...GRIS_TEXTO)
      const lineas = doc.splitTextToSize(
        'Documento generado automáticamente por el sistema a partir de los datos cargados al momento del pago. Los campos no incluidos aquí (perfil académico, condiciones, correo, etc.) se completan luego dentro de la aplicación.',
        anchoUtil - 20,
      )
      doc.text(lineas, anchoPagina / 2, y, { align: 'center' })
      y += lineas.length * 3.6 + 5
    }
  }

  function tituloSeccion(texto: string) {
    y += 2
    doc.setDrawColor(...AZUL)
    doc.setLineWidth(0.4)
    doc.line(margen, y, margen + anchoUtil, y)
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...AZUL)
    doc.text(texto.toUpperCase(), margen, y)
    y += 6
  }

  function campo(etiqueta: string, valor: string) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...GRIS_ETIQUETA)
    doc.text(etiqueta.toUpperCase(), margen, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...GRIS_TEXTO)
    doc.text(valor || '—', margen, y)
    y += 6.5
  }

  // ============================= PÁGINA 1 =============================
  encabezado(true)

  doc.setFillColor(...AZUL)
  doc.roundedRect(margen, y, anchoUtil, 16, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  doc.text(
    'CÓDIGO DE ESTUDIANTE — CONSÉRVELO, LO NECESITARÁ PARA SU PRIMER INGRESO A LA APP',
    anchoPagina / 2, y + 6, { align: 'center' },
  )
  doc.setFontSize(13)
  doc.text(datos.studentCode ?? 'PENDIENTE', anchoPagina / 2, y + 12.5, { align: 'center' })
  y += 24

  tituloSeccion('Datos del participante')
  campo('Nombre y apellido', datos.nombre)
  campo('C.I.', datos.cedula)
  campo('Módulo a cursar', datos.moduloActual ?? '—')
  campo('Días y horario', datos.diasYHorario ?? '—')
  campo('Fecha de inscripción', fecha(datos.fechaInscripcion))
  campo('Nro. celular del participante', datos.telefono ?? '—')
  campo('Dirección', datos.direccion ?? '—')

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(...GRIS_ETIQUETA)
  doc.text(
    'Los "Días y Horario" se muestran automáticamente según el módulo seleccionado; no se solicitan como dato aparte al vendedor.',
    margen, y,
  )
  y += 6

  if (datos.esMenor && datos.representante) {
    tituloSeccion('Datos del representante')
    campo('Nombre y apellido del representante', datos.representante.nombre || '—')
    campo('C.I.', datos.representante.cedula || '—')
    campo('Parentesco', datos.representante.parentesco || '—')
    campo('Edad', datos.representante.edad ? String(datos.representante.edad) : '—')
    campo('Nacionalidad', datos.representante.nacionalidad || '—')
    campo('Profesión u ocupación', datos.representante.profesion || '—')
    campo('Nro. celular', datos.representante.telefono ?? '—')
    campo('Correo', datos.representante.correo || '—')
  }

  // ============================= PÁGINA 2 =============================
  doc.addPage()
  y = margen
  encabezado(false)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text('POLÍTICA ADMINISTRATIVA Y ACADÉMICA COMPLETA — LEA DETENIDAMENTE', anchoPagina / 2, y, { align: 'center' })
  y += 8

  doc.setFontSize(8.3)
  for (const p of POLITICA) {
    const parrafo = doc.splitTextToSize(`${p.titulo} ${p.texto}`, anchoUtil)
    if (y + parrafo.length * 3.7 > altoPagina - 45) {
      doc.addPage()
      y = margen
    }
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text(p.titulo, margen, y)
    const anchoTitulo = doc.getTextWidth(p.titulo + ' ')
    doc.setFont('helvetica', 'normal')
    const restoLineas = doc.splitTextToSize(p.texto, anchoUtil - anchoTitulo)
    doc.text(restoLineas[0] ?? '', margen + anchoTitulo, y)
    y += 3.9
    for (let i = 1; i < restoLineas.length; i++) {
      doc.text(restoLineas[i], margen, y)
      y += 3.9
    }
    y += 2.3
  }

  y += 12
  doc.setFontSize(9)
  doc.setDrawColor(0, 0, 0)
  if (datos.esMenor) {
    const mitad = anchoPagina / 2
    doc.line(margen + 8, y, mitad - 6, y)
    doc.text('Firma del Representante', (margen + 8 + mitad - 6) / 2, y + 5, { align: 'center' })
    doc.line(mitad + 6, y, anchoPagina - margen - 8, y)
    doc.text('Firma del Participante', (mitad + 6 + anchoPagina - margen - 8) / 2, y + 5, { align: 'center' })
  } else {
    doc.line(anchoPagina / 2 - 35, y, anchoPagina / 2 + 35, y)
    doc.text('Firma del Participante', anchoPagina / 2, y + 5, { align: 'center' })
  }

  return doc.output('arraybuffer')
}

function descargarBlob(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

function nombreArchivoSeguro(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
}

export async function descargarPlanillasDelPrograma(
  estudiantes: { id: string; nombre: string; cedula: string }[],
  nombrePrograma: string,
  onProgreso?: (hecho: number, total: number) => void,
): Promise<{ generadas: number; fallidas: string[] }> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const fallidas: string[] = []
  let generadas = 0

  const logo = await obtenerLogoDataUrl()

  for (let i = 0; i < estudiantes.length; i++) {
    const e = estudiantes[i]
    onProgreso?.(i, estudiantes.length)
    try {
      const datos = await cargarDatosPlanilla(e.id)
      if (!datos) {
        fallidas.push(e.nombre)
        continue
      }
      const buffer = generarPdfEstudiante(datos, logo)
      zip.file(`${nombreArchivoSeguro(e.nombre)} - ${e.cedula}.pdf`, buffer)
      generadas++
    } catch (err) {
      console.error(`No se pudo generar la planilla de ${e.nombre}:`, err)
      fallidas.push(e.nombre)
    }
  }
  onProgreso?.(estudiantes.length, estudiantes.length)

  // Si ninguna planilla se pudo generar, no tiene sentido bajar un .zip
  // vacío (que además algunos programas de descompresión reportan como
  // archivo dañado, en vez de simplemente "vacío").
  if (generadas > 0) {
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    descargarBlob(zipBlob, `Planillas ${nombreArchivoSeguro(nombrePrograma)}.zip`)
  }

  return { generadas, fallidas }
}
