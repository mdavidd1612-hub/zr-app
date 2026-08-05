import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'
import type { UserRole } from '@/lib/types'

// Rutas que se ven sin haber iniciado sesión.
const PUBLICAS = [
  '/login',
  '/registro',
  '/registro/consentimiento',
  '/recuperar',
  '/api/auth/callback',
]

// A dónde va cada rol al entrar. También es a dónde se le devuelve si intenta
// meterse donde no le toca.
const INICIO: Record<UserRole, string> = {
  estudiante:  '/carnet',
  profesor:    '/hoy',
  admin:       '/panel',
  super_admin: '/panel',
}

// Qué roles pueden ver cada zona. Administración entra también a las pantallas
// de profesor: necesita ver la clase de hoy y las cohortes sin pedirle permiso
// a nadie.
const ZONAS: { prefijos: string[]; permitidos: UserRole[] }[] = [
  {
    prefijos: ['/carnet', '/clases', '/examenes', '/contenido', '/notas', '/feedback', '/progreso'],
    permitidos: ['estudiante'],
  },
  {
    prefijos: ['/hoy', '/escanear', '/sesiones', '/calificar', '/dominio'],
    permitidos: ['profesor', 'admin', 'super_admin'],
  },
  {
    prefijos: ['/panel', '/estudiantes', '/consentimientos', '/cohortes', '/reportes', '/configuracion'],
    permitidos: ['admin', 'super_admin'],
  },
]

function esPublica(ruta: string) {
  return PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`))
}

function zonaDe(ruta: string) {
  return ZONAS.find((z) => z.prefijos.some((p) => ruta === p || ruta.startsWith(`${p}/`)))
}

export async function middleware(request: NextRequest) {
  // Esta respuesta acompaña a todo el recorrido: el cliente de Supabase escribe
  // en ella las cookies de sesión renovadas. Si se devuelve otra distinta sin
  // copiarlas, la sesión se pierde en cada navegación.
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista) => {
          lista.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          lista.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // getUser() valida el token contra el servidor de Auth. getSession() solo lee
  // la cookie, que el navegador puede haber manipulado: no sirve para decidir
  // permisos.
  const { data: { user } } = await supabase.auth.getUser()

  const ruta = request.nextUrl.pathname

  if (!user) {
    if (esPublica(ruta)) return response
    const destino = request.nextUrl.clone()
    destino.pathname = '/login'
    return NextResponse.redirect(destino)
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single()

  // Con sesión pero sin perfil el usuario no puede hacer nada. Se cierra la
  // sesión para que no quede dando vueltas en un estado imposible.
  if (!perfil) {
    await supabase.auth.signOut()
    const destino = request.nextUrl.clone()
    destino.pathname = '/login'
    return NextResponse.redirect(destino)
  }

  const rol = perfil.role as UserRole

  if (perfil.status === 'suspendido') {
    const destino = request.nextUrl.clone()
    destino.pathname = '/login'
    destino.searchParams.set('motivo', 'suspendido')
    return NextResponse.redirect(destino)
  }

  // LOPNNA: un menor sin el consentimiento de su representante no llega al
  // carnet ni escribiendo la dirección a mano. Esta comprobación es la que hace
  // que la pantalla de consentimiento no se pueda saltar (T-105).
  if (rol === 'estudiante' && ruta !== '/registro/consentimiento') {
    const { data: alumno } = await supabase
      .from('students')
      .select('onboarding_status')
      .eq('id', user.id)
      .single()

    if (alumno && alumno.onboarding_status !== 'completo') {
      const destino = request.nextUrl.clone()
      destino.pathname = '/registro/consentimiento'
      destino.search = ''
      return NextResponse.redirect(destino)
    }
  }

  // Ya con sesión, las pantallas de entrada no tienen sentido: se manda a cada
  // quien a su inicio.
  if (esPublica(ruta)) {
    const destino = request.nextUrl.clone()
    destino.pathname = INICIO[rol]
    destino.search = ''
    return NextResponse.redirect(destino)
  }

  if (ruta === '/') {
    const destino = request.nextUrl.clone()
    destino.pathname = INICIO[rol]
    return NextResponse.redirect(destino)
  }

  const zona = zonaDe(ruta)
  if (zona && !zona.permitidos.includes(rol)) {
    const destino = request.nextUrl.clone()
    destino.pathname = INICIO[rol]
    destino.search = ''
    return NextResponse.redirect(destino)
  }

  return response
}

export const config = {
  matcher: [
    // Todo menos los archivos estáticos, las imágenes y los recursos de la PWA.
    // El service worker y el manifiesto tienen que servirse sin pasar por aquí
    // o la aplicación no se puede instalar.
    '/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest.webmanifest|sw\\.js|marca/).*)',
  ],
}
