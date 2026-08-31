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
