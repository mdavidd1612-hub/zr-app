# SPRINT 0 · FUNDACIONES
**30 de julio → 2 de agosto** · Objetivo: base de datos, seguridad y entornos listos antes de
escribir una sola pantalla.

> Ejecuta las tareas en orden. No empieces una sin haber cumplido la verificación de la anterior.
> Si una verificación falla, **arréglala antes de seguir**. Un cimiento torcido no se endereza
> después.

---

## T-001 · Preparar el entorno
**Antes:** nada.
**Haz:** sigue `spec/01_SETUP.md` completo, del paso 1 al 4.
**Verifica:**
```bash
supabase status
```
Debe listar los servicios corriendo, y `npm run dev` debe abrir `localhost:3000`.

---

## T-002 · Copiar las migraciones
**Antes:** T-001.
**Haz:** copia los 14 archivos `.sql` de `supabase/migrations/` de la especificación a la
carpeta `supabase/migrations/` del proyecto. Copia `supabase/seed/seed_dev.sql` a
`supabase/seed.sql`.
**No edites ni una línea.** Si algo parece mal, detente y pregunta.
**Verifica:**
```bash
ls supabase/migrations/
```
Deben aparecer 14 archivos, de `001_` a `014_`.

> `014_mastery_map.sql` se añadió el 30/07/2026 (mapa de dominio, ver
> `docs/13_DISENO_DE_PRODUCTO_ESTUDIANTE.md` §3.2). **`seed_dev.sql` inserta en `mastery_map`,
> así que sin esta migración `supabase db reset` falla.** No la omitas.

---

## T-003 · Aplicar el esquema
**Antes:** T-002.
**Haz:**
```bash
supabase db reset
```
**Verifica:** el comando termina sin errores y:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select count(*) from public.modules;"
```
Devuelve **13**.

**Si falla:** lee el error completo. Es un problema de SQL, no de tu código. No inventes un
parche: repórtalo.

---

## T-004 · Verificar que RLS está activa en todo
**Antes:** T-003.
**Haz:**
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select tablename from pg_tables where schemaname='public' and rowsecurity = false;"
```
**Verifica:** **cero filas**. Si aparece alguna tabla, le falta `enable row level security` y
hay que corregirlo en una migración nueva antes de continuar.

---

## T-005 · Verificar los datos de prueba
**Antes:** T-003.
**Haz:** ejecuta las consultas de verificación que están al final de `seed_dev.sql`.
**Verifica:** 13 módulos, 12 estudiantes, 4 menores, 2 bloqueados, 18 sesiones,
12 inscripciones, y los umbrales de aprobación son 10 y 12.

---

## T-006 · Generar los tipos de TypeScript
**Antes:** T-003.
**Haz:**
```bash
npm run db:types
```
**Verifica:** existe `lib/database.types.ts` y contiene `profiles`, `students`,
`attendance_events` y `v_exam_questions_student`.
**Recuerda:** repite este comando cada vez que apliques una migración.

---

## T-007 · Crear los clientes de Supabase
**Antes:** T-006.
**Archivos:** `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`.
**Haz:** cópialos exactamente como están en `spec/01_SETUP.md` §8.
**Verifica:** `npm run typecheck` pasa sin errores.

---

## T-008 · Crear los tipos y validadores compartidos
**Antes:** T-007.
**Archivos:** `lib/types.ts`, `lib/validators.ts`, `lib/auth-helpers.ts`.
**Haz:** cópialos de `spec/02_CONTRATOS.md` §1, §4, §5 y §7.
**Verifica:** `npm run typecheck` pasa.

---

## T-009 · Escribir las pruebas de acceso cruzado
**Antes:** T-008.
**Archivo:** `tests/rls/acceso-cruzado.test.ts`.
**Haz:** cópialo de `spec/05_PRUEBAS.md` §1, completo.
**Verifica:**
```bash
npm run test:rls
```
**Las 13 pruebas deben pasar.** Si alguna falla, hay un hueco de seguridad. No sigas hasta
resolverlo: es exactamente el tipo de fallo que este proyecto no se puede permitir.

---

## T-010 · Configurar la integración continua
**Antes:** T-009.
**Archivo:** `.github/workflows/ci.yml`.
**Haz:** un flujo que en cada push y cada pull request ejecute, en este orden:
1. `npm ci`
2. `supabase start` y `supabase db reset`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run test`
6. `npm run test:rls`

**Verifica:** abre un pull request de prueba y comprueba que el flujo corre y que **bloquea la
fusión si falla**. Las pruebas de RLS son de bloqueo obligatorio.

---

## T-011 · Crear los buckets de almacenamiento
**Antes:** T-003.
**Haz:** en `http://127.0.0.1:54323` → Storage, crea `contenido` y `consentimientos`.
**Ambos privados.**
**Verifica:** intenta abrir la URL pública de un archivo subido. Debe dar error de acceso.

---

## T-012 · Configurar el proyecto de producción
**Antes:** T-010.
**Haz:**
1. Crear el proyecto `zr-prod` en supabase.com.
2. Enlazarlo: `supabase link --project-ref <ref>`.
3. Aplicar el esquema: `supabase db push`. **Sin el seed de desarrollo.**
4. Conectar el repositorio a Vercel, con las variables de entorno de producción.
5. Activar los respaldos automáticos diarios.

**Verifica:** el dominio de producción carga por HTTPS y la consulta de tablas sin RLS devuelve
cero filas también allá.

---

## T-013 · Probar la restauración del respaldo
**Antes:** T-012.
**Haz:** restaura el último respaldo a una base descartable. **Cronometra cuánto tarda.**
**Archivo:** documenta el procedimiento en `docs/OPERACION.md`, con:
- Los pasos exactos para restaurar.
- Cuánta información se pierde en el peor caso (objetivo: máximo 24 horas).
- Cuánto tarda volver a operar (objetivo: máximo 4 horas).

**Verifica:** existe `docs/OPERACION.md` con la duración medida, no estimada.

> Un respaldo que nunca se restauró no es un respaldo. Esta tarea no se salta.

---

## CRITERIO DE SALIDA DEL SPRINT 0

- [ ] `supabase db reset` reconstruye todo desde cero, dos veces seguidas.
- [ ] Cero tablas sin RLS.
- [ ] `npm run test:rls` pasa las 13 pruebas.
- [ ] `npm run verify` pasa completo.
- [ ] La integración continua bloquea la fusión cuando algo falla.
- [ ] Producción desplegada, con respaldos activos y restauración probada.
- [ ] `docs/OPERACION.md` escrito.

**No empieces el Sprint 1 sin marcar las siete casillas.**
