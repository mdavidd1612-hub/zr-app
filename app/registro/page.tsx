'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { registroSchema } from '@/lib/validators'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { Aviso } from '@/components/ui/Aviso'
import { BotonVolver } from '@/components/ui/BotonVolver'

export default function Registro() {
  const router = useRouter()

  const [formulario, setFormulario] = useState({
    fullName: '',
    cedula: '',
    birthDate: '',
    contactEmail: '',
    phone: '',
    password: '',
    passwordConfirm: '',
  })

  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validar que las contraseñas coincidan
    if (formulario.password !== formulario.passwordConfirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    // Validar con Zod
    const validado = registroSchema.safeParse({
      fullName: formulario.fullName,
      cedula: formulario.cedula,
      birthDate: formulario.birthDate,
      contactEmail: formulario.contactEmail,
      phone: formulario.phone || undefined,
      password: formulario.password,
    })

    if (!validado.success) {
      setError(validado.error.issues[0].message)
      return
    }

    setCargando(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validado.data),
      })

      if (!res.ok) {
        try {
          const resultado = await res.json()
          setError(resultado.error || 'No se pudo crear la cuenta')
        } catch {
          setError(`Error ${res.status}: No se pudo procesar la respuesta`)
        }
        setCargando(false)
        return
      }

      const resultado = await res.json()

      // Si es menor, ir a consentimiento; si no, ir al carnet
      if (resultado.isMenor) {
        router.push('/registro/consentimiento')
      } else {
        // TODO: cuando exista provision-qr, llamarlo aquí
        // const qrSecret = await fetch('/api/auth/provision-qr', { method: 'POST' })
        router.push('/')
      }
      router.refresh()
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.')
      console.error('Registration error:', err)
      setCargando(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 p-4">
      <BotonVolver href="/login" />

      <header className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-zr-blue to-zr-blue-deep bg-clip-text text-transparent">Regístrate</h1>
        <p className="text-base text-zr-text-muted mt-1">Crea tu cuenta en ZR App</p>
      </header>

      <form onSubmit={registrar} className="glass flex flex-col gap-3 p-8 rounded-3xl" noValidate>
        <Campo
          etiqueta="Nombre completo"
          name="fullName"
          autoComplete="name"
          placeholder="Juan Pérez"
          value={formulario.fullName}
          onChange={(e) => setFormulario({ ...formulario, fullName: e.target.value })}
          required
        />

        <Campo
          etiqueta="Cédula"
          name="cedula"
          inputMode="text"
          autoComplete="off"
          placeholder="V-12345678"
          value={formulario.cedula}
          onChange={(e) => setFormulario({ ...formulario, cedula: e.target.value.toUpperCase() })}
          ayuda="Con la letra y el guion"
          required
        />

        <Campo
          etiqueta="Fecha de nacimiento"
          name="birthDate"
          type="date"
          value={formulario.birthDate}
          onChange={(e) => setFormulario({ ...formulario, birthDate: e.target.value })}
          required
        />

        <Campo
          etiqueta="Correo de contacto"
          name="contactEmail"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          value={formulario.contactEmail}
          onChange={(e) => setFormulario({ ...formulario, contactEmail: e.target.value })}
          ayuda="Si eres menor, pon el correo de tu representante"
          required
        />

        <Campo
          etiqueta="Teléfono"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+58 412 1234567"
          value={formulario.phone}
          onChange={(e) => setFormulario({ ...formulario, phone: e.target.value })}
        />

        <Campo
          etiqueta="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          value={formulario.password}
          onChange={(e) => setFormulario({ ...formulario, password: e.target.value })}
          required
        />

        <Campo
          etiqueta="Repetir contraseña"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          value={formulario.passwordConfirm}
          onChange={(e) => setFormulario({ ...formulario, passwordConfirm: e.target.value })}
          required
        />

        {error && <Aviso tipo="error">{error}</Aviso>}

        <Boton type="submit" tamano="grande" anchoCompleto cargando={cargando}>
          Crear cuenta
        </Boton>
      </form>

      <div className="text-center">
        <p className="text-base text-zr-text-muted">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-medium text-zr-blue-deep underline underline-offset-4">
            Entra aquí
          </Link>
        </p>
      </div>
    </main>
  )
}
