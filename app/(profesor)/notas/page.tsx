'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Índice de `/notas` -- pedido explícito del coordinador (sept. 2026): que
 * Notas viva en el menú fijo del profesor, no solo como un botón dentro de
 * "Hoy". Un profesor normalmente da una sola cohorte, así que si solo tiene
 * una, entra directo; si tiene varias, elige.
 */

interface Cohorte { id: string; nombre: string; moduloNombre: string | null }

export default function NotasIndice() {
  const router = useRouter()
  const [cohortes, setCohortes] = useState<Cohorte[] | null>(null)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('cohorts')
        .select('id, name, modules(name)')
        .eq('teacher_id', user.id)
        .eq('status', 'activa')

      if (!vigente) return

      const filas = ((data ?? []) as unknown as { id: string; name: string; modules: { name: string } | null }[])
        .map((c) => ({ id: c.id, nombre: c.name, moduloNombre: c.modules?.name ?? null }))

      if (filas.length === 1) {
        router.replace(`/notas/${filas[0].id}`)
        return
      }

      setCohortes(filas)
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  if (cohortes === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-5 pt-14 pb-10">
      <BotonVolver href="/hoy" />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Notas</p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">Tus cohortes</h1>
      </header>

      {cohortes.length === 0 ? (
        <EstadoVacio titulo="Sin cohorte asignada" explicacion="Todavía no tienes una cohorte activa a tu cargo." />
      ) : (
        <div className="space-y-3">
          {cohortes.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/notas/${c.id}`)}
              className="zr-card zr-card-interactive flex w-full items-center justify-between gap-3 p-5 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-zr-text">{c.nombre}</p>
                {c.moduloNombre && <p className="mt-0.5 text-sm text-zr-text-muted">{c.moduloNombre}</p>}
              </div>
              <span className="shrink-0 text-zr-text-muted">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
