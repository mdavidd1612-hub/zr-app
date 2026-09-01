'use client'

import { useEffect, useState } from 'react'
import { MarcaZR } from '@/components/ui/Iconos'

// El evento no está en las tipificaciones estándar: solo lo emite Chromium.
type EventoInstalacion = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const CLAVE = 'zr:instalar-descartado'
const DIAS_DE_SILENCIO = 7

function fueDescartadoHacePoco() {
  try {
    const cuando = window.localStorage.getItem(CLAVE)
    if (!cuando) return false
    const dias = (Date.now() - Number(cuando)) / 86_400_000
    return dias < DIAS_DE_SILENCIO
  } catch {
    return false
  }
}

function yaEstaInstalada() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS no soporta display-mode: standalone en versiones viejas.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function esIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export default function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null)
  const [visible, setVisible] = useState(false)
  const [modoIOS, setModoIOS] = useState(false)

  useEffect(() => {
    if (yaEstaInstalada() || fueDescartadoHacePoco()) return

    // Chrome/Edge/Android: el navegador nos cede el control del cartel.
    function alPoderInstalar(e: Event) {
      e.preventDefault()
      setEvento(e as EventoInstalacion)
      setVisible(true)
    }
    function alInstalar() {
      setVisible(false)
    }
    window.addEventListener('beforeinstallprompt', alPoderInstalar)
    window.addEventListener('appinstalled', alInstalar)

    // Safari en iPhone nunca emite el evento: hay que explicar el gesto a mano.
    let t: ReturnType<typeof setTimeout> | undefined
    if (esIOS()) {
      t = setTimeout(() => {
        setModoIOS(true)
        setVisible(true)
      }, 1200)
    }

    return () => {
      if (t) clearTimeout(t)
      window.removeEventListener('beforeinstallprompt', alPoderInstalar)
      window.removeEventListener('appinstalled', alInstalar)
    }
  }, [])

  function descartar() {
    setVisible(false)
    try {
      window.localStorage.setItem(CLAVE, String(Date.now()))
    } catch {
      // Modo privado: no se recuerda, y no pasa nada.
    }
  }

  async function instalar() {
    if (!evento) return
    await evento.prompt()
    await evento.userChoice
    setEvento(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Instalar ZR App"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
    >
      <div className="mx-auto w-full max-w-[430px] rounded-2xl border border-zr-border bg-zr-surface p-5 shadow-2xl shadow-black/40">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zr-blue text-white">
            <MarcaZR size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-zr-text">Instala ZR App</p>
            <p className="mt-1 text-sm text-zr-text-muted">
              {modoIOS
                ? 'Toca Compartir y luego «Agregar a pantalla de inicio».'
                : 'Ábrela desde tu pantalla de inicio, sin buscador y con menos datos.'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={descartar}
            className="flex-1 rounded-xl border border-zr-border py-3.5 text-sm font-semibold text-zr-text-muted transition-colors hover:text-zr-text"
          >
            Ahora no
          </button>
          {!modoIOS && (
            <button
              type="button"
              onClick={instalar}
              className="flex-[2] rounded-xl bg-gradient-to-r from-zr-blue to-zr-blue-deep py-3.5 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-zr-blue/30"
            >
              Instalar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
