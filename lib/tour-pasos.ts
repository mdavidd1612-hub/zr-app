import type { UserRole } from '@/lib/types'

/**
 * Pasos del tutorial guiado, por rol. Tutorial guiado para TODOS los roles
 * menos super_admin (pedido explícito del coordinador, oct. 2026) -- ver
 * migración 173 y components/ui/Tour.tsx.
 *
 * REGLA (pedido explícito del coordinador): cada vez que se agregue una
 * función, sección o pantalla nueva que un rol pueda no descubrir solo,
 * agrega un paso aquí, al arreglo de ese rol. No hace falta tocar nada más
 * -- Tour.tsx y useTour.ts ya saben que:
 *   - a quien nunca vio el tour, se lo muestra completo (bienvenida genérica).
 *   - a quien ya lo había visto, solo le aparecen los pasos NUEVOS que
 *     todavía no tiene en `profiles.tour_pasos_vistos`, con el título
 *     "Aprende a usar las nuevas funciones de ZR App" en vez de la
 *     bienvenida -- nunca le repite lo que ya vio.
 *
 * Cómo agregar un paso:
 *   1. Si la función vive en una pantalla nueva, dale a su contenedor
 *      principal un `id="tour-algo"` (único en esa pantalla).
 *   2. Agrega un objeto a PASOS_POR_ROL[rol] con:
 *      - `id`: único y ESTABLE para siempre (es lo que se guarda en la base
 *        para no repetir el paso) -- nunca lo cambies ni lo reuses para otra
 *        cosa; si hay que corregir el texto, edita `texto`/`titulo`, no `id`.
 *      - `ruta`: la URL donde vive lo que se muestra.
 *      - `targetId`: el id del paso 1, o `null` si no hay un elemento
 *        puntual que resaltar (el paso se muestra centrado).
 *      - `titulo`/`texto`: cortos, en español de Venezuela, sin tecnicismos.
 *   3. Pruébalo en un teléfono angosto (320–375 px) -- Tour.tsx ya ajusta la
 *      tarjeta sola, pero un texto muy largo igual se ve mejor corto.
 *
 * El orden del arreglo es el orden en que se muestran los pasos.
 */

/** Anuncio "Actualizaciones de la app": primera tarjeta cuando quien ya vio el tutorial tiene novedades. */
export interface PortadaTour {
  titulo: string
  texto: string
  puntos: string[]
}

export interface PasoTour {
  id: string
  ruta: string
  titulo: string
  texto: string
  targetId: string | null
  /** La ruta es solo el inicio (p. ej. '/unidades/' sirve para /unidades/<id>). */
  prefijo?: boolean
  /** Al tocar "Siguiente" el tour toca este elemento por la persona (id/data-tour-target, o 'css:<selector>'). */
  clic?: string
  /** Etiqueta de la sección en la tarjeta (p. ej. "Unidades"). */
  seccion?: string
  /** Solo en un paso por rol: convierte la bienvenida en el anuncio "Actualizaciones de la app". */
  portada?: PortadaTour
}

// Roles que tienen tutorial. super_admin nunca lo tiene (pedido explícito
// del coordinador) -- administración y Dirección Académica comparten el
// mismo panel (`/panel`), así que comparten también el mismo tour.
export type RolConTour = 'estudiante' | 'profesor' | 'admin' | 'vendedor' | 'zr_coffee'

export function rolDeTour(rol: UserRole | null | undefined): RolConTour | null {
  if (rol === 'estudiante') return 'estudiante'
  if (rol === 'profesor') return 'profesor'
  if (rol === 'admin' || rol === 'direccion_academica') return 'admin'
  if (rol === 'vendedor') return 'vendedor'
  if (rol === 'zr_coffee') return 'zr_coffee'
  return null // super_admin (y cualquier rol futuro sin tour todavía)
}


