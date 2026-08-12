'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cedulaAEmail } from '@/lib/auth-helpers'
import { cedulaSchema } from '@/lib/validators'
import { MarcaZR } from '@/components/ui/Iconos'

const INICIO: Record<string, string> = {
  estudiante:  '/',
  profesor:    '/hoy',
  admin:       '/panel',
  super_admin: '/panel',
  direccion_academica: '/panel',
}

export default function Login() {
  const router = useRouter()
  const [cedula, setCedula] = useState('')
  const [password, setPassword] = useState('')
  const [esProfesorNuevo, setEsProfesorNuevo] = useState(false)
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
      .from('profiles')
      .select('role, full_name, cedula, contact_email, phone')
      .eq('id', data.user.id)
      .single()

    // "¿Eres profesor?" solo aplica a quien hoy es estudiante — alguien que
    // ya es personal simplemente entra a su interfaz normal.
    if (esProfesorNuevo && perfil?.role === 'estudiante') {
      const { data: ultima } = await supabase
        .from('professor_applications')
        .select('id, status')
        .eq('profile_id', data.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!ultima || ultima.status === 'rechazado') {
        await supabase.from('professor_applications').insert({
          profile_id: data.user.id,
          full_name: perfil.full_name,
          cedula: perfil.cedula,
          contact_email: perfil.contact_email,
          phone: perfil.phone,
        })
      }

      router.push('/solicitud-profesor')
      router.refresh()
      return
    }

    router.push(INICIO[perfil?.role ?? 'estudiante'] ?? '/')
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
          <h1 className="zr-display text-4xl text-zr-text">ZR App</h1>
          <p className="text-base font-medium text-zr-text-muted">Academia ZR Mecademy</p>
        </div>

        {/* Login Form */}
        <form onSubmit={entrar} className="space-y-5" noValidate>
          {/* Cédula Input */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-zr-text">Cédula</label>
            <input
              type="text"
              name="cedula"
              inputMode="text"
              autoComplete="username"
              placeholder="V-12345678"
              value={cedula}
              onChange={(e) => setCedula(e.target.value.toUpperCase())}
              required
              className="w-full px-5 py-4 bg-zr-surface border border-zr-border rounded-xl text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none focus:ring-2 focus:ring-zr-blue/20 transition-all text-base font-medium"
            />
            <p className="text-xs text-zr-text-muted">Con la letra y el guion, como aparece en tu cédula</p>
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-zr-text">Contraseña</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-5 py-4 bg-zr-surface border border-zr-border rounded-xl text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none focus:ring-2 focus:ring-zr-blue/20 transition-all text-base font-medium"
            />
          </div>

          {/* ¿Eres profesor? */}
          <label className="flex items-center gap-3 rounded-xl border border-zr-border bg-zr-surface px-5 py-4 cursor-pointer">
            <input
              type="checkbox"
              checked={esProfesorNuevo}
              onChange={(e) => setEsProfesorNuevo(e.target.checked)}
              className="size-5"
            />
            <span className="text-sm font-medium text-zr-text">
              ¿Eres un profesor? Marca aquí para solicitar acceso
            </span>
          </label>

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
          <Link
            href="/registro"
            className="block text-center py-3 bg-zr-surface border border-zr-border text-zr-text font-medium text-sm rounded-lg hover:border-zr-blue/50 hover:bg-zr-blue/5 transition-all"
          >
            ¿Eres nuevo? Regístrate
          </Link>
        </div>

        {/* Footer Info */}
        <div className="text-center text-xs text-zr-text-muted pt-6 border-t border-zr-border">
          <p>Acceso seguro para estudiantes, profesores y administración</p>
        </div>
      </div>
    </main>
  )
}
