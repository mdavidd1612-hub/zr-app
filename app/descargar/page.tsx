import Link from 'next/link'
import { MarcaZR, IconoDescargar, IconoAviso } from '@/components/ui/Iconos'

export const metadata = {
  title: 'Descargar ZR App',
}

export default function Descargar() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-5 py-10">
      <div className="w-full space-y-10">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zr-border bg-zr-surface text-zr-blue">
            <MarcaZR size={30} />
          </div>
          <h1 className="zr-display text-3xl text-zr-text">Descargar ZR App</h1>
          <p className="text-base font-medium text-zr-text-muted">
            Academia ZR Mecademy — carnet digital, asistencia y exámenes
          </p>
        </div>

        {/* Android */}
        <section className="space-y-4 rounded-2xl border border-zr-border bg-zr-surface p-6">
          <h2 className="text-lg font-bold text-zr-text">Android</h2>
          <p className="text-sm text-zr-text-muted">
            Descarga la aplicación como archivo APK e instálala directamente en tu teléfono.
          </p>
          <a
            href="/zr-app.apk"
            download
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-zr-blue to-zr-blue-deep py-4 font-bold text-white transition-all hover:shadow-lg hover:shadow-zr-blue/30"
          >
            <IconoDescargar size={20} />
            Descargar APK
          </a>
          <div className="flex gap-3 rounded-xl border border-zr-border bg-zr-bg p-4 text-sm text-zr-text-muted">
            <IconoAviso size={20} className="mt-0.5 shrink-0 text-zr-warning" />
            <p>
              Android va a advertir que es una app de «origen desconocido» porque no viene de
              Play Store. Es normal: toca <strong className="text-zr-text">«Instalar de todos modos»</strong> o
              <strong className="text-zr-text"> «Permitir de esta fuente»</strong> cuando lo pida.
            </p>
          </div>
        </section>

        {/* PC */}
        <section className="space-y-4 rounded-2xl border border-zr-border bg-zr-surface p-6">
          <h2 className="text-lg font-bold text-zr-text">Computadora (Chrome o Edge)</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zr-text-muted">
            <li>
              Abre <Link href="/" className="font-medium text-zr-blue hover:text-zr-blue-light">zr-app-ebon.vercel.app</Link>{' '}
              en Chrome o Edge.
            </li>
            <li>
              Busca el ícono de instalar en la barra de direcciones (una pantallita con una
              flecha) y haz clic.
            </li>
            <li>Confirma «Instalar». Queda como una aplicación aparte, con su propio ícono.</li>
          </ol>
        </section>

        {/* iPhone */}
        <section className="space-y-4 rounded-2xl border border-zr-border bg-zr-surface p-6">
          <h2 className="text-lg font-bold text-zr-text">iPhone (Safari)</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zr-text-muted">
            <li>
              Abre <Link href="/" className="font-medium text-zr-blue hover:text-zr-blue-light">zr-app-ebon.vercel.app</Link>{' '}
              en Safari (no funciona desde Chrome en iPhone).
            </li>
            <li>Toca el botón «Compartir» (el cuadrado con la flecha hacia arriba).</li>
            <li>Elige «Añadir a inicio».</li>
          </ol>
          <div className="flex gap-3 rounded-xl border border-zr-border bg-zr-bg p-4 text-sm text-zr-text-muted">
            <IconoAviso size={20} className="mt-0.5 shrink-0 text-zr-warning" />
            <p>iOS no tiene un archivo APK — así se instala en iPhone.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
