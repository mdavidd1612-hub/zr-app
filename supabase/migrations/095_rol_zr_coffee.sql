-- =============================================================================
-- ZR APP · MIGRACIÓN 095 · Rol ZR Coffee (1/2 — el valor del enum)
-- =============================================================================
-- Pedido explícito del coordinador: ZR Coffee deja de ser una sección
-- visible solo por cuenta (zr_coffee_managers, migración 090) y pasa a ser
-- un ROL propio, igual que "vendedor" (migración 045) -- Cecilia entra como
-- `admin` o como `zr_coffee` y cambia entre los dos desde su perfil (mismo
-- mecanismo genérico de la migración 085: profile_roles + fn_cambiar_mi_rol,
-- el que ya usa Erika Hidalgo para admin/vendedor).
--
-- Un ALTER TYPE ... ADD VALUE no puede usarse en la misma transacción en que
-- se agrega si esa transacción también lo consulta (restricción de
-- Postgres) -- va solo en su propia migración; el resto (RLS, asignar el
-- rol a Cecilia, quitar zr_coffee_managers) es la 096.
-- =============================================================================

alter type public.user_role add value 'zr_coffee';
