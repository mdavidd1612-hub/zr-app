-- 163: el límite de «archivo pesado» baja de 20 a 10 MB (pedido del coordinador,
-- 13 oct. 2026). Un archivo de hasta 10 MB se sube directo, sin pasar por la
-- compresión; uno mayor se intenta comprimir antes de subirse.
update public.system_config set value = to_jsonb(10) where key = 'content.aviso_pesado_mb';
