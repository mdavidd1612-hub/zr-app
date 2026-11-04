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

export interface PasoTour {
  id: string
  ruta: string
  titulo: string
  texto: string
  targetId: string | null
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

const ESTUDIANTE: PasoTour[] = [
  { id: 'estudiante-semana', ruta: '/', targetId: 'tour-semana',
    titulo: 'Tu semana',
    texto: 'Aquí ves los días de la semana. El sábado marcas tu asistencia; los demás días, tu módulo y tu material.' },
  { id: 'estudiante-accesos', ruta: '/', targetId: 'tour-accesos',
    titulo: 'Tu carnet, material y dudas',
    texto: 'Desde aquí muestras tu carnet para la asistencia, revisas el material de tu módulo y le preguntas al profesor.' },
  { id: 'estudiante-nav', ruta: '/', targetId: 'tour-nav',
    titulo: 'Muévete por la app',
    texto: 'Desde estos botones vas a Inicio, tu módulo, el Aula (ahí está todo tu material), tus dudas y tu perfil.' },
  { id: 'estudiante-modulo', ruta: '/clases', targetId: 'tour-modulo',
    titulo: 'Mi módulo',
    texto: 'Aquí ves todo lo que vas a aprender en el módulo que estás cursando ahora: el resumen completo y tus competencias.' },
  { id: 'estudiante-aula', ruta: '/unidades', targetId: null,
    titulo: 'Aula Virtual',
    texto: 'Aquí tu profesor organiza el material, los exámenes y las tareas de la semana por unidad. Una unidad aparece sola apenas tu profesor le pone fecha — si no ves ninguna, todavía no abrió.' },
  { id: 'estudiante-malla', ruta: '/malla', targetId: 'tour-malla',
    titulo: 'La malla curricular',
    texto: 'Y desde ahí puedes entrar aquí — los catorce módulos del programa completo, en el orden en que se cursan.' },
  { id: 'estudiante-dudas', ruta: '/dudas', targetId: 'tour-dudas',
    titulo: 'Dudas',
    texto: 'Si algo no te quedó claro, escríbelo aquí como pregunta. Tu profesor las responde el sábado.' },
  { id: 'estudiante-notas', ruta: '/notas', targetId: null,
    titulo: 'Notas',
    texto: 'Aquí ves las notas de tus exámenes y trabajos apenas tu profesor las publica.' },
  { id: 'estudiante-carnet', ruta: '/perfil', targetId: 'tour-carnet',
    titulo: 'Tu carnet',
    texto: 'Y aquí tu carnet digital con tu código QR — el profesor lo escanea para marcar tu asistencia.' },
]

const PROFESOR: PasoTour[] = [
  { id: 'profesor-hoy', ruta: '/hoy', targetId: 'tour-hoy-clase',
    titulo: 'Tu clase de hoy',
    texto: 'Módulo, taller y horario de tu próxima clase, con la asistencia en vivo apenas los estudiantes van llegando.' },
  { id: 'profesor-nav', ruta: '/hoy', targetId: 'tour-nav',
    titulo: 'Muévete por la app',
    texto: 'Desde aquí vas a Hoy, Dudas, Aula (ahí subes material y creas exámenes), Notas y tu perfil.' },
  { id: 'profesor-aula', ruta: '/unidades-docente', targetId: null,
    titulo: 'Organizar en Aula Virtual',
    texto: 'Aquí armas el orden de la semana: 1) "+ Agregar unidad" y ponle nombre. 2) Entra a la unidad y agrégale material o examen nuevo (se crean ahí mismo, dentro de la unidad) o una tarea. 3) Ponle fecha de apertura — sin fecha queda en borrador, nadie la ve.' },
  { id: 'profesor-aula-crear', ruta: '/unidades-docente', targetId: null,
    titulo: 'Crear examen o material nuevo',
    texto: 'Dentro de una unidad: "+ Crear examen nuevo" o "+ Subir material nuevo" lo arman ahí mismo y se enganchan solos a esa unidad. También puedes elegir uno que ya existe de otra unidad con los selectores.' },
  { id: 'profesor-aula-vista', ruta: '/unidades-docente', targetId: null,
    titulo: 'La unidad se ve como la ve tu estudiante',
    texto: 'Al entrar a una unidad ves lo mismo que ellos — toca "Editar unidad" abajo para cambiar fechas, agregar o quitar contenido. "Listo" te devuelve a esa misma vista.' },
  { id: 'profesor-aula-bloque-texto', ruta: '/unidades-docente', targetId: null,
    titulo: 'Escribe texto directo en la unidad',
    texto: 'En "Editar unidad" tienes "Nuevo bloque de texto": ponle título y escribe el párrafo ahí mismo, sin subir ningún archivo. Se ve de inmediato para tus estudiantes.' },
  { id: 'profesor-aula-mini-chequeo', ruta: '/unidades-docente', targetId: null,
    titulo: 'Mini-chequeo al terminar un video',
    texto: 'En un material de video o audio puedes asociarle un examen formativo cortico: al terminarlo, tu estudiante lo ve ahí mismo y, si lo aprueba, el material queda validado.' },
  { id: 'profesor-notas', ruta: '/notas-docente', targetId: null,
    titulo: 'Notas',
    texto: 'Una sola tabla con todas las evaluaciones de tu módulo. Cuando termines, publicas directo y el estudiante la ve de inmediato.' },
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
