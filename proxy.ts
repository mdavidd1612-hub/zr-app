import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// Ya no hay autoregistro (docs/17_PLAN_CONSOLIDADO..., ajuste post-Sprint 7):
// toda cuenta la crea administración o ventas desde dentro de la app. Solo
// quedan públicas login y recuperar contraseña.
const PUBLIC_ROUTES = ['/login', '/recuperar', '/api/auth/callback', '/descargar', '/zr-app.apk', '/.well-known']

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
const RUTAS_ESTUDIANTE = ['/', '/clases', '/contenido', '/examenes', '/perfil', '/progreso', '/completar-perfil', '/aceptar-terminos', '/malla']
const RUTAS_PROFESOR = ['/hoy', '/sesiones', '/crear-examen', '/calificar', '/perfil-docente', '/contenido-docente', '/dominio', '/escanear', '/feedback-clase']
const RUTAS_ADMIN = ['/panel', '/estudiantes', '/consentimientos', '/cohortes', '/reportes', '/perfil-admin', '/configuracion', '/personal', '/notas-academicas', '/examenes-academicos']

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

  const role = profile?.role || 'estudiante'

  const inicioPorRol: Record<string, string> = {
    estudiante: '/',
    profesor: '/hoy',
    admin: '/panel',
    super_admin: '/panel',
    direccion_academica: '/panel',
  }

  // El consentimiento parental (LOPNNA) ya no se autogestiona desde la app —
  // lo captura el vendedor al momento de la venta (Módulo 1), junto con el
  // resto de los datos del estudiante, así que no hace falta un gate aquí
  // redirigiendo a ninguna pantalla propia. La ley se sigue aplicando en la
  // base (trigger fn_check_parental_consent, migración 010): sin ese
  // consentimiento, el estudiante nunca puede quedar onboarding 'completo'.

  // Validar que el rol corresponda a la ruta.
  const esRutaDeEstudiante = empiezaConAlguna(pathname, RUTAS_ESTUDIANTE) || esNotasEstudiante(pathname)
  const esRutaDeProfesor = empiezaConAlguna(pathname, RUTAS_PROFESOR) || esNotasProfesor(pathname)
  const esRutaDeAdmin = empiezaConAlguna(pathname, RUTAS_ADMIN)

  // super_admin puede entrar a las vistas de recorrido de estudiante y
  // profesor (a pedido explícito del coordinador, docs/19_...) — el layout
  // de cada una ya sabe mostrar el banner de "vista de recorrido" y saltarse
  // los pasos que no le aplican (onboarding, validación, etc).
  if (esRutaDeEstudiante && role !== 'estudiante' && role !== 'super_admin') {
    return NextResponse.redirect(new URL(inicioPorRol[role] ?? '/', request.url))
  }
  if (esRutaDeProfesor && role !== 'profesor' && role !== 'super_admin') {
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
     *
     * El manifiesto, el service worker y los iconos tienen que responder
     * aunque no haya sesión: el navegador los pide antes de que nadie inicie
     * sesión, y si el proxy los redirige a /login la app deja de ser
     * instalable (no aparece el botón «Instalar»).
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|sw.js|icon-|apple-touch-icon.png|logo-zr-mecademy.png).*)',
  ],
}
