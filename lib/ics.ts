/**
 * Un solo evento .ics, para el botón "Agregar a mi calendario" de una tarea o
 * examen (pedido explícito del coordinador, reunión 7-nov-2026). El export
 * completo del calendario (fn_calendar_ical, migración 179) sigue siendo el
 * de "todo lo que tengo" -- este es el de "esto puntual, ahora". Abrir el
 * archivo .ics generado dispara la app de calendario nativa (iOS/Android/
 * escritorio), que es como se agrega sin pedir ningún permiso especial.
 */
function formatoICS(fecha: Date): string {
  return fecha.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function escaparTexto(texto: string): string {
  return texto.replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n')
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
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ZR App//Aula Virtual//ES',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@zrmecademy`,
    `DTSTAMP:${formatoICS(new Date())}`,
    `DTSTART:${formatoICS(opciones.inicio)}`,
    `DTEND:${formatoICS(fin)}`,
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
