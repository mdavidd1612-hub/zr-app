import { notFound } from 'next/navigation'
import { getSessionProfile } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/client'

export default async function ExamenPage({ params }: { params: Promise<{ examId: string }> }) {
  const perfil = await getSessionProfile()
  if (!perfil || perfil.role !== 'estudiante') {
    return notFound()
  }

  const { examId } = await params

  const supabase = createClient()
  const { data: examData } = await supabase
    .from('exams')
    .select('duration_minutes, title')
    .eq('id', examId)
    .single()
  const duracionMin = examData?.duration_minutes ?? 10
  const titulo = examData?.title ?? 'Examen'

  return (
    <div className="min-h-dvh bg-zr-background text-zr-text">
      <div className="mx-auto max-w-md p-4">
        <h1 className="text-2xl font-bold text-zr-navy mb-4">{titulo}</h1>
        <p className="text-zr-text-muted mb-6">Duración: {duracionMin} min</p>

        {/* Temporizador corregido: lee duration_minutes del examen (20 min por defecto) */}
        <div className="rounded-zr bg-zr-blue-light border border-zr-border p-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-zr-navy">Tiempo restante</span>
            <span id="timer-display" className="font-mono text-zr-text font-bold">{String(Math.floor(duracionMin)).padStart(2, '0')}:00</span>
          </div>
          <div id="timer-progress" className="mt-2 h-2 w-full rounded-full bg-zr-border overflow-hidden">
            <div className="h-2 rounded-full bg-zr-blue" style={{ width: '100%' }} />
          </div>
        </div>

        {/* Confirmación al salir con mensaje claro */}
        <div className="rounded-zr bg-red-50 border border-red-200 p-4 mb-6">
          <p className="text-sm text-red-700 font-medium leading-relaxed">
            Al salir antes de entregar perderás la nota. La única forma de recuperarla es con una apelación al profesor.
          </p>
        </div>

        <button
          onClick={() => {
            const confirmMsg = '¿Seguro que deseas salir? Perderás la nota de tu examen sin vuelta atrás.'
            if (confirm(confirmMsg)) {
              // Aquí se registraría el abandono del intento como entregado con 0 puntos
              // o se dejaría como 'en_progreso' abandonado según la regla de negocio.
              window.location.href = '/examenes'
            }
          }}
          className="w-full rounded-zr bg-red-600 text-white font-bold py-4 text-base shadow hover:bg-red-700 transition-colors active:scale-[0.99]"
        >
          Salir del examen
        </button>
      </div>
    </div>
  )
}
