'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { registroSchema } from '@/lib/validators'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { Aviso } from '@/components/ui/Aviso'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { createClient } from '@/lib/supabase/client'
import { cedulaAEmail } from '@/lib/auth-helpers'

// Registro para quien va a pedir acceso como profesor. La cuenta nace igual
// que cualquier otra (regla #9: todo el que se registra es 'estudiante',
// nunca el cliente decide el rol) — lo único distinto es que, apenas creada,
// se abre una solicitud en professor_applications para que Dirección
// Académica la revise y apruebe. Hasta que eso pase, la cuenta sigue siendo
// una cuenta de estudiante normal.
export default function RegistroProfesor() {
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

    if (formulario.password !== formulario.passwordConfirm) {
      setError('Las contraseñas no coinciden')
      return
    }

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

      const supabase = createClient()
      await supabase.auth.signOut()
      const { data: sesion, error: falloLogin } = await supabase.auth.signInWithPassword({
        email: cedulaAEmail(validado.data.cedula),
        password: validado.data.password,
      })

      if (falloLogin || !sesion.user) {
        setError('La cuenta se creó, pero no se pudo iniciar sesión. Entra desde el login.')
        setCargando(false)
        router.push('/login')
        return
      }

      const { error: falloSolicitud } = await supabase.from('professor_applications').insert({
        profile_id: sesion.user.id,
        full_name: validado.data.fullName,
        cedula: validado.data.cedula,
        contact_email: validado.data.contactEmail,
        phone: validado.data.phone ?? null,
      })

      if (falloSolicitud) {
        console.error('registro-profesor: fallo al crear la solicitud', falloSolicitud.message)
      }

      router.push('/solicitud-profesor')
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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-zr-blue to-zr-blue-deep bg-clip-text text-transparent">
          Solicita acceso como profesor
        </h1>
        <p className="text-base text-zr-text-muted mt-1">
          Crea tu cuenta. Dirección Académica revisará tus datos y te asignará un curso.
        </p>
      </header>

      <form onSubmit={registrar} className="space-y-4" noValidate>
        <Campo
          etiqueta="Nombre completo"
          name="fullName"
          autoComplete="name"
          placeholder="Prof. Juan Pérez"
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
          Solicitar acceso
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
