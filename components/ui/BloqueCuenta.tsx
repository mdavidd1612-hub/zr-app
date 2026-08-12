'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconoSalir } from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'

/**
 * Identidad de quien está dentro y la puerta de salida.
 *
 * Va en el /perfil de los tres roles. Antes solo el estudiante tenía dónde
 * cerrar sesión: un profesor que entraba en el teléfono equivocado se quedaba
 * dentro hasta que expirara el token.
 */

const NOMBRE_ROL: Record<UserRole, string> = {
  estudiante:  'Estudiante',
  profesor:    'Profesor',
  admin:       'Administración',
  super_admin: 'Super admin',
  direccion_academica: 'Dirección académica',
}

interface Props {
  nombre: string
  cedula: string
  rol: UserRole
  correo?: string | null
}

export function BloqueCuenta({ nombre, cedula, rol, correo }: Props) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    setSaliendo(true)
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="space-y-4">
      <div className="zr-card divide-y divide-zr-border">
        <Fila etiqueta="Nombre" valor={nombre} />
        <Fila etiqueta="Cédula" valor={cedula} mono />
        <Fila etiqueta="Rol" valor={NOMBRE_ROL[rol]} />
        {correo && <Fila etiqueta="Correo" valor={correo} />}
      </div>

      {!confirmando ? (
        <button
          onClick={() => setConfirmando(true)}
          className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-lg border border-zr-border px-6 text-base font-semibold text-zr-text transition-colors active:border-zr-error/40 active:text-zr-error"
        >
          <IconoSalir size={20} />
          Cerrar sesión
        </button>
      ) : (
        <div className="zr-card space-y-4 p-5">
          <p className="text-sm text-zr-text-muted">
            Tendrás que escribir tu cédula y contraseña otra vez para volver a entrar.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmando(false)}
              className="min-h-14 flex-1 rounded-lg border border-zr-border text-base font-semibold text-zr-text"
            >
              Quedarme
            </button>
            <button
              onClick={salir}
              disabled={saliendo}
              className="min-h-14 flex-1 rounded-lg bg-zr-error/15 text-base font-bold text-zr-error disabled:opacity-50"
            >
              {saliendo ? 'Saliendo…' : 'Salir'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Fila({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-4">
      <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-zr-text-muted">
        {etiqueta}
      </span>
      <span className={`min-w-0 truncate text-right text-base text-zr-text ${mono ? 'tabular-nums' : ''}`}>
        {valor}
      </span>
    </div>
  )
}
