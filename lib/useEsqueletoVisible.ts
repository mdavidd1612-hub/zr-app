'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Mantiene el esqueleto en pantalla un mínimo de tiempo (pedido del coordinador,
 * oct. 2026): aunque los datos carguen rapidísimo, el esqueleto se ve lo
 * suficiente para notarlo, en vez de un parpadeo. No alarga la espera real: si
 * la carga tarda más que el mínimo, desaparece apenas termina.
 *
 *   const cargando = ...              // tu estado real
 *   const mostrar = useEsqueletoVisible(cargando)
 *   if (mostrar) return <PantallaEsqueleto … />
 */
export function useEsqueletoVisible(cargando: boolean, minMs = 550): boolean {
  const [visible, setVisible] = useState(cargando)
  const desde = useRef<number | null>(cargando ? Date.now() : null)

  useEffect(() => {
    if (cargando) {
      if (desde.current === null) desde.current = Date.now()
      setVisible(true)
      return
    }
    // Terminó de cargar: espera lo que falte para completar el mínimo.
    const transcurrido = desde.current !== null ? Date.now() - desde.current : minMs
    const resto = Math.max(0, minMs - transcurrido)
    const t = setTimeout(() => {
      setVisible(false)
      desde.current = null
    }, resto)
    return () => clearTimeout(t)
  }, [cargando, minMs])

  return visible
}
