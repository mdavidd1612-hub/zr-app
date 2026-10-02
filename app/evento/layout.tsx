import type { Metadata } from 'next'

// Título y descripción que se ven cuando el enlace se comparte (historias,
// WhatsApp). Cualquier otro texto de la página sale de system_config.
export const metadata: Metadata = {
  title: 'Confirma tu asistencia · ZR Mecademy',
  description: 'Regístrate y confirma tu asistencia al evento de ZR Mecademy.',
  openGraph: {
    title: 'Confirma tu asistencia · ZR Mecademy',
    description: 'Regístrate y confirma tu asistencia al evento de ZR Mecademy.',
  },
}

export default function EventoLayout({ children }: { children: React.ReactNode }) {
  return children
}
