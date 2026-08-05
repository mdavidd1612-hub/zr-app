import { getSessionProfile } from '@/lib/auth-server'
import { redirect } from 'next/navigation'

export default async function ProfesorLayout({ children }: { children: React.ReactNode }) {
  const perfil = await getSessionProfile()

  if (!perfil || perfil.role === 'estudiante') {
    redirect('/login')
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Navegación lateral en desktop, horizontal en mobile */}
      <nav className="border-b border-zr-border bg-white lg:w-64 lg:border-r lg:border-b-0">
        <div className="flex flex-col gap-1 p-4 lg:gap-2">
          <a
            href="/hoy"
            className="rounded-zr px-4 py-3 text-base font-medium text-zr-text hover:bg-zr-background"
          >
            📅 Hoy
          </a>
          <a
            href="/escanear"
            className="rounded-zr px-4 py-3 text-base font-medium text-zr-text hover:bg-zr-background"
          >
            📱 Escanear
          </a>
          <a
            href="/sesiones"
            className="rounded-zr px-4 py-3 text-base font-medium text-zr-text hover:bg-zr-background"
          >
            📋 Sesiones
          </a>
          <a
            href="/examenes"
            className="rounded-zr px-4 py-3 text-base font-medium text-zr-text hover:bg-zr-background"
          >
            ✏️ Exámenes
          </a>
          <a
            href="/calificar"
            className="rounded-zr px-4 py-3 text-base font-medium text-zr-text hover:bg-zr-background"
          >
            📊 Calificar
          </a>
          <a
            href="/dominio"
            className="rounded-zr px-4 py-3 text-base font-medium text-zr-text hover:bg-zr-background"
          >
            🎯 Dominio
          </a>
        </div>

        {/* Seción de admin si tiene permisos */}
        {(perfil.role === 'admin' || perfil.role === 'super_admin') && (
          <div className="border-t border-zr-border p-4 lg:mt-4">
            <p className="text-xs font-medium text-zr-text-muted mb-2">ADMINISTRACIÓN</p>
            <div className="flex flex-col gap-1">
              <a
                href="/panel"
                className="rounded-zr px-4 py-3 text-base font-medium text-zr-text hover:bg-zr-background"
              >
                🏠 Panel
              </a>
              <a
                href="/estudiantes"
                className="rounded-zr px-4 py-3 text-base font-medium text-zr-text hover:bg-zr-background"
              >
                👥 Estudiantes
              </a>
              <a
                href="/consentimientos"
                className="rounded-zr px-4 py-3 text-base font-medium text-zr-text hover:bg-zr-background"
              >
                ✅ Consentimientos
              </a>
              <a
                href="/cohortes"
                className="rounded-zr px-4 py-3 text-base font-medium text-zr-text hover:bg-zr-background"
              >
                👨‍🎓 Cohortes
              </a>
              <a
                href="/reportes"
                className="rounded-zr px-4 py-3 text-base font-medium text-zr-text hover:bg-zr-background"
              >
                📈 Reportes
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Contenido principal */}
      <main className="flex-1 p-4 lg:overflow-y-auto">{children}</main>
    </div>
  )
}
