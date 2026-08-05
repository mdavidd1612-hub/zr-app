import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const usuarios = [
    {
      cedula: 'V-12345678',
      email: 'v12345678@estudiante.zrmecademy.com',
      fullName: 'Juan Carlos Pérez',
      phone: '+58 412 1234567',
    },
    {
      cedula: 'E-87654321',
      email: 'e87654321@estudiante.zrmecademy.com',
      fullName: 'María José García',
      phone: '+58 414 9876543',
    },
    {
      cedula: 'V-11111111',
      email: 'v11111111@estudiante.zrmecademy.com',
      fullName: 'Carlos Antonio López',
      phone: '+58 416 5555555',
    },
  ]

  const results = []

  for (const usuario of usuarios) {
    try {
      // Obtener auth user
      const { data: users } = await supabase.auth.admin.listUsers()
      const foundUser = users?.users.find((u) => u.email === usuario.email)

      if (!foundUser) {
        results.push({ cedula: usuario.cedula, status: 'error', message: 'Auth user not found' })
        continue
      }

      // Crear perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: foundUser.id,
          cedula: usuario.cedula,
          full_name: usuario.fullName,
          phone: usuario.phone,
          contact_email: usuario.email,
          role: 'estudiante',
        })
        .select()
        .single()

      if (profileError) {
        results.push({ cedula: usuario.cedula, status: 'error', message: profileError.message })
      } else {
        results.push({ cedula: usuario.cedula, status: 'ok' })
      }
    } catch (err) {
      results.push({ cedula: usuario.cedula, status: 'error', message: (err as Error).message })
    }
  }

  return Response.json({ results })
}
