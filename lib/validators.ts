import { z } from 'zod'

// Cédula venezolana: V, E o J, guion, 6 a 9 dígitos.
// (V/J son las que se ofrecen en el selector de la interfaz; E se acepta
// igual porque ya existía y algún registro previo puede tenerla.)
export const cedulaSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[VEJ]-\d{6,9}$/, 'La cédula debe tener el formato V-12345678')

export const PREFIJOS_CEDULA = ['V', 'J'] as const

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')

export const registroSchema = z.object({
  fullName:     z.string().trim().min(3, 'Escribe tu nombre completo'),
  cedula:       cedulaSchema,
  contactEmail: z.string().trim().email('Escribe un correo válido'),
  phone:        z.string().trim().optional(),
  birthDate:    z.coerce.date().refine(
    (date) => date < new Date(),
    'La fecha de nacimiento debe estar en el pasado'
  ),
  password:     passwordSchema,
})

export const consentimientoSchema = z.object({
  representativeName:   z.string().trim().min(3),
  representativeCedula: cedulaSchema,
  representativeEmail:  z.string().trim().email(),
  representativePhone:  z.string().trim().optional(),
  method:               z.enum(['fisico', 'digital']),
  documentUrl:          z.string().url().optional(),
})

export const escaneoSchema = z.object({
  sessionId: z.string().uuid(),
  qrCode:    z.string().regex(/^ZR1\|[VE]-\d{6,9}\|\d{6}$/, 'Código QR con formato inválido'),
  scannedAt: z.string().datetime(),
  deviceId:  z.string().min(1),
})

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