// ───────────────────────── NOVEDADES: UNIDADES (estudiante) ─────────────────────────
// "Actualizaciones de la app" (nov 2026): Material pasa a vivir dentro de Unidades.
// Recorre TODO lo de esa sección. Ids nuevos a propósito: quien ya vio el tutorial
// viejo (estudiante-aula, estudiante-material) no los tiene marcados y los ve completos.
const U = '/unidades'
const NOVEDADES_ESTUDIANTE: PasoTour[] = [
  { id: 'nov-est-unidades', ruta: U, targetId: null, seccion: 'Unidades',
    portada: {
      titulo: 'Esto es nuevo en ZR App',
      texto: 'Agregamos una sección nueva, Unidades, donde está todo lo de tu módulo. Lo que antes veías en “Material” ahora vive aquí, junto con tus exámenes y tareas.',
      puntos: [
        'Unidades reemplaza a Material: todo ordenado por unidad',
        'Exámenes y tareas dentro de cada unidad',
        'Calendario con tu clase, salón, exámenes y tareas',
        'Tus notas de exámenes y tareas aparecen solas',
        'Material descargable para ver sin internet',
      ],
    },
    titulo: 'Unidades: tu aula virtual',
    texto: 'Aquí está todo lo de tu módulo: material, exámenes y tareas, ordenados por unidad. Tu material de antes también está aquí, dentro de su unidad. Vamos a recorrerlo botón por botón.' },
  { id: 'nov-est-mis-examenes', ruta: U, targetId: 'tour-unidades-examenes', seccion: 'Unidades',
    titulo: 'Mis exámenes',
    texto: 'Todos tus exámenes en un solo lugar: cuáles están disponibles, cuáles ya presentaste, tu nota y la revisión de tus respuestas. Si saliste de un examen por un problema, aquí también puedes apelar.' },
  { id: 'nov-est-sin-conexion', ruta: U, targetId: 'tour-unidades-sinconexion', seccion: 'Unidades',
    titulo: 'Sin conexión',
    texto: 'Aquí abres lo que descargaste para ver sin internet (lecturas, PDF, imágenes). Descargas una unidad desde su propia pantalla, con el botón del final.' },
  { id: 'nov-est-calendario-boton', ruta: U, targetId: 'tour-unidades-calendario', seccion: 'Unidades',
    titulo: 'Calendario',
    texto: 'Tu agenda: la clase del sábado con su salón, y las fechas de exámenes y tareas. Un puntito avisa cuando algo vence en las próximas 48 horas.' },
  { id: 'nov-est-modulo', ruta: U, targetId: 'tour-unidades-modulo', seccion: 'Unidades',
    titulo: 'Cambiar de módulo',
    texto: 'Si ya cursaste otros módulos, toca aquí para volver a ver sus unidades y su material. El módulo que estás cursando ahora aparece marcado como “actual”. Los módulos que todavía no empiezas no aparecen.' },
  { id: 'nov-est-recorrido', ruta: U, targetId: 'tour-unidades-lista', seccion: 'Unidades',
    clic: 'css:a[href^="/unidades/"]',
    titulo: 'Tu recorrido por unidades',
    texto: '“Vas aquí” marca por dónde vas. “Abierta” se puede entrar; “Cerrada · repaso” sigue disponible para estudiar; y una unidad con candado se abre cuando apruebes la certificación de la anterior. Toca “Siguiente” y entramos a una unidad.' },

  { id: 'nov-est-u-pestanas', ruta: U + '/', prefijo: true, targetId: 'tour-unidad-pestanas', seccion: 'Dentro de una unidad',
    titulo: 'Las unidades del módulo',
    texto: 'Esta fila reúne todas las unidades de tu módulo. Toca otra para cambiar de unidad sin volver atrás.' },
  { id: 'nov-est-u-banner', ruta: U + '/', prefijo: true, targetId: 'tour-unidad-banner', seccion: 'Dentro de una unidad',
    titulo: 'La portada de la unidad',
    texto: 'Cada unidad tiene el color o la imagen que le puso tu profesor. Los botones y detalles de esta unidad usan ese mismo color.' },
  { id: 'nov-est-u-progreso', ruta: U + '/', prefijo: true, targetId: 'tour-unidad-progreso', seccion: 'Dentro de una unidad',
    titulo: 'Tu avance',
    texto: 'Cuenta los materiales obligatorios que ya viste. Cuando llegas al total se habilita la certificación de la unidad. Si no hay obligatorios, esta barra no aparece.' },
  { id: 'nov-est-u-contenido', ruta: U + '/', prefijo: true, targetId: 'tour-unidad-contenido', seccion: 'Dentro de una unidad',
    titulo: 'El contenido, paso a paso',
    texto: 'Cada tarjeta es un paso: Documento, Presentación, Imagen, Video, Audio, Lectura, Examen, Certificación o Tarea. Una marca verde “Completado” indica lo que ya hiciste; “Obligatorio” es lo que necesitas para la certificación; y “Todavía no disponible” es algo que tu profesor aún no habilita.' },
  { id: 'nov-est-u-material', ruta: U + '/', prefijo: true, targetId: null, seccion: 'Dentro de una unidad',
    titulo: 'Cómo ver un material',
    texto: 'Toca una tarjeta de material y se abre dentro de la app: PDF, Word, imagen, video, audio o un enlace. En imágenes y documentos puedes acercar con los dedos. Un material cuenta como visto cuando lo recorres completo (adelantar un video no vale). Algunos videos traen un mini-chequeo corto al final.' },
  { id: 'nov-est-u-examenes', ruta: U + '/', prefijo: true, targetId: null, seccion: 'Dentro de una unidad',
    titulo: 'Exámenes y certificación',
    texto: 'Un examen de práctica te deja repasar. La certificación es el examen que cuenta para pasar a la siguiente unidad: puede tener un segundo intento (remedial) con tope de nota y una espera entre intentos. Algunos exámenes tienen tiempo límite. Si sales del examen antes de entregar, sacas cero y puedes apelar. Al entregar ves enseguida tu nota base; las preguntas de redacción las califica tu profesor.' },
  { id: 'nov-est-u-tareas', ruta: U + '/', prefijo: true, targetId: null, seccion: 'Dentro de una unidad',
    titulo: 'Tareas',
    texto: 'Abre la tarea, lee la instrucción y sube tu PDF antes de la fecha límite. Puedes agregar la fecha a tu calendario con un toque. Cuando tu profesor la califica, la nota aparece aquí y en Notas, y te llega un aviso.' },
  { id: 'nov-est-u-dudas', ruta: U + '/', prefijo: true, targetId: null, seccion: 'Dentro de una unidad',
    titulo: 'Dudas de la unidad',
    texto: 'Si una unidad tiene su tarjeta de Dudas, ahí preguntas lo que no entendiste de ESA unidad y ves las respuestas de tu profesor y las preguntas frecuentes.' },
  { id: 'nov-est-u-candado', ruta: U + '/', prefijo: true, targetId: null, seccion: 'Dentro de una unidad',
    titulo: 'Candados y fechas',
    texto: 'Un candado significa que algo todavía no está listo: falta completar materiales obligatorios, no ha llegado la fecha de apertura, o hay que aprobar la certificación anterior. El mensaje de la tarjeta te dice qué falta.' },
  { id: 'nov-est-u-descargar', ruta: U + '/', prefijo: true, targetId: 'tour-unidad-descargar', seccion: 'Dentro de una unidad',
    titulo: 'Descargar para ver sin internet',
    texto: 'Guarda los materiales de esta unidad en tu teléfono para leerlos sin conexión. Ocupan espacio, así que puedes borrarlos cuando quieras desde “Sin conexión”.' },

  { id: 'nov-est-examenes', ruta: '/examenes', targetId: null, seccion: 'Exámenes',
    titulo: 'Tu lista de exámenes',
    texto: 'Cada examen muestra su estado y tu nota. Desde aquí presentas los que están abiertos, revisas tus respuestas cuando ya está calificado y, si saliste de uno por un problema real, apelas para que tu profesor te deje repetirlo.' },
  { id: 'nov-est-calendario', ruta: '/calendario', targetId: null, seccion: 'Calendario',
    titulo: 'Tu calendario',
    texto: 'Aquí ves lo que viene: tu clase (con salón y profesor), exámenes y tareas con su fecha. Toca un evento y agrégalo al calendario de tu teléfono para que te avise.' },
  { id: 'nov-est-notas', ruta: '/notas', targetId: null, seccion: 'Notas',
    titulo: 'Notas que llegan solas',
    texto: 'Las notas de tus exámenes y tareas digitales aparecen aquí automáticamente apenas se califican, junto con su porcentaje en la nota del módulo. No tienes que esperar a que las carguen a mano.' },
  { id: 'nov-est-avisos', ruta: '/', targetId: null, seccion: 'Avisos',
    titulo: 'La campanita te avisa',
    texto: 'Te llega un aviso cuando se abre una unidad, cuando te desbloquean la siguiente, cuando se publica un examen, cuando una tarea o examen vence pronto y cuando te califican. Activa las notificaciones en tu perfil para recibirlos aunque no tengas la app abierta.' },
  { id: 'estudiante-calendario-flotante', ruta: '/', targetId: null, seccion: 'Avisos',
    titulo: 'Calendario siempre a mano',
    texto: 'El botón del calendario, junto a la campanita, te muestra lo que viene: tu clase del sábado con su salón, exámenes y tareas. Un puntito avisa cuando hay algo en las próximas 48 horas.' },
]

