# CHEQUEO MASIVO DE PRODUCCIÓN — 7 de noviembre de 2026

**Motivo:** mañana sábado arranca el nuevo programa/cohorte con datos reales. Pedido: chequeo total de `zr-prod` (`main` → `https://zr-app-ebon.vercel.app`), todos los roles, todas las secciones, sin modificar nada salvo bugs confirmados, con todo documentado.

**Alcance real de este chequeo — léase antes que nada:** no hay forma de simular hardware físico (Samsung real, iPhone real, teléfono viejo real) desde aquí. Lo más cercano disponible es emulación de viewport/user-agent (375×812 tipo Android moderno, 320×568 tipo teléfono viejo/compacto) en un navegador de escritorio dentro de un pane de Claude. Tampoco entré con cuentas reales de estudiantes/profesores/admin — por política no debo probar ni adivinar credenciales de producción. Donde esas dos limitaciones importan, lo digo explícito abajo en vez de dar por buena una pantalla que no vi.

---

## 1. Qué se revisó y cómo

| Categoría | Método | Resultado |
|---|---|---|
| Compila el código real de producción | `git worktree` aislado en el commit exacto de `main`, `npm ci` + `npm run typecheck` + `npm run build` (webpack) | ✅ 0 errores de tipos, build completo exitoso, ~80 rutas generadas sin fallos (estáticas y dinámicas) |
| Calidad de código (lint) | `npx eslint .` sobre el mismo checkout, filtrando el ruido de un archivo vendored (`public/pdf.worker.min.mjs`, 1566 de 1611 "problemas" eran de ahí) | 17 hallazgos reales, todos revisados uno por uno: reglas nuevas de `react-hooks` (forward-looking para React Compiler, no bugs de runtime — confirmado razonando sobre hoisting de funciones) + 1 nit cosmético de HTML entity. **Cero bugs de runtime encontrados en lint.** |
| Seguridad de base de datos | `get_advisors` (security) sobre `zr-prod` | Los únicos "ERROR"/"WARN" son `SECURITY DEFINER` en vistas/funciones intencionales (`v_exam_questions_student`, vistas `v_feedback_*`) — correctas por diseño: así es como se cumplen las Reglas Absolutas #3 (nunca enviar `correct_answer`) y la anonimidad del feedback (§5/§7.5 del doc maestro). `student_qr_secrets` tiene RLS sin políticas de cliente — correcto por diseño (deny-by-default, solo tocan esa tabla las Edge Functions con `service_role`, Regla Absoluta #4). |
| Rendimiento de base de datos | `get_advisors` (performance) sobre `zr-prod` | Avisos de escala (`unindexed_foreign_keys`, `auth_rls_initplan`, `unused_index`, `multiple_permissive_policies`) — no son riesgo para mañana con ~20 estudiantes reales, pero quedan anotados para cuando se piense en 200 (alerta de escalabilidad del doc maestro §1.2). |
| RLS de los 3 flujos críticos del sábado | Lectura directa de políticas (`pg_policies`) en `attendance_events`, `class_sessions`, `cohorts`, `daily_snack_codes`, `session_checkin_codes`, `snack_overrides` | Todas correctamente scoped: estudiante solo lee lo suyo, personal solo lee/escribe lo de su cohorte/módulo vía `teaches_cohort_module()`, la única política con `roles: {public}` (`vendedor: borrar cohortes vacias`) exige `is_vendedor()` en el `USING`, así que un visitante anónimo no puede ejecutarla aunque el rol de Postgres lo permita en el papel. |
| Edge Functions críticas del sábado | `list_edge_functions` sobre `zr-prod` | `validate-scan`, `checkin-session`, `claim-snack`, `claim-snack-checkin`, `provision-qr` — las 5 en estado `ACTIVE`. Las 18 funciones del proyecto están `ACTIVE`. |
| PWA / manifest / service worker | `fetch` del manifest real + `navigator.serviceWorker.getRegistrations()` en el navegador contra producción | Manifest válido, service worker registrado. **Se encontró y corrigió 1 bug real (ver §2).** |
| Rutas referenciadas vs. rutas reales | Se extrajeron todos los `href="/..."` estáticos del código de `main` y se cruzaron contra el árbol de archivos de `app/` del mismo commit | Todas resuelven a una página real, incluyendo el enlace de descarga del APK (`/zr-app.apk`, confirmado con `HEAD` en vivo: 200, `application/vnd.android.package-archive`, ~1 MB — no está en este checkout de git porque es un binario servido aparte, pero SÍ está desplegado y responde). |
| Visual / responsive | Capturas y `scrollWidth === innerWidth` en producción real, viewport 320px y 375px | `/login` y `/descargar` renderizan sin overflow horizontal ni en el ancho más angosto probado (320px). Sin errores en consola. |

