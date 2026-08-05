# T-012 y T-013: Configuración de Producción

Estas dos tareas requieren cuentas externas que solo tú puedes configurar.

## T-012: Vercel + Supabase Producción

### Paso 1: Crear proyecto Supabase producción

1. Ve a https://supabase.com y crea un **nuevo proyecto** con el nombre `zr-prod`
2. Región: **East US (N. Virginia)** — es la más cercana a Venezuela
3. Guarda la **contraseña de base de datos** en Bitwarden (Supabase NO la vuelve a mostrar)
4. Una vez creado, ve a **Project Settings** y copia:
   - `NEXT_PUBLIC_SUPABASE_URL` (la URL de la API)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave pública)
   - `SUPABASE_SERVICE_ROLE_KEY` (clave de servidor — PRIVADA)

### Paso 2: Aplicar esquema a producción

En tu máquina, con la CLI de Supabase:

```bash
# Conectar a la base producción
supabase link --project-ref <tu-ref-produccion>

# Aplicar migraciones (001 a 015)
supabase db push

# Cargar datos iniciales (opcional — solo si quieres datos de prueba)
supabase db push --seed
```

### Paso 3: Crear proyecto Vercel

1. Ve a https://vercel.com
2. Importa el repositorio `guayamuripm-boop/zrapp`
3. Durante la importación, agrega estas variables de entorno:

```
NEXT_PUBLIC_SUPABASE_URL=<de paso 1>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<de paso 1>
SUPABASE_SERVICE_ROLE_KEY=<de paso 1>
NEXT_PUBLIC_APP_URL=https://zrapp.vercel.app
```

4. Haz deploy
5. Verifica en https://zrapp.vercel.app que funciona

## T-013: Respaldos Probados

### Paso 1: Activar respaldos automáticos

En https://supabase.com → tu proyecto `zr-prod` → **Backups**:

1. Elige **Daily** (diario)
2. Descarga la **primera copia** a mano para verificar que funciona

### Paso 2: Probar restauración

1. Descarga el respaldo
2. Crea una **base de datos temporal** en Supabase
3. Restaura el respaldo allí
4. Verifica que puedes:
   - Ver la tabla `profiles` (debe haber 12 estudiantes)
   - Hacer login con `V-30000001 / Prueba123!`
   - Ver el carnet

### Paso 3: Limpiar

Elimina la base temporal si todo funcionó.

## Checklist de Verificación

- [ ] T-012: Proyecto Supabase prod creado y esquema aplicado
- [ ] T-012: Variables de env en Vercel
- [ ] T-012: Deploy en Vercel funciona (puedes registrarte y ver carnet)
- [ ] T-013: Respaldos automáticos activados
- [ ] T-013: Restauración de respaldo probada y funciona

## Variables de Entorno que Necesita OpenCode

Para que OpenCode pueda desplegar después, guarda en un lugar seguro:

```env
# Supabase Producción
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Vercel
NEXT_PUBLIC_APP_URL=https://zrapp.vercel.app
```

Nunca los metas en el repo — son secretos. Vercel los gestiona en Project Settings.

## Regla de Oro

**Service role key es la llave maestra.** Si se expone:

1. Generar una nueva en Supabase
2. Actualizar en Vercel
3. Rotar inmediatamente

Por eso usamos `SUPABASE_SERVICE_ROLE_KEY` (sin `NEXT_PUBLIC_` prefix) — Next.js no la mete en el paquete del navegador.
