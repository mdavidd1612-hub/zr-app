import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(URL, SERVICE_KEY)

const usuarios = [
  {
    email: 'V-30000001@estudiante.zrmecademy.com',
    password: 'Test123!',
    fullName: 'Luis Hernández',
    cedula: 'V-30000001',
    role: 'estudiante',
  },
  {
    email: 'V-20000001@profesor.zrmecademy.com',
    password: 'Test123!',
    fullName: 'Prof. Carlos Rivas',
    cedula: 'V-20000001',
    role: 'profesor',
  },
  {
    email: 'V-10000001@admin.zrmecademy.com',
    password: 'Test123!',
    fullName: 'María Admin',
    cedula: 'V-10000001',
    role: 'admin',
  },
]

async function crearUsuarios() {
  console.log('🔧 Creando usuarios de prueba...\n')

  for (const usuario of usuarios) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: usuario.email,
        password: usuario.password,
        email_confirm: true,
        user_metadata: {
          full_name: usuario.fullName,
          cedula: usuario.cedula,
        },
      })

      if (error) {
        console.log(`⚠️  ${usuario.fullName}: ${error.message}`)
        continue
      }

      // Actualizar role en profiles
      await supabase
        .from('profiles')
        .upsert({ id: data.user.id, role: usuario.role })

      console.log(`✅ ${usuario.fullName}`)
      console.log(`   Email: ${usuario.email}`)
      console.log(`   Pass: ${usuario.password}`)
      console.log(`   Rol: ${usuario.role}\n`)
    } catch (err) {
      console.log(`❌ Error en ${usuario.fullName}: ${err.message}\n`)
    }
  }

  console.log('✓ Usuarios de prueba listos para usar\n')
  console.log('📱 Puedes entrar en http://localhost:3000/login con cualquiera de estos usuarios')
}

crearUsuarios().catch(console.error)
