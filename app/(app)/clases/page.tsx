'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * "Mi módulo" se retiró a pedido explícito del coordinador: pasó a ser la
 * malla curricular (/malla), que ya muestra el módulo actual resaltado
 * dentro del camino completo. Esta ruta se deja como redirección, no se
 * borra del todo, por si algún enlace guardado (accesos directos, historial
 * del navegador) todavía apunta aquí.
 */
export default function MiModuloRedireccion() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/malla')
  }, [router])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
      <p className="text-sm text-zr-text-muted">Cargando…</p>
    </div>
  )
}
