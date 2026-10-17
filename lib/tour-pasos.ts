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
    texto: 'Desde estos botones vas a Inicio, tu módulo, el material, tus dudas y tu perfil.' },
  { id: 'estudiante-modulo', ruta: '/clases', targetId: 'tour-modulo',
    titulo: 'Mi módulo',
    texto: 'Aquí ves todo lo que vas a aprender en el módulo que estás cursando ahora: el resumen completo y tus competencias.' },
  { id: 'estudiante-malla', ruta: '/malla', targetId: 'tour-malla',
    titulo: 'La malla curricular',
    texto: 'Y desde ahí puedes entrar aquí — los catorce módulos del programa completo, en el orden en que se cursan.' },
  { id: 'estudiante-material', ruta: '/contenido', targetId: 'tour-material',
    titulo: 'Material',
    texto: 'Aquí está el material de tu módulo: guías, PDFs y presentaciones, organizados en carpetas.' },
  { id: 'estudiante-dudas', ruta: '/dudas', targetId: 'tour-dudas',
    titulo: 'Dudas',
    texto: 'Si algo no te quedó claro, escríbelo aquí como pregunta. Tu profesor las responde el sábado.' },
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
    texto: 'Desde aquí vas a Hoy, Dudas, Material, Notas y tu perfil.' },
  { id: 'profesor-material', ruta: '/contenido-docente', targetId: null,
    titulo: 'Material',
    texto: 'Sube las guías y PDFs de tu módulo — eliges primero el programa y el módulo si das clase en más de uno.' },
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
