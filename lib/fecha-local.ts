/**
 * Convierte un instante ISO (UTC, como lo guarda la base) al valor que espera
 * un <input type="datetime-local">: "YYYY-MM-DDTHH:mm" en la HORA LOCAL del
 * usuario. Antes se hacía `iso.slice(0, 16)`, que muestra la hora UTC tal cual
 * (en Venezuela, 4 h de más): 11:35 AM se guardaba bien pero al reabrir decía
 * 3:35 PM, y al guardar de nuevo se desplazaba otras 4 horas (18-nov-2026).
 */
export function isoAInputLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
