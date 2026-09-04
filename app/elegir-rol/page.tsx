'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MarcaZR } from '@/components/ui/Iconos'
import { ETIQUETA_ROL, INICIO_POR_ROL } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * Selector de rol activo (migración 085 — pedido explícito del coordinador):
 * una cuenta con más de un rol asignado (p. ej. Erika Hidalgo, vendedor +
 * administración) elige aquí con cuál va a trabajar esta vez, en vez de
 * necesitar una segunda cuenta — la cédula ya es única por persona.
 *
 * Solo aparece cuando hace falta: login/page.tsx manda aquí únicamente si la
 * cuenta tiene 2+ roles en profile_roles. Si alguien llega por su cuenta con
 * uno solo (o ninguno, caso imposible salvo error), se le redirige derecho a
 * su inicio — no tiene nada que elegir.
 */
export default function ElegirRol() {
  const router = useRouter()
  const [roles, setRoles] = useState<UserRole[] | null>(null)
  const [eligiendo, setEligiendo] = useState<UserRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase.from('profile_roles').select('role').eq('profile_id', user.id)
      const misRoles = (data ?? []).map((r) => r.role as UserRole)

      if (misRoles.length <= 1) {
        const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        router.replace(INICIO_POR_ROL[(perfil?.role as UserRole) ?? 'estudiante'] ?? '/')
        return
      }

      setRoles(misRoles)
    }
    cargar()
  }, [router])

  async function elegir(rol: UserRole) {
    setEligiendo(rol)
    setError(null)
    const supabase = createClient()
    const { error: fallo } = await supabase.rpc('fn_cambiar_mi_rol', { nuevo_rol: rol })

    if (fallo) {
      setError('No se pudo cambiar de rol. Intenta de nuevo.')
      setEligiendo(null)
      return
    }

    router.push(INICIO_POR_ROL[rol])
    router.refresh()
  }

  if (!roles) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center bg-zr-bg px-5">
      <div className="w-full space-y-9">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zr-border bg-zr-surface text-zr-blue">
            <MarcaZR size={30} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
            ZR App · Academia ZR Mecademy
          </p>
          <h1 className="zr-display text-4xl text-zr-text">¿Cómo quieres entrar?</h1>
          <p className="text-sm text-zr-text-muted">Tu cuenta tiene más de un rol. Elige con cuál trabajas ahora.</p>
        </div>

        <div className="space-y-3">
          {roles.map((rol) => (
            <button
              key={rol}
              onClick={() => elegir(rol)}
              disabled={eligiendo !== null}
              className="min-h-16 w-full rounded-xl border border-zr-border bg-zr-surface px-6 text-left text-lg font-bold text-zr-text transition-colors active:bg-zr-border/40 disabled:opacity-50"
            >
              {eligiendo === rol ? 'Entrando…' : ETIQUETA_ROL[rol]}
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-center text-sm font-medium text-zr-error">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
