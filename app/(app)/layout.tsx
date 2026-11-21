'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type ItemBarra } from '@/components/ui/BarraFlotante'
import { Marco } from '@/components/ui/Marco'
import { BannerSimulacion } from '@/components/ui/BannerSimulacion'
import { Tour } from '@/components/ui/Tour'
import { useTour } from '@/lib/useTour'
import { PASOS_POR_ROL } from '@/lib/tour-pasos'
import { BannerNoSolvente, ModalNoSolvente } from '@/components/ui/AvisoSolvencia'
import { ResultadoModulo } from '@/components/ui/ResultadoModulo'
import { ActualizacionObligatoria } from '@/components/ui/ActualizacionObligatoria'
import { ACTUALIZACION_OBLIGATORIA } from '@/lib/version'
import {
  IconoInicio, IconoPerfil, IconoVideo, IconoDuda, IconoNotas,
} from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'

// Fase 0 (docs/14_FASE0_PLAN_SPRINTS.md, Sprints 1, 3 y 4): Exámenes, Notas y
// Progreso se retiran del menú del estudiante para esta entrega, "Clases" se
// reemplaza por "Mi módulo" (el módulo que se está cursando, resumen largo)
// y se agrega Dudas. La malla curricular completa (los 14 módulos, resumen
// corto) se ve desde dentro de Mi módulo, no tiene ícono propio en la barra
// — dos entradas para lo mismo confundía más de lo que ayudaba. Las rutas
// viejas siguen existiendo en el código — no se borran — para retomarlas en
// la fase siguiente sin rehacer nada.
//
// "Aula" (Aula Virtual, migraciones 174-182): antes solo se llegaba por un
// enlace escondido dentro de "Mi módulo" -- el estudiante no tenía forma de
// saber que ahí vivía lo que el profesor organizaba (reporte real del
// coordinador, oct. 2026: "el estudiante no ve nada de lo que hace el
// profesor"). Se saca a la barra, igual que en el menú del profesor.
//
// "Material" se retira del menú en la reunión del 31-oct-2026 -- redundante
// con Aula Virtual, que ya muestra todos los materiales organizados por
// unidad. La pantalla /contenido sigue existiendo en el código (no se
// borra), solo deja de ser pestaña del menú.
const NAV: ItemBarra[] = [
  // Barra de 5 (19-nov-2026, propuesta E): "Mi módulo" (con Malla y Mi
  // progreso como pestañas) se abre desde una tarjeta de Inicio.
  { href: '/',          label: 'Inicio',    Icono: IconoInicio, tambienEn: ['/clases', '/malla', '/progreso'] },
  { href: '/unidades',  label: 'Unidades',  Icono: IconoVideo, tambienEn: ['/examenes', '/descargas', '/calendario'] },
  { href: '/notas',     label: 'Notas',     Icono: IconoNotas },
  { href: '/dudas',     label: 'Dudas',     Icono: IconoDuda },
  { href: '/perfil',    label: 'Perfil',    Icono: IconoPerfil },
]

