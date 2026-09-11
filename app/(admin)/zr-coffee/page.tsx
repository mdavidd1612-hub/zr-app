'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { IconoFlechaAtras } from '@/components/ui/Iconos'

/**
 * ZR Coffee — inventario y ventas de la cantina (migración 090, pedido
 * explícito del coordinador a partir de las especificaciones de
 * administradora Cecilia). Visible SOLO para quien esté en
 * `zr_coffee_managers` — el layout ya oculta el enlace del menú, esta
 * pantalla además redirige si alguien entra directo por la URL sin serlo
 * (RLS de todas formas le negaría los datos, esto es solo para no dejarlo
 * viendo una pantalla vacía y confundido).
 *
 * Costo y precio de venta viven en USD (estable frente a la inflación). La
 * tasa del día convierte a bolívares para mostrar cuánto cobrar — así no
 * hay que reescribir precios en Bs cada vez que la tasa cambia. Cada venta
 * guarda la tasa que se usó ese día (columna `tasa_usada`), para que el
 * historial no cambie de valor si la tasa de hoy es distinta.
 *
 * El descuento de inventario NUNCA se calcula aquí — pasa por
 * `fn_zr_coffee_registrar_venta` (server, atómico), igual que notas y QR
 * nunca se calculan en el navegador (regla 2 de AGENTS.md). La razón es la
 * misma: que dos ventas casi simultáneas no dejen el inventario en negativo.
 *
 * Interfaz tipo Excel (pedido explícito del coordinador, sept. 2026): Cecilia
 * lleva años trabajando esto en una hoja de cálculo y mandó la suya
 * ("Inventario y Control de Ventas.xlsx") como referencia. El inventario es
 * un cuadro con celdas editables de verdad — click, escribe, sale del campo
 * y se guarda — con una fila en blanco siempre al final para el próximo
 * producto, en vez de un formulario aparte. El historial de ventas por día
 * (ya se navegaba día por día) ahora también se ve como un cuadro, no como
 * una lista de tarjetas.
 *
 * Su hoja lleva DOS cantidades, no una (migración 091): "Cantidad" (todo lo
 * que se ha repuesto de ese producto en total) y "Cantidad Restante" (lo que
 * queda ahora). `zr_coffee_products.total_repuesto` es la primera -- solo
 * sube, con "+ Reponer"; `stock` sigue siendo la segunda -- baja con cada
 * venta y sube junto con `total_repuesto` al reponer. Restar una de la otra
 * es cuánto se ha vendido en total, de un vistazo, sin abrir el historial.
 *
 * Tasa del día (pedido explícito del coordinador, sept. 2026): se trae sola
 * desde Al Cambio (alcambio.app) al abrir la pantalla si todavía no se
 * registró hoy — /api/zr-coffee/tasa hace esa consulta del lado del
 * servidor. Sigue pudiéndose escribir a mano (botón "Manual") por si la
 * consulta falla o hay que corregirla.
 *
 * Selector de moneda por celda (pedido explícito del coordinador, sept.
 * 2026): Costo y Precio de venta se pueden escribir y leer en dólares o en
 * bolívares (botón "$ | Bs" al lado de cada uno) -- por dentro siempre se
 * guardan en USD, la conversión es solo de entrada/salida usando la tasa
 * del día. Ganancia y Precio de venta también son editables directamente
 * (migración 092, columna `sale_price`): si se tocan a mano quedan fijos
 * aunque cambie el costo después, hasta que se toque "volver a automático"
 * -- ahí vuelven a salir solos del costo + el margen de `system_config`.
 * Eliminar un producto no borra la fila (rompería `zr_coffee_sales`, que
 * referencia `product_id` con `on delete restrict`): apaga `active`, igual
 * que ya se hacía para dar de baja cualquier otro registro de la app.
 */

interface Producto {
  id: string
  nombre: string
  costo: number
  precioVentaManual: number | null
  cantidadTotal: number
  stock: number
  activo: boolean
}

type Moneda = 'USD' | 'BS'

interface Venta {
  id: string
  productoId: string
  productoNombre: string
  cantidad: number
  precioUnitario: number
  total: number
  tasaUsada: number | null
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function fechaLarga(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-VE', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function bs(usd: number, tasa: number | null) {
  if (!tasa) return null
  return usd * tasa
}

function usdDesdeBs(valorBs: number, tasa: number | null) {
  if (!tasa) return null
  return valorBs / tasa
}

// Para el VALOR de una celda editable: sin separador de miles (a diferencia
// de formatoUSD, que sí lo pone) -- un monto en bolívares puede pasar de
// 1.000 fácilmente, y ese punto se confundiría con el separador decimal al
// volver a leer lo que se escribió.
function numeroEditable(n: number) {
  return n.toFixed(2)
}

const formatoUSD = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const claseCelda =
  'w-full rounded border border-transparent bg-transparent px-2 py-2 text-zr-text focus:border-zr-blue focus:bg-zr-bg focus:outline-none'

export default function ZRCoffee() {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)
  const [margenPct, setMargenPct] = useState(30)

  const [productos, setProductos] = useState<Producto[]>([])
  const [cargandoProductos, setCargandoProductos] = useState(true)

  const [tasaHoy, setTasaHoy] = useState<number | null>(null)
  const [tasaHoyCargada, setTasaHoyCargada] = useState(false)
  const [editandoTasa, setEditandoTasa] = useState(false)
  const [tasaInput, setTasaInput] = useState('')
  const [guardandoTasa, setGuardandoTasa] = useState(false)
  const [actualizandoTasaAuto, setActualizandoTasaAuto] = useState(false)
  const [errorTasaAuto, setErrorTasaAuto] = useState<string | null>(null)

  const [vendiendoId, setVendiendoId] = useState<string | null>(null)
  const [cantidadVenta, setCantidadVenta] = useState('')
  const [errorVenta, setErrorVenta] = useState<string | null>(null)
  const [procesandoVenta, setProcesandoVenta] = useState(false)

  const [reponiendoId, setReponiendoId] = useState<string | null>(null)
  const [cantidadReponer, setCantidadReponer] = useState('')
  const [guardandoReponer, setGuardandoReponer] = useState(false)

  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [guardandoEliminar, setGuardandoEliminar] = useState(false)

