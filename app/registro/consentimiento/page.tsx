'use client'

import { useState } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { Aviso } from '@/components/ui/Aviso'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { SelectorCedula } from '@/components/ui/SelectorCedula'

type Metodo = 'fisico' | 'digital'

export default function Consentimiento() {

  const [formulario, setFormulario] = useState({
    representativeName: '',
    representativeCedula: 'V-',
    representativeEmail: '',
    representativePhone: '',
    method: 'fisico' as Metodo,
    documentId: null as File | null,
    documentConsent: null as File | null,
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

    if (formulario.method === 'digital' && (!formulario.documentId || !formulario.documentConsent)) {
      setError('Debes subir la cédula del representante y el consentimiento firmado')
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
      if (formulario.documentId) {
        formData.append('documentId', formulario.documentId)
      }
      if (formulario.documentConsent) {
        formData.append('documentConsent', formulario.documentConsent)
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

      // Consentimiento registrado. Recarga completa (no router.push) a
      // propósito: así el middleware vuelve a evaluar todo desde cero con
      // el consentimiento ya guardado, sin depender de que el router del
      // cliente reconcilie una redirección de servidor a mitad de una
      // transición — eso era lo que se quedaba pegado en "Un momento…".
      window.location.href = '/'
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

      <form onSubmit={guardar} className="space-y-4" noValidate>
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

          <SelectorCedula
            etiqueta="Cédula"
            value={formulario.representativeCedula}
            onChange={(v) => setFormulario({ ...formulario, representativeCedula: v })}
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
          <fieldset className="space-y-4 border-t border-zr-border pt-4">
            <div>
              <label htmlFor="documentId" className="block font-medium mb-2">
                Cédula del representante (foto o PDF)
              </label>
              <input
                id="documentId"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) =>
                  setFormulario({
                    ...formulario,
                    documentId: e.target.files?.[0] || null,
                  })
                }
                className="block w-full text-sm text-zr-text file:mr-4 file:rounded-zr file:border-0 file:bg-zr-blue file:px-4 file:py-2 file:text-white file:cursor-pointer hover:file:bg-zr-blue-deep"
              />
            </div>

            <div>
              <label htmlFor="documentConsent" className="block font-medium mb-2">
                Consentimiento firmado (foto o PDF)
              </label>
              <input
                id="documentConsent"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) =>
                  setFormulario({
                    ...formulario,
                    documentConsent: e.target.files?.[0] || null,
                  })
                }
                className="block w-full text-sm text-zr-text file:mr-4 file:rounded-zr file:border-0 file:bg-zr-blue file:px-4 file:py-2 file:text-white file:cursor-pointer hover:file:bg-zr-blue-deep"
              />
            </div>
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
