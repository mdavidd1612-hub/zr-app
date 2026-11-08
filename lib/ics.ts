/**
 * Un solo evento, para el botón "Agregar a mi calendario" de una tarea o
 * examen (pedido explícito del coordinador, reunión 7-nov-2026). El export
 * completo del calendario (fn_calendar_ical, migración 179) sigue siendo el
 * de "todo lo que tengo" -- este es el de "esto puntual, ahora".
 *
 * Bug real reportado en vivo (8-nov-2026): en iPhone, descargar un .ics abre
 * directo la hoja de "Agregar al calendario" -- es el comportamiento nativo
 * de Safari con ese tipo de archivo. En Android (probado en un Samsung) el
 * navegador solo lo descarga a Archivos; hay que ir a abrirlo a mano después,
 * y mucha gente no entiende ese paso. No hay forma de "abrir directo la app
 * de calendario" genérica para cualquier calendario de Android -- pero si el
 * teléfono usa Google Calendar (la inmensa mayoría), su propio link de
 * "agregar evento" sí abre directo la pantalla de agregar, sin descargar
 * nada. Se detecta Android y se usa ese link en vez del archivo .ics.
 */
function formatoICS(fecha: Date): string {
  return fecha.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function escaparTexto(texto: string): string {
  return texto.replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n')
}

function esAndroid(): boolean {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
}

function abrirEventoEnGoogleCalendar(opciones: { titulo: string; descripcion?: string; inicio: Date; fin: Date }) {
  const parametros = new URLSearchParams({
    action: 'TEMPLATE',
    text: opciones.titulo,
    dates: `${formatoICS(opciones.inicio)}/${formatoICS(opciones.fin)}`,
  })
  if (opciones.descripcion) parametros.set('details', opciones.descripcion)
  window.open(`https://calendar.google.com/calendar/render?${parametros.toString()}`, '_blank', 'noopener,noreferrer')
}

function descargarArchivoICS(opciones: { titulo: string; descripcion?: string; inicio: Date; fin: Date; nombreArchivo?: string }) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ZR App//Aula Virtual//ES',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@zrmecademy`,
    `DTSTAMP:${formatoICS(new Date())}`,
    `DTSTART:${formatoICS(opciones.inicio)}`,
    `DTEND:${formatoICS(opciones.fin)}`,
    `SUMMARY:${escaparTexto(opciones.titulo)}`,
    opciones.descripcion ? `DESCRIPTION:${escaparTexto(opciones.descripcion)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = opciones.nombreArchivo ?? 'evento.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function descargarEventoICS(opciones: {
  titulo: string
  descripcion?: string
  inicio: Date
  /** Sin fin, dura 1 hora por defecto (suficiente para que el calendario lo muestre). */
  fin?: Date
  nombreArchivo?: string
}) {
  const fin = opciones.fin ?? new Date(opciones.inicio.getTime() + 60 * 60 * 1000)
  if (esAndroid()) {
    abrirEventoEnGoogleCalendar({ ...opciones, fin })
  } else {
    descargarArchivoICS({ ...opciones, fin })
  }
}
