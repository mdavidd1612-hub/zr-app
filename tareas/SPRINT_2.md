# SPRINT 2 · ASISTENCIA Y OPERACIÓN DEL SÁBADO
**10 → 16 de agosto** · Prueba en campo: **sábado 15 de agosto**
Objetivo: eliminar la planilla de papel. **Es el corazón del proyecto.**

> Si este sprint sale bien, el proyecto se justifica solo. Si sale mal, nada de lo demás
> importa. Trátalo en consecuencia.

---

## T-201 · Gestión de sesiones de clase
**Archivo:** `app/(profesor)/sesiones/page.tsx`.
**Haz:** lista de sesiones de las cohortes del profesor. Acciones: **Abrir**, **Cerrar**,
**Reprogramar**, **Ver asistencia**.
- Abrir: `status = 'abierta'` (el disparador pone `opened_at` solo).
- Cerrar: `status = 'cerrada'`.
- Reprogramar: crea una sesión nueva con `rescheduled_from` apuntando a la original, y deja la
  original en `reprogramada`.

**Verifica:** solo se acepta asistencia mientras la sesión está `abierta`. Con cualquier otro
estado, la base lo rechaza.

---

## T-202 · Pantalla de inicio del profesor
**Archivo:** `app/(profesor)/hoy/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §4. Lo primero que ve el profesor el sábado a las 8 de la
mañana, sin tener que buscar nada.
El botón **Abrir clase y pasar asistencia** debe ocupar al menos un cuarto de la pantalla.
**Verifica:** con los datos de prueba, el profesor Carlos Rivas ve su clase del sábado.

---

## T-203 · Edge Function `validate-scan`
**Archivo:** `supabase/functions/validate-scan/index.ts`.
**Haz:** según `spec/03_EDGE_FUNCTIONS.md` función 2. **Los 12 pasos, en ese orden exacto.**

Puntos donde es fácil equivocarse:
- Usa `scannedAt` de la entrada, **no** `now()`. El dispositivo pudo estar sin señal.
- Un duplicado **no es un error**: devuelve `{ ok: true, duplicate: true }`.
- Lee la ventana y la tolerancia de `system_config`, no las escribas en el código.

**Verifica:** las cinco pruebas — código válido, código vencido, sesión cerrada, estudiante de
otra cohorte, y duplicado.

---

## T-204 · Cola de escaneos sin conexión
**Archivo:** `lib/scan-queue.ts`.
**Haz:** con IndexedDB, según el tipo `PendingScan` de `spec/02_CONTRATOS.md`:
- `encolar(scan)` — guarda con `synced: false`.
- `sincronizar()` — envía los pendientes en orden de `scannedAt`.
- `contarPendientes()` — para el indicador de la pantalla.
- Escuchar el evento `online` del navegador y sincronizar solo.
- Una respuesta `duplicate: true` **cuenta como éxito** y limpia el elemento de la cola.

**Verifica:** desconecta la red, haz 5 escaneos, reconecta. Los 5 deben llegar sin duplicarse.

---

## T-205 · Pantalla de escaneo
**Archivo:** `app/(profesor)/escanear/[sessionId]/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §4. Es la pantalla más importante de toda la app.
- Cámara con `@zxing/browser`, escaneo continuo.
- Franja de resultado enorme: verde con el nombre, amarilla si ya estaba, roja con el motivo.
- Sonido distinto para éxito y para error. **En un taller con ruido, el sonido importa más que
  el color.**
- El resultado dura 2 segundos y vuelve a escanear solo.
- Contador `Asistencia: 18 / 24` siempre visible.
- Indicador de pendientes por sincronizar, siempre visible.

**Verifica:** en un teléfono real, escanea 10 códigos seguidos sin tocar la pantalla entre uno
y otro.

---

## T-206 · Interruptor de modo refrigerio
**Archivo:** el mismo de T-205.
**Haz:** un interruptor arriba, **Asistencia** / **Refrigerio**. En modo refrigerio llama a
`claim-snack` en vez de a `validate-scan`. Todo lo demás igual.
El fondo cambia de color para que nadie se confunda de modo.
**Verifica:** en modo refrigerio, un estudiante sin asistencia registrada da error, y un
segundo intento del mismo estudiante da `REFRIGERIO_YA_ENTREGADO`.

---

## T-207 · Edge Function `claim-snack`
**Archivo:** `supabase/functions/claim-snack/index.ts`.
**Haz:** según `spec/03_EDGE_FUNCTIONS.md` función 3.
**Regla de negocio:** no hay refrigerio sin asistencia registrada. No la relajes.

---

## T-208 · Respaldo manual por cédula
**Archivo:** `components/BusquedaManual.tsx`.
**Haz:** un panel deslizante con la lista de estudiantes de la cohorte y un buscador.
Al elegir uno, **pide obligatoriamente un motivo**: *olvidó el teléfono*, *teléfono sin
batería*, *otro* (con texto libre).
Registra con `method = 'manual'` y `manual_reason`.
**Verifica:** la base rechaza un registro manual sin motivo. Comprueba que el evento aparece en
`audit_log`.

---

## T-209 · Vista de asistencia del estudiante
**Archivo:** `app/(estudiante)/clases/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §3.
**Verifica:** el estudiante ve solo sus propias sesiones y su propia asistencia.

---

## T-210 · Reportes de asistencia
**Archivo:** `app/(admin)/reportes/page.tsx` (primera parte).
**Haz:** asistencia por cohorte y por sesión, con exportación a CSV.
**Verifica:** los totales cuadran con lo que hay en la base.

---

## T-211 · Gestión de cohortes
**Archivo:** `app/(admin)/cohortes/page.tsx`.
**Haz:** crear cohortes, asignar profesor y salón, avanzar de módulo, ver estudiantes.
**Avanzar de módulo pide confirmación explícita**, porque cambia el contenido y los exámenes
visibles de todo el grupo de golpe.
**Verifica:** al avanzar de módulo, los estudiantes de esa cohorte ven el contenido nuevo.

---

## T-212 · Prueba de carga
**Archivo:** `tests/carga/escaneos.ts`.
**Haz:** un script que simule 100 escaneos en 10 minutos contra la base local.
**Verifica:** ninguna llamada tarda más de 2 segundos y no hay errores.

---

## T-213 · Pruebas del sprint
**Archivo:** `tests/e2e/asistencia.spec.ts`.
**Haz:** cópialo de `spec/05_PRUEBAS.md` §3.
**Verifica:** `npm run test:e2e` pasa.

---

## SÁBADO 15 DE AGOSTO · PILOTO REAL
Una cohorte completa pasa asistencia **solo con la app**. La planilla de papel va en la
carpeta, pero no se usa salvo emergencia real.

**Se aprueba si:**
1. El 100% de los presentes queda registrado.
2. El tiempo total es **menor** que la línea base medida el 1 de agosto.
3. El sistema aguantó al menos un corte de señal sin perder ningún escaneo.

**Si falla:** el Sprint 3 se dedica entero a arreglar asistencia y las evaluaciones se corren a
Fase 1.5. La asistencia es innegociable; las evaluaciones no.

---

## CRITERIO DE SALIDA
- [ ] `npm run verify` pasa.
- [ ] Los escaneos sin conexión se sincronizan sin duplicar.
- [ ] El registro manual queda auditado con motivo.
- [ ] El piloto del sábado 15 cumplió los tres criterios.
