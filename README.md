# ZR App — Plataforma académica de ZR Mecademy

Aplicación web instalable (PWA) para la gestión académica de una academia técnica de mecánica
automotriz. Clases sabatinas, ~100 estudiantes activos de 15 a 25 años.

**Entrega de Fase 1: sábado 5 de septiembre de 2026.**

---

## ⚡ Empieza aquí

| Si eres… | Lee esto primero |
|---|---|
| **Desarrollador** que entra al proyecto | [`COLABORACION.md`](COLABORACION.md) §3 — lista del primer día |
| **Agente de código** (Claude, Cursor, Copilot) | [`AGENTS.md`](AGENTS.md) — **completo, antes de escribir una línea** |
| Alguien que quiere entender **por qué** el proyecto es así | [`docs/08_AUDITORIA_TECNICA_Y_VIABILIDAD.md`](docs/08_AUDITORIA_TECNICA_Y_VIABILIDAD.md) |

---

## Estructura

```
├── AGENTS.md · CLAUDE.md    Reglas absolutas y orden de trabajo
├── COLABORACION.md          Cómo trabajamos juntos
│
├── spec/                    LA ESPECIFICACIÓN — es la verdad
│   ├── 01_SETUP.md          Comandos exactos para montar el entorno
│   ├── 02_CONTRATOS.md      Tipos y formas de datos
│   ├── 03_EDGE_FUNCTIONS.md Cada función con su entrada y salida
│   ├── 04_PANTALLAS.md      Cada ruta con sus campos y estados
│   ├── 05_PRUEBAS.md        Qué probar y cómo
│   └── 06_IDENTIDAD_VISUAL.md  Colores, tipografía, voz y tono
│
├── supabase/
│   ├── migrations/          14 archivos SQL · COPIAR TAL CUAL, NO EDITAR
│   └── seed/                Datos de prueba
│
├── tareas/                  6 sprints con tareas atómicas T-001 … T-515
├── marca/                   Logos y referencia visual oficial
└── docs/                    Contexto de negocio, auditoría y decisiones
```

**Jerarquía cuando dos archivos se contradicen:**
`supabase/migrations/*.sql` › `spec/` › `docs/`

⚠️ `docs/01_` y `docs/04_` están **superados** — describen un stack y un esquema que ya no se
usan. Llevan el aviso al inicio.

---

## Stack

Next.js (App Router) + TypeScript · Supabase (Postgres, Auth, Storage, Edge Functions) ·
Tailwind · PWA instalable · Vercel

**No se usa:** FlutterFlow, Retool, n8n, Firebase ni ningún ORM.

---

## Arrancar en local

```bash
npm install && supabase start && supabase db reset && npm run dev
```

Detalle completo, requisitos previos y variables de entorno en [`spec/01_SETUP.md`](spec/01_SETUP.md).

Verificación de que quedó bien: **13 módulos, 12 estudiantes, 4 menores, 2 bloqueados.**

---

## Antes de cada Pull Request

```bash
npm run verify
```

Ejecuta comprobación de tipos, linter, pruebas y **pruebas de acceso cruzado**. Estas últimas
verifican que un estudiante no puede leer los datos de otro. **Si fallan, no se publica** —
la base contiene datos personales de menores de edad y eso lo regula la LOPNNA.

---

## Reglas que no se rompen

1. Nadie sube directo a `main`. Todo pasa por Pull Request.
2. Nadie despliega en viernes.
3. Nadie edita una migración ya aplicada; se crea una nueva.
4. Ninguna tabla se crea sin RLS y sin su prueba de acceso cruzado.
5. Ningún número de negocio va escrito en el código: vive en `system_config`.
6. Las claves nunca se comparten por chat.

Las diez reglas completas están en [`AGENTS.md`](AGENTS.md) §2.

---

## Recursos que no viven en el repositorio

| Qué | Dónde |
|---|---|
| Claves de Supabase, Vercel y GitHub | Gestor de contraseñas compartido (Bitwarden) |
| Manual de identidad completo (PDF, 23 MB) | `C:\Proyectos\Marcas\ZR Mecademy\IdentidadZRMecademy2025\` |
| Fuentes de Illustrator y Photoshop | Misma carpeta |

En `marca/referencia/` están las tres páginas del manual que de verdad se consultan: paleta,
tipografías y usos del logo.

---

*Repositorio privado. Contiene datos y documentación interna de ZR Mecademy.*
// Force rebuild