// Mientras administración no valida al estudiante (firma física de la
// planilla, ver docs/17_PLAN_CONSOLIDADO...), solo tiene sentido mostrarle
// dos pestañas: Inicio (con el mensaje de "en validación") y Perfil.
const NAV_PENDIENTE: ItemBarra[] = [NAV[0], NAV[NAV.length - 1]]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [validado, setValidado] = useState(true)
  // `undefined` = todavía no se sabe. Todo lo demás en este layout (formulario
  // de primer login, términos, validación) espera a saber el rol antes de
  // decidir nada — así administración/dirección académica/super_admin, que
  // no tienen fila en `students` ni en `student_profile_details`, no caen en
  // esas pantallas al usar la vista de recorrido (a pedido explícito del
  // coordinador: los tres pueden recorrer la vista de estudiante).
  const [rol, setRol] = useState<UserRole | null | undefined>(undefined)
  const simulando = rol === 'super_admin' || rol === 'admin' || rol === 'direccion_academica'

  // Solvencia (finanzas, migraciones 115/128/140): un estudiante 'no_solvente'
  // queda bloqueado en TODA la app salvo Perfil. La base ya no le entrega
  // material ni notas y los servidores rechazan asistencia y refrigerio; esto
  // pone las secciones en gris y le explica qué hacer.
  const [noSolvente, setNoSolvente] = useState(false)
  const [whatsapp, setWhatsapp] = useState<string | null>(null)
  const [avisoAbierto, setAvisoAbierto] = useState(false)
  const [avisoVisto, setAvisoVisto] = useState(false)

  // Bug real de producción (sept. 2026): durante el formulario de primer
  // ingreso o aceptar términos no se puede mostrar el tour -- ver el bug
  // documentado en components/ui/Tour.tsx (si llega a montarse ahí, deja el
  // scroll de esa pantalla bloqueado aunque no dibuje nada visible).
  const enOnboarding = pathname === '/completar-perfil' || pathname === '/aceptar-terminos'

  // Tour guiado (migración 173, pedido explícito del coordinador): vive
  // aquí, no en una page.tsx suelta, para que su progreso sobreviva la
  // navegación entre Inicio, Mi módulo, Material, Dudas y Perfil — un
  // layout no se remonta al cambiar de ruta dentro del mismo grupo. TAMBIÉN
  // en la vista de recorrido -- administración, Dirección Académica y
  // super_admin tienen que poder verlo sin entrar a una cuenta de
  // estudiante de verdad, que es justo para lo que existe esa vista (se
  // guarda en el propio profiles.tour_pasos_vistos de quien está
  // recorriendo; los IDs llevan el prefijo del rol, nunca chocan).
  // Actualización obligatoria (21-nov-2026, pedido del coordinador): antes del
  // tutorial, una pantalla que no se puede cerrar anuncia la actualización, la
  // "instala" con una animación y lleva al tutorial sin "Omitir". Sale una vez
  // por estudiante por cada ACTUALIZACION_OBLIGATORIA (lib/version.ts).
  // 'revisando' pausa el tutorial hasta saber si toca mostrarla.
  const [actualizacion, setActualizacion] = useState<'revisando' | 'mostrar' | 'no'>('revisando')
  const [tourObligatorio, setTourObligatorio] = useState(false)
  const claveActualizacion = `actualizacion:${ACTUALIZACION_OBLIGATORIA}`

  const { pasos: pasosTour, incremental: tourIncremental, terminar: terminarTour } =
    useTour(PASOS_POR_ROL.estudiante, rol !== undefined && rol !== null && validado && !enOnboarding, simulando, {
      pausado: actualizacion !== 'no',
      completoSiNoHayNuevos: tourObligatorio,
    })

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      if (!sesion) router.replace('/login')
    })
    return () => subscription?.unsubscribe()
  }, [router])

  useEffect(() => {
    const supabase = createClient()
    async function cargarRol() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRol((perfil?.role as UserRole) ?? null)
    }
    cargarRol()
  }, [])

  // Formulario del primer login (Sprint 6, docs/17_...): mientras el
  // estudiante no lo llene, no puede usar el resto de la app.
  //
  // OJO: esto NO se puede leer de students.onboarding_status. Ese campo es
  // de antes de este sprint (registro/registro/consentimiento ya lo ponían
  // en 'completo' apenas terminaba el registro básico, sin pasar por este
  // formulario) — reusarlo aquí hacía que cualquiera que se registrara
  // entrara derecho a la app sin llenar nada. La señal real es si ya existe
  // su fila en student_profile_details.
  useEffect(() => {
    if (rol === undefined || simulando) return
    if (pathname === '/completar-perfil') return
    const supabase = createClient()
    async function verificarPerfilCompleto() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: yaLleno } = await supabase
        .from('student_profile_details').select('id').eq('student_id', user.id).maybeSingle()
      if (!yaLleno) router.replace('/completar-perfil')
    }
    verificarPerfilCompleto()
  }, [pathname, router, rol, simulando])

  // Términos y condiciones (B-1, docs/18_BRECHAS_SPEC_FUNCIONAL_ZRM.md, spec
  // §20): independiente del formulario de arriba. Si system_config sube
  // terms.version, el estudiante cae aquí de nuevo en su próximo ingreso,
  // sin importar que ya haya aceptado una versión anterior.
  useEffect(() => {
    if (rol === undefined || simulando) return
    if (pathname === '/completar-perfil' || pathname === '/aceptar-terminos') return
    const supabase = createClient()
    async function verificarTerminos() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: version } = await supabase
        .from('system_config').select('value').eq('key', 'terms.version').maybeSingle()
      const versionVigente = Number(version?.value ?? 1)

      const { data: aceptado } = await supabase
        .from('terms_acceptances').select('id')
        .eq('user_id', user.id).eq('terms_version', versionVigente).maybeSingle()

      if (!aceptado) router.replace('/aceptar-terminos')
    }
    verificarTerminos()
  }, [pathname, router, rol, simulando])

  // Validación de administración (firma física de la planilla): es
  // INDEPENDIENTE de lo de arriba — el estudiante puede llenar su formulario
  // y aceptar términos mientras espera. Lo que sí se restringe es la
  // navegación: sin validar, solo Inicio y Perfil tienen sentido, y
  // cualquier otra ruta de estudiante rebota a Inicio.
  useEffect(() => {
    if (rol === undefined) return
    if (simulando) { setValidado(true); return }
    const supabase = createClient()
    async function verificarValidacion() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: est } = await supabase
        .from('students').select('validated_at').eq('id', user.id).maybeSingle()
      const yaValidado = Boolean(est?.validated_at)
      setValidado(yaValidado)
      const rutasPermitidasPendiente = ['/', '/perfil', '/completar-perfil', '/aceptar-terminos']
      if (!yaValidado && !rutasPermitidasPendiente.includes(pathname)) {
        router.replace('/')
      }
    }
    verificarValidacion()
  }, [pathname, router, rol, simulando])

  useEffect(() => {
    if (rol === undefined || simulando) return
    const supabase = createClient()
    async function revisarSolvencia() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: est } = await supabase.from('students').select('payment_status').eq('id', user.id).maybeSingle()
      const bloqueado = est?.payment_status === 'no_solvente'
      setNoSolvente(bloqueado)
      if (bloqueado) {
        const { data: cfg } = await supabase
          .from('system_config').select('value').eq('key', 'finanzas.whatsapp_administracion').maybeSingle()
        if (cfg?.value) setWhatsapp(String(cfg.value))
      }
    }
    revisarSolvencia()
    // Administración puede cambiar el estado mientras la app está abierta.
    const alVolver = () => { if (document.visibilityState === 'visible') revisarSolvencia() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [rol, simulando, pathname])

  useEffect(() => {
    if (rol === undefined || actualizacion !== 'revisando') return
    if (rol !== 'estudiante' || simulando) { setActualizacion('no'); return } // eslint-disable-line react-hooks/set-state-in-effect
    // Mientras llena su perfil, acepta términos o espera validación, el
    // tutorial tampoco corre: se decide después.
    if (!validado || enOnboarding) return
    // Un estudiante sin solvencia no puede abrir lo que enseña el tutorial; la
    // verá cuando vuelva a estar solvente.
    if (noSolvente) { setActualizacion('no'); return }
    const supabase = createClient()
    async function revisarActualizacion() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase
        .from('profiles').select('tour_pasos_vistos').eq('id', user.id).maybeSingle()
      const vistos: string[] = perfil?.tour_pasos_vistos ?? []
      if (vistos.includes(claveActualizacion)) { setActualizacion('no'); return }
      // Estudiante nuevo (nunca vio el tutorial): no hay nada que "actualizar";
      // ve la bienvenida normal y no se le muestra esta pantalla.
      if (vistos.length === 0) {
        await supabase.rpc('fn_marcar_pasos_tour_vistos', { p_pasos: [claveActualizacion] })
        setActualizacion('no')
        return
      }
      setActualizacion('mostrar')
    }
    revisarActualizacion()
  }, [rol, simulando, validado, enOnboarding, noSolvente, actualizacion, claveActualizacion])

  async function terminarActualizacion() {
    await createClient().rpc('fn_marcar_pasos_tour_vistos', { p_pasos: [claveActualizacion] })
    setTourObligatorio(true)
    setActualizacion('no')
  }

  async function terminarTutorial() {
    await terminarTour()
    setTourObligatorio(false)
  }

  const rutaPermitidaSiBloqueado =
    pathname === '/' || pathname.startsWith('/perfil') || pathname === '/completar-perfil' || pathname === '/aceptar-terminos'

  // Al entrar a Inicio bloqueado, el mensaje sale una vez por sesión; si toca
  // una sección en gris (o llega a una ruta bloqueada), sale siempre.
  useEffect(() => {
    if (!noSolvente) { setAvisoAbierto(false); return }
    if (!rutaPermitidaSiBloqueado) {
      router.replace('/')
      setAvisoAbierto(true)
      return
    }
    if (pathname === '/' && !avisoVisto) {
      try {
        if (!sessionStorage.getItem('zr_bloqueo_visto')) setAvisoAbierto(true)
      } catch { setAvisoAbierto(true) }
    }
  }, [noSolvente, pathname, rutaPermitidaSiBloqueado, avisoVisto, router])

  function entendido() {
    try { sessionStorage.setItem('zr_bloqueo_visto', '1') } catch { /* sin almacenamiento: no es crítico */ }
    setAvisoVisto(true)
    setAvisoAbierto(false)
  }

  // Secciones bloqueadas: todas menos Inicio y Perfil.
  const itemsVista = noSolvente
    ? NAV.map((i) => (i.href === '/' || i.href === '/perfil' ? i : { ...i, bloqueado: true }))
    : NAV

  // Dentro de un examen no se desliza: el gesto de pasar de sección chocaría
  // con el de pasar de pregunta y el estudiante saldría del examen a medias.
  const enExamen = /^\/examenes\/[^/]+$/.test(pathname)

  // `enOnboarding` (definido arriba, junto al tour) también oculta la barra
  // de navegación: bug real de producción (sept. 2026) -- con la barra
  // visible durante el formulario de primer ingreso, el estudiante tocaba
  // "Perfil" o "Dudas" a mitad de llenarlo y la app lo rebotaba de vuelta
  // de forma confusa.
  //
  // Sin la barra de navegación durante el onboarding (arreglo de arriba),
  // no queda ninguna forma de cerrar sesión si hace falta salir a mitad de
  // camino -- a pedido explícito del coordinador, después de quedarse sin
  // salida probando la cuenta de un estudiante real.
  async function salir() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <Marco
      items={validado ? itemsVista : NAV_PENDIENTE}
      deslizable={validado}
      sinNavegacion={enExamen || enOnboarding}
      alTocarBloqueado={() => setAvisoAbierto(true)}
    >
      {rol === 'estudiante' && validado && !noSolvente && <ResultadoModulo />}
      {noSolvente && !avisoAbierto && <BannerNoSolvente whatsapp={whatsapp} />}
      {noSolvente && avisoAbierto && <ModalNoSolvente whatsapp={whatsapp} onEntendido={entendido} />}
      {enOnboarding && (
        <button
          onClick={salir}
          className="fixed right-3 z-50 rounded-full bg-zr-error px-4 py-2 text-xs font-bold text-white shadow-lg lg:absolute lg:right-8 lg:top-8"
          style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          Salir
        </button>
      )}
      {simulando && <BannerSimulacion etiqueta="Estudiante" />}
      {children}
      {actualizacion === 'mostrar' && <ActualizacionObligatoria onTerminar={terminarActualizacion} />}
      {pasosTour && (
        <Tour pasos={pasosTour} incremental={tourIncremental} onTerminado={terminarTutorial} obligatorio={tourObligatorio} />
      )}
    </Marco>
  )
}
