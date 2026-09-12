'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { IconoFlechaAtras } from '@/components/ui/Iconos'
import { esZRCoffee, INICIO_POR_ROL } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * ZR Coffee — inventario y ventas de la cantina (migración 090, pedido
 * explícito del coordinador a partir de las especificaciones de
 * administradora Cecilia).
 *
 * Rol propio (migración 095, pedido explícito del coordinador): dejó de ser
 * una sección dentro de administración, visible solo por cuenta
 * (zr_coffee_managers), y pasó a ser un ROL -- Cecilia entra como `admin` o
 * como `zr_coffee` y cambia entre los dos desde su perfil (mismo mecanismo
 * genérico que ya usa Erika Hidalgo para admin/vendedor). Vive en su propio
 * grupo de rutas, `app/(zr-coffee)/`, con su propia barra.
 *
 * El descuento de inventario NUNCA se calcula aquí — pasa por
 * `fn_zr_coffee_registrar_venta` (server, atómico), igual que notas y QR
 * nunca se calculan en el navegador (regla 2 de AGENTS.md). La razón es la
 * misma: que dos ventas casi simultáneas no dejen el inventario en negativo.
 *
 * Copia literal de su hoja de Excel (pedido explícito del coordinador,
 * sept. 2026, después de dos vueltas: la primera con un selector de moneda
 * $/Bs por celda salió mal -- confundía más de lo que ayudaba, el costo "se
 * cambiaba solo" de moneda al guardar por el redondeo del viaje Bs -> USD
 * -> Bs). `zr_coffee.margen_ganancia_pct` (system_config) sigue siendo el %
 * por defecto; `margin_pct` (migración 093) es el de CADA producto si lo
 * cambian ahí.
 *
 * Columnas, en el mismo orden que su hoja ("Inventario y Control de
 * Ventas.xlsx"): Producto, Cantidad, Costo, % de Ganancia, Monto de
 * Ganancia, Precio de Venta, Cantidad Restante. Igual que en Excel, "Monto
 * de Ganancia" y "Precio de Venta" son fórmulas sobre Costo y % de
 * Ganancia -- se pueden escribir directamente (como sobreescribir una
 * fórmula en Excel), y lo que se escribe ahí se guarda como el % de
 * ganancia que le corresponde, para que las demás columnas sean
 * consistentes entre sí.
 *
 * Moneda (pedido explícito del coordinador, sept. 2026, tercera vuelta): sin
 * selector -- Costo, Monto de ganancia y Precio de venta se escriben SIEMPRE
 * en bolívares (un solo campo, nada que cambiar de modo) y debajo de cada
 * uno se muestra el equivalente en dólares, calculado con la tasa del día,
 * solo de lectura. Al ser de solo lectura no hay viaje de ida y vuelta que
 * redondee nada -- se recalcula fresco en cada render a partir del valor en
 * bolívares, nunca se guarda.
 *
 * "Cantidad" (cuánto se ha repuesto en total) es un campo editable como
 * cualquier otro, no un botón aparte: al cambiarlo, "Cantidad Restante" se
 * mueve la misma diferencia (si subes Cantidad de 100 a 150, Restante sube
 * de 95 a 145 -- siguen reflejando que se repusieron 50 más). Editar
 * "Cantidad Restante" directamente, en cambio, es una corrección puntual
 * (p. ej. un conteo físico) y no toca "Cantidad".
 *
 * ("Costo para la Venta" de su hoja no se copió: en sus tres filas de
 * ejemplo siempre es idéntico a "Costo", así que no aporta un dato aparte.
 * Si en realidad necesita guardar algo distinto ahí, se agrega en otra
 * vuelta.)
 *
 * Tasa del día (pedido explícito del coordinador, sept. 2026): se trae sola
 * desde Al Cambio (alcambio.app) al abrir la pantalla si todavía no se
 * registró hoy — /api/zr-coffee/tasa hace esa consulta del lado del
 * servidor. Sigue pudiéndose escribir a mano (botón "Manual") por si la
 * consulta falla o hay que corregirla. Es solo informativa en esta
 * pantalla (queda guardada en cada venta para referencia futura); no
 * convierte nada del inventario.
 *
 * Fila nueva sin avisar errores (bug real reportado por el coordinador,
 * sept. 2026): si el insert fallaba, los campos se limpiaban igual --
 * parecía que "no se guardaba y no dejaba avanzar" porque los datos
 * desaparecían sin ningún error visible. `crearProductoDesdeFila` ahora
 * devuelve un mensaje de error (o null si salió bien) y la fila solo se
 * limpia cuando de verdad se creó. Además, Enter ahora avanza al siguiente
 * campo (Producto → Cantidad → Costo) en vez de solo quitar el foco --
 * antes, si Costo todavía estaba vacío cuando el foco se iba, la fila
 * quedaba esperando sin ninguna señal de que hacía falta escribir algo más.
 */

interface Producto {
  id: string
  nombre: string
  costo: number
  margenPctPropio: number | null
  cantidadTotal: number
  stock: number
  activo: boolean
}

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

const formatoUSD = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Para el VALOR de una celda editable: sin separador de miles (a diferencia
// de formatoUSD, que sí lo pone) -- un monto puede pasar de 1.000 fácilmente,
// y ese punto se confundiría con el separador decimal al volver a leerlo.
function numeroEditable(n: number) {
  return n.toFixed(2)
}

function numeroDesdeTexto(v: string): number | null {
  const limpio = v.trim()
  // Ojo: `Number('')` da 0, no NaN -- sin este chequeo, un campo vacío se
  // leía como "costo 0 válido" y la fila nueva se creaba sola en cuanto se
  // salía del campo Nombre, antes de llegar a escribir Cantidad o Costo.
  if (limpio === '') return null
  const n = Number(limpio.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Equivalente en dólares de un monto en bolívares -- SOLO para mostrar
// (nunca se guarda), así que no hay viaje de ida y vuelta que redondee nada.
function equivalenteUSD(bs: number, tasa: number | null) {
  if (!tasa) return null
  return bs / tasa
}

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

  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [guardandoEliminar, setGuardandoEliminar] = useState(false)

  const [eliminandoVentaId, setEliminandoVentaId] = useState<string | null>(null)
  const [guardandoEliminarVenta, setGuardandoEliminarVenta] = useState(false)

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
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const rol = perfil?.role as UserRole | undefined
      if (!esZRCoffee(rol)) {
        router.replace(INICIO_POR_ROL[rol ?? 'estudiante'] ?? '/')
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
      .select('id, name, cost, margin_pct, stock, total_repuesto, active')
      .eq('active', true)
      .order('name')

    setProductos(
      (data ?? []).map((p) => ({
        id: p.id, nombre: p.name, costo: Number(p.cost),
        margenPctPropio: p.margin_pct != null ? Number(p.margin_pct) : null,
        cantidadTotal: Number(p.total_repuesto), stock: Number(p.stock), activo: p.active,
      })),
    )
    setCargandoProductos(false)
  }, [])

  useEffect(() => {
    if (verificando) return
    void cargarProductos()
  }, [verificando, cargarProductos])

  async function actualizarCampoProducto(id: string, campo: 'name' | 'cost' | 'stock' | 'margin_pct', valor: string | number | null) {
    const supabase = createClient()
    if (campo === 'name') {
      await supabase.from('zr_coffee_products').update({ name: String(valor) }).eq('id', id)
    } else if (campo === 'cost') {
      await supabase.from('zr_coffee_products').update({ cost: Number(valor) }).eq('id', id)
    } else if (campo === 'stock') {
      await supabase.from('zr_coffee_products').update({ stock: Number(valor) }).eq('id', id)
    } else {
      await supabase.from('zr_coffee_products').update({ margin_pct: valor === null ? null : Number(valor) }).eq('id', id)
    }
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

  // Devuelve un mensaje de error (o null si salió bien) -- antes se
  // ignoraba `error` de Supabase y la fila se limpiaba igual aunque el
  // insert hubiera fallado, dando la impresión de que "no pasaba nada".
  async function crearProductoDesdeFila(nombre: string, costo: number, stock: number): Promise<string | null> {
    const { error } = await createClient()
      .from('zr_coffee_products')
      .insert({ name: nombre, cost: costo, stock, total_repuesto: stock })
    if (error) return 'No se pudo agregar el producto. Intenta de nuevo.'
    await cargarProductos()
    return null
  }

  // Editar "Cantidad" (pedido explícito del coordinador, sept. 2026): un
  // campo normal, no un botón aparte -- mueve "Cantidad Restante" la misma
  // diferencia, para que siga reflejando cuánto hay disponible de verdad
  // (si Cantidad sube de 100 a 150, Restante sube de 95 a 145: se repusieron
  // 50 más). Nunca queda negativa aunque la diferencia sea hacia abajo.
  async function actualizarCantidadTotal(producto: Producto, nuevaCantidad: number) {
    const delta = nuevaCantidad - producto.cantidadTotal
    await createClient().from('zr_coffee_products').update({
      total_repuesto: nuevaCantidad,
      stock: Math.max(0, producto.stock + delta),
    }).eq('id', producto.id)
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
    const valor = numeroDesdeTexto(tasaInput)
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
    const cantidad = numeroDesdeTexto(cantidadVenta)
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
    const pct = producto.margenPctPropio ?? margenPct
    const precioVenta = producto.costo * (1 + pct / 100)

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

  // Eliminar una venta cargada por error (pedido explícito del coordinador,
  // sept. 2026): pasa por fn_zr_coffee_eliminar_venta (server, atómico,
  // migración 094) -- devuelve la cantidad al inventario del producto y
  // borra la venta en la misma transacción. Nunca se calcula aquí, mismo
  // criterio que registrar una venta.
  async function eliminarVenta(id: string) {
    setGuardandoEliminarVenta(true)
    const { error } = await createClient().rpc('fn_zr_coffee_eliminar_venta', { p_venta_id: id })
    setGuardandoEliminarVenta(false)
    if (error) return
    setEliminandoVentaId(null)
    await Promise.all([cargarProductos(), cargarVentasDelDia(fechaHistorial)])
  }

  function cambiarDia(delta: number) {
    const d = new Date(fechaHistorial + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setFechaHistorial(d.toISOString().slice(0, 10))
  }

  if (verificando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Verificando acceso…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14 pb-16">
      <Encabezado
        sobretitulo="ZR Coffee"
        titulo="Inventario y ventas"
        descripcion="La cantina de la academia."
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
          Referencia del dólar BCV (tomada de Al Cambio), guardada en cada venta para consultarla
          después. El inventario no la usa para convertir nada.
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
                    <th className="border-b border-zr-border px-2 py-3 text-right font-bold text-zr-text">% Ganancia</th>
                    <th className="border-b border-zr-border px-2 py-3 text-right font-bold text-zr-text">Monto ganancia</th>
                    <th className="border-b border-zr-border px-2 py-3 text-right font-bold text-zr-text">Precio venta</th>
                    <th className="border-b border-zr-border px-2 py-3 text-right font-bold text-zr-text">Cant. restante</th>
                    <th className="border-b border-zr-border px-3 py-3 text-left font-bold text-zr-text">Acciones</th>
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
                      onGuardarCantidadTotal={(n) => actualizarCantidadTotal(p, n)}
                      vendiendo={vendiendoId === p.id}
                      cantidadVenta={cantidadVenta} setCantidadVenta={setCantidadVenta}
                      errorVenta={errorVenta} procesandoVenta={procesandoVenta}
                      onAbrirVenta={() => abrirVenta(p.id)}
                      onConfirmarVenta={() => confirmarVenta(p)}
                      onCancelarVenta={() => { setVendiendoId(null); setErrorVenta(null) }}
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
                  onGuardarCantidadTotal={(n) => actualizarCantidadTotal(p, n)}
                  vendiendo={vendiendoId === p.id}
                  cantidadVenta={cantidadVenta} setCantidadVenta={setCantidadVenta}
                  errorVenta={errorVenta} procesandoVenta={procesandoVenta}
                  onAbrirVenta={() => abrirVenta(p.id)}
                  onConfirmarVenta={() => confirmarVenta(p)}
                  onCancelarVenta={() => { setVendiendoId(null); setErrorVenta(null) }}
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
                    <th className="border-b border-zr-border px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {ventasDelDia.map((v) => (
                    <tr key={v.id} className="border-b border-zr-border last:border-b-0">
                      <td className="px-4 py-3 font-semibold text-zr-text">{v.productoNombre}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-zr-text">{v.cantidad}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-zr-text-muted">
                        {formatoUSD.format(v.precioUnitario)} <SufijoBs />
                        <EquivalenteUSD bs={v.precioUnitario} tasa={v.tasaUsada} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-zr-text-muted">
                        {v.tasaUsada ? formatoUSD.format(v.tasaUsada) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-bold text-zr-text">
                        {formatoUSD.format(v.total)} <SufijoBs />
                        <EquivalenteUSD bs={v.total} tasa={v.tasaUsada} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        {eliminandoVentaId === v.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => eliminarVenta(v.id)}
                              disabled={guardandoEliminarVenta}
                              className="rounded-lg bg-zr-error px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                            >
                              {guardandoEliminarVenta ? '…' : 'Sí, eliminar'}
                            </button>
                            <button
                              onClick={() => setEliminandoVentaId(null)}
                              className="rounded-lg border border-zr-border px-2 py-1.5 text-xs font-semibold text-zr-text-muted"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEliminandoVentaId(v.id)}
                            className="rounded-lg border border-zr-error/50 px-2.5 py-1.5 text-xs font-semibold text-zr-error"
                          >
                            Eliminar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Teléfono: una tarjeta por venta. */}
            <div className="space-y-2 lg:hidden">
              {ventasDelDia.map((v) => (
                <div key={v.id} className="zr-card space-y-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zr-text">{v.productoNombre}</p>
                      <p className="text-xs tabular-nums text-zr-text-muted">
                        {v.cantidad} × {formatoUSD.format(v.precioUnitario)} Bs
                        {v.tasaUsada ? ` · tasa ${formatoUSD.format(v.tasaUsada)}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular-nums font-bold text-zr-text">{formatoUSD.format(v.total)} Bs</p>
                      <EquivalenteUSD bs={v.total} tasa={v.tasaUsada} />
                    </div>
                  </div>
                  {eliminandoVentaId === v.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => eliminarVenta(v.id)}
                        disabled={guardandoEliminarVenta}
                        className="rounded-lg bg-zr-error px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {guardandoEliminarVenta ? '…' : 'Sí, eliminar'}
                      </button>
                      <button
                        onClick={() => setEliminandoVentaId(null)}
                        className="rounded-lg border border-zr-border px-2 py-2 text-xs font-semibold text-zr-text-muted"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEliminandoVentaId(v.id)}
                      className="rounded-lg border border-zr-error/50 px-3 py-2 text-xs font-semibold text-zr-error"
                    >
                      Eliminar
                    </button>
                  )}
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
  onGuardarCampo: (campo: 'name' | 'cost' | 'stock' | 'margin_pct', valor: string | number | null) => void
  onGuardarCantidadTotal: (nuevaCantidad: number) => void
  vendiendo: boolean
  cantidadVenta: string; setCantidadVenta: (v: string) => void
  errorVenta: string | null; procesandoVenta: boolean
  onAbrirVenta: () => void; onConfirmarVenta: () => void; onCancelarVenta: () => void
  eliminando: boolean
  guardandoEliminar: boolean
  onAbrirEliminar: () => void; onConfirmarEliminar: () => void; onCancelarEliminar: () => void
}

// Ganancia y Precio de venta funcionan como en Excel: son "fórmulas" sobre
// Costo y % de Ganancia (montoGanancia = costo * pct/100; precioVenta =
// costo + montoGanancia), pero se pueden escribir directamente -- igual que
// sobreescribir una celda con fórmula en Excel. Lo que se escribe ahí se
// convierte de vuelta a un % de ganancia (`margin_pct`), así las tres
// columnas se quedan consistentes entre sí sin un campo de "precio fijado a
// mano" aparte.
function usarCalculosProducto(p: Producto, margenPctGlobal: number) {
  const pct = p.margenPctPropio ?? margenPctGlobal
  const montoGanancia = p.costo * (pct / 100)
  const precioVenta = p.costo + montoGanancia
  return { pct, montoGanancia, precioVenta }
}

// Debajo de un monto en bolívares: su equivalente en dólares, solo como
// referencia (nunca se guarda, nunca se edita). Mismo tamaño que el campo
// en bolívares de arriba (pedido explícito del coordinador) -- que no se
// vea como una nota al pie, sino como el otro número que realmente es.
function EquivalenteUSD({ bs, tasa }: { bs: number; tasa: number | null }) {
  const usd = equivalenteUSD(bs, tasa)
  return (
    <p className="mt-0.5 text-right text-sm font-semibold text-zr-text-muted">
      {usd !== null ? `USD $${formatoUSD.format(usd)}` : 'Registra la tasa del día para ver el equivalente en USD'}
    </p>
  )
}

// Sufijo "Bs" pegado al campo, a la derecha del número (pedido explícito
// del coordinador) -- para que quede claro, sin selector, que Costo, Monto
// de ganancia y Precio de venta siempre se escriben en bolívares.
function SufijoBs() {
  return <span className="shrink-0 text-xs font-bold text-zr-text-muted">Bs</span>
}

function FilaProductoEscritorio({
  producto: p, margenPct, tasaHoy, onGuardarCampo, onGuardarCantidadTotal,
  vendiendo, cantidadVenta, setCantidadVenta, errorVenta, procesandoVenta,
  onAbrirVenta, onConfirmarVenta, onCancelarVenta,
  eliminando, guardandoEliminar, onAbrirEliminar, onConfirmarEliminar, onCancelarEliminar,
}: PropsFilaProducto) {
  const { pct, montoGanancia, precioVenta } = usarCalculosProducto(p, margenPct)

  function guardarPct(v: string) {
    const n = numeroDesdeTexto(v)
    if (n !== null && n >= 0) onGuardarCampo('margin_pct', n)
  }

  function guardarMontoGanancia(v: string) {
    const n = numeroDesdeTexto(v)
    if (n === null || p.costo <= 0) return
    onGuardarCampo('margin_pct', (n / p.costo) * 100)
  }

  function guardarPrecioVenta(v: string) {
    const n = numeroDesdeTexto(v)
    if (n === null || n < p.costo || p.costo <= 0) return
    onGuardarCampo('margin_pct', ((n - p.costo) / p.costo) * 100)
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
      <td className="px-1 py-1">
        <CeldaEditable
          valor={String(p.cantidadTotal)}
          tipo="decimal"
          onGuardar={(v) => { const n = numeroDesdeTexto(v); if (n !== null && n >= 0) onGuardarCantidadTotal(n) }}
          className={`${claseCelda} w-16 text-right tabular-nums`}
        />
      </td>
      <td className="px-1 py-1">
        <div className="flex items-center justify-end gap-1">
          <CeldaEditable
            valor={numeroEditable(p.costo)}
            tipo="decimal"
            onGuardar={(v) => { const n = numeroDesdeTexto(v); if (n !== null && n >= 0) onGuardarCampo('cost', n) }}
            className={`${claseCelda} w-20 text-right tabular-nums`}
          />
          <SufijoBs />
        </div>
        <EquivalenteUSD bs={p.costo} tasa={tasaHoy} />
      </td>
      <td className="px-1 py-1">
        <div className="flex items-center justify-end gap-1">
          <CeldaEditable
            valor={numeroEditable(pct)}
            tipo="decimal"
            onGuardar={guardarPct}
            className={`${claseCelda} w-16 text-right tabular-nums`}
          />
          <span className="text-xs text-zr-text-muted">%</span>
        </div>
      </td>
      <td className="px-1 py-1">
        <div className="flex items-center justify-end gap-1">
          <CeldaEditable
            valor={numeroEditable(montoGanancia)}
            tipo="decimal"
            onGuardar={guardarMontoGanancia}
            className={`${claseCelda} w-20 text-right tabular-nums text-zr-text-muted`}
          />
          <SufijoBs />
        </div>
        <EquivalenteUSD bs={montoGanancia} tasa={tasaHoy} />
      </td>
      <td className="px-1 py-1">
        <div className="flex items-center justify-end gap-1">
          <CeldaEditable
            valor={numeroEditable(precioVenta)}
            tipo="decimal"
            onGuardar={guardarPrecioVenta}
            className={`${claseCelda} w-20 text-right tabular-nums font-semibold text-zr-blue`}
          />
          <SufijoBs />
        </div>
        <EquivalenteUSD bs={precioVenta} tasa={tasaHoy} />
      </td>
      <td className="px-1 py-1">
        <CeldaEditable
          valor={String(p.stock)}
          tipo="decimal"
          onGuardar={(v) => { const n = numeroDesdeTexto(v); if (n !== null && n >= 0) onGuardarCampo('stock', n) }}
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
          eliminando={eliminando}
          guardandoEliminar={guardandoEliminar}
          onAbrirEliminar={onAbrirEliminar} onConfirmarEliminar={onConfirmarEliminar} onCancelarEliminar={onCancelarEliminar}
        />
      </td>
    </tr>
  )
}

// Fila para agregar un producto nuevo. Enter avanza al siguiente campo
// (Producto → Cantidad → Costo) como en una hoja de cálculo; en el último
// campo, Enter intenta guardar. Si el guardado falla, se muestra el error y
// LOS CAMPOS NO SE BORRAN -- antes se limpiaban siempre, sin importar si el
// insert había funcionado, dando la falsa impresión de que "no dejaba
// avanzar" cuando en realidad los datos ya se habían perdido en silencio.
function FilaNuevoProductoEscritorio({ onCrear }: { onCrear: (nombre: string, costo: number, stock: number) => Promise<string | null> }) {
  const [nombre, setNombre] = useState('')
  const [costo, setCosto] = useState('')
  const [stock, setStock] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guardandoRef = useRef(false)
  const nombreRef = useRef<HTMLInputElement>(null)
  const stockRef = useRef<HTMLInputElement>(null)
  const costoRef = useRef<HTMLInputElement>(null)

  async function intentarCrear() {
    if (guardandoRef.current) return
    const costoNum = numeroDesdeTexto(costo)
    if (!nombre.trim() || costoNum === null || costoNum < 0) return
    guardandoRef.current = true
    setGuardando(true)
    setError(null)
    const fallo = await onCrear(nombre.trim(), costoNum, numeroDesdeTexto(stock) || 0)
    guardandoRef.current = false
    setGuardando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setNombre(''); setCosto(''); setStock('')
    nombreRef.current?.focus()
  }

  function onEnterNombre(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    stockRef.current?.focus()
  }

  function onEnterStock(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    costoRef.current?.focus()
  }

  return (
    <tr className="border-b border-dashed border-zr-blue/30 bg-zr-blue/5">
      <td className="px-1 py-1">
        <input
          ref={nombreRef}
          type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={intentarCrear}
          onKeyDown={onEnterNombre}
          placeholder="+ Nuevo producto…"
          className={`${claseCelda} text-left font-semibold placeholder:font-normal placeholder:text-zr-blue-mid`}
        />
      </td>
      <td className="px-1 py-1">
        <input
          ref={stockRef}
          type="text" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} onBlur={intentarCrear}
          onKeyDown={onEnterStock}
          placeholder="0"
          className={`${claseCelda} w-16 text-right tabular-nums`}
        />
      </td>
      <td className="px-1 py-1">
        <input
          ref={costoRef}
          type="text" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} onBlur={intentarCrear}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void intentarCrear() } }}
          placeholder="0,00"
          className={`${claseCelda} w-20 text-right tabular-nums`}
        />
      </td>
      <td colSpan={5} className="px-3 py-3 text-xs">
        {error ? (
          <span className="font-semibold text-zr-error">{error}</span>
        ) : (
          <span className="text-zr-text-muted">
            {guardando ? 'Guardando…' : 'Escribe el producto, la cantidad y el costo para agregarlo'}
          </span>
        )}
      </td>
    </tr>
  )
}

function TarjetaProducto({
  producto: p, margenPct, tasaHoy, onGuardarCampo, onGuardarCantidadTotal,
  vendiendo, cantidadVenta, setCantidadVenta, errorVenta, procesandoVenta,
  onAbrirVenta, onConfirmarVenta, onCancelarVenta,
  eliminando, guardandoEliminar, onAbrirEliminar, onConfirmarEliminar, onCancelarEliminar,
}: PropsFilaProducto) {
  const { pct, montoGanancia, precioVenta } = usarCalculosProducto(p, margenPct)

  function guardarPct(v: string) {
    const n = numeroDesdeTexto(v)
    if (n !== null && n >= 0) onGuardarCampo('margin_pct', n)
  }

  function guardarMontoGanancia(v: string) {
    const n = numeroDesdeTexto(v)
    if (n === null || p.costo <= 0) return
    onGuardarCampo('margin_pct', (n / p.costo) * 100)
  }

  function guardarPrecioVenta(v: string) {
    const n = numeroDesdeTexto(v)
    if (n === null || n < p.costo || p.costo <= 0) return
    onGuardarCampo('margin_pct', ((n - p.costo) / p.costo) * 100)
  }

  return (
    <div className="zr-card space-y-3 p-4">
      <CeldaEditable
        valor={p.nombre}
        onGuardar={(v) => { if (v.trim()) onGuardarCampo('name', v.trim()) }}
        className="w-full rounded border border-zr-border bg-zr-bg px-3 py-2 text-base font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="mb-1 text-zr-text-muted">Cantidad</p>
          <CeldaEditable
            valor={String(p.cantidadTotal)}
            tipo="decimal"
            onGuardar={(v) => { const n = numeroDesdeTexto(v); if (n !== null && n >= 0) onGuardarCantidadTotal(n) }}
            className="w-full rounded border border-zr-border bg-zr-bg px-2 py-2 text-right tabular-nums font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
          />
        </div>
        <div>
          <p className="mb-1 text-zr-text-muted">Cant. restante</p>
          <CeldaEditable
            valor={String(p.stock)}
            tipo="decimal"
            onGuardar={(v) => { const n = numeroDesdeTexto(v); if (n !== null && n >= 0) onGuardarCampo('stock', n) }}
            className={`w-full rounded border border-zr-border bg-zr-bg px-2 py-2 text-right tabular-nums font-semibold focus:border-zr-blue focus:outline-none ${p.stock === 0 ? 'text-zr-error' : 'text-zr-text'}`}
          />
        </div>
        <div>
          <p className="mb-1 text-zr-text-muted">Costo</p>
          <div className="flex items-center gap-1.5 rounded border border-zr-border bg-zr-bg px-2">
            <CeldaEditable
              valor={numeroEditable(p.costo)}
              tipo="decimal"
              onGuardar={(v) => { const n = numeroDesdeTexto(v); if (n !== null && n >= 0) onGuardarCampo('cost', n) }}
              className="w-full border-transparent bg-transparent py-2 text-right tabular-nums font-semibold text-zr-text focus:border-transparent focus:outline-none"
            />
            <SufijoBs />
          </div>
          <EquivalenteUSD bs={p.costo} tasa={tasaHoy} />
        </div>
        <div>
          <p className="mb-1 text-zr-text-muted">% Ganancia</p>
          <CeldaEditable
            valor={numeroEditable(pct)}
            tipo="decimal"
            onGuardar={guardarPct}
            className="w-full rounded border border-zr-border bg-zr-bg px-2 py-2 text-right tabular-nums font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
          />
        </div>
        <div>
          <p className="mb-1 text-zr-text-muted">Monto ganancia</p>
          <div className="flex items-center gap-1.5 rounded border border-zr-border bg-zr-bg px-2">
            <CeldaEditable
              valor={numeroEditable(montoGanancia)}
              tipo="decimal"
              onGuardar={guardarMontoGanancia}
              className="w-full border-transparent bg-transparent py-2 text-right tabular-nums font-semibold text-zr-text focus:border-transparent focus:outline-none"
            />
            <SufijoBs />
          </div>
          <EquivalenteUSD bs={montoGanancia} tasa={tasaHoy} />
        </div>
        <div>
          <p className="mb-1 text-zr-text-muted">Precio de venta</p>
          <div className="flex items-center gap-1.5 rounded border border-zr-border bg-zr-bg px-2">
            <CeldaEditable
              valor={numeroEditable(precioVenta)}
              tipo="decimal"
              onGuardar={guardarPrecioVenta}
              className="w-full border-transparent bg-transparent py-2 text-right tabular-nums font-bold text-zr-blue focus:border-transparent focus:outline-none"
            />
            <SufijoBs />
          </div>
          <EquivalenteUSD bs={precioVenta} tasa={tasaHoy} />
        </div>
      </div>
      <AccionesFila
        producto={p}
        vendiendo={vendiendo}
        cantidadVenta={cantidadVenta} setCantidadVenta={setCantidadVenta}
        errorVenta={errorVenta} procesandoVenta={procesandoVenta}
        onAbrirVenta={onAbrirVenta} onConfirmarVenta={onConfirmarVenta} onCancelarVenta={onCancelarVenta}
        eliminando={eliminando}
        guardandoEliminar={guardandoEliminar}
        onAbrirEliminar={onAbrirEliminar} onConfirmarEliminar={onConfirmarEliminar} onCancelarEliminar={onCancelarEliminar}
      />
    </div>
  )
}

function TarjetaNuevoProducto({ onCrear }: { onCrear: (nombre: string, costo: number, stock: number) => Promise<string | null> }) {
  const [nombre, setNombre] = useState('')
  const [costo, setCosto] = useState('')
  const [stock, setStock] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guardandoRef = useRef(false)
  const nombreRef = useRef<HTMLInputElement>(null)
  const costoRef = useRef<HTMLInputElement>(null)
  const stockRef = useRef<HTMLInputElement>(null)

  async function intentarCrear() {
    if (guardandoRef.current) return
    const costoNum = numeroDesdeTexto(costo)
    if (!nombre.trim() || costoNum === null || costoNum < 0) return
    guardandoRef.current = true
    setGuardando(true)
    setError(null)
    const fallo = await onCrear(nombre.trim(), costoNum, numeroDesdeTexto(stock) || 0)
    guardandoRef.current = false
    setGuardando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setNombre(''); setCosto(''); setStock('')
    nombreRef.current?.focus()
  }

  function onEnterNombre(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    costoRef.current?.focus()
  }

  function onEnterCosto(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    stockRef.current?.focus()
  }

  return (
    <div className="zr-card space-y-3 border border-dashed border-zr-blue/40 bg-zr-blue/5 p-4">
      <input
        ref={nombreRef}
        type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={intentarCrear}
        onKeyDown={onEnterNombre}
        placeholder="+ Nuevo producto (ej. Refresco 355ml)"
        className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          ref={costoRef}
          type="text" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} onBlur={intentarCrear}
          onKeyDown={onEnterCosto}
          placeholder="Costo"
          className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
        />
        <input
          ref={stockRef}
          type="text" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} onBlur={intentarCrear}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void intentarCrear() } }}
          placeholder="Cantidad inicial"
          className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
        />
      </div>
      {error ? (
        <p className="text-xs font-semibold text-zr-error">{error}</p>
      ) : (
        <p className="text-xs text-zr-text-muted">
          {guardando ? 'Guardando…' : 'Completa producto y costo — se agrega solo al salir del campo.'}
        </p>
      )}
    </div>
  )
}

function AccionesFila({
  producto, vendiendo, cantidadVenta, setCantidadVenta, errorVenta, procesandoVenta,
  onAbrirVenta, onConfirmarVenta, onCancelarVenta,
  eliminando, guardandoEliminar, onAbrirEliminar, onConfirmarEliminar, onCancelarEliminar,
}: {
  producto: Producto
  vendiendo: boolean
  cantidadVenta: string; setCantidadVenta: (v: string) => void
  errorVenta: string | null; procesandoVenta: boolean
  onAbrirVenta: () => void; onConfirmarVenta: () => void; onCancelarVenta: () => void
  eliminando: boolean
  guardandoEliminar: boolean
  onAbrirEliminar: () => void; onConfirmarEliminar: () => void; onCancelarEliminar: () => void
}) {
  if (vendiendo) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="text" inputMode="decimal" value={cantidadVenta} onChange={(e) => setCantidadVenta(e.target.value)}
          placeholder="Cant." autoFocus
          className="w-20 rounded-lg border border-zr-border bg-zr-bg px-2 py-2 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
        />
        <button onClick={onConfirmarVenta} disabled={procesandoVenta} className="rounded-lg bg-zr-blue px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
          {procesandoVenta ? '…' : 'Vender'}
        </button>
        <button onClick={onCancelarVenta} className="rounded-lg border border-zr-border px-2 py-2 text-xs font-semibold text-zr-text-muted">
          Cancelar
        </button>
        {errorVenta && <p className="w-full text-xs text-zr-error">{errorVenta}</p>}
      </div>
    )
  }

  if (eliminando) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="w-full text-xs text-zr-error">¿Eliminar {producto.nombre}?</p>
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
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={onAbrirVenta}
        disabled={producto.stock === 0}
        className="rounded-lg bg-zr-blue px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
      >
        Vender
      </button>
      <button onClick={onAbrirEliminar} className="rounded-lg border border-zr-error/50 px-3 py-2 text-xs font-semibold text-zr-error">
        Eliminar
      </button>
    </div>
  )
}
