'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarraFlotante } from '@/components/ui/BarraFlotante'
import { IconoInicio, IconoExamen, IconoProgreso, IconoPerfil } from '@/components/ui/Iconos'

// Cuatro botones, ni uno más: spec/04 §1. Clases, Material y Notas se alcanzan
// desde la rejilla de accesos del inicio — están a un toque igual, y meterlos
// aquí dejaría cada botón por debajo del área táctil mínima de 48 px.
const NAV = [
  { href: '/',         label: 'Inicio',   Icono: IconoInicio },
  { href: '/examenes', label: 'Exámenes', Icono: IconoExamen },
  { href: '/progreso', label: 'Progreso', Icono: IconoProgreso },
  { href: '/perfil',   label: 'Perfil',   Icono: IconoPerfil },
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
      <div className="pb-28">{children}</div>
      {!enExamen && <BarraFlotante items={NAV} />}
    </div>
  )
}