const ESTUDIANTE: PasoTour[] = [
  { id: 'estudiante-semana', ruta: '/', targetId: 'tour-semana',
    titulo: 'Tu semana',
    texto: 'Aquí ves los días de la semana. El sábado marcas tu asistencia; los demás días, tu módulo y tu material.' },
  { id: 'estudiante-accesos', ruta: '/', targetId: 'tour-accesos',
    titulo: 'Tu carnet, calendario y material',
    texto: 'Desde aquí muestras tu carnet para la asistencia, y entras directo a tu calendario o al material de Aula Virtual.' },
  { id: 'estudiante-nav', ruta: '/', targetId: 'tour-nav',
    titulo: 'Muévete por la app',
    texto: 'Desde estos botones vas a Inicio, tu módulo, Unidades (ahí está todo tu material, exámenes y tareas), tus notas, tus dudas y tu perfil.' },
  { id: 'estudiante-modulo', ruta: '/clases', targetId: 'tour-modulo',
    titulo: 'Mi módulo',
    texto: 'Aquí ves todo lo que vas a aprender en el módulo que estás cursando ahora: el resumen completo y tus competencias.' },
  ...NOVEDADES_ESTUDIANTE,
  { id: 'estudiante-malla', ruta: '/malla', targetId: 'tour-malla',
    titulo: 'La malla curricular',
    texto: 'Y desde ahí puedes entrar aquí — los catorce módulos del programa completo, en el orden en que se cursan.' },
  { id: 'estudiante-dudas', ruta: '/dudas', targetId: 'tour-dudas',
    titulo: 'Dudas',
    texto: 'Si algo no te quedó claro, escríbelo aquí como pregunta. Tu profesor las responde el sábado.' },
  { id: 'estudiante-carnet', ruta: '/perfil', targetId: 'tour-carnet',
    titulo: 'Tu carnet',
    texto: 'Y aquí tu carnet digital con tu código QR — el profesor lo escanea para marcar tu asistencia.' },
]


