import { type ItemBarra } from '@/components/ui/BarraFlotante'
import {
  IconoPanel, IconoEstudiantes, IconoPerfil, IconoNotas, IconoPersonal, IconoExamen,
  IconoDocumento, IconoCalendario, IconoCarnet, IconoProgreso, IconoDuda, IconoCalificar, IconoVideo, IconoAjustes,
} from '@/components/ui/Iconos'

/**
 * Menú propio de Dirección Académica y super_admin.
 *
 * Nace del bug reportado por el coordinador (7-nov-2026): al entrar a
 * Unidades (Aula Virtual) desde su propio menú, `app/(profesor)/layout.tsx`
 * les pintaba el menú reducido del profesor (Hoy, Dudas, Casos, Unidades,
 * Notas, Perfil) en la barra lateral -- perdían Panel, Asistencia, QR,
 * Personal, Cohortes, Notas académicas, etc. sin ningún aviso. El fix de la
 * sesión anterior (quitar el banner de "vista de recorrido" cuando entran
 * COMO ELLOS MISMOS) solo tapó el síntoma del banner, no el de fondo: la
 * barra lateral seguía siendo la del profesor.
 *
 * Este archivo es la copia exacta de NAV_DIRECCION/TODAS_DIRECCION/
 * TODAS_SUPER de `app/(admin)/layout.tsx`, para que `app/(profesor)/
 * layout.tsx` pueda usarlas cuando Dirección/super_admin entran a Unidades
 * sin simular al profesor -- así conservan TODO su menú, con "Unidades"
 * resaltado, en vez de perderlo.
 *
 * FUENTE ÚNICA (16-nov-2026): `app/(admin)/layout.tsx` y `app/(profesor)/
 * layout.tsx` importan los menús de aquí. Antes eran dos copias y se
 * desincronizaron: la barra de abajo cambiaba sola al pasar de Panel a
 * Unidades. Cualquier cambio de menú se hace SOLO en este archivo.
 */

export const NAV: ItemBarra[] = [
  { href: '/panel',        label: 'Panel',      Icono: IconoPanel },
  { href: '/asistencias',  label: 'Asistencia', Icono: IconoCalendario },
  { href: '/qr',           label: 'QR',         Icono: IconoCarnet },
  { href: '/perfil-admin', label: 'Perfil',     Icono: IconoPerfil },
]

const UNIDADES: ItemBarra = { href: '/unidades-docente', label: 'Unidades', Icono: IconoVideo }
const MATERIAL: ItemBarra = { href: '/material', label: 'Material', Icono: IconoDocumento }

/** Píldora flotante del teléfono (máximo 5 secciones). */
export const NAV_DIRECCION: ItemBarra[] = [
  NAV[0], NAV[1], UNIDADES, { href: '/notas-academicas', label: 'Notas', Icono: IconoNotas }, NAV[3],
]

/**
 * Píldora de super_admin: lo que más usa -- Programas y Ajustes -- a la vista.
 * Asistencia y QR siguen en el panel de inicio y en el menú ☰.
 */
export const NAV_SUPER: ItemBarra[] = [
  NAV[0],
  UNIDADES,
  { href: '/cohortes',      label: 'Programas', Icono: IconoProgreso },
  { href: '/configuracion', label: 'Ajustes',   Icono: IconoAjustes },
  NAV[3],
]

const FINANZAS: ItemBarra = { href: '/finanzas', label: 'Finanzas', Icono: IconoCalificar, grupo: 'Administración' }

export const TODAS: ItemBarra[] = [
  { ...NAV[0], grupo: 'General' },
  { href: '/inscribir',       label: 'Inscribir',       Icono: IconoEstudiantes, grupo: 'Estudiantes' },
  { href: '/estudiantes',     label: 'Estudiantes',     Icono: IconoEstudiantes, grupo: 'Estudiantes' },
  { ...NAV[1], grupo: 'Clase de hoy' },
  { ...NAV[2], grupo: 'Clase de hoy' },
  { href: '/personal',        label: 'Personal',        Icono: IconoPersonal,    grupo: 'Administración' },
  FINANZAS,
  { ...NAV[3], grupo: 'Cuenta' },
]

