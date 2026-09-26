'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * `/zr-coffee/refrigerio` — pedido explícito del coordinador (sept. 2026):
 * el tiquet de refrigerio deja de ser físico. Este dispositivo, fijo en la
 * cantina, escanea el mismo QR rotatorio del carnet de asistencia (no hay
 * un "tiquet" nuevo que inventar) y llama a la edge function
 * `claim-snack-cantina`, que ya resuelve sola la sesión de hoy del
 * estudiante y respeta la ventana de horario de `system_config` — esta
 * pantalla no valida nada de eso, solo escanea y muestra el resultado
 * (regla 2 de AGENTS.md).
 *
 * A diferencia de `/escanear/[sessionId]` (el profesor, en su aula), aquí no
 * hay sessionId ni cola offline: la cantina tiene un solo lugar fijo con
 * wifi, así que no aplica el caso "sin señal en el taller".
 */

type Resultado =
  | { tipo: 'exito'; nombre: string }
  | { tipo: 'error'; mensaje: string }
  | null

export default function RefrigerioCantina() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const bloqueadoRef = useRef(false)

  const [resultado, setResultado] = useState<Resultado>(null)
  const [entregados, setEntregados] = useState(0)
  const [errorCamara, setErrorCamara] = useState<string | null>(null)

  const procesarQR = useCallback(async (qrCode: string) => {
    if (bloqueadoRef.current) return
    bloqueadoRef.current = true

    const supabase = createClient()
    const { data, error } = await supabase.functions.invoke('claim-snack-cantina', { body: { qrCode } })

    if (error) {
      const contexto = (error as { context?: Response }).context
      let mensaje = 'No se pudo conectar.'
      if (contexto) {
        try {
          const cuerpo = await contexto.json()
          mensaje = cuerpo.error?.message ?? mensaje
        } catch {
          // se queda el mensaje genérico
        }
      }
      setResultado({ tipo: 'error', mensaje })
    } else if (data?.ok) {
      setResultado({ tipo: 'exito', nombre: data.student?.fullName ?? 'Estudiante' })
      setEntregados((n) => n + 1)
    } else {
      setResultado({ tipo: 'error', mensaje: data?.error?.message ?? 'No se pudo entregar' })
    }

    setTimeout(() => {
      setResultado(null)
      bloqueadoRef.current = false
    }, 2000)
  }, [])

  useEffect(() => {
    let cancelado = false
    const lector = new BrowserQRCodeReader()

    async function iniciar() {
      try {
        const dispositivos = await BrowserQRCodeReader.listVideoInputDevices()
        const trasera = dispositivos.find((d) => /back|trasera|rear|environment/i.test(d.label)) ?? dispositivos[0]

        const controles = await lector.decodeFromVideoDevice(
          trasera?.deviceId,
          videoRef.current!,
          (resultado) => {
            if (resultado && !cancelado) void procesarQR(resultado.getText())
          },
        )
        controlsRef.current = controles
      } catch {
        setErrorCamara('No se pudo acceder a la cámara de este dispositivo.')
      }
    }

    iniciar()
    return () => {
      cancelado = true
      controlsRef.current?.stop()
    }
  }, [procesarQR])

  return (
    <div className="flex min-h-dvh flex-col bg-black">
      <div className="relative h-[75vh] w-full overflow-hidden bg-zr-bg">
        <div className="absolute left-3 top-3 z-10">
          <BotonVolver href="/zr-coffee" texto="Salir" />
        </div>

        <div className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white backdrop-blur">
          Entregados hoy: {entregados}
        </div>

        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

        {errorCamara && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
            <p className="text-sm text-white">{errorCamara}</p>
          </div>
        )}

        {resultado && (
          <div
            className={`absolute inset-x-0 bottom-0 flex flex-col items-center justify-center px-6 py-8 text-center ${
              resultado.tipo === 'exito' ? 'bg-zr-success' : 'bg-zr-error'
            }`}
          >
            <p className="text-3xl font-bold text-white">
              {resultado.tipo === 'exito' ? resultado.nombre : resultado.mensaje}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-6 text-center">
        <p className="text-sm text-white/60">
          Escanea el carnet del estudiante para entregar su refrigerio. Solo funciona en el horario
          de refrigerio configurado.
        </p>
      </div>
    </div>
  )
}
