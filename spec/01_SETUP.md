# 01 · PREPARACIÓN DEL ENTORNO
> Ejecuta estos comandos **en este orden**. No sigas al siguiente hasta que el anterior
> termine sin errores.

---

## 1. Requisitos previos

Verifica que están instalados:

```bash
node --version
```
Debe decir 20 o superior.

```bash
npm --version
```

```bash
git --version
```

Instala la CLI de Supabase:

```bash
npm install -g supabase
```

Instala Docker Desktop y déjalo corriendo. Supabase local lo necesita.

---

## 2. Crear el proyecto

```bash
npx create-next-app@latest zr-app --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"
```

Responde: App Router **sí**, Turbopack **sí**.

```bash
cd zr-app
```

---

## 3. Instalar dependencias

```bash
npm install @supabase/supabase-js @supabase/ssr otpauth qrcode @zxing/browser date-fns zod
```

```bash
npm install -D vitest @vitejs/plugin-react @playwright/test dotenv tsx
```

---

## 4. Inicializar Supabase

```bash
supabase init
```

Copia los 14 archivos `.sql` de `supabase/migrations/` de la especificación a la carpeta
`supabase/migrations/` del proyecto, y `seed_dev.sql` a `supabase/seed.sql`.

**No modifiques ningún archivo SQL.** Si crees que hay un error, detente y pregunta.

```bash
supabase start
```

Guarda lo que imprime: `API URL`, `anon key`, `service_role key`.

```bash
supabase db reset
```

Este comando borra la base local, aplica las 14 migraciones en orden y carga los datos de
prueba. **Si falla, no sigas: el problema está en el SQL y hay que resolverlo antes.**

---

## 5. Verificar que la base quedó bien

```bash
supabase db reset && psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select count(*) as modulos from public.modules; select count(*) as estudiantes from public.students; select count(*) as menores from public.v_students where is_minor; select count(*) as bloqueados from public.v_students_blocked;"
```

Resultado esperado: **13 módulos, 12 estudiantes, 4 menores, 2 bloqueados**.

Verifica que RLS está activa en todas las tablas:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select tablename from pg_tables where schemaname='public' and rowsecurity = false;"
```

**Debe devolver cero filas.** Si aparece alguna tabla, le falta `enable row level security`.

---

## 6. Variables de entorno

Crea `.env.local` en la raíz del proyecto:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key que imprimió supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key que imprimió supabase start>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Crea `.env.example` con las mismas claves pero sin valores, y añade `.env.local` a
`.gitignore`.

> **`SUPABASE_SERVICE_ROLE_KEY` no lleva el prefijo `NEXT_PUBLIC_`.** Eso es a propósito: si lo
> lleva, Next.js la incluye en el paquete que descarga el navegador y cualquiera puede leer y
> escribir toda la base de datos saltándose RLS.

---

## 7. Generar los tipos de TypeScript

```bash
npx supabase gen types typescript --local > lib/database.types.ts
```

Repite este comando **cada vez que apliques una migración nueva**. Los tipos se generan; no se
escriben a mano.

---

## 8. Clientes de Supabase

Crea estos tres archivos exactamente así.

**`lib/supabase/client.ts`** — para componentes del navegador:
```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`lib/supabase/server.ts`** — para componentes de servidor:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch { /* Server Component: lo maneja el middleware */ }
        },
      },
    }
  )
}
```

**`lib/supabase/admin.ts`** — solo servidor, se salta RLS:
```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// PELIGRO: este cliente ignora Row Level Security.
// Úsalo únicamente en rutas de servidor y solo cuando la operación ya validó
// que quien la pide tiene permiso. Jamás lo importes en un componente cliente.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
```

---

## 9. Scripts de package.json

Añade estos scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "estado": "node scripts/estado.mjs",
    "db:reset": "supabase db reset",
    "db:types": "supabase gen types typescript --local > lib/database.types.ts",
    "test": "vitest run",
    "test:rls": "vitest run tests/rls",
    "test:e2e": "playwright test",
    "verify": "npm run typecheck && npm run lint && npm run test && npm run test:rls"
  }
}
```

**`npm run verify` es el comando que debes correr antes de dar por terminada cualquier tarea.**

> `next lint` desapareció en Next.js 16; el comando es `eslint` a secas. Si ves
> *"Invalid project directory provided, no such directory: …/lint"*, es esto.

**`npm run estado`** dibuja el tablero de avance: qué falta del entorno, cuánto llevamos de cada
sprint y qué tarea toca. Léelo antes de empezar el día. Deja una copia en `ESTADO.md`.

---

## 10. Buckets de almacenamiento

En el panel de Supabase (`http://127.0.0.1:54323`), Storage → New bucket. Crea dos, **ambos
privados**:

| Bucket | Contenido |
|---|---|
| `contenido` | PDFs y material de estudio |
| `consentimientos` | Documentos de consentimiento parental firmados |

Ninguno de los dos puede ser público: el primero es material de la academia y el segundo
contiene datos de menores de edad y de sus representantes legales.

---

## 11. Verificación final del entorno

```bash
npm run dev
```

Abre `http://localhost:3000`. Debe cargar la página por defecto de Next.js sin errores en la
consola.

```bash
npm run verify
```

Si todo pasa, el entorno está listo. Continúa con `tareas/SPRINT_0.md`.
