'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      if (!sesion) router.replace('/login')
    })
    return () => subscription?.unsubscribe()
  }, [router])

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
      {!enExamen && <BarraFlotante items={NAV} />}
    </div>
  )
}
