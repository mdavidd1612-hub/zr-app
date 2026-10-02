'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MarcaZR, IconoCheck } from '@/components/ui/Iconos'

/**
 * Página pública del evento (pedido del coordinador, oct. 2026). Sin login:
 * el enlace va en historias. Quien se registra solo puede INSERTAR su
 * registro (RLS, migración 118) -- nunca lee ni edita nada, ni siquiera lo
 * suyo. Nombre, fecha, hora y lugar del evento vienen de system_config
 * (se editan desde /configuracion, sin desplegar).
 *
 * Las opciones de "¿cómo te enteraste?" son botones, no un <select>: el
 * desplegable nativo se ve fuera de estilo en Android.
 */

const FUENTES = [
  { valor: 'instagram', etiqueta: 'Instagram' },
  { valor: 'whatsapp', etiqueta: 'WhatsApp' },
  { valor: 'tiktok', etiqueta: 'TikTok' },
  { valor: 'amigo_familiar', etiqueta: 'Un amigo o familiar' },
  { valor: 'estudiante_zr', etiqueta: 'Soy estudiante de ZR' },
  { valor: 'otro', etiqueta: 'Otro' },
] as const

type Fuente = (typeof FUENTES)[number]['valor']

interface InfoEvento {
  nombre: string
  fecha: string
  hora: string
  lugar: string
}

const CLASE_INPUT =
  'w-full rounded-xl border border-zr-border bg-zr-surface px-5 py-4 text-base font-medium text-zr-text placeholder-zr-text-muted transition-all focus:border-zr-blue focus:outline-none focus:ring-2 focus:ring-zr-blue/20'

