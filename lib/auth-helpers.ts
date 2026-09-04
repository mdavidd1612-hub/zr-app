import type { UserRole } from '@/lib/types'

// ---------------------------------------------------------------------------
// AYUDANTES PUROS · se pueden usar en el navegador y en el servidor
// ---------------------------------------------------------------------------
// OJO: en este archivo no se importa nada de '@/lib/supabase/server'.
//
// spec/02_CONTRATOS.md pone `cedulaAEmail` y `getSessionProfile` juntos aquí,
// pero eso no compila: `cedulaAEmail` lo necesita el formulario de login, que
// corre en el navegador, y `getSessionProfile` usa `next/headers`, que solo
// existe en el servidor. Importar el primero arrastraba el segundo al paquete
// del navegador y Next fallaba con "You're importing a module that depends on
// next/headers".
//
// Por eso `getSessionProfile` vive ahora en `lib/auth-server.ts`.
// ---------------------------------------------------------------------------

// El estudiante entra con su cédula, pero Supabase Auth necesita un correo.
// La conversión es determinista y SIEMPRE la misma en toda la aplicación.
//
// El estudiante nunca ve este correo. Su correo real de contacto está en
// profiles.contact_email y es el que se usa para recuperar la contraseña.
// Para menores de edad, ese correo es el de su representante legal.
export function cedulaAEmail(cedula: string): string {
  return `${cedula.trim().toUpperCase()}@estudiante.zrmecademy.com`
}

export function esPersonal(role?: UserRole | null) {
  return role === 'profesor' || role === 'admin' || role === 'super_admin' || role === 'direccion_academica'
}

// Entra al área de administración (el layout, la barra flotante). Quién ve
// qué DENTRO de esa área (p.ej. /configuracion es solo de super_admin) se
// sigue filtrando aparte, pantalla por pantalla.
export function esAdmin(role?: UserRole | null) {
  return role === 'admin' || role === 'super_admin' || role === 'direccion_academica'
}

// Dirección Académica y super_admin coexisten al mismo nivel, pero con
// enfoques distintos: super_admin sigue a cargo de system_config/cohortes;
// Dirección Académica aprueba profesores, gestiona permisos de personal y
// supervisa/corrige notas. Esta función es para lo segundo.
export function esDireccionAcademica(role?: UserRole | null) {
  return role === 'direccion_academica' || role === 'super_admin'
}

export function esVendedor(role?: UserRole | null) {
  return role === 'vendedor'
}

// A dónde entra cada rol al iniciar sesión (login), al cambiar de rol activo
// (elegir-rol) y a dónde lo manda proxy.ts si intenta una ruta que no es la
// suya. Un solo lugar — antes estaba repetido en login/page.tsx y proxy.ts,
// y ya habían quedado ligeramente distintos entre sí (uno sin 'vendedor').
export const INICIO_POR_ROL: Record<UserRole, string> = {
  estudiante: '/',
  profesor: '/hoy',
  admin: '/panel',
  super_admin: '/panel',
  direccion_academica: '/panel',
  vendedor: '/carga-ventas',
}

// Cómo se le llama a cada rol en pantalla (selector de rol, Personal). La
// base y el código siguen en inglés (CLAUDE.md §9); esto es lo único que ve
// el usuario.
export const ETIQUETA_ROL: Record<UserRole, string> = {
  estudiante: 'Estudiante',
  profesor: 'Profesor',
  admin: 'Administración',
  super_admin: 'Super admin',
  direccion_academica: 'Dirección académica',
  vendedor: 'Vendedor',
}

// Calcula la edad cumplida. Se usa en el registro para decidir si hace falta
// el consentimiento del representante legal (LOPNNA).
export function edadCumplida(nacimiento: Date, hoy = new Date()): number {
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mes = hoy.getMonth() - nacimiento.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--
  return edad
}

export function esMenorDeEdad(nacimiento: Date, hoy = new Date()): boolean {
  return edadCumplida(nacimiento, hoy) < 18
}
