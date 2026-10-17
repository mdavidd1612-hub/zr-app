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
// Cohorte elegida por quien está recorriendo (bug reportado por el
// coordinador, oct. 2026): sin esto, cada pantalla de "Vista de Estudiante"
// improvisaba su propia cohorte "de prueba" (la más poblada, o la primera
// que encontrara) sin que la persona pudiera elegir cuál -- "lo estamos
// viendo como que es general". Ahora se elige UNA vez, en el panel, antes de
// entrar, y todas las pantallas de esa vista respetan la misma elección.
const COOKIE_COHORTE = 'zr_vista_cohorte'
// Módulo elegido dentro del programa (pedido explícito del coordinador, oct.
// 2026): antes solo se podía elegir el PROGRAMA y todo caía al módulo
// vigente de esa cohorte -- Dirección Académica y super_admin no podían
// revisar Material o Notas de un módulo ya cursado o futuro. Ahora el panel
// pide programa y, aparte, módulo (ver app/(admin)/panel/page.tsx).
const COOKIE_MODULO = 'zr_vista_modulo'

export type VistaRecorrido = 'estudiante' | 'profesor' | 'vendedor'

export function activarVistaRecorrido(vista: VistaRecorrido, cohortId?: string, moduleId?: string) {
  if (typeof document === 'undefined') return
  // 4 horas: alcanza de sobra para una sesión de trabajo, pero no se queda
  // pegada para siempre si alguien se olvida de salir.
  document.cookie = `${COOKIE}=${vista}; path=/; max-age=14400; samesite=lax`
  if (cohortId) {
    document.cookie = `${COOKIE_COHORTE}=${cohortId}; path=/; max-age=14400; samesite=lax`
  } else {
    document.cookie = `${COOKIE_COHORTE}=; path=/; max-age=0; samesite=lax`
  }
  if (moduleId) {
    document.cookie = `${COOKIE_MODULO}=${moduleId}; path=/; max-age=14400; samesite=lax`
  } else {
    document.cookie = `${COOKIE_MODULO}=; path=/; max-age=0; samesite=lax`
  }
}

export function salirDeVistaRecorrido() {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax`
  document.cookie = `${COOKIE_COHORTE}=; path=/; max-age=0; samesite=lax`
  document.cookie = `${COOKIE_MODULO}=; path=/; max-age=0; samesite=lax`
}

// Para las pantallas de estudiante que, en vista de recorrido, necesitan
// saber qué cohorte elegir (Inicio, Mi módulo, Malla, Material) -- ver nota
// de COOKIE_COHORTE arriba.
export function leerCohorteVistaRecorridoCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_COHORTE}=([^;]*)`))
  const valor = match ? decodeURIComponent(match[1]) : ''
  return valor || null
}

// El módulo elegido dentro de ese programa -- ver nota de COOKIE_MODULO
// arriba. Puede no estar presente (sesiones viejas, antes de este cambio);
// las pantallas caen al módulo vigente de la cohorte en ese caso.
export function leerModuloVistaRecorridoCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_MODULO}=([^;]*)`))
  const valor = match ? decodeURIComponent(match[1]) : ''
  return valor || null
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
