// Catálogo de los campos que se pueden incluir u omitir en la planilla al
// descargarla (pedido de Dirección Académica, nov. 2026): al bajar una
// planilla —una sola o todas las de un programa— aparece un checklist para
// elegir qué datos salen impresos. Por defecto van TODOS marcados; quien
// descarga puede quitar los que no quiera que aparezcan.
//
// La página 2 (política administrativa + firmas) NO entra en el checklist:
// es el texto legal que hace de la planilla un documento firmable, no un
// "dato" del estudiante. El checklist solo controla los datos de la página 1.
//
// Este catálogo es la única fuente de verdad de las claves y etiquetas — lo
// usan el componente React (vista individual, se imprime del navegador), el
// generador jsPDF (descarga masiva en .zip) y el selector de la UI.

export type ClaveCampo =
  | 'codigo'
  | 'nombre'
  | 'cedula'
  | 'correo'
  | 'modulo'
  | 'diasHorario'
  | 'fechaInscripcion'
  | 'telefono'
  | 'direccion'
  | 'repNombre'
  | 'repCedula'
  | 'repParentesco'
  | 'repEdad'
  | 'repNacionalidad'
  | 'repProfesion'
  | 'repTelefono'
  | 'repCorreo'

export type CamposPlanilla = Record<ClaveCampo, boolean>

export const GRUPOS_CAMPOS: { grupo: string; campos: { clave: ClaveCampo; etiqueta: string }[] }[] = [
  {
    grupo: 'Datos del participante',
    campos: [
      { clave: 'codigo', etiqueta: 'Código de estudiante' },
      { clave: 'nombre', etiqueta: 'Nombre y apellido' },
      { clave: 'cedula', etiqueta: 'C.I.' },
      { clave: 'correo', etiqueta: 'Correo' },
      { clave: 'modulo', etiqueta: 'Módulo a cursar' },
      { clave: 'diasHorario', etiqueta: 'Días y horario' },
      { clave: 'fechaInscripcion', etiqueta: 'Fecha de inscripción' },
      { clave: 'telefono', etiqueta: 'Nro. celular' },
      { clave: 'direccion', etiqueta: 'Dirección' },
    ],
  },
  {
    // Esta sección solo aparece en la planilla de un estudiante menor de edad;
    // igual se listan sus campos en el checklist (no estorban al mayor de
    // edad, cuya planilla simplemente no tiene esta sección).
    grupo: 'Datos del representante (solo menores)',
    campos: [
      { clave: 'repNombre', etiqueta: 'Nombre y apellido' },
      { clave: 'repCedula', etiqueta: 'C.I.' },
      { clave: 'repParentesco', etiqueta: 'Parentesco' },
      { clave: 'repEdad', etiqueta: 'Edad' },
      { clave: 'repNacionalidad', etiqueta: 'Nacionalidad' },
      { clave: 'repProfesion', etiqueta: 'Profesión u ocupación' },
      { clave: 'repTelefono', etiqueta: 'Nro. celular' },
      { clave: 'repCorreo', etiqueta: 'Correo' },
    ],
  },
]

const TODAS_LAS_CLAVES: ClaveCampo[] = GRUPOS_CAMPOS.flatMap((g) => g.campos.map((c) => c.clave))

/** Todos los campos marcados — el estado por defecto del checklist. */
export const CAMPOS_TODOS: CamposPlanilla = Object.fromEntries(
  TODAS_LAS_CLAVES.map((c) => [c, true]),
) as CamposPlanilla

/** ¿Queda al menos un campo visible de ese grupo? (para ocultar el título de sección). */
export function algunCampoDe(grupo: 'participante' | 'representante', campos: CamposPlanilla): boolean {
  const claves = grupo === 'participante'
    ? GRUPOS_CAMPOS[0].campos
    : GRUPOS_CAMPOS[1].campos
  return claves.some((c) => campos[c.clave])
}

/**
 * ¿Están TODOS los campos marcados? Solo entonces el PDF es la planilla de
 * inscripción formal (con la página 2 de políticas y firmas). Si se quitó
 * aunque sea un campo, deja de ser una planilla firmable y pasa a ser un
 * simple resumen de datos de la página 1 — Dirección Académica no necesita
 * las políticas ni la firma cuando solo extrae, p. ej., nombre y correo.
 */
export function esPlanillaCompleta(campos: CamposPlanilla): boolean {
  return TODAS_LAS_CLAVES.every((c) => campos[c])
}

/** Claves marcadas, en el orden del catálogo (columnas de la tabla Excel). */
export function camposSeleccionados(campos: CamposPlanilla): ClaveCampo[] {
  return TODAS_LAS_CLAVES.filter((c) => campos[c])
}

/**
 * Encabezados para la descarga en tabla (Excel). A diferencia de las
 * etiquetas del checklist —que se agrupan visualmente bajo "participante" /
 * "representante"— aquí cada columna tiene que explicarse sola, por eso los
 * campos del representante llevan el prefijo.
 */
export const ENCABEZADO_TABLA: Record<ClaveCampo, string> = {
  codigo: 'Código de estudiante',
  nombre: 'Nombre y apellido',
  cedula: 'C.I.',
  correo: 'Correo',
  modulo: 'Módulo',
  diasHorario: 'Días y horario',
  fechaInscripcion: 'Fecha de inscripción',
  telefono: 'Celular',
  direccion: 'Dirección',
  repNombre: 'Representante: nombre',
  repCedula: 'Representante: C.I.',
  repParentesco: 'Representante: parentesco',
  repEdad: 'Representante: edad',
  repNacionalidad: 'Representante: nacionalidad',
  repProfesion: 'Representante: profesión',
  repTelefono: 'Representante: celular',
  repCorreo: 'Representante: correo',
}
