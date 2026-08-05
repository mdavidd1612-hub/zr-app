# 🧪 GUÍA DE PRUEBA - ZR App

## ✅ Estado Actual

| Componente | Estado |
|-----------|--------|
| **Frontend** | ✅ Next.js 16 + React 19 + TypeScript |
| **Estilos** | ✅ Liquid Glass iPhone-style (Tailwind CSS 4) |
| **Base de Datos** | ✅ Supabase PostgreSQL con 15 migraciones |
| **Seguridad** | ✅ RLS en todas las tablas |
| **CI/CD** | ✅ GitHub Actions configurado |
| **Usuarios de Prueba** | ✅ 3 usuarios creados y listos |
| **Servidor** | ✅ Corriendo en http://localhost:3000 |

---

## 🚀 ENTRAR A LA APP AHORA

Abre en tu navegador:
```
http://localhost:3000/login
```

---

## 👥 USUARIOS DE PRUEBA

Elige uno para entrar:

### 1️⃣ ESTUDIANTE (Ver tu carnet, asistencia, notas)
```
Cédula: V-30000001
Contraseña: Test123!
```
**Acceso a:**
- 📱 Tu carnet digital con código QR rotatorio
- 📊 Tu progreso en el módulo actual
- 🗓️ Próximo sábado (qué debes preparar)
- 📈 Tus calificaciones

### 2️⃣ PROFESOR (Escanear, crear contenido)
```
Cédula: V-20000001
Contraseña: Test123!
```
**Acceso a:**
- 📷 Escanear asistencia de estudiantes
- 📋 Sesiones de hoy
- 📝 Crear exámenes y contenido
- 📊 Reporte de asistencia

### 3️⃣ ADMINISTRADOR (Control total)
```
Cédula: V-10000001
Contraseña: Test123!
```
**Acceso a:**
- 👥 Gestionar estudiantes
- ✅ Revisar consentimientos parentales
- 📈 Reportes de progreso
- 🔧 Configuración de la app

---

## 🎨 QUÉ VER EN LA APP

### ✨ Efecto Liquid Glass iPhone-Style

Al entrar verás:
- **Títulos** con gradiente azul claro → azul profundo
- **Formularios** con fondo translúcido + blur profundo
- **Inputs** con bordes sutiles y efecto vidrio
- **Botones** con efecto iPhone puro
- **Tarjetas** con profundidad profesional

### 📱 Responsive Design

Abre DevTools (F12) y selecciona:
- **Mobile (375px)** - Se ve perfecto
- **Tablet (768px)** - Layout se adapta
- **Desktop (1280px)** - Ancho máximo de contenedor

---

## ⚡ FUNCIONALIDADES TÉCNICAS

### 🔐 Seguridad
- ✅ Autenticación con Supabase (email + cédula)
- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Roles: estudiante, profesor, admin, super_admin
- ✅ Validación de contraseñas con Zod

### 💾 Base de Datos
- ✅ 15 migraciones SQL aplicadas
- ✅ 13 módulos de capacitación
- ✅ Buckets de almacenamiento privado
- ✅ Vistas especializadas para cada rol

### 🏗️ Arquitectura
- ✅ Next.js App Router (Turbopack)
- ✅ Client Components para interactividad
- ✅ Server Components para seguridad
- ✅ Supabase Auth integrado

---

## 🧪 CASOS DE PRUEBA RECOMENDADOS

### Prueba 1: Login Básico
1. Entra como **Estudiante**
2. Deberías ver tu carnet digital
3. El QR se actualiza cada 30 segundos
4. Logout y vuelve a entrar

### Prueba 2: Registro (Nuevo Estudiante)
1. Click en "¿Eres nuevo? Regístrate"
2. Completa el formulario (todos los campos)
3. **Importante:** Si tienes < 18 años, necesitarás consentimiento parental
4. Verifica que ves el glassmorphism en cada campo

### Prueba 3: Recuperar Contraseña
1. Click en "¿Olvidaste tu contraseña?"
2. Ingresa tu cédula (V-30000001)
3. Verás mensaje de confirmación
4. **Nota:** En desarrollo, los emails van a MailPit (puerto 54324)

### Prueba 4: Responsive Mobile
1. Abre DevTools (F12)
2. Presiona Ctrl+Shift+M (Mobile)
3. Observa que:
   - Botones son grandes (min 56px)
   - Texto es legible
   - Glassmorphism se adapta
   - No hay scroll horizontal

---

## 🔍 VERIFICAR QUE TODO FUNCIONA

Ejecuta en terminal:

```bash
# Ver el status
git log --oneline -5

# Compilación OK
npm run typecheck

# Linting OK
npm run lint

# Tests (excepto RLS que necesita usuarios seed)
npm run test
```

---

## 📊 ESTADÍSTICAS DEL PROYECTO

- **Archivos TypeScript/TSX:** 30+
- **Componentes UI:** 7
- **Migraciones SQL:** 15
- **Páginas:** 9
- **APIs:** 3
- **Líneas de CSS:** 500+

---

## 🐛 SI ALGO NO FUNCIONA

### El servidor no inicia
```bash
# Reinicia manualmente
npm run dev
```

### Los usuarios de prueba no existen
```bash
# Recrea automáticamente
node scripts/crear-usuarios-prueba.js
```

### Los estilos se ven planos
```bash
# Hard refresh del navegador
Ctrl + Shift + R  (Windows/Linux)
Cmd + Shift + R   (Mac)
```

### Las migraciones fallaron
```bash
# Reset completo de BD
supabase db reset --no-seed
```

---

## 🎯 PRÓXIMOS PASOS

Una vez que termines de probar:

1. **SPRINT 1:** Implementar más funcionalidades
2. **SPRINT 2:** Integrar escaneo de QR
3. **SPRINT 3:** Exámenes y calificación
4. **PRODUCTION:** Desplegar en Vercel

---

## 💬 RESUMEN RÁPIDO

**¿Dónde entro?**
→ http://localhost:3000/login

**¿Con qué usuario?**
→ Elige cualquiera de los 3 (estudiante, profesor, admin)

**¿Qué debo ver?**
→ Formularios hermosos con efecto iPhone de vidrio

**¿Cómo se ve profesional?**
→ Colores ZR Mecademy + blur profundo + bordes sutiles

**¿Está seguro?**
→ Sí, RLS en todas las tablas + validaciones en cliente y servidor

---

**Fecha:** 4 de agosto de 2026  
**Status:** ✅ LISTO PARA PROBAR  
**Autor:** Claude Code  
