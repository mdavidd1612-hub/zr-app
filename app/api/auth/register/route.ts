import { createAdminClient } from '@/lib/supabase/admin'
import { cedulaAEmail, esMenorDeEdad } from '@/lib/auth-helpers'
import { registroSchema } from '@/lib/validators'

export async function POST(req: Request) {
  const payload = await req.json()

  const validado = registroSchema.safeParse(payload)
  if (!validado.success) {
    return Response.json(
      { error: validado.error.issues[0].message },
      { status: 400 }
    )
  }

  const { fullName, cedula, contactEmail, phone, birthDate, password } = validado.data
  const email = cedulaAEmail(cedula)

  const admin = createAdminClient()

  // 1. Crear usuario en Auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    user_metadata: { full_name: fullName, cedula, contact_email: contactEmail },
    email_confirm: true, // No requiere confirmación porque es cuentas de prueba/registro escolar
  })

  if (authError || !authData.user) {
    return Response.json(
      { error: 'No se pudo crear la cuenta. Intenta con otra cédula.' },
      { status: 400 }
    )
  }

  // 2. El disparador handle_new_user() ya creó la fila en profiles con role='estudiante'
  // Aquí insertamos en students con la fecha de nacimiento
  const esMenor = esMenorDeEdad(new Date(birthDate))
  const { error: studentError } = await admin
    .from('students')
    .insert({
      id: authData.user.id,
      birth_date: new Date(birthDate).toISOString().split('T')[0],
      phone: phone || null,
      onboarding_status: esMenor ? 'en_curso' : 'completo',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

  if (studentError) {
    // Rollback: eliminar el usuario que acabamos de crear
    await admin.auth.admin.deleteUser(authData.user.id)
    return Response.json(
      { error: 'Error al registrar. Intenta de nuevo.' },
      { status: 400 }
    )
  }

  return Response.json({
    success: true,
    userId: authData.user.id,
    isMenor: esMenor,
  })
}
