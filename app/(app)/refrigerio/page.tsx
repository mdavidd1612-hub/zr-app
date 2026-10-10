'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { createClient } from '@/lib/supabase/client'
import { IconoFlechaAtras } from '@/components/ui/Iconos'

/**
 * `/refrigerio` -- corrección explícita del coordinador (sept. 2026): la
 * cantina (ZR Coffee) muestra el QR, el ESTUDIANTE lo escanea con su propia
 * cámara. Mismo patrón que `/asistencia` (checkin-session) -- la Edge
 * Function `claim-snack-checkin` es la única que decide si vale (regla 2 de
 * AGENTS.md).
 */

interface ResultadoOk { tipo: 'exito' }
interface ResultadoError { tipo: 'error'; mensaje: string }

export default function ReclamarRefrigerio() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const bloqueadoRef = useRef(false)

  const [errorCamara, setErrorCamara] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoOk | ResultadoError | null>(null)

  useEffect(() => {
    let cancelado = false
    const lector = new BrowserQRCodeReader()

    async function procesar(qrText: string) {
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke('claim-snack-checkin', { body: { qrText } })

      if (error || !data?.ok) {
        const contexto = (error as { context?: Response } | undefined)?.context
        let mensaje = 'No se pudo conectar. Revisa tu conexión.'
        if (contexto) {
          try {
            const cuerpo = await contexto.json()
            mensaje = cuerpo.error?.message ?? mensaje
          } catch {
            // se queda con el mensaje genérico
          }
        }
        setResultado({ tipo: 'error', mensaje })
        setTimeout(() => {
          setResultado(null)
          bloqueadoRef.current = false
        }, 2500)
        return
      }

      setResultado({ tipo: 'exito' })
      setTimeout(() => router.push('/'), 1500)
    }

    async function iniciar() {
      try {
        const dispositivos = await BrowserQRCodeReader.listVideoInputDevices()
        const trasera = dispositivos.find((d) => /back|trasera|rear|environment/i.test(d.label)) ?? dispositivos[0]

        const controles = await lector.decodeFromVideoDevice(
          trasera?.deviceId,
          videoRef.current!,
          (r) => {
            if (r && !cancelado && !bloqueadoRef.current) {
              bloqueadoRef.current = true
              void procesar(r.getText())
            }
          },
        )
        controlsRef.current = controles
      } catch {
        setErrorCamara('No se pudo acceder a la cámara. Revisa los permisos del navegador.')
      }
    }

    iniciar()
    return () => {
      cancelado = true
      controlsRef.current?.stop()
    }
  }, [router])

  return (
    <div className="flex min-h-dvh flex-col bg-black">
      <div className="relative h-[70vh] w-full overflow-hidden bg-zr-bg">
        <div className="absolute left-3 top-3 z-10">
          <button
            onClick={() => router.push('/')}
            aria-label="Volver"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <IconoFlechaAtras size={20} />
          </button>
        </div>

        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-square w-[64%] rounded-2xl border-[3px] border-white/85">
            <div className="absolute inset-x-[8%] top-[18%] h-0.5 animate-pulse bg-[#5ee08a] shadow-[0_0_10px_#5ee08a]" />
          </div>
        </div>
        <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-white/80">
          Apunta al código que muestra la cantina
        </p>

        {errorCamara && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
            <p className="text-sm text-white">{errorCamara}</p>
          </div>
        )}

        {resultado?.tipo === 'exito' && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-1 bg-zr-success px-6 py-8 text-center">
            <p className="text-lg font-bold text-white">¡Buen provecho!</p>
          </div>
        )}
        {resultado?.tipo === 'error' && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-1 bg-zr-error px-6 py-8 text-center">
            <p className="text-lg font-bold text-white">{resultado.mensaje}</p>
          </div>
        )}
      </div>

      <div className="flex-1 bg-zr-bg px-5 py-6">
        <p className="text-sm leading-relaxed text-zr-text-muted">
          Escanea el código que muestra la cantina para reclamar tu refrigerio. Solo funciona en el
          horario configurado, y una sola vez por sábado.
        </p>
      </div>
    </div>
  )
}
