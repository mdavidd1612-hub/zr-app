'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CASOS_HABILITADO } from '@/lib/flags'
import { Marco } from '@/components/ui/Marco'
import { BannerSimulacion } from '@/components/ui/BannerSimulacion'
import { Tour } from '@/components/ui/Tour'
import { useTour } from '@/lib/useTour'
import { PASOS_POR_ROL } from '@/lib/tour-pasos'
import { leerVistaRecorridoCookie } from '@/lib/vista-recorrido'
import { NAV_DIRECCION, TODAS_DIRECCION, TODAS_SUPER } from '@/lib/nav-direccion'
import {
  IconoPanel, IconoDuda, IconoProgreso, IconoVideo, IconoNotas, IconoPerfil,
} from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'

/**
 * El profesor también usa el teléfono. Fase 0
 * (docs/16_FASE0_PLAN_PROFESOR.md, Sprint A): Sesiones, Exámenes y Calificar
 * se retiran del menú (código intacto, se retoman en la fase siguiente).
 *
 * "Notas" se agrega al menú fijo (pedido explícito del coordinador, sept.
 * 2026) -- antes solo se llegaba desde un botón dentro de "Hoy".
 */

const NAV_BASE = [
  { href: '/hoy',                label: 'Hoy',      Icono: IconoPanel },
  { href: '/dudas-docente',      label: 'Dudas',    Icono: IconoDuda },
  { href: '/casos-docente',      label: 'Casos',    Icono: IconoProgreso },
  // Aula Virtual: antes solo se llegaba por un enlace dentro de "Material"
  // (pedido del coordinador, oct. 2026: sacarlo a la barra para que se vea).
  // "Material" se retira del menú en la reunión del 31-oct-2026 -- redundante
  // con Aula Virtual, que ya centraliza materiales, exámenes y tareas. Subir
  // y ver material sigue existiendo en /contenido-docente, pero ahora se
  // llega siempre desde dentro de una unidad (botón "+ Subir material
  // nuevo"), nunca como pestaña aparte.
  { href: '/unidades-docente',   label: 'Unidades', Icono: IconoVideo },
  { href: '/notas-docente',      label: 'Notas',    Icono: IconoNotas },
  { href: '/perfil-docente',     label: 'Perfil',    Icono: IconoPerfil },
]

// "Casos" apagado a pedido del coordinador (lib/flags.ts): la IA todavía no
// pasó revisión de los profesores. Se quita del menú, no solo de la pantalla
// — un ícono que lleva a nada confunde más que no tenerlo.
const NAV = CASOS_HABILITADO ? NAV_BASE : NAV_BASE.filter((i) => i.href !== '/casos-docente')

