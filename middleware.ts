import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/registro', '/recuperar', '/api/auth/callback']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas: pasar sin validar
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Ruta especial: consentimiento es pública pero solo si vienes del registro
  if (pathname.startsWith('/registro/consentimiento')) {
    return NextResponse.next()
  }

  // Crear cliente de Supabase
  let response = NextResponse.next()
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
  const { data: { user }, error } = await supabase.auth.getUser()

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

  // VALIDACIÓN CRÍTICA: menor sin consentimiento no puede acceder a nada excepto consentimiento
  if (role === 'estudiante' && onboarding_status !== 'completo' && pathname.startsWith('/(estudiante)')) {
    return NextResponse.redirect(new URL('/registro/consentimiento', request.url))
  }

  // Validar que el rol corresponda a la ruta
  if (pathname.startsWith('/(estudiante)') && role !== 'estudiante') {
    // Redirigir a su pantalla de inicio según rol
    if (role === 'profesor') return NextResponse.redirect(new URL('/hoy', request.url))
    if (['admin', 'super_admin'].includes(role)) return NextResponse.redirect(new URL('/panel', request.url))
  }

  if (pathname.startsWith('/(profesor)') && role !== 'profesor') {
    // Redirigir a su pantalla de inicio según rol
    if (role === 'estudiante') return NextResponse.redirect(new URL('/carnet', request.url))
    if (['admin', 'super_admin'].includes(role)) return NextResponse.redirect(new URL('/panel', request.url))
  }

  if (pathname.startsWith('/(admin)') && !['admin', 'super_admin'].includes(role)) {
    // Redirigir a su pantalla de inicio según rol
    if (role === 'estudiante') return NextResponse.redirect(new URL('/carnet', request.url))
    if (role === 'profesor') return NextResponse.redirect(new URL('/hoy', request.url))
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