export default function Evento() {
  const [info, setInfo] = useState<InfoEvento>({ nombre: 'Evento ZR Mecademy', fecha: '', hora: '', lugar: '' })

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo, setCorreo] = useState('')
  const [fuente, setFuente] = useState<Fuente | null>(null)
  const [fuenteOtro, setFuenteOtro] = useState('')
  const [acepto, setAcepto] = useState(false)
  // Campo trampa: una persona nunca lo ve ni lo llena; un robot sí.
  const [trampa, setTrampa] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmado, setConfirmado] = useState<{ nombre: string; yaEstaba: boolean } | null>(null)

  useEffect(() => {
    let vigente = true
    createClient()
      .rpc('get_evento_info')
      .then(({ data }) => {
        const fila = (data as InfoEvento[] | null)?.[0]
        if (vigente && fila) setInfo(fila)
      })
    return () => { vigente = false }
  }, [])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const digitos = telefono.replace(/\D/g, '')
    if (nombre.trim().length < 2) return setError('Escribe tu nombre completo.')
    if (digitos.length < 10 || digitos.length > 13) return setError('Revisa tu teléfono: debe tener entre 10 y 13 números.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim())) return setError('Revisa tu correo, parece incompleto.')
    if (!fuente) return setError('Cuéntanos por dónde te enteraste del evento.')
    if (!acepto) return setError('Necesitamos tu autorización para guardar tus datos.')

    // Un robot llena el campo trampa: se le dice "listo" y no se guarda nada.
    if (trampa) {
      setConfirmado({ nombre: nombre.trim(), yaEstaba: false })
      return
    }

    setEnviando(true)
    const { error: fallo } = await createClient().from('event_registrations').insert({
      full_name: nombre.trim(),
      phone: telefono.trim(),
      email: correo.trim().toLowerCase(),
      source: fuente,
      source_detail: fuente === 'otro' && fuenteOtro.trim() ? fuenteOtro.trim() : null,
      consent: true,
    })
    setEnviando(false)

    if (fallo) {
      // 23505: ese teléfono ya está registrado -- para quien lo intenta es
      // una buena noticia, no un error.
      if (fallo.code === '23505') {
        setConfirmado({ nombre: nombre.trim(), yaEstaba: true })
        return
      }
      setError('No pudimos guardar tu registro. Revisa tu conexión e inténtalo de nuevo.')
      return
    }

    setConfirmado({ nombre: nombre.trim(), yaEstaba: false })
  }

  const detalles = [
    { etiqueta: 'Fecha', valor: info.fecha },
    { etiqueta: 'Hora', valor: info.hora },
    { etiqueta: 'Lugar', valor: info.lugar },
  ].filter((d) => d.valor)

  const cabecera = (
    <div className="space-y-3 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zr-border bg-zr-surface text-zr-blue">
        <MarcaZR size={30} />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">ZR Mecademy</p>
      <h1 className="zr-display text-4xl text-zr-text">{info.nombre}</h1>
    </div>
  )

  const bloqueDetalles = detalles.length > 0 && (
    <div className="grid gap-2">
      {detalles.map((d) => (
        <div key={d.etiqueta} className="flex items-baseline justify-between gap-4 rounded-xl border border-zr-border bg-zr-surface px-5 py-3">
          <span className="text-xs font-bold uppercase tracking-wider text-zr-text-muted">{d.etiqueta}</span>
          <span className="text-right text-sm font-semibold text-zr-text">{d.valor}</span>
        </div>
      ))}
    </div>
  )

  if (confirmado) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center bg-zr-bg px-5 py-10">
        <div className="w-full space-y-8">
          {cabecera}
          <div className="space-y-3 rounded-2xl border border-zr-success/30 bg-zr-success/12 px-6 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zr-success/20 text-zr-success">
              <IconoCheck size={28} />
            </div>
            <p className="text-xl font-bold text-zr-text">
              {confirmado.yaEstaba ? '¡Ya estabas registrado!' : '¡Listo'}{!confirmado.yaEstaba && `, ${confirmado.nombre.split(' ')[0]}!`}
            </p>
            <p className="text-sm text-zr-text-muted">
              {confirmado.yaEstaba
                ? 'Ese teléfono ya tenía su asistencia confirmada. Te esperamos.'
                : 'Tu asistencia quedó confirmada. Te esperamos.'}
            </p>
          </div>
          {bloqueDetalles}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center bg-zr-bg px-5 py-10">
      <div className="w-full space-y-8">
        {cabecera}

        {bloqueDetalles}

        <form onSubmit={enviar} className="space-y-5" noValidate>
          <div className="space-y-2">
            <label htmlFor="nombre" className="block text-sm font-semibold text-zr-text">Nombre completo</label>
            <input
              id="nombre"
              type="text"
              autoComplete="name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={120}
              className={CLASE_INPUT}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="telefono" className="block text-sm font-semibold text-zr-text">Teléfono</label>
            <input
              id="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="0414 123 4567"
              maxLength={20}
              className={CLASE_INPUT}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="correo" className="block text-sm font-semibold text-zr-text">Correo</label>
            <input
              id="correo"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              maxLength={160}
              className={CLASE_INPUT}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 block text-sm font-semibold text-zr-text">¿Por dónde te enteraste del evento?</legend>
            <div className="flex flex-wrap gap-2">
              {FUENTES.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  onClick={() => setFuente(f.valor)}
                  aria-pressed={fuente === f.valor}
                  className={`min-h-11 rounded-full border px-4 text-sm font-bold transition-colors ${
                    fuente === f.valor
                      ? 'border-zr-blue bg-zr-blue/20 text-zr-blue'
                      : 'border-zr-border bg-zr-surface text-zr-text-muted'
                  }`}
                >
                  {f.etiqueta}
                </button>
              ))}
            </div>
            {fuente === 'otro' && (
              <input
                type="text"
                value={fuenteOtro}
                onChange={(e) => setFuenteOtro(e.target.value)}
                placeholder="¿Cuál?"
                maxLength={120}
                aria-label="Otra fuente"
                className={`${CLASE_INPUT} mt-2`}
              />
            )}
          </fieldset>

          {/* Campo trampa para robots: fuera de pantalla, sin tabulador. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Sitio web
              <input type="text" tabIndex={-1} autoComplete="off" value={trampa} onChange={(e) => setTrampa(e.target.value)} />
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-zr-border bg-zr-surface px-4 py-4">
            <input
              type="checkbox"
              checked={acepto}
              onChange={(e) => setAcepto(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-zr-blue"
            />
            <span className="text-xs leading-relaxed text-zr-text-muted">
              Autorizo a ZR Mecademy a guardar mis datos y usarlos solo para contactarme sobre este
              evento. Si eres menor de edad, regístrate con ayuda de tu representante.
            </span>
          </label>

          {error && (
            <div role="alert" className="rounded-lg border border-zr-error/30 bg-zr-error/15 p-4 text-sm font-medium text-zr-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-xl bg-gradient-to-r from-zr-blue to-zr-blue-deep py-4 text-base font-bold text-white transition-all hover:shadow-lg hover:shadow-zr-blue/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : 'Confirmar mi asistencia'}
          </button>
        </form>
      </div>
    </main>
  )
}
