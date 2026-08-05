'use client'

import { EstadoVacio } from '@/components/ui/EstadoVacio'

export default function Examenes() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-zr-blue to-zr-blue-deep bg-clip-text text-transparent">✏️ Mis exámenes</h1>
        <p className="text-sm text-zr-text-muted">Evaluaciones, calificaciones y resultados</p>
      </header>

      <EstadoVacio
        titulo="No hay exámenes disponibles"
        explicacion="Cuando tu profesor publique un examen para tu cohorte, aparecerá aquí. Tendrás acceso solo a los exámenes habilitados."
        icono="📋"
      />
    </div>
  )
}