// ───────────────────────── NOVEDADES: UNIDADES (profesor) ─────────────────────────
const UD = '/unidades-docente'
const NOVEDADES_PROFESOR: PasoTour[] = [
  { id: 'nov-prof-unidades', ruta: UD, targetId: 'td-elegir', clic: 'td-elegir', seccion: 'Unidades',
    portada: {
      titulo: 'Todo tu módulo en un solo lugar',
      texto: 'Material ya no es una sección aparte: ahora subes todo dentro de cada unidad, junto con tus exámenes y tareas. Esto es lo nuevo.',
      puntos: [
        'Unidades por módulo, con fechas y bloqueos',
        'Material, exámenes, tareas y texto dentro de la unidad',
        'Exámenes de práctica y certificación con remedial',
        'Las notas pasan solas a Notas',
        'Plantillas para reutilizar unidades y exámenes',
        'Avisos cuando entregan, aprueban o hay algo por corregir',
      ],
    },
    titulo: 'Unidades: tu espacio de trabajo',
    texto: 'Aquí armas el módulo. Primero eliges el módulo; toca “Siguiente” y elegimos uno por ti para ver sus unidades. Vamos a recorrerlo todo, desde crear una unidad hasta dónde quedan las notas.' },
  { id: 'nov-prof-nueva', ruta: UD, targetId: 'td-nueva', seccion: 'Unidades',
    titulo: 'Nueva unidad',
    texto: '“+ Agregar unidad” crea una unidad con el nombre que le pongas. “+ Agregar unidad ya creada” copia una de tus plantillas con todo su contenido (los exámenes llegan ocultos y con 0 % para que los ajustes).' },
  { id: 'nov-prof-lista', ruta: UD, targetId: 'td-lista', seccion: 'Unidades',
    titulo: 'Tus unidades',
    texto: 'Cada tarjeta muestra su estado: Borrador (sin fecha, nadie la ve), Programada, Abierta o Cerrada. Ahí mismo: “Corregir nombre”, “Guardar plantilla” para reutilizarla en otro módulo, y “Eliminar” (te muestra primero qué se pierde).' },
  { id: 'nov-prof-abrir', ruta: UD, targetId: 'td-primera-unidad', clic: 'td-primera-unidad', seccion: 'Unidades',
    titulo: 'Entrar a una unidad',
    texto: 'Al tocarla ves la unidad tal como la ve tu estudiante. Toca “Siguiente” y entramos a una por ti.' },

  { id: 'nov-prof-u-vista', ruta: UD + '/', prefijo: true, targetId: 'td-banner', seccion: 'Dentro de una unidad',
    titulo: 'Así la ve el estudiante',
    texto: 'La portada con su estado (Borrador, Abierta…) y arriba las pestañas para saltar entre unidades. Es solo lectura: los cambios se hacen con “Editar unidad”.' },
  { id: 'nov-prof-u-recorrido', ruta: UD + '/', prefijo: true, targetId: 'td-recorrido', clic: 'td-editar', seccion: 'Dentro de una unidad',
    titulo: 'El recorrido y sus “Ver”',
    texto: 'Cada paso tiene su acción: un material se abre en el visor; un examen te lleva a la lista de quienes lo presentaron para corregir; una tarea a sus entregas; las dudas a su panel. Toca “Siguiente” y pasamos a editar.' },
  { id: 'nov-prof-u-fechas', ruta: UD + '/', prefijo: true, targetId: 'td-fechas', seccion: 'Editar unidad',
    titulo: 'Cuándo se abre y se cierra',
    texto: '“Se abre” hace que la unidad aparezca sola ese día; sin fecha queda como borrador. “Se cierra” la deja solo para repaso. Recuerda tocar “Guardar fechas”. Ojo: la hora es la de tu teléfono.' },
  { id: 'nov-prof-u-bloqueo', ruta: UD + '/', prefijo: true, targetId: 'td-bloqueo', seccion: 'Editar unidad',
    titulo: 'Bloqueo por certificación',
    texto: 'Decide de qué depende esta unidad: de la certificación de la unidad anterior (automático), de una certificación que elijas, o ninguna (se abre libre). El bloqueo por fecha siempre aplica.' },
  { id: 'nov-prof-u-contenido', ruta: UD + '/', prefijo: true, targetId: 'td-contenido', seccion: 'Editar unidad',
    titulo: 'Las tarjetas del contenido',
    texto: 'Mantén presionados los puntitos para arrastrar y cambiar el orden. “Quitar” saca el elemento de la unidad. En un material: “Editar” cambia título, descripción o enlace; “Obligatorio/Opcional” decide si cuenta para la certificación; y una etiqueta indica si Dirección lo aprobó, está en espera o lo rechazó (toca para ver el motivo).' },
  { id: 'nov-prof-u-agregar', ruta: UD + '/', prefijo: true, targetId: 'td-agregar', seccion: 'Editar unidad',
    titulo: '¿Qué quieres agregar?',
    texto: 'Cuatro opciones: Material, Examen, Tarea y Texto. Todo lo que crees aquí queda enganchado a esta unidad automáticamente.' },
  { id: 'nov-prof-u-material', ruta: UD + '/', prefijo: true, targetId: null, seccion: 'Editar unidad',
    titulo: 'Material',
    texto: 'Sube un PDF, Word, presentación, imagen, video o audio, o pega un link (YouTube, Google Drive, Google Fotos u otra página). Puedes agregar una descripción. Un archivo nuevo espera la aprobación de Dirección (te llega un aviso cuando lo aprueban o rechazan). A un video o audio le puedes asociar un mini-chequeo.' },
  { id: 'nov-prof-u-examen', ruta: UD + '/', prefijo: true, targetId: null, seccion: 'Editar unidad',
    titulo: 'Examen',
    texto: 'Elige si es de práctica o certificación, la nota mínima, los intentos (el segundo es el remedial, con tope de nota y espera entre intentos), el tiempo, las fechas de apertura y cierre, y cuánto % vale en la nota del módulo. Las preguntas pueden ser de opción múltiple, verdadero/falso o redacción; también las importas desde Word, Excel o CSV. Publícalo de una vez o guárdalo como borrador. Se guarda como plantilla para reutilizarlo.' },
  { id: 'nov-prof-u-tarea', ruta: UD + '/', prefijo: true, targetId: null, seccion: 'Editar unidad',
    titulo: 'Tarea',
    texto: 'Ponle instrucciones, fecha límite y su % en la nota. Tus estudiantes suben un PDF; tú lo ves dentro de la app, lo calificas (0 a 20) y la nota llega sola a Notas. También puedes descargar todas las entregas en un ZIP.' },
  { id: 'nov-prof-u-texto', ruta: UD + '/', prefijo: true, targetId: null, seccion: 'Editar unidad',
    titulo: 'Bloque de texto',
    texto: 'Escribe una explicación directo en la unidad, con negritas, listas y títulos, sin subir ningún archivo. Se ve completo en el recorrido del estudiante y lo puedes editar cuando quieras.' },
  { id: 'nov-prof-u-apariencia', ruta: UD + '/', prefijo: true, targetId: 'td-apariencia', clic: 'td-apariencia-toggle', seccion: 'Editar unidad',
    titulo: 'Apariencia',
    texto: 'Personaliza la portada de la unidad. Toca “Siguiente” y la abrimos.' },
  { id: 'nov-prof-u-apariencia-2', ruta: UD + '/', prefijo: true, targetId: 'td-apariencia', seccion: 'Editar unidad',
    titulo: 'Color e imagen',
    texto: 'Sube una imagen propia y súbela o bájala para encuadrarla, o elige un color en tres tonos. Ese color también tiñe los botones y detalles de la unidad para ti y tus estudiantes.' },
  { id: 'nov-prof-u-guardar', ruta: UD + '/', prefijo: true, targetId: 'td-guardar', seccion: 'Editar unidad',
    titulo: 'Guardar cambios',
    texto: 'Cuando termines, toca este botón para volver a la vista del estudiante. La mayoría de los controles guardan solos; las fechas piden su propio botón “Guardar fechas”.' },

  { id: 'nov-prof-examenes', ruta: '/crear-examen', targetId: null, seccion: 'Exámenes y notas',
    titulo: 'Tus exámenes',
    texto: 'La lista de todos tus exámenes: publicas u ocultas, editas, borras y entras a ver quién lo presentó para corregir las respuestas de redacción. Aquí no se crean exámenes nuevos: se crean dentro de una unidad.' },
  { id: 'nov-prof-notas', ruta: '/notas-docente', targetId: null, seccion: 'Exámenes y notas',
    titulo: 'Las notas llegan solas',
    texto: 'Cada examen o tarea con su % aparece como una columna en Notas, y la nota del estudiante se llena sola cuando se califica. No tienes que registrarla dos veces.' },
  { id: 'nov-prof-dudas', ruta: '/dudas-docente', targetId: null, seccion: 'Exámenes y notas',
    titulo: 'Dudas por unidad',
    texto: 'Las dudas de tus estudiantes llegan agrupadas y puedes filtrarlas por unidad. Responde una vez y todos ven la respuesta.' },
  { id: 'nov-prof-avisos', ruta: '/hoy', targetId: null, seccion: 'Avisos',
    titulo: 'La campanita te avisa',
    texto: 'Te llega un aviso cuando un estudiante entrega una tarea, cuando un examen tiene respuestas por corregir, cuando Dirección aprueba o rechaza tu material y cuando hay una duda nueva.' },
]

