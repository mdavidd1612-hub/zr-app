'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cedulaSchema } from '@/lib/validators'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { Aviso } from '@/components/ui/Aviso'

export default function Recuperar() {
  const [cedula, setCedula] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function recuperar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validada = cedulaSchema.safeParse(cedula)
    if (!validada.success) {
      setError(validada.error.issues[0].message)
      return
    }

    setCargando(true)
    const supabase = createClient()

    // Supabase envía el link al correo de contacto del usuario, no al sintético
    // Eso ya lo sabe la base de datos
    const { error: fallo } = await supabase.auth.resetPasswordForEmail(
      `${validada.data}@estudiante.zrmecademy.com`
    )

    if (fallo) {
      setError('No pudimos enviar el correo. Verifica que la cédula sea correcta.')
      setCargando(false)
      return
    }

    setEnviado(true)
    setCargando(false)
  }

  if (enviado) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-4">
        <header className="text-center">
          <h1 className="text-2xl">Correo enviado</h1>
        </header>

        <Aviso tipo="exito">
          <p>
            Hemos enviado un enlace a tu correo de contacto. Revisa tu bandeja y sigue los
            pasos para cambiar tu contraseña.
          </p>
          <p className="mt-2 text-xs">
            (Si no lo ves, revisa spam. Si aún no tienes correo registrado, contacta a la
            coordinación.)
          </p>
        </Aviso>

        <Link href="/login" className="text-center text-base text-zr-blue-deep underline">
          Volver al inicio de sesión
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-4">
      <header className="text-center">
        <h1 className="text-2xl">Recuperar contraseña</h1>
        <p className="text-sm text-zr-text-muted">Te enviaremos un enlace por correo</p>
      </header>

      <form onSubmit={recuperar} className="flex flex-col gap-4" noValidate>
        <Campo
          etiqueta="Cédula"
          name="cedula"
          inputMode="text"
          placeholder="V-12345678"
          value={cedula}
          onChange={(e) => setCedula(e.target.value.toUpperCase())}
          ayuda="Con la letra y el guion"
          required
        />

        {error && <Aviso tipo="error">{error}</Aviso>}

        <Boton type="submit" tamano="grande" anchoCompleto cargando={cargando}>
          Enviar enlace
        </Boton>
      </form>

      <div className="text-center">
        <p className="text-sm text-zr-text-muted">
          ¿Ya tienes contraseña?{' '}
          <Link href="/login" className="font-medium text-zr-blue-deep underline">
            Entra aquí
          </Link>
        </p>
      </div>
    </main>
  )
}
