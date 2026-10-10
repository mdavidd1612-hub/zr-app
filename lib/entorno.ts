/**
 * Distinguir el entorno de PRUEBA del de PRODUCCIÓN (pedido del coordinador,
 * oct. 2026): quien tiene instaladas las dos apps las confundía. El entorno de
 * prueba apunta a su propio proyecto de Supabase, así que se reconoce por ahí;
 * no hace falta otra variable que alguien tenga que acordarse de poner.
 */
const PROYECTO_PRUEBA = 'iazqmnfekulxjcqelzog'

export const ES_ENTORNO_PRUEBA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes(PROYECTO_PRUEBA)
export const SUFIJO_ENTORNO = ES_ENTORNO_PRUEBA ? ' (Prueba)' : ''
