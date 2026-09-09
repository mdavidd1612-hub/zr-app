# 20 · Inducción — cómo se trabaja en ZR App

> Este documento existe para que Marco y [tu nombre] no tengan que preguntar cada vez dónde
> está algo o cómo se hace algo. Léelo una vez completo; después úsalo como referencia rápida.
>
> La fuente de verdad para reglas de negocio y arquitectura sigue siendo **`AGENTS.md`** (copia
> idéntica en `CLAUDE.md`) — este documento no la repite, enlaza a ella. Si algo de aquí y de
> `AGENTS.md` se contradicen, gana `AGENTS.md`.

---

## 1. Los dos entornos

Desde septiembre de 2026 el proyecto vive en dos copias completas, nunca se trabaja directo
sobre lo que usan los estudiantes reales.

| | Producción | Staging (pruebas) |
|---|---|---|
| **Rama de git** | `main` | `develop` |
| **Supabase** | `zr-prod` (`hagbqhnittynxebdssua`) | `zr-staging` (`iazqmnfekulxjcqelzog`) |
| **Vercel** | Deploy de producción, dominio real | Preview automático de `develop` |
| **Quién lo usa** | Estudiantes, profesores y administración reales | Solo tú y Marco, con datos falsos |

**Regla de oro:** si estás probando algo nuevo, estás en `develop`, apuntando a `zr-staging`.
Solo se toca `main`/`zr-prod` cuando algo ya se probó ahí, o para un hotfix que no puede esperar.
El detalle completo de esta regla está en `AGENTS.md` §11.

---

## 2. Dónde está cada cosa

| Servicio | Para qué | Organización/cuenta |
|---|---|---|
| **GitHub** | El código, historial de cambios, ramas | Repo `zr-app` |
| **Vercel** | Despliega la app automáticamente en cada push | Proyecto `zr-app`, org `mt-projects12` |
| **Supabase** (`zr-prod`) | Base de datos, autenticación y Edge Functions de producción | Org `mtprojects1612` |
| **Supabase** (`zr-staging`) | Lo mismo, pero para probar sin riesgo | Misma org, proyecto separado |

**Acceso:** tanto tú como Marco ya tienen su propio login en los tres servicios — nadie depende
de la cuenta de otro para trabajar. Si alguna vez uno de los dos pierde acceso a algo, avisa de
una vez; no se comparten contraseñas, se invita a la cuenta.

---

## 3. El flujo de trabajo, paso a paso

1. Parado en `develop`, no en `main`.
2. Haces el cambio, lo pruebas contra `zr-staging` (local con `.env.development.local` apuntando
   ahí, o directo en la URL de preview de Vercel).
3. `git push origin develop` — Vercel despliega solo a la URL de preview.
4. Cuando el cambio ya se probó y se quiere pasar a producción: merge de `develop` a `main`.
5. Push a `main` — Vercel despliega solo a producción.

**Si tocaste la base de datos:** la migración se crea y se aplica primero contra `zr-staging`,
se prueba ahí, y la MISMA migración (nunca una reescrita) se aplica después contra `zr-prod` al
promover a producción. Nunca se edita una migración ya aplicada — `AGENTS.md` §2.6.

---

## 4. Convención de commits

Ya se venía haciendo así de hecho; queda formalizado:

- Mensaje descriptivo, en español, en la forma `tipo(alcance): qué cambia y por qué en una línea`.
  Ej.: `fix(material): el botón Descargar no abría el archivo`.
- Tipos usados en este repo: `feat`, `fix`, `docs`, `chore`.
- Cambios de Claude Code terminan con:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
- No se hace `git commit --amend` sobre commits ya empujados, ni `push --force` a `main`.

---

## 5. Reglas que no se negocian (resumen — la lista completa está en `AGENTS.md` §2)

1. Toda tabla nueva lleva su política de RLS.
2. Nada de notas, aprobaciones ni validación de QR se calcula en el navegador — eso vive en
   Edge Functions.
3. `exam_questions.correct_answer` nunca llega al estudiante.
4. La clave `service_role` nunca va en código de navegador, solo en servidor/Edge Functions.
5. Ningún número de negocio (umbrales, porcentajes, ventanas de tiempo) va escrito en el
   código — se lee de `system_config`.
6. Nunca se edita una migración ya aplicada.
7. Nunca reprobación automática por inasistencia.
8. Nunca bloqueo de acceso físico a aulas/talleres.
9. El rol de un usuario nunca lo decide el cliente.
10. Nada de Fase 2/3 (pagos, videos, red social, etc. — lista completa en `AGENTS.md` §7).

---

## 6. Si algo no está escrito en ningún lado

**Detente y pregunta.** No se improvisa una regla de negocio ni un campo nuevo. Orden de
búsqueda antes de preguntar:

1. `spec/` — el 95% de las respuestas están ahí.
2. `docs/09_DECISIONES_ARQUITECTONICAS.md` — el "por qué" de las decisiones ya tomadas.
3. `docs/00_CONTEXTO_MAESTRO_AGENTE.md` — reglas de negocio de la academia.
4. `docs/18_BRECHAS_SPEC_FUNCIONAL_ZRM.md` — antes de tocar inscripción, planilla, malla,
   asistencia u Odoo: qué falta, qué ya se hizo, y qué NO hay que "corregir" porque fue una
   decisión deliberada.

---

## 7. Estado de lo bloqueado (para no perder el hilo)

- **Integración con Odoo** (`docs/18_BRECHAS_SPEC_FUNCIONAL_ZRM.md`, sección D-1): en pausa,
  esperando la planificación que el coordinador va a mandar. No se empieza código hasta tener
  credenciales, URL, y el método de sincronización decidido.