---

## 2. BUG ENCONTRADO Y CORREGIDO

### El atajo "Mi carnet" del ícono de la app (PWA shortcut) apuntaba a una ruta que no existe

- **Dónde:** [`app/manifest.ts`](app/manifest.ts) — el `shortcuts` array que Android/Chrome muestra al mantener presionado el ícono de la app instalada.
- **Qué pasaba:** `url: '/carnet'`. Esa ruta nunca existió — confirmado cruzando el código completo (`app`, `lib`, `components`) y la tabla completa de rutas del build de producción. El carnet digital real (con QR) vive en `/perfil`.
- **Impacto real para un estudiante:** al no existir la ruta, el fallback del service worker (app shell offline-first) atrapaba la navegación y lo mandaba a `/login` (confirmado en vivo, navegando a esa URL en producción) — es decir, un estudiante que usara el atajo del ícono para ver su carnet terminaba en la pantalla de login en vez de en su carnet.
- **Corrección aplicada:** `url: '/carnet'` → `url: '/perfil'` (un solo caracter de diferencia funcional, un commit).
- **Cómo se subió:** commit en `develop` (`8c53443`) → cherry-pick a una rama corta sobre la punta real de `main` → merge fast-forward → push directo a `main`. Deploy de Vercel confirmado `READY` (`dpl_7tKgjeg1qW6sRP9qmEDrAAPJYrL4`, commit `623267a`).
- **Verificado en vivo, ya en producción:** `fetch` del manifest real en `https://zr-app-ebon.vercel.app` devuelve `"url": "/perfil"`.

No se encontró ningún otro bug durante todo este chequeo. Todo lo demás de la tabla de arriba salió limpio.

---

## 3. Lo que ESTE chequeo NO cubrió (honestidad sobre el alcance)

- **No se probó ningún flujo con cuentas reales de producción** (iniciar sesión como estudiante/profesor/admin/vendedor/ZR Coffee y navegar sus pantallas reales con datos reales). No tengo ni debo usar credenciales de producción. Lo que sí se cubrió en su lugar: que el código que sirve esas pantallas compila y pasa lint sin bugs, que las políticas RLS que las protegen están bien scoped, y que las Edge Functions que accionan (escanear QR, reclamar refrigerio, etc.) están activas.
- **No se probó en hardware físico real** (Samsung, iPhone, teléfono Android viejo) — se usó emulación de viewport/user-agent en navegador de escritorio como la aproximación más cercana disponible, explícitamente avisado desde el inicio de esta tarea.
- **No se revisó línea por línea cada una de las ~180 funciones del catálogo del documento maestro** — eso ya está marcado como pendiente (sesión dedicada) en `docs/26_...` §8.5 desde el chequeo del 6-nov. Este chequeo masivo se enfocó en: ¿compila y despliega sin errores?, ¿hay bugs de código?, ¿las reglas de seguridad (RLS) y las Edge Functions de los flujos del sábado están bien y activas?, ¿la PWA funciona?, ¿las rutas enlazadas existen? — no en volver a auditar función por función contra el roadmap (eso ya se hizo parcialmente el 6-nov).
- Los avisos de rendimiento de escala (índices, policies múltiples) no se tocaron — no son riesgo a 20 estudiantes, quedan para cuando se aborde la alerta de escalabilidad del doc maestro.

---

## 4. Veredicto para mañana sábado

**Producción (`zr-prod`) está en buen estado para el inicio del nuevo programa.** Build limpio, sin bugs de código encontrados, RLS y Edge Functions de asistencia/refrigerio/QR correctas y activas, PWA funcionando. El único bug real que apareció en todo el chequeo (el atajo del carnet) ya está corregido y verificado en vivo.

**Dónde queda todo:**
- Fix: commit `8c53443` (`develop`) / `623267a` (`main`, ya en producción).
- Este reporte: `docs/reportes/chequeo_masivo_produccion_2026-11-07.md`.
