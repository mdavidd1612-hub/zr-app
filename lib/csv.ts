/**
 * Exportación a CSV. Un solo lugar: si cada reporte armara su propio CSV, el
 * día que alguien olvide el BOM en uno de los cuatro, ese reporte sale con
 * los acentos rotos en Excel y nadie lo nota hasta que un profesor se queja.
 */
export function exportarCSV(nombreArchivo: string, columnas: string[], filas: (string | number)[][]) {
  const escapar = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const contenido = [columnas, ...filas].map((fila) => fila.map(escapar).join(',')).join('\r\n')

  // Excel en Windows asume la codificación local si no hay BOM. Sin este
  // prefijo, "Cédula" sale como "CÃ©dula" al abrir el archivo.
  const BOM = '﻿'
  const blob = new Blob([BOM + contenido], { type: 'text/csv;charset=utf-8;' })

  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}
