/**
 * Importación masiva de preguntas de examen (pedido explícito del
 * coordinador, 8-nov-2026): el profesor normalmente escribe sus preguntas en
 * Word (desarrollo, para que el estudiante conteste) y a veces en Excel/CSV
 * (opción múltiple, con columnas). No se intenta adivinar en silencio: cada
 * pregunta leída se muestra para revisión antes de agregarla de verdad al
 * examen (components/ImportarPreguntas.tsx) -- el lector puede equivocarse,
 * sobre todo detectando cuál opción es la correcta.
 */

export type TipoPregunta = 'opcion_multiple' | 'verdadero_falso' | 'redaccion_abierta'

export interface PreguntaImportada {
  type: TipoPregunta
  statement: string
  points: number
  options?: Array<{ key: string; text: string }>
  correct_answer?: { key: string } | { value: boolean } | null
  rubric?: string | null
  /** Si el lector no está seguro de algo (p. ej. no detectó la correcta). */
  advertencia?: string | null
}

const LETRAS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

// ---------------------------------------------------------------------------
// Excel / CSV: columnas fijas -- alta confianza, no hay que adivinar nada.
// tipo | enunciado | opcion_a..opcion_f | correcta | puntos
// ---------------------------------------------------------------------------

function normalizarEncabezado(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/\s+/g, '_')
}

function filaAPregunta(fila: Record<string, string>): PreguntaImportada | null {
  const enunciado = (fila['enunciado'] ?? fila['pregunta'] ?? '').trim()
  if (!enunciado) return null

  const opciones: Array<{ key: string; text: string }> = []
  for (const letra of LETRAS) {
    const texto = (fila[`opcion_${letra}`] ?? '').trim()
    if (texto) opciones.push({ key: letra, text: texto })
  }

  const correctaRaw = (fila['correcta'] ?? fila['respuesta_correcta'] ?? fila['respuesta'] ?? '').trim().toLowerCase()
  const puntos = Number(fila['puntos'] ?? fila['pts'] ?? 1) || 1

  let tipo = (fila['tipo'] ?? '').trim().toLowerCase().replace(/\s+/g, '_') as TipoPregunta | ''
  if (!tipo) {
    if (opciones.length >= 2) tipo = 'opcion_multiple'
    else if (['verdadero', 'falso', 'v', 'f'].includes(correctaRaw)) tipo = 'verdadero_falso'
    else tipo = 'redaccion_abierta'
  }

  if (tipo === 'verdadero_falso') {
    const esVerdadero = ['verdadero', 'v', 'true'].includes(correctaRaw)
    const esFalso = ['falso', 'f', 'false'].includes(correctaRaw)
    return {
      type: 'verdadero_falso',
      statement: enunciado,
      points: puntos,
      correct_answer: esVerdadero ? { value: true } : esFalso ? { value: false } : null,
      advertencia: !esVerdadero && !esFalso ? 'No se detectó si la correcta es Verdadero o Falso.' : null,
    }
  }

  if (tipo === 'opcion_multiple' && opciones.length >= 2) {
    const clave = correctaRaw.replace(/[^a-f]/g, '')
    const coincide = opciones.some((o) => o.key === clave)
    return {
      type: 'opcion_multiple',
      statement: enunciado,
      points: puntos,
      options: opciones,
      correct_answer: coincide ? { key: clave } : null,
      advertencia: !coincide ? 'No se detectó cuál opción es la correcta.' : null,
    }
  }

  return { type: 'redaccion_abierta', statement: enunciado, points: puntos, rubric: null }
}

/** Parser mínimo de CSV: soporta comillas con comas/saltos de línea adentro. */
function parsearCSV(texto: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let enComillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') enComillas = false
      else campo += c
    } else if (c === '"') enComillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo); campo = ''
      if (fila.some((v) => v !== '')) filas.push(fila)
      fila = []
    } else campo += c
  }
  if (campo !== '' || fila.length > 0) { fila.push(campo); filas.push(fila) }
  return filas
}

function filasAObjetos(filas: string[][]): Record<string, string>[] {
  if (filas.length === 0) return []
  const encabezados = filas[0].map(normalizarEncabezado)
  return filas.slice(1).map((fila) => {
    const obj: Record<string, string> = {}
    encabezados.forEach((enc, i) => { obj[enc] = (fila[i] ?? '').trim() })
    return obj
  })
}

export async function leerPreguntasDeCSV(archivo: File): Promise<PreguntaImportada[]> {
  const texto = await archivo.text()
  const filas = filasAObjetos(parsearCSV(texto))
  return filas.map(filaAPregunta).filter((p): p is PreguntaImportada => p !== null)
}

export async function leerPreguntasDeExcel(archivo: File): Promise<PreguntaImportada[]> {
  const XLSX = await import('xlsx')
  const datos = await archivo.arrayBuffer()
  const libro = XLSX.read(datos, { type: 'array' })
  const hoja = libro.Sheets[libro.SheetNames[0]]
  const filas = XLSX.utils.sheet_to_json<Record<string, string>>(hoja, { defval: '' })
  const normalizadas = filas.map((fila) => {
    const obj: Record<string, string> = {}
    for (const [k, v] of Object.entries(fila)) obj[normalizarEncabezado(k)] = String(v ?? '').trim()
    return obj
  })
  return normalizadas.map(filaAPregunta).filter((p): p is PreguntaImportada => p !== null)
}