const PROFESOR: PasoTour[] = [
  { id: 'profesor-hoy', ruta: '/hoy', targetId: 'tour-hoy-clase',
    titulo: 'Tu clase de hoy',
    texto: 'Módulo, taller y horario de tu próxima clase, con la asistencia en vivo apenas los estudiantes van llegando.' },
  { id: 'profesor-nav', ruta: '/hoy', targetId: 'tour-nav',
    titulo: 'Muévete por la app',
    texto: 'Desde aquí vas a Hoy, Dudas, Unidades (ahí subes material y creas exámenes y tareas), Notas y tu perfil.' },
  ...NOVEDADES_PROFESOR,
]

const ADMIN: PasoTour[] = [
  { id: 'admin-panel', ruta: '/panel', targetId: 'tour-panel-accesos',
    titulo: 'Tu panel',
    texto: 'Todo lo que puedes hacer está agrupado aquí por tema: estudiantes, asistencia, y más abajo lo que te toque según tu rol.' },
  { id: 'admin-nav', ruta: '/panel', targetId: 'tour-nav',
    titulo: 'Muévete por la app',
    texto: 'Los accesos del día a día van fijos aquí abajo. El ☰ abre la lista completa de todo lo que puedes hacer.' },
  { id: 'admin-asistencia', ruta: '/asistencias', targetId: null,
    titulo: 'Asistencia',
    texto: 'El cuadro completo de asistencia por programa, en vivo — igual que la hoja de firmas, pero digital.' },
  { id: 'admin-salones', ruta: '/salones', targetId: null,
    titulo: 'Salones',
    texto: 'Elige en qué salón tiene clase cada cohorte cada sábado. Estudiantes y profesores lo ven en su calendario. Si no cambias nada, se repite el de la semana anterior.' },
]

