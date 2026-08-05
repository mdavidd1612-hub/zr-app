import type { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Alias de tablas (para no escribir la ruta larga en todo el código)
// ---------------------------------------------------------------------------
type T = Database['public']['Tables']
type V = Database['public']['Views']

export type Profile          = T['profiles']['Row']
export type Student          = T['students']['Row']
export type StudentView      = V['v_students']['Row']
export type Teacher          = T['teachers']['Row']
export type Cohort           = T['cohorts']['Row']
export type Module           = T['modules']['Row']
export type LearningGuide    = T['learning_guides']['Row']
export type ClassSession     = T['class_sessions']['Row']
export type Enrollment       = T['module_enrollments']['Row']
export type AttendanceEvent  = T['attendance_events']['Row']
export type Exam             = T['exams']['Row']
export type ExamQuestion     = T['exam_questions']['Row']
export type StudentQuestion  = V['v_exam_questions_student']['Row']
export type ExamAttempt      = T['exam_attempts']['Row']
export type ExamAnswer       = T['exam_answers']['Row']
export type ContentItem      = T['content_items']['Row']
export type Notification     = T['notifications']['Row']
export type ParentalConsent  = T['parental_consents']['Row']

export type UserRole = Database['public']['Enums']['user_role']

// ---------------------------------------------------------------------------
// Respuestas de opciones y preguntas
// ---------------------------------------------------------------------------
// El formato de 'options' y 'answer' es jsonb en la base. Estos tipos son el
// contrato de qué se guarda ahí. Respétalos exactamente.

export type QuestionOption = { key: string; text: string }

export type CorrectAnswer =
  | { key: string }        // opcion_multiple
  | { value: boolean }     // verdadero_falso
  | null                   // redaccion_abierta

export type StudentAnswer =
  | { key: string }
  | { value: boolean }
  | { text: string }

export type FeedbackAnswer = { q: string; a: number }  // a va de 1 a 5

// ---------------------------------------------------------------------------
// Cola de asistencia sin conexión (se guarda en IndexedDB)
// ---------------------------------------------------------------------------
export type PendingScan = {
  localId: string          // uuid generado en el navegador
  sessionId: string
  qrCode: string           // el código de 6 dígitos leído del QR
  scannedAt: string        // ISO 8601, momento REAL del escaneo
  deviceId: string
  synced: boolean
  lastError?: string
}

// ---------------------------------------------------------------------------
// Forma de los errores de las Edge Functions y rutas de API
// ---------------------------------------------------------------------------
export type ApiError = {
  error: {
    code: string      // identificador estable, en MAYUSCULAS_CON_GUION_BAJO
    message: string   // texto en español, listo para mostrarle al usuario
    detail?: unknown  // solo para depuración, nunca se muestra
  }
}
