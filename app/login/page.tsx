'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cedulaAEmail } from '@/lib/auth-helpers'
import { cedulaSchema } from '@/lib/validators'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { Aviso } from '@/components/ui/Aviso'

const INICIO: Record<string, string> = {
  estudiante:  '/carnet',
  profesor:    '/hoy',
  admin:       '/panel',
  super_admin: '/panel',
}

export default function Login() {
  const router = useRouter()
  const [cedula, setCedula] = useState('')
  const [password, setPassword] = useState('')
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

    router.push(INICIO[perfil?.role ?? 'estudiante'] ?? '/carnet')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-4">
      <header className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-zr-blue to-zr-blue-deep bg-clip-text text-transparent">ZR App</h1>
        <p className="text-base text-zr-text-muted mt-1">Academia ZR Mecademy</p>
      </header>

      <form onSubmit={entrar} className="glass flex flex-col gap-4 p-6 rounded-2xl" noValidate>
        <Campo
          etiqueta="Cédula"
          name="cedula"
          inputMode="text"
          autoComplete="username"
          placeholder="V-12345678"
          value={cedula}
          // Se pasa a mayúsculas sola: nadie escribe la v mayúscula a propósito.
          onChange={(e) => setCedula(e.target.value.toUpperCase())}
          ayuda="Con la letra y el guion, como aparece en tu cédula"
          required
        />

        <Campo
          etiqueta="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <Aviso tipo="error">{error}</Aviso>}

        <Boton type="submit" tamano="grande" anchoCompleto cargando={cargando}>
          Entrar
        </Boton>
      </form>

      <div className="flex flex-col items-center gap-3">
        <Link href="/recuperar" className="text-base text-zr-blue-deep underline underline-offset-4">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link href="/registro" className="text-base text-zr-blue-deep underline underline-offset-4">
          ¿Eres nuevo? Regístrate
        </Link>
      </div>
    </main>
  )
}
