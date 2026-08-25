'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { IconoFlechaAtras, IconoCheck } from '@/components/ui/Iconos'

/**
 * Fase 0 (docs/14_FASE0_PLAN_SPRINTS.md, Sprint 2 — ajuste): nueva regla de
 * la academia, todavía sin Edge Function propia: es administración quien
 * muestra el QR en pantalla y el ESTUDIANTE quien lo escanea (al revés de
 * como estaba documentado en AGENTS.md). Se deja el lector realmente
 * funcionando —cámara y detección de QR reales, con @zxing/browser, igual
 * que en la pantalla del profesor— pero la validación contra una sesión de
 * clase se conecta cuando se trabaje el panel de administración.
 */
export default function MarcarAsistencia() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const bloqueadoRef = useRef(false)

  const [errorCamara, setErrorCamara] = useState<string | null>(null)
  const [leido, setLeido] = useState<string | null>(null)

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
            if (resultado && !cancelado && !bloqueadoRef.current) {
              bloqueadoRef.current = true
              setLeido(resultado.getText())
              setTimeout(() => {
                setLeido(null)
                bloqueadoRef.current = false
              }, 2500)
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
  }, [])

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

        {/* Marco visual del visor, como en el prototipo de referencia */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-square w-[64%] rounded-2xl border-[3px] border-white/85">
            <div className="absolute inset-x-[8%] top-[18%] h-0.5 animate-pulse bg-[#5ee08a] shadow-[0_0_10px_#5ee08a]" />
          </div>
        </div>
        <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-white/80">
          Apunta al código que muestra administración
        </p>

        {errorCamara && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
            <p className="text-sm text-white">{errorCamara}</p>
          </div>
        )}

        {leido && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-1 bg-zr-blue px-6 py-8 text-center">
            <IconoCheck size={28} className="text-white" />
            <p className="text-lg font-bold text-white">Código leído</p>
            <p className="text-sm text-white/80">
              Se registrará automáticamente cuando conectemos administración
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 bg-zr-bg px-5 py-6">
        <p className="text-sm leading-relaxed text-zr-text-muted">
          Este lector ya usa tu cámara de verdad. Falta conectarlo con el panel de
          administración, que es quien va a mostrar el código en pantalla — eso se resuelve
          cuando trabajemos ese panel.
        </p>
      </div>
    </div>
  )
}
