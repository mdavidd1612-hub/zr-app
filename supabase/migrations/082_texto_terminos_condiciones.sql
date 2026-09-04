-- =============================================================================
-- ZR APP · MIGRACIÓN 082 · Texto real de Términos y Condiciones
-- =============================================================================
-- Reemplaza el placeholder de la migración 053 por el borrador que redactó
-- el coordinador (documento enviado por WhatsApp), completado con lo que ya
-- sabemos del sistema. Quedan DOS datos reales que no invento: la dirección
-- de la sede y un correo/teléfono de contacto de la academia — se avisó al
-- coordinador para que los complete desde Configuración (no hace falta
-- desplegar nada para eso, system_config.terms.text es editable en vivo).
-- No sube terms.version: es el mismo texto que faltaba, no un cambio sobre
-- uno ya aceptado por nadie.
-- =============================================================================

update public.system_config set
  value = to_jsonb($TXT$Antes de continuar, es necesario que leas y aceptes los siguientes términos sobre el uso de tus datos personales.

1. Responsable del tratamiento de datos
ZR Mecademy, con sede en [dirección de la sede — pendiente de completar], es responsable de la recolección y el uso de los datos personales que se describen a continuación.

2. Datos que recolectamos
Al registrarte en esta aplicación, recolectamos y almacenamos digitalmente los siguientes datos:
- Nombre completo
- Número de cédula de identidad
- Número de teléfono
- Ubicación (dirección/zona de residencia)
- Respuestas al formulario de preguntas realizado durante tu inscripción

3. Finalidad del tratamiento
Estos datos serán utilizados exclusivamente para:
- Gestionar tu proceso de inscripción y matrícula en el programa académico correspondiente
- Identificarte dentro del sistema (acceso con cédula)
- Contactarte para fines administrativos y académicos (avisos de clases, horarios, etc.)
- Llevar el control y seguimiento académico durante tu formación

4. Carácter de los datos
La cédula, el nombre y el teléfono son de suministro obligatorio para poder completar tu inscripción. La dirección/ubicación es opcional.

5. Almacenamiento y seguridad
Tus datos se almacenan de forma digital en los sistemas internos de la academia. Solo el personal autorizado de ZR Mecademy tiene acceso a esta información. Se toman medidas razonables para proteger tus datos contra pérdida, uso indebido o acceso no autorizado.

6. Terceros
Tus datos no serán vendidos, cedidos ni compartidos con terceros ajenos a la academia, salvo que exista una obligación legal que lo requiera.

7. Tus derechos
De acuerdo con el derecho constitucional de acceso a la información (Artículo 28 de la Constitución de la República Bolivariana de Venezuela), tienes derecho a:
- Conocer qué datos tuyos están registrados
- Solicitar la corrección de datos incorrectos o desactualizados
- Solicitar la eliminación de tus datos cuando ya no exista una relación académica vigente

Para ejercer estos derechos puedes escribir a [correo o teléfono de contacto de la academia — pendiente de completar].

8. Menores de edad
Si el estudiante es menor de 18 años, este consentimiento debe ser otorgado por su representante legal (padre, madre o tutor), quien además deberá suministrar sus propios datos de contacto como responsable del estudiante.

9. Vigencia y revocación
Este consentimiento tiene vigencia mientras dure tu relación con la academia. Puedes revocarlo en cualquier momento escribiendo a [correo o teléfono de contacto de la academia — pendiente de completar], entendiendo que esto podría afectar la continuidad de tu inscripción o del servicio prestado.

Al marcar la casilla de abajo declaras que has leído y comprendido esta información, y das tu consentimiento libre, expreso e informado para que ZR Mecademy recolecte, almacene digitalmente y utilice tu cédula, nombre, teléfono y ubicación, así como las respuestas que suministres en el formulario de inscripción, únicamente para los fines aquí descritos.$TXT$::text)
where key = 'terms.text';
