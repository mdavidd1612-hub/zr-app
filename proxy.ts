import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { INICIO_POR_ROL } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

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
const RUTAS_ESTUDIANTE = ['/', '/clases', '/contenido', '/examenes', '/perfil', '/progreso', '/completar-perfil', '/aceptar-terminos', '/malla', '/feedback-modulo']
// '/unidades-docente' faltaba aquí (hueco encontrado el 7-nov-2026, junto
// con el bug de la cookie de arriba): sin estar en esta lista, el proxy no
// frenaba a NINGÚN rol autenticado pidiéndola -- funcionaba igual gracias al
// chequeo de rol en app/(profesor)/layout.tsx y a la RLS, pero las dos
// capas deben decir lo mismo. Se agrega para que sea consistente.
const RUTAS_PROFESOR = ['/hoy', '/sesiones', '/crear-examen', '/calificar', '/perfil-docente', '/contenido-docente', '/unidades-docente', '/temario-docente', '/dominio', '/escanear', '/feedback-clase', '/feedback-modulo-docente', '/notas-docente', '/evaluaciones']
const RUTAS_ADMIN = ['/panel', '/estudiantes', '/consentimientos', '/cohortes', '/reportes', '/perfil-admin', '/configuracion', '/personal', '/notas-academicas', '/examenes-academicos', '/cobertura-modulos', '/feedback-modulos', '/metricas-material']

function empiezaConAlguna(pathname: string, rutas: string[]) {
  return rutas.some((r) => pathname === r || pathname.startsWith(r + '/'))
}

const esNotasEstudiante = (pathname: string) => pathname === '/notas'
const esNotasProfesor = (pathname: string) => pathname.startsWith('/notas/')

// Bug real reportado por el coordinador (sept. 2026): a algunos estudiantes
// y a administración se les cerraba la sesión sola de vez en cuando, sin
// haber tocado "salir". Causa: `supabase.auth.getUser()` puede refrescar el
// access token, y Supabase ROTA el refresh token en cada refresco (el
// viejo queda invalidado). El cliente de arriba escribe esas cookies
// nuevas en `response` -- pero cuando el proxy decide redirigir (rol
// equivocado para la ruta, sin sesión, etc.), `NextResponse.redirect(...)`
// crea una respuesta DISTINTA que no lleva esas cookies. El navegador se
// quedaba con el refresh token anterior, ya invalidado por la rotación; la
// siguiente vez que el access token expiraba (hasta una hora después), ese
// refresh token ya no servía y la sesión moría sin aviso. Esta función
// copia las cookies de sesión a CUALQUIER redirección antes de mandarla.
function redirigirConSesion(url: URL, sesion: NextResponse) {
  const redireccion = NextResponse.redirect(url)
  sesion.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie))
  return redireccion
}

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
    return redirigirConSesion(new URL('/login', request.url), response)
  }

  // Obtener rol y onboarding_status del perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'estudiante') as UserRole

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

  // Vistas de recorrido (a pedido explícito del coordinador, docs/19_...):
  // administración, dirección académica y super_admin pueden recorrer la
  // vista de estudiante (simulación -- ven cómo luce para otro rol, no es
  // su área de trabajo real). El layout de cada una ya sabe mostrar el
  // banner de "vista de recorrido" y saltarse los pasos que no le aplican
  // (onboarding, etc).
  //
  // OJO: además del rol, se exige la cookie zr_vista (lib/vista-recorrido.ts)
  // — bug reportado por el coordinador: la PWA arranca en "/" (start_url,
  // app/manifest.ts), la MISMA ruta que "Vista de Estudiante", así que sin
  // esta cookie no había forma de distinguir "abrí la app de cero" de
  // "elegí ver como estudiante" — administración quedaba entrando siempre a
  // la vista de estudiante en vez de a su propio panel. La cookie solo se
  // prende al tocar el botón correspondiente en el panel (nunca aparece
  // sola), y sin ella cualquier rol de personal va derecho a lo suyo.
  const vistaRecorrido = request.cookies.get('zr_vista')?.value

  if (esRutaDeEstudiante && role !== 'estudiante') {
    const puedeRecorrer = ['admin', 'direccion_academica', 'super_admin'].includes(role) && vistaRecorrido === 'estudiante'
    if (!puedeRecorrer) {
      return redirigirConSesion(new URL(INICIO_POR_ROL[role] ?? '/', request.url), response)
    }
  }
  // Dirección Académica y super_admin: Unidades (Aula Virtual) es SU propia
  // área de trabajo, no una simulación -- entran COMO ELLOS MISMOS, pudiendo
  // modificar todo (RLS por is_staff() ya se los permite desde antes, ver
  // app/(profesor)/layout.tsx y CLAUDE.md §8.6 #1, 7-nov-2026). Bug real
  // reportado por el coordinador ese mismo día: este gate seguía exigiendo
  // la cookie zr_vista=profesor (la de "vista de recorrido", pensada para
  // CUANDO SÍ eligen simular al profesor desde su panel) para dejarlos
  // entrar a /crear-examen y /contenido-docente -- sin esa cookie (que es
  // justo el caso normal al entrar por su propio menú "Unidades"), el
  // servidor los regresaba a /panel ANTES de que la pantalla llegara a
  // renderizar. /unidades-docente no estaba en RUTAS_PROFESOR (arriba), así
  // que esa pantalla sí funcionaba por omisión -- pero cualquier "Ver"
  // dentro de una unidad (examen, crear examen nuevo, subir material) caía
  // en esta trampa. Se agregó /unidades-docente a la lista también, para
  // que de aquí en más pase por este mismo chequeo en vez de colarse sin
  // pasar por ninguno.
  if (esRutaDeProfesor && role !== 'profesor') {
    const puedeEntrar = ['direccion_academica', 'super_admin'].includes(role)
    if (!puedeEntrar) {
      return redirigirConSesion(new URL(INICIO_POR_ROL[role] ?? '/', request.url), response)
    }
  }
  if (esRutaDeAdmin && !['admin', 'super_admin', 'direccion_academica'].includes(role)) {
    return redirigirConSesion(new URL(INICIO_POR_ROL[role] ?? '/', request.url), response)
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
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|sw.js|icon-|icon.png|staging/|apple-touch-icon.png|logo-zr-mecademy.png|pdf.worker.min.mjs).*)',
  ],
}