  const [fechaHistorial, setFechaHistorial] = useState(hoyISO())
  const [ventasDelDia, setVentasDelDia] = useState<Venta[]>([])
  const [cargandoVentas, setCargandoVentas] = useState(true)

  // ---------------------------------------------------------------------------
  // Acceso
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function verificar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: gestor } = await supabase
        .from('zr_coffee_managers').select('profile_id').eq('profile_id', user.id).maybeSingle()
      if (!gestor) {
        router.replace('/panel')
        return
      }
      setVerificando(false)
    }
    verificar()
  }, [router])

  // ---------------------------------------------------------------------------
  // Margen configurado (nunca escrito en el código — regla 5 de AGENTS.md)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (verificando) return
    createClient()
      .from('system_config').select('value').eq('key', 'zr_coffee.margen_ganancia_pct').maybeSingle()
      .then(({ data }) => {
        const v = Number(data?.value)
        if (v > 0) setMargenPct(v)
      })
  }, [verificando])

  // ---------------------------------------------------------------------------
  // Productos
  // ---------------------------------------------------------------------------
  const cargarProductos = useCallback(async () => {
    setCargandoProductos(true)
    const { data } = await createClient()
      .from('zr_coffee_products')
      .select('id, name, cost, sale_price, stock, total_repuesto, active')
      .eq('active', true)
      .order('name')

    setProductos(
      (data ?? []).map((p) => ({
        id: p.id, nombre: p.name, costo: Number(p.cost),
        precioVentaManual: p.sale_price != null ? Number(p.sale_price) : null,
        cantidadTotal: Number(p.total_repuesto), stock: Number(p.stock), activo: p.active,
      })),
    )
    setCargandoProductos(false)
  }, [])

  useEffect(() => {
    if (verificando) return
    void cargarProductos()
  }, [verificando, cargarProductos])

  async function actualizarCampoProducto(id: string, campo: 'name' | 'cost' | 'stock', valor: string | number) {
    const supabase = createClient()
    if (campo === 'name') {
      await supabase.from('zr_coffee_products').update({ name: String(valor) }).eq('id', id)
    } else if (campo === 'cost') {
      await supabase.from('zr_coffee_products').update({ cost: Number(valor) }).eq('id', id)
    } else {
      await supabase.from('zr_coffee_products').update({ stock: Number(valor) }).eq('id', id)
    }
    await cargarProductos()
  }

  // Precio de venta manual (migración 092): null vuelve a dejarlo automático
  // (costo + margen de system_config); cualquier otro número lo fija tal
  // cual, sin importar qué pase después con el costo o la tasa.
  async function guardarPrecioVentaManual(id: string, valorUSD: number | null) {
    await createClient().from('zr_coffee_products').update({ sale_price: valorUSD }).eq('id', id)
    await cargarProductos()
  }

  // Eliminar (pedido explícito del coordinador, sept. 2026): en realidad
  // desactiva (`active = false`, ya filtrado en cargarProductos) en vez de
  // borrar la fila -- `zr_coffee_sales.product_id` tiene `on delete
  // restrict` (migración 090) justo para que una venta ya registrada nunca
  // se quede huérfana si el producto se retira del catálogo.
  async function eliminarProducto(id: string) {
    setGuardandoEliminar(true)
    await createClient().from('zr_coffee_products').update({ active: false }).eq('id', id)
    setEliminandoId(null)
    setGuardandoEliminar(false)
    await cargarProductos()
  }

  async function crearProductoDesdeFila(nombre: string, costo: number, stock: number) {
    // "Cantidad" arranca igual a la existencia inicial -- a partir de aquí
    // solo sube cuando se repone (migración 091).
    await createClient().from('zr_coffee_products').insert({ name: nombre, cost: costo, stock, total_repuesto: stock })
    await cargarProductos()
  }

  // "+ Reponer" (migración 091): a diferencia de editar la celda "Cantidad
  // Restante" (una corrección puntual, p. ej. un conteo físico), reponer
  // suma existencia real que se compró -- por eso mueve ambas columnas
  // juntas, igual que en la hoja de Cecilia.
  function abrirReponer(id: string) {
    setReponiendoId(id); setCantidadReponer('')
  }

  async function confirmarReponer(producto: Producto) {
    const cantidad = Number(cantidadReponer.replace(',', '.'))
    if (!cantidad || cantidad <= 0) return
    setGuardandoReponer(true)
    await createClient().from('zr_coffee_products').update({
      stock: producto.stock + cantidad,
      total_repuesto: producto.cantidadTotal + cantidad,
    }).eq('id', producto.id)
    setReponiendoId(null)
    setCantidadReponer('')
    setGuardandoReponer(false)
    await cargarProductos()
  }

  // ---------------------------------------------------------------------------
  // Tasa del día
  // ---------------------------------------------------------------------------
  const cargarTasaHoy = useCallback(async () => {
    const { data } = await createClient()
      .from('zr_coffee_tasa_cambio').select('tasa').eq('fecha', hoyISO()).maybeSingle()
    setTasaHoy(data ? Number(data.tasa) : null)
    setTasaHoyCargada(true)
  }, [])

  useEffect(() => {
    if (verificando) return
    void cargarTasaHoy()
  }, [verificando, cargarTasaHoy])

  async function guardarTasa() {
    const valor = Number(tasaInput.replace(',', '.'))
    if (!valor || valor <= 0) return
    setGuardandoTasa(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('zr_coffee_tasa_cambio').upsert({
      fecha: hoyISO(), tasa: valor, registrado_por: user?.id ?? null,
    })
    await cargarTasaHoy()
    setEditandoTasa(false)
    setTasaInput('')
    setGuardandoTasa(false)
  }

  const actualizarTasaAutomatica = useCallback(async () => {
    setActualizandoTasaAuto(true)
    setErrorTasaAuto(null)
    try {
      const res = await fetch('/api/zr-coffee/tasa')
      const json: { tasa?: number; error?: string } = await res.json()
      if (!res.ok || !json.tasa) {
        setErrorTasaAuto(json.error ?? 'No se pudo traer la tasa de Al Cambio.')
        return
      }
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('zr_coffee_tasa_cambio').upsert({
        fecha: hoyISO(), tasa: json.tasa, registrado_por: user?.id ?? null,
      })
      await cargarTasaHoy()
    } catch {
      setErrorTasaAuto('No se pudo conectar con Al Cambio. Intenta de nuevo o regístrala a mano.')
    } finally {
      setActualizandoTasaAuto(false)
    }
  }, [cargarTasaHoy])

  // Si todavía no hay tasa registrada hoy, se trae sola de Al Cambio una vez
  // que termina de cargar — Cecilia no tiene que acordarse de pedirla cada
  // sábado. El botón "Traer de Al Cambio" sigue ahí para repetirla a mano.
  useEffect(() => {
    if (!tasaHoyCargada || tasaHoy !== null) return
    void actualizarTasaAutomatica()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasaHoyCargada])

  // ---------------------------------------------------------------------------
  // Vender
  // ---------------------------------------------------------------------------
  function abrirVenta(id: string) {
    setVendiendoId(id); setCantidadVenta(''); setErrorVenta(null)
  }

  async function confirmarVenta(producto: Producto) {
    const cantidad = Number(cantidadVenta.replace(',', '.'))
    if (!cantidad || cantidad <= 0) {
      setErrorVenta('Escribe cuántas unidades se vendieron.')
      return
    }
    if (cantidad > producto.stock) {
      setErrorVenta(`Solo quedan ${producto.stock}.`)
      return
    }

    setProcesandoVenta(true)
    setErrorVenta(null)
    const precioVenta = producto.precioVentaManual ?? producto.costo * (1 + margenPct / 100)

    const { error } = await createClient().rpc('fn_zr_coffee_registrar_venta', {
      p_product_id: producto.id,
      p_cantidad: cantidad,
      p_precio_unitario: precioVenta,
    })

    if (error) {
      setErrorVenta('No se pudo registrar la venta. Intenta de nuevo.')
      setProcesandoVenta(false)
      return
    }

    setVendiendoId(null)
    setCantidadVenta('')
    setProcesandoVenta(false)
    await Promise.all([cargarProductos(), cargarVentasDelDia(fechaHistorial)])
  }

  // ---------------------------------------------------------------------------
  // Historial de ventas, día por día
  // ---------------------------------------------------------------------------
  const cargarVentasDelDia = useCallback(async (fecha: string) => {
    setCargandoVentas(true)
    const { data } = await createClient()
      .from('zr_coffee_sales')
      .select('id, product_id, quantity, unit_price, total, tasa_usada, zr_coffee_products(name)')
      .eq('sold_at', fecha)
      .order('created_at', { ascending: false })

    setVentasDelDia(
      ((data ?? []) as unknown as {
        id: string; product_id: string; quantity: number; unit_price: number; total: number
        tasa_usada: number | null; zr_coffee_products: { name: string } | null
      }[]).map((v) => ({
        id: v.id,
        productoId: v.product_id,
        productoNombre: v.zr_coffee_products?.name ?? '—',
        cantidad: Number(v.quantity),
        precioUnitario: Number(v.unit_price),
        total: Number(v.total),
        tasaUsada: v.tasa_usada ? Number(v.tasa_usada) : null,
      })),
    )
    setCargandoVentas(false)
  }, [])

  useEffect(() => {
    if (verificando) return
    void cargarVentasDelDia(fechaHistorial)
  }, [verificando, fechaHistorial, cargarVentasDelDia])

  function cambiarDia(delta: number) {
    const d = new Date(fechaHistorial + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setFechaHistorial(d.toISOString().slice(0, 10))
  }

  const totalDia = useMemo(() => ventasDelDia.reduce((acc, v) => acc + v.total, 0), [ventasDelDia])
  const gananciaDia = useMemo(
    () => ventasDelDia.reduce((acc, v) => {
      const producto = productos.find((p) => p.id === v.productoId)
      const costoUnit = producto?.costo ?? v.precioUnitario / (1 + margenPct / 100)
      return acc + (v.precioUnitario - costoUnit) * v.cantidad
    }, 0),
    [ventasDelDia, productos, margenPct],
  )

  if (verificando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Verificando acceso…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14 pb-16">
      <BotonVolver href="/panel" />

      <Encabezado
        sobretitulo="Administración"
        titulo="ZR Coffee"
        descripcion="Inventario y ventas de la cantina."
      />

      <Regla delay={60} />

      {/* ------------------------------ Tasa del día ------------------------------ */}
      <div className="zr-card space-y-3 p-5">
        <p className="text-sm font-bold text-zr-text">Tasa del día</p>
        {editandoTasa ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={tasaInput}
              onChange={(e) => setTasaInput(e.target.value)}
              placeholder="Ej. 45,80"
              autoFocus
              className="w-32 rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            />
            <button
              onClick={guardarTasa}
              disabled={guardandoTasa}
              className="rounded-lg bg-zr-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {guardandoTasa ? '…' : 'Guardar'}
            </button>
            <button
              onClick={() => { setEditandoTasa(false); setTasaInput('') }}
              className="text-sm font-semibold text-zr-text-muted"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="zr-metric text-2xl text-zr-blue">
              {actualizandoTasaAuto ? 'Consultando Al Cambio…' : tasaHoy ? `${formatoUSD.format(tasaHoy)} Bs/USD` : 'Sin registrar hoy'}
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={actualizarTasaAutomatica}
                disabled={actualizandoTasaAuto}
                className="rounded-lg border border-zr-blue/40 px-3 py-2 text-xs font-bold text-zr-blue-mid disabled:opacity-50"
              >
                {actualizandoTasaAuto ? '…' : 'Traer de Al Cambio'}
              </button>
              <button
                onClick={() => { setEditandoTasa(true); setTasaInput(tasaHoy ? String(tasaHoy) : '') }}
                className="rounded-lg border border-zr-border px-3 py-2 text-xs font-semibold text-zr-text"
              >
                Manual
              </button>
            </div>
          </div>
        )}
        {errorTasaAuto && <p className="text-xs text-zr-error">{errorTasaAuto}</p>}
        <p className="text-xs text-zr-text-muted">
          Los precios se guardan en USD. Todo lo que se cobra en bolívares se calcula con esta tasa
          (dólar BCV, tomada de Al Cambio — se puede corregir a mano con &ldquo;Manual&rdquo;).
        </p>
      </div>

      {/* ------------------------------ Inventario ------------------------------ */}
      <Seccion numero={1} titulo="Inventario" delay={120}>
        <p className="text-xs text-zr-text-muted">
          Igual que en Excel: haz clic en un campo, escribe y sal del campo para guardar. La última
          fila siempre está en blanco, lista para el próximo producto.
        </p>

        {cargandoProductos ? (
          <p className="text-sm text-zr-text-muted">Cargando…</p>
        ) : (
          <>
            {/* Computadora: cuadro tipo Excel. */}
            <div className="hidden overflow-x-auto rounded-lg border border-zr-border lg:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-zr-surface">
                    <th className="border-b border-zr-border px-2 py-3 text-left font-bold text-zr-text">Producto</th>
                    <th className="border-b border-zr-border px-2 py-3 text-right font-bold text-zr-text">Cantidad</th>
                    <th className="border-b border-zr-border px-2 py-3 text-right font-bold text-zr-text">Costo</th>
                    <th className="border-b border-zr-border px-3 py-3 text-right font-bold text-zr-text">Ganancia</th>
                    <th className="border-b border-zr-border px-3 py-3 text-right font-bold text-zr-text">Precio venta</th>
                    <th className="border-b border-zr-border px-3 py-3 text-right font-bold text-zr-text">Equivalente</th>
                    <th className="border-b border-zr-border px-2 py-3 text-right font-bold text-zr-text">Cantidad restante</th>
                    <th className="border-b border-zr-border px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => (
                    <FilaProductoEscritorio
                      key={p.id}
                      producto={p}
                      margenPct={margenPct}
                      tasaHoy={tasaHoy}
                      onGuardarCampo={(campo, valor) => actualizarCampoProducto(p.id, campo, valor)}
                      onGuardarPrecioVenta={(valorUSD) => guardarPrecioVentaManual(p.id, valorUSD)}
                      vendiendo={vendiendoId === p.id}
                      cantidadVenta={cantidadVenta} setCantidadVenta={setCantidadVenta}
                      errorVenta={errorVenta} procesandoVenta={procesandoVenta}
                      onAbrirVenta={() => abrirVenta(p.id)}
                      onConfirmarVenta={() => confirmarVenta(p)}
                      onCancelarVenta={() => { setVendiendoId(null); setErrorVenta(null) }}
                      reponiendo={reponiendoId === p.id}
                      cantidadReponer={cantidadReponer} setCantidadReponer={setCantidadReponer}
                      guardandoReponer={guardandoReponer}
                      onAbrirReponer={() => abrirReponer(p.id)}
                      onConfirmarReponer={() => confirmarReponer(p)}
                      onCancelarReponer={() => setReponiendoId(null)}
                      eliminando={eliminandoId === p.id}
                      guardandoEliminar={guardandoEliminar}
                      onAbrirEliminar={() => setEliminandoId(p.id)}
                      onConfirmarEliminar={() => eliminarProducto(p.id)}
                      onCancelarEliminar={() => setEliminandoId(null)}
                    />
                  ))}
                  <FilaNuevoProductoEscritorio onCrear={crearProductoDesdeFila} />
                </tbody>
              </table>
            </div>

            {/* Teléfono: una tarjeta por producto, con los mismos campos editables. */}
            <div className="space-y-3 lg:hidden">
              <TarjetaNuevoProducto onCrear={crearProductoDesdeFila} />
              {productos.map((p) => (
                <TarjetaProducto
                  key={p.id}
                  producto={p}
                  margenPct={margenPct}
                  tasaHoy={tasaHoy}
                  onGuardarCampo={(campo, valor) => actualizarCampoProducto(p.id, campo, valor)}
                  onGuardarPrecioVenta={(valorUSD) => guardarPrecioVentaManual(p.id, valorUSD)}
                  vendiendo={vendiendoId === p.id}
                  cantidadVenta={cantidadVenta} setCantidadVenta={setCantidadVenta}
                  errorVenta={errorVenta} procesandoVenta={procesandoVenta}
                  onAbrirVenta={() => abrirVenta(p.id)}
                  onConfirmarVenta={() => confirmarVenta(p)}
                  onCancelarVenta={() => { setVendiendoId(null); setErrorVenta(null) }}
                  reponiendo={reponiendoId === p.id}
                  cantidadReponer={cantidadReponer} setCantidadReponer={setCantidadReponer}
                  guardandoReponer={guardandoReponer}
                  onAbrirReponer={() => abrirReponer(p.id)}
                  onConfirmarReponer={() => confirmarReponer(p)}
                  onCancelarReponer={() => setReponiendoId(null)}
                  eliminando={eliminandoId === p.id}
                  guardandoEliminar={guardandoEliminar}
                  onAbrirEliminar={() => setEliminandoId(p.id)}
                  onConfirmarEliminar={() => eliminarProducto(p.id)}
                  onCancelarEliminar={() => setEliminandoId(null)}
                />
              ))}
            </div>
          </>
        )}
      </Seccion>

      {/* ------------------------------ Historial ------------------------------ */}
      <Seccion numero={2} titulo="Ventas por día" delay={200}>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-zr-border bg-zr-surface px-4 py-3">
          <button onClick={() => cambiarDia(-1)} aria-label="Día anterior" className="p-1 text-zr-text-muted">
            <IconoFlechaAtras size={18} />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold capitalize text-zr-text">{fechaLarga(fechaHistorial)}</p>
            {fechaHistorial !== hoyISO() && (
              <button onClick={() => setFechaHistorial(hoyISO())} className="text-xs font-semibold text-zr-blue-mid">
                Volver a hoy
              </button>
            )}
          </div>
          <button
            onClick={() => cambiarDia(1)}
            aria-label="Día siguiente"
            disabled={fechaHistorial >= hoyISO()}
            className="rotate-180 p-1 text-zr-text-muted disabled:opacity-30"
          >
            <IconoFlechaAtras size={18} />
          </button>
        </div>

        {cargandoVentas ? (
          <p className="text-sm text-zr-text-muted">Cargando…</p>
        ) : ventasDelDia.length === 0 ? (
          <EstadoVacio titulo="Sin ventas este día" explicacion="Las ventas que registres van a aparecer aquí." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="zr-card p-4">
                <p className="zr-metric text-2xl text-zr-blue">${formatoUSD.format(totalDia)}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zr-text-muted">Vendido</p>
              </div>
              <div className="zr-card p-4">
                <p className="zr-metric text-2xl text-zr-success">${formatoUSD.format(gananciaDia)}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zr-text-muted">Ganancia</p>
              </div>
            </div>

            {/* Computadora: cuadro con todas las ventas del día. */}
            <div className="hidden overflow-x-auto rounded-lg border border-zr-border lg:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-zr-surface">
                    <th className="border-b border-zr-border px-4 py-3 text-left font-bold text-zr-text">Producto</th>
                    <th className="border-b border-zr-border px-3 py-3 text-right font-bold text-zr-text">Cantidad</th>
                    <th className="border-b border-zr-border px-3 py-3 text-right font-bold text-zr-text">Precio unitario</th>
                    <th className="border-b border-zr-border px-3 py-3 text-right font-bold text-zr-text">Tasa usada</th>
                    <th className="border-b border-zr-border px-3 py-3 text-right font-bold text-zr-text">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasDelDia.map((v) => (
                    <tr key={v.id} className="border-b border-zr-border last:border-b-0">
                      <td className="px-4 py-3 font-semibold text-zr-text">{v.productoNombre}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-zr-text">{v.cantidad}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-zr-text-muted">${formatoUSD.format(v.precioUnitario)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-zr-text-muted">
                        {v.tasaUsada ? formatoUSD.format(v.tasaUsada) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-bold text-zr-text">${formatoUSD.format(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Teléfono: una tarjeta por venta. */}
            <div className="space-y-2 lg:hidden">
              {ventasDelDia.map((v) => (
                <div key={v.id} className="zr-card flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zr-text">{v.productoNombre}</p>
                    <p className="text-xs tabular-nums text-zr-text-muted">
                      {v.cantidad} × ${formatoUSD.format(v.precioUnitario)}
                      {v.tasaUsada ? ` · tasa ${formatoUSD.format(v.tasaUsada)}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 tabular-nums font-bold text-zr-text">${formatoUSD.format(v.total)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </Seccion>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Celda editable — el ingrediente del "cuadro Excel": se ve como texto
// plano hasta que se hace clic, y guarda al salir del campo (blur) o con
// Enter. Mantiene su propio valor mientras se escribe para no perder el
// cursor con cada recarga del padre; se resincroniza si el valor de afuera
// cambia (por ejemplo, después de guardar).
// ---------------------------------------------------------------------------
function CeldaEditable({
  valor, onGuardar, tipo = 'texto', placeholder, className,
}: {
  valor: string
  onGuardar: (valor: string) => void
  tipo?: 'texto' | 'decimal'
  placeholder?: string
  className?: string
}) {
  const [local, setLocal] = useState(valor)

  useEffect(() => { setLocal(valor) }, [valor])

  return (
    <input
      type="text"
      inputMode={tipo === 'decimal' ? 'decimal' : 'text'}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== valor) onGuardar(local) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className={className ?? claseCelda}
    />
  )
}

interface PropsFilaProducto {
  producto: Producto
  margenPct: number
  tasaHoy: number | null
  onGuardarCampo: (campo: 'name' | 'cost' | 'stock', valor: string | number) => void
  onGuardarPrecioVenta: (valorUSD: number | null) => void
  vendiendo: boolean
  cantidadVenta: string; setCantidadVenta: (v: string) => void
  errorVenta: string | null; procesandoVenta: boolean
  onAbrirVenta: () => void; onConfirmarVenta: () => void; onCancelarVenta: () => void
  reponiendo: boolean
  cantidadReponer: string; setCantidadReponer: (v: string) => void
  guardandoReponer: boolean
  onAbrirReponer: () => void; onConfirmarReponer: () => void; onCancelarReponer: () => void
  eliminando: boolean
  guardandoEliminar: boolean
  onAbrirEliminar: () => void; onConfirmarEliminar: () => void; onCancelarEliminar: () => void
}

// Selector de moneda por campo (pedido explícito del coordinador, sept.
// 2026): Costo y Precio de venta se guardan siempre en USD (estable frente
// a la inflación, igual que antes), pero Cecilia necesita escribirlos y
// leerlos en bolívares sin hacer la cuenta a mano. Este selector solo
// decide en qué moneda se MUESTRA y se ESCRIBE ese campo -- la conversión
// usa la tasa del día y el valor de siempre se guarda en USD.
function SelectorMoneda({ valor, onCambiar, disabled }: { valor: Moneda; onCambiar: (m: Moneda) => void; disabled?: boolean }) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded border border-zr-border text-[10px] font-bold">
      <button
        type="button" onClick={() => onCambiar('USD')} disabled={disabled}
        className={`px-1.5 py-1 ${valor === 'USD' ? 'bg-zr-blue text-white' : 'text-zr-text-muted'} disabled:opacity-40`}
      >
        $
      </button>
      <button
        type="button" onClick={() => onCambiar('BS')} disabled={disabled}
        className={`px-1.5 py-1 ${valor === 'BS' ? 'bg-zr-blue text-white' : 'text-zr-text-muted'} disabled:opacity-40`}
      >
        Bs
      </button>
    </div>
  )
}

function FilaProductoEscritorio({
  producto: p, margenPct, tasaHoy, onGuardarCampo, onGuardarPrecioVenta,
  vendiendo, cantidadVenta, setCantidadVenta, errorVenta, procesandoVenta,
  onAbrirVenta, onConfirmarVenta, onCancelarVenta,
  reponiendo, cantidadReponer, setCantidadReponer, guardandoReponer,
  onAbrirReponer, onConfirmarReponer, onCancelarReponer,
  eliminando, guardandoEliminar, onAbrirEliminar, onConfirmarEliminar, onCancelarEliminar,
}: PropsFilaProducto) {
  const [monedaCosto, setMonedaCosto] = useState<Moneda>('USD')
  const [monedaVenta, setMonedaVenta] = useState<Moneda>('USD')

  const precioVentaUSD = p.precioVentaManual ?? p.costo * (1 + margenPct / 100)
  const gananciaUSD = precioVentaUSD - p.costo

  const costoMostrado = monedaCosto === 'USD' ? p.costo : bs(p.costo, tasaHoy) ?? p.costo
  const gananciaMostrada = monedaCosto === 'USD' ? gananciaUSD : bs(gananciaUSD, tasaHoy) ?? gananciaUSD
  const precioVentaMostrado = monedaVenta === 'USD' ? precioVentaUSD : bs(precioVentaUSD, tasaHoy) ?? precioVentaUSD
  // La columna "Equivalente" (más abajo) siempre muestra la moneda contraria
  // a la que se eligió para Precio de venta, como referencia cruzada rápida.

  function guardarCosto(v: string) {
    const n = Number(v.replace(',', '.'))
    if (!(n >= 0)) return
    const nuevoUSD = monedaCosto === 'USD' ? n : usdDesdeBs(n, tasaHoy)
    if (nuevoUSD !== null) onGuardarCampo('cost', nuevoUSD)
  }

  function guardarGanancia(v: string) {
    const n = Number(v.replace(',', '.'))
    if (Number.isNaN(n)) return
    const nuevaGananciaUSD = monedaCosto === 'USD' ? n : usdDesdeBs(n, tasaHoy)
    if (nuevaGananciaUSD !== null) onGuardarPrecioVenta(p.costo + nuevaGananciaUSD)
  }

  function guardarPrecioVenta(v: string) {
    const n = Number(v.replace(',', '.'))
    if (!(n >= 0)) return
    const nuevoUSD = monedaVenta === 'USD' ? n : usdDesdeBs(n, tasaHoy)
    if (nuevoUSD !== null) onGuardarPrecioVenta(nuevoUSD)
  }

  return (
    <tr className="border-b border-zr-border last:border-b-0 hover:bg-zr-surface/60">
      <td className="px-1 py-1">
        <CeldaEditable
          valor={p.nombre}
          onGuardar={(v) => { if (v.trim()) onGuardarCampo('name', v.trim()) }}
          className={`${claseCelda} text-left font-semibold`}
        />
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-zr-text-muted">{p.cantidadTotal}</td>
      <td className="px-1 py-1">
        <div className="flex items-center justify-end gap-1">
          <SelectorMoneda valor={monedaCosto} onCambiar={setMonedaCosto} disabled={!tasaHoy} />
          <CeldaEditable
            valor={numeroEditable(costoMostrado)}
            tipo="decimal"
            onGuardar={guardarCosto}
            className={`${claseCelda} w-20 text-right tabular-nums`}
          />
        </div>
      </td>
      <td className="px-1 py-1">
        <CeldaEditable
          valor={numeroEditable(gananciaMostrada)}
          tipo="decimal"
          onGuardar={guardarGanancia}
          className={`${claseCelda} w-20 text-right tabular-nums text-zr-text-muted`}
        />
      </td>
      <td className="px-1 py-1">
        <div className="flex items-center justify-end gap-1">
          <SelectorMoneda valor={monedaVenta} onCambiar={setMonedaVenta} disabled={!tasaHoy} />
          <CeldaEditable
            valor={numeroEditable(precioVentaMostrado)}
            tipo="decimal"
            onGuardar={guardarPrecioVenta}
            className={`${claseCelda} w-20 text-right tabular-nums font-semibold text-zr-blue`}
          />
        </div>
        {p.precioVentaManual !== null && (
          <button
            onClick={() => onGuardarPrecioVenta(null)}
            className="mt-0.5 block w-full text-right text-[10px] font-semibold text-zr-blue-mid"
          >
            ↺ volver a automático
          </button>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-zr-text-muted">
        {monedaVenta === 'USD'
          ? (bs(precioVentaUSD, tasaHoy) !== null ? `${formatoUSD.format(bs(precioVentaUSD, tasaHoy)!)} Bs` : '—')
          : `$${formatoUSD.format(precioVentaUSD)}`}
      </td>
      <td className="px-1 py-1">
        <CeldaEditable
          valor={String(p.stock)}
          tipo="decimal"
          onGuardar={(v) => { const n = Number(v.replace(',', '.')); if (n >= 0) onGuardarCampo('stock', n) }}
          className={`${claseCelda} w-16 text-right tabular-nums ${p.stock === 0 ? 'font-bold text-zr-error' : ''}`}
        />
      </td>
      <td className="px-3 py-3">
        <AccionesFila
          producto={p}
          vendiendo={vendiendo}
          cantidadVenta={cantidadVenta} setCantidadVenta={setCantidadVenta}
          errorVenta={errorVenta} procesandoVenta={procesandoVenta}
          onAbrirVenta={onAbrirVenta} onConfirmarVenta={onConfirmarVenta} onCancelarVenta={onCancelarVenta}
          reponiendo={reponiendo}
          cantidadReponer={cantidadReponer} setCantidadReponer={setCantidadReponer}
          guardandoReponer={guardandoReponer}
          onAbrirReponer={onAbrirReponer} onConfirmarReponer={onConfirmarReponer} onCancelarReponer={onCancelarReponer}
          eliminando={eliminando}
          guardandoEliminar={guardandoEliminar}
          onAbrirEliminar={onAbrirEliminar} onConfirmarEliminar={onConfirmarEliminar} onCancelarEliminar={onCancelarEliminar}
        />
      </td>
    </tr>
  )
}

function FilaNuevoProductoEscritorio({ onCrear }: { onCrear: (nombre: string, costo: number, stock: number) => Promise<void> }) {
  const [nombre, setNombre] = useState('')
  const [costo, setCosto] = useState('')
  const [stock, setStock] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function intentarCrear() {
    const costoNum = Number(costo.replace(',', '.'))
    if (!nombre.trim() || !(costoNum >= 0) || guardando) return
    setGuardando(true)
    await onCrear(nombre.trim(), costoNum, Number(stock.replace(',', '.')) || 0)
    setNombre(''); setCosto(''); setStock('')
    setGuardando(false)
  }

  return (
    <tr className="border-b border-dashed border-zr-blue/30 bg-zr-blue/5">
      <td className="px-1 py-1">
        <input
          type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={intentarCrear}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder="+ Nuevo producto…"
          className={`${claseCelda} text-left font-semibold placeholder:font-normal placeholder:text-zr-blue-mid`}
        />
      </td>
      <td className="px-1 py-1">
        <input
          type="text" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} onBlur={intentarCrear}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder="0"
          className={`${claseCelda} w-16 text-right tabular-nums`}
        />
      </td>
      <td className="px-1 py-1">
        <div className="flex items-center justify-end gap-1">
          <span className="text-xs text-zr-text-muted">$</span>
          <input
            type="text" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} onBlur={intentarCrear}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            placeholder="0,00"
            className={`${claseCelda} w-20 text-right tabular-nums`}
          />
        </div>
      </td>
      <td colSpan={5} className="px-3 py-3 text-xs text-zr-text-muted">
        {guardando ? 'Guardando…' : 'Escribe el producto, la cantidad y el costo para agregarlo'}
      </td>
    </tr>
  )
}

function TarjetaProducto({
  producto: p, margenPct, tasaHoy, onGuardarCampo, onGuardarPrecioVenta,
  vendiendo, cantidadVenta, setCantidadVenta, errorVenta, procesandoVenta,
  onAbrirVenta, onConfirmarVenta, onCancelarVenta,
  reponiendo, cantidadReponer, setCantidadReponer, guardandoReponer,
  onAbrirReponer, onConfirmarReponer, onCancelarReponer,
  eliminando, guardandoEliminar, onAbrirEliminar, onConfirmarEliminar, onCancelarEliminar,
}: PropsFilaProducto) {
  const [monedaCosto, setMonedaCosto] = useState<Moneda>('USD')
  const [monedaVenta, setMonedaVenta] = useState<Moneda>('USD')

  const precioVentaUSD = p.precioVentaManual ?? p.costo * (1 + margenPct / 100)
  const gananciaUSD = precioVentaUSD - p.costo

  const costoMostrado = monedaCosto === 'USD' ? p.costo : bs(p.costo, tasaHoy) ?? p.costo
  const gananciaMostrada = monedaCosto === 'USD' ? gananciaUSD : bs(gananciaUSD, tasaHoy) ?? gananciaUSD
  const precioVentaMostrado = monedaVenta === 'USD' ? precioVentaUSD : bs(precioVentaUSD, tasaHoy) ?? precioVentaUSD
  const precioVentaEquivalente = monedaVenta === 'USD' ? bs(precioVentaUSD, tasaHoy) : precioVentaUSD

  function guardarCosto(v: string) {
    const n = Number(v.replace(',', '.'))
    if (!(n >= 0)) return
    const nuevoUSD = monedaCosto === 'USD' ? n : usdDesdeBs(n, tasaHoy)
    if (nuevoUSD !== null) onGuardarCampo('cost', nuevoUSD)
  }

  function guardarGanancia(v: string) {
    const n = Number(v.replace(',', '.'))
    if (Number.isNaN(n)) return
    const nuevaGananciaUSD = monedaCosto === 'USD' ? n : usdDesdeBs(n, tasaHoy)
    if (nuevaGananciaUSD !== null) onGuardarPrecioVenta(p.costo + nuevaGananciaUSD)
  }

  function guardarPrecioVenta(v: string) {
    const n = Number(v.replace(',', '.'))
    if (!(n >= 0)) return
    const nuevoUSD = monedaVenta === 'USD' ? n : usdDesdeBs(n, tasaHoy)
    if (nuevoUSD !== null) onGuardarPrecioVenta(nuevoUSD)
  }

  return (
    <div className="zr-card space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <CeldaEditable
          valor={p.nombre}
          onGuardar={(v) => { if (v.trim()) onGuardarCampo('name', v.trim()) }}
          className="w-full rounded border border-zr-border bg-zr-bg px-3 py-2 text-base font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
        />
        <p className="shrink-0 whitespace-nowrap pt-2 text-xs text-zr-text-muted">Repuesto: {p.cantidadTotal}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-zr-text-muted">Costo</p>
            <SelectorMoneda valor={monedaCosto} onCambiar={setMonedaCosto} disabled={!tasaHoy} />
          </div>
          <CeldaEditable
            valor={numeroEditable(costoMostrado)}
            tipo="decimal"
            onGuardar={guardarCosto}
            className="w-full rounded border border-zr-border bg-zr-bg px-2 py-2 text-right tabular-nums font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
          />
        </div>
        <div>
          <p className="mb-1 text-zr-text-muted">Cant. restante</p>
          <CeldaEditable
            valor={String(p.stock)}
            tipo="decimal"
            onGuardar={(v) => { const n = Number(v.replace(',', '.')); if (n >= 0) onGuardarCampo('stock', n) }}
            className={`w-full rounded border border-zr-border bg-zr-bg px-2 py-2 text-right tabular-nums font-semibold focus:border-zr-blue focus:outline-none ${p.stock === 0 ? 'text-zr-error' : 'text-zr-text'}`}
          />
        </div>
        <div>
          <p className="mb-1 text-zr-text-muted">Ganancia</p>
          <CeldaEditable
            valor={numeroEditable(gananciaMostrada)}
            tipo="decimal"
            onGuardar={guardarGanancia}
            className="w-full rounded border border-zr-border bg-zr-bg px-2 py-2 text-right tabular-nums font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-zr-text-muted">Precio venta</p>
            <SelectorMoneda valor={monedaVenta} onCambiar={setMonedaVenta} disabled={!tasaHoy} />
          </div>
          <CeldaEditable
            valor={numeroEditable(precioVentaMostrado)}
            tipo="decimal"
            onGuardar={guardarPrecioVenta}
            className="w-full rounded border border-zr-border bg-zr-bg px-2 py-2 text-right tabular-nums font-bold text-zr-blue focus:border-zr-blue focus:outline-none"
          />
        </div>
      </div>
      <p className="text-xs text-zr-text-muted">
        {precioVentaEquivalente !== null
          ? `Equivalente: ${monedaVenta === 'USD' ? `${formatoUSD.format(precioVentaEquivalente)} Bs` : `$${formatoUSD.format(precioVentaEquivalente)}`}`
          : 'Registra la tasa del día para ver el equivalente.'}
        {p.precioVentaManual !== null && (
          <button onClick={() => onGuardarPrecioVenta(null)} className="ml-2 font-semibold text-zr-blue-mid">
            ↺ volver a automático
          </button>
        )}
      </p>
      <AccionesFila
        producto={p}
        vendiendo={vendiendo}
        cantidadVenta={cantidadVenta} setCantidadVenta={setCantidadVenta}
        errorVenta={errorVenta} procesandoVenta={procesandoVenta}
        onAbrirVenta={onAbrirVenta} onConfirmarVenta={onConfirmarVenta} onCancelarVenta={onCancelarVenta}
        reponiendo={reponiendo}
        cantidadReponer={cantidadReponer} setCantidadReponer={setCantidadReponer}
        guardandoReponer={guardandoReponer}
        onAbrirReponer={onAbrirReponer} onConfirmarReponer={onConfirmarReponer} onCancelarReponer={onCancelarReponer}
        eliminando={eliminando}
        guardandoEliminar={guardandoEliminar}
        onAbrirEliminar={onAbrirEliminar} onConfirmarEliminar={onConfirmarEliminar} onCancelarEliminar={onCancelarEliminar}
      />
    </div>
  )
}

function TarjetaNuevoProducto({ onCrear }: { onCrear: (nombre: string, costo: number, stock: number) => Promise<void> }) {
  const [nombre, setNombre] = useState('')
  const [costo, setCosto] = useState('')
  const [stock, setStock] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function intentarCrear() {
    const costoNum = Number(costo.replace(',', '.'))
    if (!nombre.trim() || !(costoNum >= 0) || guardando) return
    setGuardando(true)
    await onCrear(nombre.trim(), costoNum, Number(stock.replace(',', '.')) || 0)
    setNombre(''); setCosto(''); setStock('')
    setGuardando(false)
  }

  return (
    <div className="zr-card space-y-3 border border-dashed border-zr-blue/40 bg-zr-blue/5 p-4">
      <input
        type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={intentarCrear}
        placeholder="+ Nuevo producto (ej. Refresco 355ml)"
        className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} onBlur={intentarCrear}
          placeholder="Costo (USD)"
          className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
        />
        <input
          type="text" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} onBlur={intentarCrear}
          placeholder="Cantidad inicial"
          className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
        />
      </div>
      <p className="text-xs text-zr-text-muted">
        {guardando ? 'Guardando…' : 'Completa producto y costo — se agrega solo al salir del campo.'}
      </p>
    </div>
  )
}

function AccionesFila({
  producto, vendiendo, cantidadVenta, setCantidadVenta, errorVenta, procesandoVenta,
  onAbrirVenta, onConfirmarVenta, onCancelarVenta,
  reponiendo, cantidadReponer, setCantidadReponer, guardandoReponer,
  onAbrirReponer, onConfirmarReponer, onCancelarReponer,
  eliminando, guardandoEliminar, onAbrirEliminar, onConfirmarEliminar, onCancelarEliminar,
}: {
  producto: Producto
  vendiendo: boolean
  cantidadVenta: string; setCantidadVenta: (v: string) => void
  errorVenta: string | null; procesandoVenta: boolean
  onAbrirVenta: () => void; onConfirmarVenta: () => void; onCancelarVenta: () => void
  reponiendo: boolean
  cantidadReponer: string; setCantidadReponer: (v: string) => void
  guardandoReponer: boolean
  onAbrirReponer: () => void; onConfirmarReponer: () => void; onCancelarReponer: () => void
  eliminando: boolean
  guardandoEliminar: boolean
  onAbrirEliminar: () => void; onConfirmarEliminar: () => void; onCancelarEliminar: () => void
}) {
  if (vendiendo) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text" inputMode="decimal" value={cantidadVenta} onChange={(e) => setCantidadVenta(e.target.value)}
          placeholder="Cant." autoFocus
          className="w-20 rounded-lg border border-zr-border bg-zr-bg px-2 py-2 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
        />
        <div className="flex gap-1.5">
          <button onClick={onConfirmarVenta} disabled={procesandoVenta} className="rounded-lg bg-zr-blue px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {procesandoVenta ? '…' : 'Vender'}
          </button>
          <button onClick={onCancelarVenta} className="rounded-lg border border-zr-border px-2 py-2 text-xs font-semibold text-zr-text-muted">
            ✕
          </button>
        </div>
        {errorVenta && <p className="text-xs text-zr-error">{errorVenta}</p>}
      </div>
    )
  }

  if (reponiendo) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text" inputMode="decimal" value={cantidadReponer} onChange={(e) => setCantidadReponer(e.target.value)}
          placeholder="Cant." autoFocus
          className="w-20 rounded-lg border border-zr-border bg-zr-bg px-2 py-2 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
        />
        <div className="flex gap-1.5">
          <button onClick={onConfirmarReponer} disabled={guardandoReponer} className="rounded-lg bg-zr-success px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {guardandoReponer ? '…' : 'Reponer'}
          </button>
          <button onClick={onCancelarReponer} className="rounded-lg border border-zr-border px-2 py-2 text-xs font-semibold text-zr-text-muted">
            ✕
          </button>
        </div>
      </div>
    )
  }

  if (eliminando) {
    return (
      <div className="flex items-center gap-1.5">
        <p className="text-xs text-zr-error">¿Eliminar {producto.nombre}?</p>
        <button onClick={onConfirmarEliminar} disabled={guardandoEliminar} className="rounded-lg bg-zr-error px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
          {guardandoEliminar ? '…' : 'Sí, eliminar'}
        </button>
        <button onClick={onCancelarEliminar} className="rounded-lg border border-zr-border px-2 py-2 text-xs font-semibold text-zr-text-muted">
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-1.5">
      <button
        onClick={onAbrirVenta}
        disabled={producto.stock === 0}
        className="rounded-lg bg-zr-blue px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
      >
        Vender
      </button>
      <button onClick={onAbrirReponer} className="rounded-lg border border-zr-border px-3 py-2 text-xs font-semibold text-zr-text">
        + Reponer
      </button>
      <button onClick={onAbrirEliminar} aria-label="Eliminar producto" className="rounded-lg border border-zr-border px-2 py-2 text-xs font-semibold text-zr-error">
        🗑
      </button>
    </div>
  )
}
