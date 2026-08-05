import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const usuarios = [
    { cedula: 'V-30000001', email: 'v30000001@test.com', nombre: 'Juan Carlos' },
    { cedula: 'V-30000002', email: 'v30000002@test.com', nombre: 'María García' },
  ]

  const results = []

  for (const u of usuarios) {
    try {
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email: u.email,
        password: 'Prueba123!',
        email_confirm: true,
      })

      if (authErr) {
        results.push({ cedula: u.cedula, status: 'error', msg: authErr.message })
        continue
      }

      const { error: profileErr } = await supabase
        .from('profiles')
        .insert({
          id: authUser.user.id,
          cedula: u.cedula,
          full_name: u.nombre,
          contact_email: u.email,
          role: 'estudiante',
        })

      if (profileErr) {
        results.push({ cedula: u.cedula, status: 'error', msg: profileErr.message })
      } else {
        results.push({ cedula: u.cedula, status: 'ok' })
      }
    } catch (err) {
      results.push({ cedula: u.cedula, status: 'error', msg: (err as Error).message })
    }
  }

  return Response.json({ results })
}
