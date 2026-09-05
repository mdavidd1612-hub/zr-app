// Vista de recorrido (bug reportado por el coordinador): administración,
// dirección académica y super_admin pueden entrar a ver cómo se ve la app
// para otro rol (migración de permisos anterior), pero eso los dejaba
// entrando SIEMPRE a esa vista al abrir la app de nuevo — el manifest de la
// PWA arranca en "/" (app/manifest.ts, start_url), que es exactamente la
// misma ruta que "Vista de Estudiante". El servidor (proxy.ts) no tenía
// forma de distinguir "abrí la app de cero" de "elegí deliberadamente ver
// como estudiante" — ambos son un GET a "/" con el mismo rol.
//
// Esta cookie es esa distinción: se prende SOLO cuando la persona toca el
// botón "Vista de X" en su panel, y se apaga al salir (BannerSimulacion) o
// sola a las 4 horas. Sin la cookie, proxy.ts manda a cualquier rol de
// personal derecho a su propio panel, nunca a la vista de otro rol.
const COOKIE = 'zr_vista'

export type VistaRecorrido = 'estudiante' | 'profesor' | 'vendedor'

export function activarVistaRecorrido(vista: VistaRecorrido) {
  if (typeof document === 'undefined') return
  // 4 horas: alcanza de sobra para una sesión de trabajo, pero no se queda
  // pegada para siempre si alguien se olvida de salir.
  document.cookie = `${COOKIE}=${vista}; path=/; max-age=14400; samesite=lax`
}

export function salirDeVistaRecorrido() {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax`
}

// Para rutas que proxy.ts no gatea a nivel de servidor (p. ej. /carga-ventas
// — vendedor nunca tuvo su propia lista de rutas ahí, ver proxy.ts), el
// mismo chequeo se hace del lado del cliente.
export function leerVistaRecorridoCookie(): VistaRecorrido | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`))
  const valor = match ? decodeURIComponent(match[1]) : ''
  return valor === 'estudiante' || valor === 'profesor' || valor === 'vendedor' ? valor : null
}
