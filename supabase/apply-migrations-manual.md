# Aplicar migraciones manualmente en Supabase Cloud

## Pasos:

1. Abre https://app.supabase.com/project/hagbqhnittynxebdssua
2. Ve a **SQL Editor** (en la barra lateral izquierda)
3. Copia y pega CADA migración en orden, **una a una**:

---

### 001_init_profiles.sql
(Copia el contenido de supabase/migrations/001_init_profiles.sql)

---

### 002_init_auth_related.sql
(Copia el contenido de supabase/migrations/002_init_auth_related.sql)

... (continúa con cada archivo en orden: 003, 004, ... hasta 018)

---

**IMPORTANTE:**
- Ejecuta cada una por separado
- Espera a que termine antes de pasar a la siguiente
- Si una falla, avísame del error exacto

**O más fácil:** dame permiso SSH a tu máquina y lo hago yo.

**O alternativa rápida:** despliega a Vercel SIN migraciones aplicadas, y luego las aplicamos desde el SQL Editor de Supabase.
