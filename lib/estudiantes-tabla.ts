import { cargarDatosPlanilla } from '@/lib/planilla-datos'
import type { DatosPlanilla } from '@/components/planilla/PlanillaDocumento'
import {
  CAMPOS_TODOS,
  camposSeleccionados,
  ENCABEZADO_TABLA,
  type CamposPlanilla,
  type ClaveCampo,
} from '@/lib/planilla-campos'

/**
 * Descarga de estudiantes en TABLA (Excel), como alternativa a la planilla
 * en PDF (pedido de Dirección Académica + Pedro, nov. 2026): cuando lo que
 * se necesita es un listado —p. ej. nombre y correo— no tiene sentido un PDF
 * con políticas y firma. Aquí sale un .xlsx con una fila por estudiante y una
 * columna por cada campo marcado en el mismo checklist.
 *
 * Se arma el .xlsx a mano con jszip (un xlsx es un .zip de XML) en vez de
 * sumar una dependencia de hojas de cálculo: las celdas son solo texto
 * (`inlineStr`), así que no hace falta nada más. Se prefirió xlsx real sobre
 * CSV para no depender del separador (coma/punto y coma) que cada Excel
 * espera según el idioma — con el .xlsx las columnas salen limpias siempre.
 */

function fechaCorta(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function valorCampo(datos: DatosPlanilla, clave: ClaveCampo): string {
  switch (clave) {
    case 'codigo': return datos.studentCode ?? ''
    case 'nombre': return datos.nombre
    case 'cedula': return datos.cedula
    case 'correo': return datos.correo ?? ''
    case 'modulo': return datos.moduloActual ?? ''
    case 'diasHorario': return datos.diasYHorario ?? ''
    case 'fechaInscripcion': return fechaCorta(datos.fechaInscripcion)
    case 'telefono': return datos.telefono ?? ''
    case 'direccion': return datos.direccion ?? ''
    case 'repNombre': return datos.representante?.nombre ?? ''
    case 'repCedula': return datos.representante?.cedula ?? ''
    case 'repParentesco': return datos.representante?.parentesco ?? ''
    case 'repEdad': return datos.representante?.edad != null ? String(datos.representante.edad) : ''
    case 'repNacionalidad': return datos.representante?.nacionalidad ?? ''
    case 'repProfesion': return datos.representante?.profesion ?? ''
    case 'repTelefono': return datos.representante?.telefono ?? ''
    case 'repCorreo': return datos.representante?.correo ?? ''
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 0 → A, 1 → B, … 26 → AA. */
function colRef(n: number): string {
  let s = ''
  let x = n + 1
  while (x > 0) {
    const m = (x - 1) % 26
    s = String.fromCharCode(65 + m) + s
    x = Math.floor((x - 1) / 26)
  }
  return s
}

async function generarXlsx(encabezados: string[], filas: string[][]): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  const todas = [encabezados, ...filas]
  const filasXml = todas
    .map((fila, r) => {
      const celdas = fila
        .map(
          (val, c) =>
            `<c r="${colRef(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(String(val ?? ''))}</t></is></c>`,
        )
        .join('')
      return `<row r="${r + 1}">${celdas}</row>`
    })
    .join('')

  const cols = `<cols>${encabezados
    .map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="26" customWidth="1"/>`)
    .join('')}</cols>`

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${filasXml}</sheetData></worksheet>`

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  )
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  )
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Estudiantes" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  )
  zip.file('xl/worksheets/sheet1.xml', sheet)

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
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

export async function descargarTablaDelPrograma(
  estudiantes: { id: string; nombre: string }[],
  nombrePrograma: string,
  campos: CamposPlanilla = CAMPOS_TODOS,
  onProgreso?: (hecho: number, total: number) => void,
): Promise<{ generadas: number; fallidas: string[] }> {
  const claves = camposSeleccionados(campos)
  if (claves.length === 0) return { generadas: 0, fallidas: [] }

  const encabezados = claves.map((c) => ENCABEZADO_TABLA[c])
  const filas: string[][] = []
  const fallidas: string[] = []

  for (let i = 0; i < estudiantes.length; i++) {
    onProgreso?.(i, estudiantes.length)
    try {
      const datos = await cargarDatosPlanilla(estudiantes[i].id)
      if (!datos) {
        fallidas.push(estudiantes[i].nombre)
        continue
      }
      filas.push(claves.map((c) => valorCampo(datos, c)))
    } catch (err) {
      console.error(`No se pudo leer los datos de ${estudiantes[i].nombre}:`, err)
      fallidas.push(estudiantes[i].nombre)
    }
  }
  onProgreso?.(estudiantes.length, estudiantes.length)

  if (filas.length > 0) {
    const blob = await generarXlsx(encabezados, filas)
    descargarBlob(blob, `Estudiantes ${nombreArchivoSeguro(nombrePrograma)}.xlsx`)
  }

  return { generadas: filas.length, fallidas }
}
