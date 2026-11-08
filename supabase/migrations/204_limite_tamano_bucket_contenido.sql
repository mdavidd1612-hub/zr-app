-- Bug real reportado en vivo (8-nov-2026): subir un video de ~150MB fallaba
-- con "The object exceeded the maximum allowed size" -- el bucket "contenido"
-- no tenía file_size_limit propio, así que usaba el límite global del
-- proyecto (más bajo). Se le pone un límite propio de 500MB, suficiente para
-- un video de clase típico. El video no se comprime en el navegador (no hay
-- forma liviana de transcodificar video en el cliente); el límite de bucket
-- es la parte real que bloqueaba la subida.
update storage.buckets set file_size_limit = 524288000 where id = 'contenido';
