'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Seccion } from '@/components/ui/Editorial'
import { ETIQUETA_ROL, INICIO_POR_ROL } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * Cambiar de rol activo desde el propio perfil (migración 085) — antes solo
 * se podía elegir al iniciar sesión (app/elegir-rol); pedido explícito del
 * coordinador para no tener que cerrar sesión y volver a entrar cada vez que
 * alguien con más de un rol (p. ej. Erika Hidalgo, vendedor + admin)
 * necesita cambiar. No se muestra nada si la cuenta tiene un solo rol.
 */
export function CambiarRol({ rolActual, numero }: { rolActual: UserRole; numero: number }) {
  const router = useRouter()
  const [otrosRoles, setOtrosRoles] = useState<UserRole[]>([])
  const [cambiando, setCambiando] = useState<UserRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profile_roles').select('role').eq('profile_id', user.id)
      if (!vigente) return
      setOtrosRoles((data ?? []).map((r) => r.role as UserRole).filter((r) => r !== rolActual))
    }
    cargar()
    return () => { vigente = false }
  }, [rolActual])

  async function cambiar(rol: UserRole) {
    setCambiando(rol)
    setError(null)
    const supabase = createClient()
    const { error: fallo } = await supabase.rpc('fn_cambiar_mi_rol', { nuevo_rol: rol })

    if (fallo) {
      console.error('fn_cambiar_mi_rol:', fallo)
      setError('No se pudo cambiar de rol. Intenta de nuevo.')
      setCambiando(null)
      return
    }

    router.push(INICIO_POR_ROL[rol])
    router.refresh()
  }

  if (otrosRoles.length === 0) return null

  return (
    <Seccion numero={numero} titulo="Cambiar de rol" delay={280}>
      <div className="space-y-2">
        {otrosRoles.map((rol) => (
          <button
            key={rol}
            onClick={() => cambiar(rol)}
            disabled={cambiando !== null}
            className="zr-card zr-card-interactive flex w-full items-center justify-between gap-3 p-5 text-left disabled:opacity-60"
          >
            <div>
              <p className="text-sm font-semibold text-zr-text">Entrar como {ETIQUETA_ROL[rol]}</p>
              <p className="mt-0.5 text-xs text-zr-text-muted">Tu cuenta también tiene este rol asignado.</p>
            </div>
            <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-zr-blue-mid">
              {cambiando === rol ? '…' : '›'}
            </span>
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm font-medium text-zr-error">{error}</p>}
    </Seccion>
  )
}
