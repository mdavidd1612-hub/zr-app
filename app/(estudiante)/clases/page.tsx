'use client'

import { EstadoVacio } from '@/components/ui/EstadoVacio'

export default function Clases() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-zr-blue to-zr-blue-deep bg-clip-text text-transparent">📚 Mis clases</h1>
        <p className="text-sm text-zr-text-muted">Historial de sesiones y próximas clases</p>
      </header>

      <EstadoVacio
        titulo="Aún no hay clases registradas"
        explicacion="Cuando asistas a una clase y el profesor registre tu asistencia, aparecerá aquí el historial completo de sesiones."
        icono="📅"
      />
    </div>
  )
}
