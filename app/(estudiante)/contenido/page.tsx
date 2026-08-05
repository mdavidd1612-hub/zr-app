'use client'

import { EstadoVacio } from '@/components/ui/EstadoVacio'

export default function Contenido() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-zr-blue to-zr-blue-deep bg-clip-text text-transparent">📖 Material de estudio</h1>
        <p className="text-sm text-zr-text-muted">PDFs, guías y recursos del módulo actual</p>
      </header>

      <EstadoVacio
        titulo="No hay material disponible"
        explicacion="El profesor subirá las guías de aprendizaje y material de estudio aquí. Por ahora no hay contenido para tu módulo."
        icono="📚"
      />
    </div>
  )
}
