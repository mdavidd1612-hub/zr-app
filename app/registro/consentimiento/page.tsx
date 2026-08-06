'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { Aviso } from '@/components/ui/Aviso'
import { BotonVolver } from '@/components/ui/BotonVolver'

type Metodo = 'fisico' | 'digital'

export default function Consentimiento() {
  const router = useRouter()

  const [formulario, setFormulario] = useState({
    representativeName: '',
    representativeCedula: '',
    representativeEmail: '',
    representativePhone: '',
    method: 'fisico' as Metodo,
    document: null as File | null,
  })

  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validaciones mínimas
    if (!formulario.representativeName || !formulario.representativeCedula || !formulario.representativeEmail) {
      setError('Todos los campos de datos son obligatorios')
      return
    }

    if (formulario.method === 'digital' && !formulario.document) {
      setError('Debes subir el documento')
      return
    }

    setCargando(true)

    try {
      const formData = new FormData()
      formData.append('representativeName', formulario.representativeName)
      formData.append('representativeCedula', formulario.representativeCedula)
      formData.append('representativeEmail', formulario.representativeEmail)
      formData.append('representativePhone', formulario.representativePhone)
      formData.append('method', formulario.method)
      if (formulario.document) {
        formData.append('document', formulario.document)
      }

      const res = await fetch('/api/auth/consent', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        try {
          const resultado = await res.json()
          setError(resultado.error || 'No se pudo guardar el consentimiento')
        } catch {
          setError(`Error ${res.status}: No se pudo procesar la respuesta`)
        }
        setCargando(false)
        return
      }

      // Consentimiento registrado, ir al carnet
      router.push('/')
      router.refresh()
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.')
      console.error('Consent submission error:', err)
      setCargando(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 p-4">
      <BotonVolver href="/registro" />

      <header className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-zr-blue to-zr-blue-deep bg-clip-text text-transparent">Autorización</h1>
        <p className="text-sm text-zr-text-muted mt-1">
          Como eres menor de edad, la ley exige que tu representante legal autorice tu cuenta
        </p>
      </header>

      <form onSubmit={guardar} className="glass flex flex-col gap-3 p-8 rounded-3xl" noValidate>
        <fieldset className="space-y-3 border-t border-zr-border pt-4">
          <legend className="font-medium">Datos del representante legal</legend>

          <Campo
            etiqueta="Nombre completo"
            name="representativeName"
            autoComplete="name"
            placeholder="Juan Pérez Morales"
            value={formulario.representativeName}
            onChange={(e) =>
              setFormulario({ ...formulario, representativeName: e.target.value })
            }
            required
          />

          <Campo
            etiqueta="Cédula"
            name="representativeCedula"
            inputMode="text"
            placeholder="V-12345678"
            value={formulario.representativeCedula}
            onChange={(e) =>
              setFormulario({
                ...formulario,
                representativeCedula: e.target.value.toUpperCase(),
              })
            }
            ayuda="Con la letra y el guion"
            required
          />

          <Campo
            etiqueta="Correo"
            name="representativeEmail"
            type="email"
            inputMode="email"
            placeholder="representante@correo.com"
            value={formulario.representativeEmail}
            onChange={(e) =>
              setFormulario({ ...formulario, representativeEmail: e.target.value })
            }
            required
          />

          <Campo
            etiqueta="Teléfono"
            name="representativePhone"
            type="tel"
            inputMode="tel"
            placeholder="+58 412 1234567"
            value={formulario.representativePhone}
            onChange={(e) =>
              setFormulario({ ...formulario, representativePhone: e.target.value })
            }
          />
        </fieldset>

        <fieldset className="space-y-3 border-t border-zr-border pt-4">
          <legend className="font-medium">Método de consentimiento</legend>

          <label className="flex items-center gap-3 rounded-zr border border-zr-border p-3 cursor-pointer">
            <input
              type="radio"
              name="method"
              value="fisico"
              checked={formulario.method === 'fisico'}
              onChange={(e) =>
                setFormulario({
                  ...formulario,
                  method: e.target.value as Metodo,
                })
              }
              className="size-5"
            />
            <span className="text-base">Firmó en papel en la sede</span>
          </label>

          <label className="flex items-center gap-3 rounded-zr border border-zr-border p-3 cursor-pointer">
            <input
              type="radio"
              name="method"
              value="digital"
              checked={formulario.method === 'digital'}
              onChange={(e) =>
                setFormulario({
                  ...formulario,
                  method: e.target.value as Metodo,
                })
              }
              className="size-5"
            />
            <span className="text-base">Subir documento firmado</span>
          </label>
        </fieldset>

        {formulario.method === 'digital' && (
          <fieldset className="border-t border-zr-border pt-4">
            <label htmlFor="document" className="block font-medium mb-2">
              Documento (PDF o imagen)
            </label>
            <input
              id="document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) =>
                setFormulario({
                  ...formulario,
                  document: e.target.files?.[0] || null,
                })
              }
              className="block w-full text-sm text-zr-text file:mr-4 file:rounded-zr file:border-0 file:bg-zr-blue file:px-4 file:py-2 file:text-white file:cursor-pointer hover:file:bg-zr-blue-deep"
            />
          </fieldset>
        )}

        {error && <Aviso tipo="error">{error}</Aviso>}

        <Boton type="submit" tamano="grande" anchoCompleto cargando={cargando}>
          Guardar consentimiento
        </Boton>
      </form>
    </main>
  )
}
