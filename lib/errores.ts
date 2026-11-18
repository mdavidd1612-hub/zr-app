/**
 * Traduce errores de red/conexión (AbortError, "Failed to fetch", timeouts) a un
 * mensaje claro. Con internet lento el profesor veía "AbortError: The operation
 * was aborted" sin saber qué hacer (reporte del 18-nov-2026).
 */
export function mensajeError(msg: string | null | undefined): string {
  const m = msg ?? ''
  if (/abort|failed to fetch|networkerror|network request failed|timeout|timed out|load failed/i.test(m)) {
    return 'Se cortó o está muy lenta la conexión y no se pudo guardar. No perdiste lo que escribiste: revisa tu internet y vuelve a tocar Guardar.'
  }
  return m
}
