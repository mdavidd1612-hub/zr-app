import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// /api/auth/register: lo llama alguien que TODAVÍA no tiene cuenta — no
// puede exigirle sesión. /api/auth/consent: si pasara por el chequeo de
// abajo, un menor con onboarding_status='en_curso' quedaría atrapado en un
// bucle (la propia llamada que completa el consentimiento sería bloqueada
// por no haber completado el consentimiento todavía). La ruta valida su
// propia sesión internamente (devuelve 401 si no hay usuario).
const PUBLIC_ROUTES = ['/login', '/registro', '/recuperar', '/api/auth/callback', '/api/auth/register', '/api/auth/consent']

// Rutas reales por rol. Los grupos de Next.js como (app), (profesor) o
// (admin) NUNCA aparecen en la URL — son solo organización de archivos —
// así que comparar pathname.startsWith('/(estudiante)') nunca es verdadero.
// Esa comparación rota dejaba sin efecto tanto el bloqueo LOPNNA como la
// separación de roles: cualquiera podía visitar cualquier ruta a nivel de
// middleware (las capas de cada layout.tsx sí frenaban el acceso a datos
// via RLS, pero la pantalla llegaba a renderizar).
// '/notas' es ambigua entre roles: el estudiante ve exactamente '/notas'
// (sin nada más), el profesor ve '/notas/[cohortId]'. Va aparte para no
// hacer match de prefijo con el otro rol por accidente.
const RUTAS_ESTUDIANTE = ['/', '/clases', '/contenido', '/examenes', '/perfil', '/progreso', '/solicitud-profesor']
const RUTAS_PROFESOR = ['/hoy', '/sesiones', '/crear-examen', '/calificar', '/perfil-docente', '/contenido-docente', '/dominio', '/escanear', '/feedback-clase']
const RUTAS_ADMIN = ['/panel', '/estudiantes', '/consentimientos', '/cohortes', '/reportes', '/perfil-admin', '/configuracion', '/personal', '/solicitudes-profesor', '/notas-academicas', '/examenes-academicos']

function empiezaConAlguna(pathname: string, rutas: string[]) {
  return rutas.some((r) => pathname === r || pathname.startsWith(r + '/'))
}

const esNotasEstudiante = (pathname: string) => pathname === '/notas'
const esNotasProfesor = (pathname: string) => pathname.startsWith('/notas/')

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas: pasar sin validar. '/registro' ya cubre
  // '/registro/consentimiento' por prefijo.
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Crear cliente de Supabase
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refrescar sesión
  const { data: { user } } = await supabase.auth.getUser()

  // Sin sesión: ir a login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Obtener rol y onboarding_status del perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: student } = await supabase
    .from('students')
    .select('onboarding_status')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'estudiante'
  const onboarding_status = student?.onboarding_status || 'en_curso'

  const inicioPorRol: Record<string, string> = {
    estudiante: '/',
    profesor: '/hoy',
    admin: '/panel',
    super_admin: '/panel',
    direccion_academica: '/panel',
  }

  // VALIDACIÓN CRÍTICA: menor sin consentimiento no puede acceder a nada
  // excepto consentimiento. La comparación anterior (pathname.startsWith
  // ('/(estudiante)')) nunca era verdadera — los grupos de rutas de
  // Next.js no aparecen en la URL — así que este bloqueo nunca se ejecutaba.
  if (role === 'estudiante' && onboarding_status !== 'completo') {
    return NextResponse.redirect(new URL('/registro/consentimiento', request.url))
  }

  // Validar que el rol corresponda a la ruta.
  const esRutaDeEstudiante = empiezaConAlguna(pathname, RUTAS_ESTUDIANTE) || esNotasEstudiante(pathname)
  const esRutaDeProfesor = empiezaConAlguna(pathname, RUTAS_PROFESOR) || esNotasProfesor(pathname)
  const esRutaDeAdmin = empiezaConAlguna(pathname, RUTAS_ADMIN)

  if (esRutaDeEstudiante && role !== 'estudiante') {
    return NextResponse.redirect(new URL(inicioPorRol[role] ?? '/', request.url))
  }
  if (esRutaDeProfesor && role !== 'profesor') {
    return NextResponse.redirect(new URL(inicioPorRol[role] ?? '/', request.url))
  }
  if (esRutaDeAdmin && !['admin', 'super_admin', 'direccion_academica'].includes(role)) {
    return NextResponse.redirect(new URL(inicioPorRol[role] ?? '/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
