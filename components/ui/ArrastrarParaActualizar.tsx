'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Arrastrar hacia abajo para actualizar (como en el teléfono).
 *
 * Una app instalada en iPhone no trae esto: Safari lo desactiva en modo app y
 * además la app apaga el rebote (overscroll-behavior). Se arma a mano:
 * solo funciona estando arriba del todo, con el dedo (no con mouse), y NO se
 * activa si la persona está escribiendo, dentro de un examen, ni cuando el
 * gesto empieza dentro de una lista que se desplaza por su cuenta.
 * Actualizar = recargar la pantalla (los datos se piden al abrirla).
 */
const UMBRAL = 70
const MAX = 110

export function ArrastrarParaActualizar() {
  const pathname = usePathname()
  const [dist, setDist] = useState(0)
  const [cargando, setCargando] = useState(false)
  const inicio = useRef<number | null>(null)
  const distRef = useRef(0)
  const bloqueado = pathname.startsWith('/examenes/') || pathname.startsWith('/login')

  useEffect(() => {
    if (bloqueado) return

    function dentroDeScroll(el: EventTarget | null): boolean {
      for (let e = el as HTMLElement | null; e && e !== document.body; e = e.parentElement) {
        const o = getComputedStyle(e).overflowY
        if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight && e.scrollTop > 0) return true
        if (e.dataset?.sinRefrescar !== undefined) return true
      }
      return false
    }
    function escribiendo(): boolean {
      const a = document.activeElement as HTMLElement | null
      return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)
    }

    function alTocar(e: TouchEvent) {
      if (e.touches.length !== 1 || window.scrollY > 0 || escribiendo() || dentroDeScroll(e.target)) {
        inicio.current = null
        return
      }
      inicio.current = e.touches[0].clientY
    }
    function alMover(e: TouchEvent) {
      if (inicio.current === null) return
      const dy = e.touches[0].clientY - inicio.current
      if (dy <= 0 || window.scrollY > 0) {
        if (distRef.current !== 0) { distRef.current = 0; setDist(0) }
        return
      }
      const d = Math.min(MAX, dy * 0.5)
      distRef.current = d
      setDist(d)
      if (d > 8 && e.cancelable) e.preventDefault()
    }
    function alSoltar() {
      const d = distRef.current
      inicio.current = null
      distRef.current = 0
      if (d >= UMBRAL) {
        setCargando(true)
        setDist(UMBRAL)
        setTimeout(() => window.location.reload(), 350)
      } else {
        setDist(0)
      }
    }

    document.addEventListener('touchstart', alTocar, { passive: true })
    document.addEventListener('touchmove', alMover, { passive: false })
    document.addEventListener('touchend', alSoltar, { passive: true })
    document.addEventListener('touchcancel', alSoltar, { passive: true })
    return () => {
      document.removeEventListener('touchstart', alTocar)
      document.removeEventListener('touchmove', alMover)
      document.removeEventListener('touchend', alSoltar)
      document.removeEventListener('touchcancel', alSoltar)
    }
  }, [bloqueado])

  if (bloqueado || (dist === 0 && !cargando)) return null
  const listo = dist >= UMBRAL
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-1/2 z-[90] flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-white/15 bg-zr-surface shadow-lg"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        transform: `translate(-50%, ${dist - 20}px)`,
        opacity: Math.min(1, dist / 40),
      }}
    >
      <svg
        viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round"
        className={`text-zr-blue-mid ${cargando ? 'animate-spin' : ''}`}
        style={!cargando ? { transform: `rotate(${listo ? 180 : (dist / UMBRAL) * 180}deg)` } : undefined}
      >
        {cargando ? <path d="M21 12a9 9 0 1 1-6.2-8.55" /> : <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>}
      </svg>
    </div>
  )
}
