import { getSessionProfile } from '@/lib/auth-server'
import Link from 'next/link'

export default async function ExamenesPage() {
  const perfil = await getSessionProfile()
  if (!perfil || perfil.role !== 'estudiante') {
    return <div className="p-6 text-red-600">No autorizado</div>
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-zr-navy mb-4">Exámenes</h1>
      <p className="text-zr-text-muted mb-6">Lista de exámenes disponibles.</p>

      <div className="rounded-zr bg-white border border-zr-border shadow-sm p-4 mb-4">
        <h2 className="font-bold text-zr-text">Estado del examen</h2>
        <ul className="mt-2 text-sm text-zr-text-muted space-y-1">
          <li>Sin empezar → Botón <strong>Presentar examen</strong></li>
          <li>En progreso → Botón <strong>Continuar</strong></li>
          <li>Entregado, sin calificar → Esperando calificación</li>
          <li>Calificado → Nota final</li>
        </ul>
      </div>

      <Link
        href="/examenes/00000000-0000-0000-0000-000000009001"
        className="block w-full rounded-zr bg-zr-blue text-white font-bold py-4 text-center shadow hover:bg-zr-blue-dark transition-colors active:scale-[0.99]"
      >
        Ir al examen de ejemplo
      </Link>
    </div>
  )
}