export default function ProfesorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [verificando, setVerificando] = useState(true)
  // Dirección académica y super_admin son "staff" de esta vista: pueden
  // administrar las Unidades como propias (RLS por is_staff() ya les permite
  // editar todo). Se guarda aparte del "recorrido deliberado" para que el
  // tutorial de profesor no se les dispare solo (soloManual), aunque entren
  // sin el banner de simulación.
  const [esStaff, setEsStaff] = useState(false)
  // Rol exacto de staff (direccion_academica vs super_admin): decide cuál de
  // los dos menús completos (TODAS_DIRECCION / TODAS_SUPER) les corresponde
  // cuando entran a Unidades como ellos mismos.
  const [rolStaff, setRolStaff] = useState<UserRole | null>(null)
  // Banner "Vista de recorrido": SOLO cuando la persona eligió a propósito
  // "Vista de profesor" desde su panel (cookie zr_vista=profesor). Pedido
  // explícito del coordinador (nov. 2026): al entrar por "Unidades" de su
  // propio menú, super_admin y dirección entran COMO ELLOS MISMOS, pudiendo
  // modificar todo, no como una simulación del profesor.
  const [enRecorrido, setEnRecorrido] = useState(false)

  // La pantalla de escaneo necesita cada centímetro: es la que se usa de
  // pie, con una mano, mientras entran los estudiantes. La barra flotante
  // encima le robaría espacio a la cámara y a la franja de resultado.
  const escaneando = /^\/escanear\//.test(pathname)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    // Bug real reportado por el coordinador (7-nov-2026): al navegar entre
    // pantallas del profesor/Unidades, una falla transitoria de red al leer
    // el rol (p. ej. un refresco de sesión a mitad de la consulta) hacía que
    // `perfil` llegara vacío, y el código lo trataba como "rol no permitido"
    // -- expulsaba a Dirección/super_admin a "/" (que termina en su propio
    // panel) en pleno uso, sin haber confirmado de verdad que no tenía
    // acceso. Ahora se distingue "no se pudo confirmar todavía" (se
    // reintenta, sin expulsar a nadie) de "se confirmó que el rol no es
    // ninguno de los permitidos" (ahí sí se va). Máximo 3 intentos con una
    // pausa corta; si de verdad no hay sesión, `getUser()` ya manda a login.
    async function verificarRol(intento = 0) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!vigente) return
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil, error: errorPerfil } = await supabase
        .from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (!vigente) return

      if ((errorPerfil || !perfil) && intento < 2) {
        setTimeout(() => { if (vigente) verificarRol(intento + 1) }, 400)
        return
      }

      const rol = perfil?.role as UserRole | undefined
      if (rol === 'super_admin' || rol === 'direccion_academica') {
        setEsStaff(true)
        setRolStaff(rol)
        // El banner solo si vienen de elegir "Vista de profesor" a propósito.
        setEnRecorrido(leerVistaRecorridoCookie() === 'profesor')
      }

      // Un estudiante (o administración, que no tiene vista de profesor) que
      // escriba /calificar en la barra de direcciones se va a su pantalla. La
      // RLS ya lo bloquea en la base; esto solo evita que vea un panel vacío
      // y crea que la app está rota. Solo expulsa con el rol YA confirmado
      // -- nunca por una consulta que todavía no respondió bien.
      if (!perfil) return
      if (rol !== 'profesor' && rol !== 'direccion_academica' && rol !== 'super_admin') {
        router.replace('/')
        return
      }

      setVerificando(false)
    }

    verificarRol()
    return () => { vigente = false }
  }, [router])

  // Tour guiado (migración 173, pedido explícito del coordinador): TAMBIÉN
  // en la vista de recorrido -- Dirección Académica y super_admin tienen que
  // poder verlo sin entrar a una cuenta de profesor de verdad, que es
  // justo para lo que existe esa vista. Se guarda en el propio
  // profiles.tour_pasos_vistos de quien está recorriendo (los IDs ya llevan
  // el prefijo del rol -- "profesor-...", nunca chocan con los suyos).
  const { pasos: pasosTour, incremental: tourIncremental, terminar: terminarTour } =
    useTour(PASOS_POR_ROL.profesor, !verificando, esStaff)

  if (verificando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Verificando acceso…</p>
      </div>
    )
  }

  // Dirección/super_admin entrando COMO ELLOS MISMOS (no simulando al
  // profesor): conservan su propio menú completo -- con "Unidades"
  // resaltado -- en vez de perder Panel, Asistencia, Personal, Cohortes,
  // Notas académicas, etc. Bug real reportado por el coordinador
  // (7-nov-2026): el fix anterior solo quitó el banner de simulación, pero
  // la barra lateral seguía siendo la reducida del profesor.
  const propioMenu = esStaff && !enRecorrido
  const itemsBarra = propioMenu ? NAV_DIRECCION : NAV
  const todasLasSecciones = propioMenu
    ? (rolStaff === 'super_admin' ? TODAS_SUPER : TODAS_DIRECCION)
    : undefined

  return (
    <Marco items={itemsBarra} todasLasSecciones={todasLasSecciones} sinNavegacion={escaneando}>
      {enRecorrido && <BannerSimulacion etiqueta="Profesor" />}
      {children}
      {pasosTour && <Tour pasos={pasosTour} incremental={tourIncremental} onTerminado={terminarTour} />}
    </Marco>
  )
}
