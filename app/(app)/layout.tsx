'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarraFlotante, type ItemBarra } from '@/components/ui/BarraFlotante'
import { Campanita } from '@/components/ui/Campanita'
import {
  IconoInicio, IconoPerfil, IconoProgreso, IconoDocumento, IconoDuda,
} from '@/components/ui/Iconos'

// Fase 0 (docs/14_FASE0_PLAN_SPRINTS.md, Sprints 1, 3 y 4): Exámenes, Notas y
// Progreso se retiran del menú del estudiante para esta entrega, "Clases" se
// reemplaza por "Mi módulo" (misma ruta /clases, contenido nuevo) y se agrega
// Dudas. Las rutas viejas siguen existiendo en el código — no se borran —
// para retomarlas en la fase siguiente sin rehacer nada.
const NAV: ItemBarra[] = [
  { href: '/',          label: 'Inicio',    Icono: IconoInicio },
  { href: '/clases',    label: 'Mi módulo', Icono: IconoProgreso },
  { href: '/contenido', label: 'Material',  Icono: IconoDocumento },
  { href: '/dudas',     label: 'Dudas',     Icono: IconoDuda },
  { href: '/perfil',    label: 'Perfil',    Icono: IconoPerfil },
]

// Mientras administración no valida al estudiante (firma física de la
// planilla, ver docs/17_PLAN_CONSOLIDADO...), solo tiene sentido mostrarle
// dos pestañas: Inicio (con el mensaje de "en validación") y Perfil.
const NAV_PENDIENTE: ItemBarra[] = [NAV[0], NAV[4]]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [validado, setValidado] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      if (!sesion) router.replace('/login')
    })
    return () => subscription?.unsubscribe()
  }, [router])

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
  }, [pathname, router])

  // Validación de administración (firma física de la planilla): es
  // INDEPENDIENTE del formulario de arriba — el estudiante puede llenarlo
  // mientras espera. Lo que sí se restringe es la navegación: sin validar,
  // solo Inicio y Perfil tienen sentido, y cualquier otra ruta de estudiante
  // rebota a Inicio.
  useEffect(() => {
    const supabase = createClient()
    async function verificarValidacion() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: est } = await supabase
        .from('students').select('validated_at').eq('id', user.id).maybeSingle()
      const yaValidado = Boolean(est?.validated_at)
      setValidado(yaValidado)
      if (!yaValidado && pathname !== '/' && pathname !== '/perfil' && pathname !== '/completar-perfil') {
        router.replace('/')
      }
    }
    verificarValidacion()
  }, [pathname, router])

  // Dentro de un examen no se desliza: el gesto de pasar de sección chocaría
  // con el de pasar de pregunta y el estudiante saldría del examen a medias.
  const enExamen = /^\/examenes\/[^/]+$/.test(pathname)

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-zr-bg">
      {!enExamen && (
        <div className="fixed right-3 top-3 z-40 rounded-full border border-white/15 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <Campanita />
        </div>
      )}
      <div className="pb-28">{children}</div>
      {!enExamen && <BarraFlotante items={validado ? NAV : NAV_PENDIENTE} deslizable={validado} />}
    </div>
  )
}
