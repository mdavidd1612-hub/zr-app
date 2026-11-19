'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cargarAgenda, type Agenda } from '@/lib/agenda'
import { IconoCalendario } from '@/components/ui/Iconos'

/**
 * Botón del calendario junto a la campanita (estudiante y profesor): al tocarlo
 * se abre la página del calendario completo (cuadrícula de mes con el detalle de
 * cada día). Un punto avisa cuando hay algo en las próximas 48 horas. Los demás
 * roles no lo ven.
 */
export function CalendarioFlotante() {
  const router = useRouter()
  const [agenda, setAgenda] = useState<Agenda | null>(null)

  useEffect(() => {
    let vigente = true
    cargarAgenda(createClient()).then((a) => { if (vigente) setAgenda(a) }).catch(() => {})
    return () => { vigente = false }
  }, [])

  if (!agenda || (agenda.rol !== 'estudiante' && agenda.rol !== 'profesor')) return null

  const ahora = Date.now()
  const cercano = agenda.items.some((i) => {
    const t = new Date(i.fecha).getTime()
    return t >= ahora - 3_600_000 && t - ahora < 48 * 3_600_000
  })

  return (
    <button
      onClick={() => router.push(agenda.rol === 'profesor' ? '/calendario-docente' : '/calendario')}
      aria-label="Abrir calendario"
      className="relative flex h-11 w-11 items-center justify-center text-zr-text"
    >
      <IconoCalendario size={20} />
      {cercano && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-zr-warning ring-2 ring-zr-bg" />}
    </button>
  )
}
