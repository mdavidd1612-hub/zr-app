# Estado de ZR App

> Generado por `npm run estado` el sábado, 1 de agosto de 2026.
> No lo edites a mano: se sobrescribe.

```

  ZR APP · TABLERO DE ESTADO
  sábado, 1 de agosto de 2026
  ──────────────────────────────────────────────────────────────

  1 · ENTORNO DE TRABAJO

    OK    Node.js 20 o superior              v24.18.0
    OK    CLI de Supabase                    2.111.0
    OK    Docker (motor de la base local)    Docker version 29.6.2, build dfc4efb
    OK    Docker encendido                   el motor responde
    OK    Base de datos local levantada      contenedor de Postgres corriendo
    OK    Dependencias instaladas            node_modules presente
    OK    Claves locales (.env.local)        presente
    OK    Tipos generados (lib/database.types.ts) presente
    OK    Flujo de CI en su sitio            .github/workflows/ci.yml

  2 · BASE DE DATOS

  Migraciones en el repo: 14  (001_extensions_and_enums.sql … 014_mastery_map.sql)
  Semilla de desarrollo:  supabase/seed.sql lista

  Al aplicarla debe dar: 13 módulos · 12 estudiantes · 4 menores · 2 bloqueados

  3 · AVANCE POR SPRINT
  (un archivo escrito no es un archivo correcto — eso lo dice npm run verify)

  ██████████████████░░░░░░   77%  SPRINT 0 · FUNDACIONES
                                  10/13 tareas · 30 de julio → 2 de agosto · Objetivo: base de datos, seguridad y entornos listos antes de

  ████████████████░░░░░░░░   67%  SPRINT 1 · IDENTIDAD, CONSENTIMIENTO Y CARNET
                                  10/15 tareas · 3 → 9 de agosto · Prueba en campo: sábado 8 de agosto

  ██░░░░░░░░░░░░░░░░░░░░░░    8%  SPRINT 2 · ASISTENCIA Y OPERACIÓN DEL SÁBADO
                                  1/13 tareas · 10 → 16 de agosto · Prueba en campo: sábado 15 de agosto

  ░░░░░░░░░░░░░░░░░░░░░░░░    0%  SPRINT 3 · EVALUACIONES
                                  0/13 tareas · 17 → 23 de agosto · Prueba en campo: sábado 22 de agosto

  █░░░░░░░░░░░░░░░░░░░░░░░    6%  SPRINT 4 · CONTENIDO, FEEDBACK Y VISIBILIDAD
                                  1/17 tareas · 24 → 30 de agosto · Prueba en campo: sábado 29 de agosto (ensayo general)

  ░░░░░░░░░░░░░░░░░░░░░░░░    0%  SPRINT 5 · ENDURECIMIENTO, CAPACITACIÓN Y ENTREGA
                                  0/15 tareas · 31 de agosto → sábado 5 de septiembre

  ──────────────────────────────────────────────────────────────
  FASE 1 COMPLETA  ██████░░░░░░░░░░░░░░░░░░  26%  22/86 tareas

  4 · QUÉ TOCA AHORA

  Las cinco siguientes, en orden:

    [a mano] T-011 · Crear los buckets de almacenamiento
    [a mano] T-012 · Configurar el proyecto de producción
    [código]  T-013 · Probar la restauración del respaldo
              docs/OPERACION.md
    [código]  T-102 · Diseño base y componentes comunes
              app/globals.css, tailwind.config.ts, components/ui/*
    [código]  T-109 · Recuperación de contraseña
              app/recuperar/page.tsx, app/api/auth/callback/route.ts

  Las tareas [a mano] no crean archivos (son comandos o verificaciones).
  Cuando completes una, escribe su código en tareas/COMPLETADAS.txt.

  5 · CONTROL DE VERSIONES

  Rama actual:      tarea/T-001-entorno-y-tablero
  Último commit:    docs: Sprint 1 al 93% · T-113/T-114 completadas, solo faltan
  Sin guardar:      nada pendiente

  ──────────────────────────────────────────────────────────────
  Este tablero se regenera con: npm run estado
  La prueba de que el código sirve, no de que existe: npm run verify

```