const VENDEDOR: PasoTour[] = [
  { id: 'vendedor-inscribir', ruta: '/carga-ventas', targetId: null,
    titulo: 'Inscribir',
    texto: 'Este formulario registra a un estudiante nuevo — es lo primero que ves al entrar.' },
  { id: 'vendedor-nav', ruta: '/carga-ventas', targetId: 'tour-nav',
    titulo: 'Muévete por la app',
    texto: 'Desde aquí vas a Inscribir, tus inscripciones, los programas disponibles y tu perfil.' },
  { id: 'vendedor-programas', ruta: '/programas', targetId: null,
    titulo: 'Programas',
    texto: 'Las cohortes de PTMA y PFTA disponibles, con cuántos ya inscribiste tú en cada una.' },
]

const ZR_COFFEE: PasoTour[] = [
  { id: 'zrcoffee-inventario', ruta: '/zr-coffee', targetId: null,
    titulo: 'Inventario y ventas',
    texto: 'Registra cada venta aquí — el inventario y el precio en bolívares se calculan solos con la tasa del día.' },
  { id: 'zrcoffee-nav', ruta: '/zr-coffee', targetId: 'tour-nav',
    titulo: 'Muévete por la app',
    texto: 'Desde aquí vas a ZR Coffee y a tu perfil — ahí también está el QR de refrigerio para imprimir.' },
]

export const PASOS_POR_ROL: Record<RolConTour, PasoTour[]> = {
  estudiante: ESTUDIANTE,
  profesor: PROFESOR,
  admin: ADMIN,
  vendedor: VENDEDOR,
  zr_coffee: ZR_COFFEE,
}

// Para cuando no hay rol de tour (super_admin): bug real de producción
// (oct. 2026, reportado por el coordinador) -- un `[]` escrito directo en
// el JSX (`grupo ? PASOS_POR_ROL[grupo] : []`) crea un arreglo NUEVO en
// cada render; como useTour() depende de la identidad de ese arreglo,
// React entraba en un bucle de renders sin fin ("Maximum update depth
// exceeded") que dejaba el panel de administración congelado -- un botón
// se podía tocar, pero no pasaba nada. Esta constante es la misma
// referencia siempre, así nunca dispara el efecto de nuevo sin motivo.
export const SIN_PASOS_DE_TOUR: PasoTour[] = []
