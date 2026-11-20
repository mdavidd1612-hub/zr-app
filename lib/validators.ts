// Rendimiento (20-nov-2026): antes este archivo usaba zod, y eso metía ~285 KB
// de JavaScript en la pantalla de login (y en Personal, Recuperar, etc.) solo
// para validar una cédula. Con poco internet era lo más pesado de la primera
// carga. Se reemplaza por funciones pequeñas que devuelven la MISMA forma que
// zod (`safeParse` -> { success, data } o { success, error.issues[0].message })
// para no tocar las pantallas que ya lo usan.

type Resultado<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: { message: string }[] } }

/** Crea un validador con la misma forma que `z.safeParse`. `fn` devuelve el
 *  valor limpio, o `null` si no es válido (entonces se usa `mensaje`). */
function validador<T>(fn: (v: unknown) => T | null, mensaje: string) {
  return {
    safeParse(v: unknown): Resultado<T> {
      const r = fn(v)
      return r === null
        ? { success: false, error: { issues: [{ message: mensaje }] } }
        : { success: true, data: r }
    },
  }
}

// Cédula venezolana: V, E o J, guion, 6 a 9 dígitos.
// (V/J son las que se ofrecen en el selector de la interfaz; E se acepta
// igual porque ya existía y algún registro previo puede tenerla.)
export const cedulaSchema = validador<string>((v) => {
  const c = String(v ?? '').trim().toUpperCase()
  return /^[VEJ]-\d{6,9}$/.test(c) ? c : null
}, 'La cédula debe tener el formato V-12345678')

export const PREFIJOS_CEDULA = ['V', 'J'] as const

export const passwordSchema = validador<string>((v) => {
  const c = String(v ?? '')
  return c.length >= 8 ? c : null
}, 'La contraseña debe tener al menos 8 caracteres')

// -----------------------------------------------------------------------------
// R-10 y R-11 (docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md) · duplicadas a
// propósito en supabase/functions/create-student/index.ts: las Edge
// Functions no importan de este archivo, solo de esm.sh. Si cambias la regla
// aquí, cámbiala también allá — el servidor es quien de verdad decide, esto
// solo avisa antes de enviar.
// -----------------------------------------------------------------------------

// Ataca el caso real que reportó la directiva (dos "Ricardo Hernández" en el
// mismo corte): al menos dos palabras de 3+ letras, sin puntos de abreviatura.
export function nombreCompletoValido(nombre: string): boolean {
  const limpio = nombre.trim()
  if (limpio.includes('.')) return false
  const palabras = limpio.split(/\s+/).filter(Boolean)
  if (palabras.length < 2) return false
  return palabras.every((p) => (p.match(/\p{L}/gu) ?? []).length >= 3)
}

// Formato venezolano: 11 dígitos empezando en 0 (0412-1234567) o 12
// empezando en 58 (58-412-1234567), con o sin guiones/espacios.
export function telefonoVenezolanoValido(raw: string): boolean {
  if (!raw) return false
  const digitos = raw.replace(/\D/g, '')
  if (digitos.length === 11 && digitos.startsWith('0')) return true
  if (digitos.length === 12 && digitos.startsWith('58')) return true
  return false
}
