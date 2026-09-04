'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cedulaAEmail, INICIO_POR_ROL } from '@/lib/auth-helpers'
import { cedulaSchema } from '@/lib/validators'
import { MarcaZR, IconoOjo, IconoOjoTachado } from '@/components/ui/Iconos'
import { SelectorCedula } from '@/components/ui/SelectorCedula'

export default function Login() {
  const router = useRouter()
  const [cedula, setCedula] = useState('V-')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validada = cedulaSchema.safeParse(cedula)
    if (!validada.success) {
      setError(validada.error.issues[0].message)
      return
    }

    setCargando(true)
    const supabase = createClient()

    const { data, error: fallo } = await supabase.auth.signInWithPassword({
      email: cedulaAEmail(validada.data),
      password,
    })

    if (fallo || !data.user) {
      // Un solo mensaje, siempre el mismo. Decir cuál de los dos falló le
      // regala a un atacante la confirmación de qué cédulas están registradas.
      setError('Cédula o contraseña incorrecta')
      setCargando(false)
      return
    }

    const { data: perfil } = await supabase
      .from('profiles').select('role').eq('id', data.user.id).single()

    // Cuentas con más de un rol asignado (p. ej. vendedor + administración,
    // migración 085 — pedido explícito del coordinador): no se entra directo,
    // se le pregunta con cuál de los dos quiere trabajar esta vez.
    const { count } = await supabase
      .from('profile_roles').select('*', { count: 'exact', head: true }).eq('profile_id', data.user.id)

    if ((count ?? 0) > 1) {
      router.push('/elegir-rol')
      return
    }

    router.push(INICIO_POR_ROL[perfil?.role ?? 'estudiante'] ?? '/')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center bg-zr-bg px-5">
      <div className="w-full space-y-9">
        {/* Cabecera */}
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zr-border bg-zr-surface text-zr-blue">
            <MarcaZR size={30} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
            ZR App · Academia ZR Mecademy
          </p>
          <h1 className="zr-display text-4xl text-zr-text">Iniciar sesión</h1>
        </div>

        {/* Login Form */}
        <form onSubmit={entrar} className="space-y-5" noValidate>
          {/* Cédula Input */}
          <SelectorCedula etiqueta="Cédula" value={cedula} onChange={setCedula} required />

          {/* Password Input */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-zr-text">Contraseña</label>
            <div className="relative">
              <input
                type={verPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-5 py-4 pr-14 bg-zr-surface border border-zr-border rounded-xl text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none focus:ring-2 focus:ring-zr-blue/20 transition-all text-base font-medium"
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={verPassword}
                className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-zr-text-muted hover:text-zr-text"
              >
                {verPassword ? <IconoOjoTachado size={22} /> : <IconoOjo size={22} />}
              </button>
            </div>
            <p className="text-xs text-zr-text-muted">
              Si eres estudiante y es tu primera vez, es el código de tu carnet (ej. PTMA-2026-02-001).
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-zr-error/15 border border-zr-error/30 text-zr-error rounded-lg p-4 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={cargando}
            className="w-full py-4 bg-gradient-to-r from-zr-blue to-zr-blue-deep text-white rounded-xl font-bold text-base hover:shadow-lg hover:shadow-zr-blue/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-6"
          >
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Links */}
        <div className="space-y-3">
          <Link
            href="/recuperar"
            className="block text-center py-3 text-zr-blue font-medium text-sm hover:text-zr-blue-light transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {/* Footer Info */}
        <div className="text-center text-xs text-zr-text-muted pt-6 border-t border-zr-border">
          <p>Las cuentas las crea administración o ventas. Si eres estudiante nuevo,
          tu clave es el código de tu carnet — lo recibiste en tu planilla de inscripción.</p>
        </div>
      </div>
    </main>
  )
}
