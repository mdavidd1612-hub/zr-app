-- =============================================================================
-- ZR APP · MIGRACIÓN 079 · Resúmenes cortos, competencias y horas por módulo
-- =============================================================================
-- A pedido explícito del coordinador (audio): los resúmenes largos de la
-- migración 074 "se ven feos, mucho texto, nadie va a leer eso" — tanto en
-- Mi módulo como en la malla curricular. Se reemplazan por un resumen corto
-- (2-3 frases) más una lista de competencias, y se agregan las horas
-- académicas de cada módulo (duration_weeks × horas por sábado — regla 5 de
-- AGENTS.md: el número de horas por sábado vive en system_config, nunca
-- escrito en el código).
-- =============================================================================

insert into public.system_config (key, value, description, is_public) values
  ('academia.horas_por_sabado', '4'::jsonb,
   'Horas académicas de una sesión de sábado. Se usa para calcular las horas totales de un módulo (duration_weeks × esto).', true)
on conflict (key) do nothing;

alter table public.modules add column if not exists competencias text[];

-- Resúmenes cortos + competencias, solo para los 5 módulos con contenido
-- real (order_index 1-5) — mismo criterio de la migración 074: actualiza
-- ambos programas (PTMA y PFTA comparten el mismo module.name/order_index).

update public.modules set
  description = 'Las bases de la mecánica automotriz: el carro como sistema, el motor de combustión interna, mantenimiento preventivo, diagnóstico de fallas comunes y seguridad en el taller.',
  competencias = array[
    'El carro como sistema: frenos, dirección, suspensión, eléctrico',
    'Motor de combustión interna: piezas y ciclo de 4 tiempos',
    'Mantenimiento preventivo y cronograma de servicio',
    'Diagnóstico preliminar por síntomas y testigos del tablero',
    'Seguridad industrial en el taller',
    'Cómo funciona un taller profesional'
  ]
where order_index = 1;

update public.modules set
  description = 'Medir con precisión antes de tocar nada: metrología, vernier, micrómetro, torquímetro, multímetro y manómetro — más el uso correcto de las herramientas básicas de taller.',
  competencias = array[
    'Metrología y sistemas de unidades (métrico e inglés)',
    'Uso del vernier y el micrómetro',
    'Torquímetro, multímetro y manómetro',
    'Herramientas de taller: uso y conservación'
  ]
where order_index = 2;

update public.modules set
  description = 'Los fluidos que mantienen vivo al vehículo: lubricantes y aditivos, viscosidad, líquido de frenos y refrigerante, grasa y filtros, y los fluidos de transmisión.',
  competencias = array[
    'Tribología y tipos de lubricantes',
    'Aditivos y viscosidad (clasificación SAE/API)',
    'Líquido de frenos y refrigerante',
    'Grasa, filtros y fluidos de transmisión'
  ]
where order_index = 3;

update public.modules set
  description = 'El corazón del vehículo a fondo: clasificación de motores, cada componente del motor (bloque, pistones, bielas, cigüeñal, culata) y el ciclo completo de cuatro tiempos.',
  competencias = array[
    'Clasificación de motores térmicos',
    'Componentes del motor',
    'Ciclo de cuatro tiempos paso a paso'
  ]
where order_index = 4;

update public.modules set
  description = 'Cómo llega la potencia del motor a las ruedas: relación de transmisión, cajas manuales sincronizadas, sistemas de embrague y transmisiones automáticas.',
  competencias = array[
    'Relación de transmisión y torque',
    'Caja manual sincronizada',
    'Sistema de embrague: tipos',
    'Transmisión automática y convertidor de par'
  ]
where order_index = 5;

-- Horas reales que dio el coordinador para los dos módulos que ya están en
-- curso ahora mismo (PTMA-2026-II): el actual, 3 sábados; el siguiente, 6.
-- El resto de los módulos se queda en su duración por defecto hasta que
-- avise las horas reales de cada uno ("ya después el resto lo vamos poniendo
-- poco a poco").
update public.modules set duration_weeks = 3 where order_index = 1;
update public.modules set duration_weeks = 6 where order_index = 2;