// ---------------------------------------------------------------------------
// Word: texto libre -- baja confianza, heurística. El profesor normalmente
// escribe "1. enunciado", a veces con opciones "a) ..." debajo y la correcta
// marcada con *, (correcta) o una línea "Respuesta: b". Sin opciones, se
// trata como pregunta de desarrollo (redacción abierta) -- es el caso más
// común descrito por el coordinador.
// ---------------------------------------------------------------------------

const RE_PREGUNTA = /^\s*(?:pregunta\s*)?(\d{1,3})[.)]\s*(.*)$/i
const RE_OPCION = /^\s*([a-fA-F])[.)]\s*(.*)$/
const RE_RESPUESTA_LINEA = /^\s*(?:respuesta|correcta|rpta)\s*:?\s*([a-fA-F]|verdadero|falso)\s*$/i
const RE_PUNTOS = /\(?\s*(\d+(?:[.,]\d+)?)\s*(?:pts?|puntos?)\s*\)?\s*$/i
const RE_MARCA_CORRECTA = /\s*(\*|✓|\(correcta?\)|\(correcto\)|\(x\))\s*$/i

interface BloquePregunta {
  statement: string
  opciones: { key: string; text: string; correcta: boolean }[]
  respuestaLinea: string | null
  puntos: number
}

export function parsearTextoLibre(texto: string): PreguntaImportada[] {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '')
  const bloques: BloquePregunta[] = []
  let actual: BloquePregunta | null = null

  for (const linea of lineas) {
    const mPregunta = linea.match(RE_PREGUNTA)
    const mOpcion = linea.match(RE_OPCION)
    const mRespuesta = linea.match(RE_RESPUESTA_LINEA)

    if (mPregunta) {
      if (actual) bloques.push(actual)
      let enunciado = mPregunta[2]
      let puntos = 1
      const mPts = enunciado.match(RE_PUNTOS)
      if (mPts) { puntos = Number(mPts[1].replace(',', '.')) || 1; enunciado = enunciado.slice(0, mPts.index).trim() }
      actual = { statement: enunciado, opciones: [], respuestaLinea: null, puntos }
    } else if (mOpcion && actual) {
      let texto2 = mOpcion[2]
      let correcta = false
      if (RE_MARCA_CORRECTA.test(texto2)) { correcta = true; texto2 = texto2.replace(RE_MARCA_CORRECTA, '').trim() }
      actual.opciones.push({ key: mOpcion[1].toLowerCase(), text: texto2, correcta })
    } else if (mRespuesta && actual) {
      actual.respuestaLinea = mRespuesta[1].toLowerCase()
    } else if (actual) {
      // Continuación del enunciado en varias líneas (antes de que empiecen las opciones).
      if (actual.opciones.length === 0) actual.statement += (actual.statement ? ' ' : '') + linea
    }
  }
  if (actual) bloques.push(actual)

  return bloques
    .filter((b) => b.statement.trim() !== '')
    .map((b): PreguntaImportada => {
      if (b.opciones.length === 0) {
        return { type: 'redaccion_abierta', statement: b.statement, points: b.puntos, rubric: null }
      }

      const esVF = b.opciones.length === 2 &&
        b.opciones.every((o) => ['verdadero', 'falso', 'v', 'f'].includes(o.text.trim().toLowerCase()))

      const marcadas = b.opciones.filter((o) => o.correcta)
      const claveRespuesta = b.respuestaLinea && LETRAS.includes(b.respuestaLinea as typeof LETRAS[number])
        ? b.respuestaLinea
        : null

      if (esVF) {
        const esVerdaderaMarcada = marcadas[0]?.text.trim().toLowerCase().startsWith('v')
        const porLinea = b.respuestaLinea === 'verdadero' ? true : b.respuestaLinea === 'falso' ? false : null
        const valor = marcadas.length === 1 ? esVerdaderaMarcada : porLinea
        return {
          type: 'verdadero_falso',
          statement: b.statement,
          points: b.puntos,
          correct_answer: valor === null ? null : { value: valor },
          advertencia: valor === null ? 'No se detectó si la correcta es Verdadero o Falso.' : null,
        }
      }

      const options = b.opciones.map((o) => ({ key: o.key, text: o.text }))
      const clave = marcadas.length === 1 ? marcadas[0].key : claveRespuesta
      return {
        type: 'opcion_multiple',
        statement: b.statement,
        points: b.puntos,
        options,
        correct_answer: clave ? { key: clave } : null,
        advertencia: marcadas.length > 1
          ? 'Hay más de una opción marcada como correcta -- revísala.'
          : !clave
          ? 'No se detectó cuál opción es la correcta.'
          : null,
      }
    })
}

export async function leerPreguntasDeWord(archivo: File): Promise<PreguntaImportada[]> {
  const mammoth = await import('mammoth')
  const datos = await archivo.arrayBuffer()
  const { value: texto } = await mammoth.extractRawText({ arrayBuffer: datos })
  return parsearTextoLibre(texto)
}

export async function leerPreguntasDeArchivo(archivo: File): Promise<PreguntaImportada[]> {
  const ext = archivo.name.slice(archivo.name.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'csv') return leerPreguntasDeCSV(archivo)
  if (ext === 'xlsx' || ext === 'xls') return leerPreguntasDeExcel(archivo)
  if (ext === 'docx') return leerPreguntasDeWord(archivo)
  throw new Error('Formato no reconocido. Usa .docx, .xlsx o .csv.')
}
