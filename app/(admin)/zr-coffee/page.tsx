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
 * Mismo patrón responsive que Asistencia (migración de sept. 2026): tabla
 * completa en computadora, tarjetas en teléfono.
 */

interface Producto {
  id: string
  nombre: string
  costo: number
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

function bs(usd: number, tasa: number | null) {
  if (!tasa) return null
  return usd * tasa
}

const formatoUSD = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ZRCoffee() {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)
  const [margenPct, setMargenPct] = useState(30)

  const [productos, setProductos] = useState<Producto[]>([])
  const [cargandoProductos, setCargandoProductos] = useState(true)

  const [tasaHoy, setTasaHoy] = useState<number | null>(null)
  const [editandoTasa, setEditandoTasa] = useState(false)
  const [tasaInput, setTasaInput] = useState('')
  const [guardandoTasa, setGuardandoTasa] = useState(false)

  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoCosto, setNuevoCosto] = useState('')
  const [nuevoStock, setNuevoStock] = useState('')
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)

  const [vendiendoId, setVendiendoId] = useState<string | null>(null)
  const [cantidadVenta, setCantidadVenta] = useState('')
  const [errorVenta, setErrorVenta] = useState<string | null>(null)
  const [procesandoVenta, setProcesandoVenta] = useState(false)

  const [agregandoStockId, setAgregandoStockId] = useState<string | null>(null)
  const [cantidadStock, setCantidadStock] = useState('')
  const [guardandoStock, setGuardandoStock] = useState(false)

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
      .select('id, name, cost, stock, active')
      .eq('active', true)
      .order('name')

    setProductos(
      (data ?? []).map((p) => ({ id: p.id, nombre: p.name, costo: Number(p.cost), stock: Number(p.stock), activo: p.active })),
    )
    setCargandoProductos(false)
  }, [])

  useEffect(() => {
    if (verificando) return
    void cargarProductos()
  }, [verificando, cargarProductos])

  // ---------------------------------------------------------------------------
  // Tasa del día
  // ---------------------------------------------------------------------------
  const cargarTasaHoy = useCallback(async () => {
    const { data } = await createClient()
      .from('zr_coffee_tasa_cambio').select('tasa').eq('fecha', hoyISO()).maybeSingle()
    setTasaHoy(data ? Number(data.tasa) : null)
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

  // ---------------------------------------------------------------------------
  // Nuevo producto
  // ---------------------------------------------------------------------------
  async function crearProducto() {
    const costo = Number(nuevoCosto.replace(',', '.'))
    const stock = Number(nuevoStock.replace(',', '.')) || 0
    if (!nuevoNombre.trim() || !(costo >= 0)) return

    setGuardandoNuevo(true)
    await createClient().from('zr_coffee_products').insert({
      name: nuevoNombre.trim(), cost: costo, stock,
    })
    setNuevoNombre(''); setNuevoCosto(''); setNuevoStock(''); setNuevoAbierto(false)
    await cargarProductos()
    setGuardandoNuevo(false)
  }

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
    const precioVenta = producto.costo * (1 + margenPct / 100)

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
  // Agregar existencia (reposición)
  // ---------------------------------------------------------------------------
  function abrirAgregarStock(id: string) {
    setAgregandoStockId(id); setCantidadStock('')
  }

  async function confirmarAgregarStock(producto: Producto) {
    const cantidad = Number(cantidadStock.replace(',', '.'))
    if (!cantidad || cantidad <= 0) return

    setGuardandoStock(true)
    await createClient()
      .from('zr_coffee_products')
      .update({ stock: producto.stock + cantidad })
      .eq('id', producto.id)

    setAgregandoStockId(null)
    setCantidadStock('')
    setGuardandoStock(false)
    await cargarProductos()
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
          <div className="flex items-center justify-between">
            <p className="zr-metric text-2xl text-zr-blue">
              {tasaHoy ? `${formatoUSD.format(tasaHoy)} Bs/USD` : 'Sin registrar hoy'}
            </p>
            <button
              onClick={() => { setEditandoTasa(true); setTasaInput(tasaHoy ? String(tasaHoy) : '') }}
              className="rounded-lg border border-zr-border px-4 py-2 text-sm font-semibold text-zr-text"
            >
              {tasaHoy ? 'Actualizar' : 'Registrar'}
            </button>
          </div>
        )}
        <p className="text-xs text-zr-text-muted">
          Los precios se guardan en USD. Todo lo que se cobra en bolívares se calcula con esta tasa.
        </p>
      </div>

      {/* ------------------------------ Inventario ------------------------------ */}
      <Seccion numero={1} titulo="Inventario" delay={120}>
        {!nuevoAbierto ? (
          <button
            onClick={() => setNuevoAbierto(true)}
            className="w-full rounded-lg border border-dashed border-zr-blue/40 py-3 text-sm font-bold text-zr-blue-mid"
          >
            + Nuevo producto
          </button>
        ) : (
          <div className="zr-card space-y-3 p-5">
            <input
              type="text" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Producto (ej. Refresco 355ml)"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text" inputMode="decimal" value={nuevoCosto} onChange={(e) => setNuevoCosto(e.target.value)}
                placeholder="Costo (USD)"
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              />
              <input
                type="text" inputMode="decimal" value={nuevoStock} onChange={(e) => setNuevoStock(e.target.value)}
                placeholder="Cantidad inicial"
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={crearProducto}
                disabled={guardandoNuevo}
                className="flex-1 rounded-lg bg-zr-blue py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {guardandoNuevo ? 'Guardando…' : 'Guardar producto'}
              </button>
              <button
                onClick={() => setNuevoAbierto(false)}
                className="rounded-lg border border-zr-border px-4 text-sm font-semibold text-zr-text"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {cargandoProductos ? (
          <p className="text-sm text-zr-text-muted">Cargando…</p>
        ) : productos.length === 0 ? (
          <EstadoVacio titulo="Sin productos todavía" explicacion="Agrega el primero desde el botón de arriba." />
        ) : (
          <>
            {/* Computadora: tabla completa. */}
            <div className="hidden overflow-x-auto rounded-lg border border-zr-border lg:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-zr-surface">
                    <th className="border-b border-zr-border px-4 py-3 text-left font-bold text-zr-text">Producto</th>
                    <th className="border-b border-zr-border px-3 py-3 text-right font-bold text-zr-text">Cantidad</th>
                    <th className="border-b border-zr-border px-3 py-3 text-right font-bold text-zr-text">Costo</th>
                    <th className="border-b border-zr-border px-3 py-3 text-right font-bold text-zr-text">Ganancia {margenPct}%</th>
                    <th className="border-b border-zr-border px-3 py-3 text-right font-bold text-zr-text">Precio venta</th>
                    <th className="border-b border-zr-border px-3 py-3 text-right font-bold text-zr-text">En Bs (hoy)</th>
                    <th className="border-b border-zr-border px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => {
                    const ganancia = p.costo * (margenPct / 100)
                    const precioVenta = p.costo + ganancia
                    const precioBs = bs(precioVenta, tasaHoy)
                    return (
                      <tr key={p.id} className="border-b border-zr-border last:border-b-0">
                        <td className="px-4 py-3 font-semibold text-zr-text">{p.nombre}</td>
                        <td className={`px-3 py-3 text-right tabular-nums ${p.stock === 0 ? 'font-bold text-zr-error' : 'text-zr-text'}`}>
                          {p.stock}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-zr-text-muted">${formatoUSD.format(p.costo)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-zr-text-muted">${formatoUSD.format(ganancia)}</td>
                        <td className="px-3 py-3 text-right tabular-nums font-semibold text-zr-blue">${formatoUSD.format(precioVenta)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-zr-text-muted">
                          {precioBs ? `${formatoUSD.format(precioBs)} Bs` : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <FilaAcciones
                            producto={p}
                            vendiendo={vendiendoId === p.id}
                            agregandoStock={agregandoStockId === p.id}
                            cantidadVenta={cantidadVenta} setCantidadVenta={setCantidadVenta}
                            errorVenta={errorVenta} procesandoVenta={procesandoVenta}
                            cantidadStock={cantidadStock} setCantidadStock={setCantidadStock}
                            guardandoStock={guardandoStock}
                            onAbrirVenta={() => abrirVenta(p.id)}
                            onConfirmarVenta={() => confirmarVenta(p)}
                            onCancelarVenta={() => { setVendiendoId(null); setErrorVenta(null) }}
                            onAbrirStock={() => abrirAgregarStock(p.id)}
                            onConfirmarStock={() => confirmarAgregarStock(p)}
                            onCancelarStock={() => setAgregandoStockId(null)}
                            compacto
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Teléfono: una tarjeta por producto. */}
            <div className="space-y-3 lg:hidden">
              {productos.map((p) => {
                const ganancia = p.costo * (margenPct / 100)
                const precioVenta = p.costo + ganancia
                const precioBs = bs(precioVenta, tasaHoy)
                return (
                  <div key={p.id} className="zr-card space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-zr-text">{p.nombre}</p>
                      <p className={`shrink-0 tabular-nums text-sm font-bold ${p.stock === 0 ? 'text-zr-error' : 'text-zr-text-muted'}`}>
                        {p.stock} en existencia
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-zr-text-muted">Costo</p>
                        <p className="tabular-nums font-semibold text-zr-text">${formatoUSD.format(p.costo)}</p>
                      </div>
                      <div>
                        <p className="text-zr-text-muted">Ganancia {margenPct}%</p>
                        <p className="tabular-nums font-semibold text-zr-text">${formatoUSD.format(ganancia)}</p>
                      </div>
                      <div>
                        <p className="text-zr-text-muted">Venta</p>
                        <p className="tabular-nums font-bold text-zr-blue">
                          ${formatoUSD.format(precioVenta)}{precioBs ? ` · ${formatoUSD.format(precioBs)} Bs` : ''}
                        </p>
                      </div>
                    </div>
                    <FilaAcciones
                      producto={p}
                      vendiendo={vendiendoId === p.id}
                      agregandoStock={agregandoStockId === p.id}
                      cantidadVenta={cantidadVenta} setCantidadVenta={setCantidadVenta}
                      errorVenta={errorVenta} procesandoVenta={procesandoVenta}
                      cantidadStock={cantidadStock} setCantidadStock={setCantidadStock}
                      guardandoStock={guardandoStock}
                      onAbrirVenta={() => abrirVenta(p.id)}
                      onConfirmarVenta={() => confirmarVenta(p)}
                      onCancelarVenta={() => { setVendiendoId(null); setErrorVenta(null) }}
                      onAbrirStock={() => abrirAgregarStock(p.id)}
                      onConfirmarStock={() => confirmarAgregarStock(p)}
                      onCancelarStock={() => setAgregandoStockId(null)}
                      compacto={false}
                    />
                  </div>
                )
              })}
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
            <div className="space-y-2">
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

function FilaAcciones({
  producto, vendiendo, agregandoStock,
  cantidadVenta, setCantidadVenta, errorVenta, procesandoVenta,
  cantidadStock, setCantidadStock, guardandoStock,
  onAbrirVenta, onConfirmarVenta, onCancelarVenta,
  onAbrirStock, onConfirmarStock, onCancelarStock,
  compacto,
}: {
  producto: Producto
  vendiendo: boolean; agregandoStock: boolean
  cantidadVenta: string; setCantidadVenta: (v: string) => void
  errorVenta: string | null; procesandoVenta: boolean
  cantidadStock: string; setCantidadStock: (v: string) => void
  guardandoStock: boolean
  onAbrirVenta: () => void; onConfirmarVenta: () => void; onCancelarVenta: () => void
  onAbrirStock: () => void; onConfirmarStock: () => void; onCancelarStock: () => void
  compacto: boolean
}) {
  if (vendiendo) {
    return (
      <div className={compacto ? 'flex items-center gap-1.5' : 'space-y-2'}>
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

  if (agregandoStock) {
    return (
      <div className={compacto ? 'flex items-center gap-1.5' : 'space-y-2'}>
        <input
          type="text" inputMode="decimal" value={cantidadStock} onChange={(e) => setCantidadStock(e.target.value)}
          placeholder="Cant." autoFocus
          className="w-20 rounded-lg border border-zr-border bg-zr-bg px-2 py-2 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
        />
        <div className="flex gap-1.5">
          <button onClick={onConfirmarStock} disabled={guardandoStock} className="rounded-lg bg-zr-success px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {guardandoStock ? '…' : 'Agregar'}
          </button>
          <button onClick={onCancelarStock} className="rounded-lg border border-zr-border px-2 py-2 text-xs font-semibold text-zr-text-muted">
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={onAbrirVenta}
        disabled={producto.stock === 0}
        className="rounded-lg bg-zr-blue px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
      >
        Vender
      </button>
      <button onClick={onAbrirStock} className="rounded-lg border border-zr-border px-3 py-2 text-xs font-semibold text-zr-text">
        + Existencia
      </button>
    </div>
  )
}
