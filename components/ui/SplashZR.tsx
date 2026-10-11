'use client'

import { useEffect, useState } from 'react'

/**
 * Splash de apertura (pedido del coordinador, oct. 2026): al abrir la app, en
 * vez del logo gigante sobre blanco, el logo ZR se agita y aparece el nombre
 * (estilo Good Lock de Samsung). Vive en el layout raíz, así que se monta una
 * sola vez por apertura real — no reaparece al navegar dentro de la app.
 *
 * Solo transform/opacity (corre en GPU): fluido, sin tirones. Se va a los
 * ~1,3 s con un fundido y se desmonta para no estorbar.
 */
export function SplashZR() {
  const [fase, setFase] = useState<'dentro' | 'saliendo' | 'fuera'>('dentro')

  useEffect(() => {
    const t1 = setTimeout(() => setFase('saliendo'), 1300)
    const t2 = setTimeout(() => setFase('fuera'), 1750)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (fase === 'fuera') return null

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-zr-bg ${
        fase === 'saliendo' ? 'zr-splash-out pointer-events-none' : ''
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-192.png"
        alt=""
        width={96}
        height={96}
        className="zr-splash-icono h-24 w-24 rounded-[22px] shadow-[0_14px_44px_rgba(56,105,177,0.45)]"
      />
      <div className="zr-splash-word text-center">
        <p className="zr-display text-3xl tracking-tight text-zr-text">ZR Mecademy</p>
        <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.3em] text-zr-blue-mid">
          Academia técnica
        </p>
      </div>
    </div>
  )
}