/** Barra lateral completa (PC) para Dirección Académica. */
export const TODAS_DIRECCION: ItemBarra[] = [
  TODAS[0],
  { href: '/estudiantes',          label: 'Estudiantes',  Icono: IconoEstudiantes, grupo: 'Estudiantes' },
  { ...NAV[1], grupo: 'Clase de hoy' },
  { ...NAV[2], grupo: 'Clase de hoy' },
  { ...UNIDADES, grupo: 'Académico' },
  { ...MATERIAL, grupo: 'Académico' },
  { href: '/notas-academicas',     label: 'Notas',        Icono: IconoNotas,    grupo: 'Académico' },
  { href: '/examenes-academicos',  label: 'Exámenes',     Icono: IconoExamen,   grupo: 'Académico' },
  { href: '/dudas-docente',        label: 'Dudas',        Icono: IconoDuda,     grupo: 'Académico' },
  { href: '/personal',             label: 'Profesores',   Icono: IconoPersonal, grupo: 'Dirección académica' },
  { href: '/cohortes',             label: 'Programas',    Icono: IconoProgreso, grupo: 'Dirección académica' },
  { href: '/modulos',              label: 'Módulos',      Icono: IconoProgreso, grupo: 'Dirección académica' },
  { href: '/salones',              label: 'Salones',      Icono: IconoProgreso, grupo: 'Dirección académica' },
  { href: '/cobertura-modulos',    label: 'Cobertura',    Icono: IconoProgreso, grupo: 'Dirección académica' },
  { href: '/feedback-modulos',     label: 'Feedback',     Icono: IconoDuda,     grupo: 'Dirección académica' },
  TODAS[TODAS.length - 1],
]

/** Barra lateral completa (PC) para super_admin. */
export const TODAS_SUPER: ItemBarra[] = [
  TODAS[0], TODAS[1], TODAS[2],
  { ...UNIDADES, grupo: 'Clase de hoy' },
  TODAS[3], TODAS[4],
  { href: '/personal',             label: 'Personal',      Icono: IconoPersonal, grupo: 'Dirección académica' },
  { ...MATERIAL, grupo: 'Dirección académica' },
  { href: '/cohortes',             label: 'Programas',     Icono: IconoProgreso, grupo: 'Dirección académica' },
  { href: '/cobertura-modulos',    label: 'Cobertura',     Icono: IconoProgreso, grupo: 'Dirección académica' },
  { href: '/notas-academicas',     label: 'Notas',         Icono: IconoNotas,    grupo: 'Dirección académica' },
  { href: '/examenes-academicos',  label: 'Exámenes',      Icono: IconoExamen,   grupo: 'Dirección académica' },
  { href: '/dudas-docente',        label: 'Dudas',         Icono: IconoDuda,     grupo: 'Dirección académica' },
  { href: '/modulos',              label: 'Módulos',       Icono: IconoProgreso, grupo: 'Dirección académica' },
  { href: '/salones',              label: 'Salones',       Icono: IconoProgreso, grupo: 'Dirección académica' },
  { href: '/feedback-modulos',     label: 'Feedback',      Icono: IconoDuda,     grupo: 'Dirección académica' },
  FINANZAS,
  { href: '/monitoreo',            label: 'Monitoreo',     Icono: IconoProgreso,  grupo: 'Solo super admin' },
  { href: '/catalogo',             label: 'Catálogo',      Icono: IconoDocumento, grupo: 'Solo super admin' },
  { href: '/configuracion',        label: 'Configuración', Icono: IconoAjustes,   grupo: 'Solo super admin' },
  TODAS[TODAS.length - 1],
]
