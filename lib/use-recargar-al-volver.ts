'use client'

/**
 * Antes recargaba la pagina entera al volver a la app tras 60 s oculta (para
 * revivir conexiones "muertas" tras suspender el equipo). Pedido del
 * coordinador (17-nov-2026): la app debe quedarse quieta, como una app de
 * verdad -- salir y volver NO debe recargar nada. Ya no hace falta: toda
 * peticion al servidor tiene un tope de 15 s (lib/supabase/client.ts) y falla
 * con un mensaje en vez de colgarse. Se deja el hook vacio para no tocar
 * quien lo llama.
 */
export function useRecargarAlVolver() {
  // intencionalmente vacio
}
