# Instrucciones para la Inteligencia Artificial (AI_INSTRUCTIONS)

Este proyecto es un plugin para Roam Research destinado al Análisis Cualitativo Asistido por Computadora (CAQDAS). Al generar o modificar código para este proyecto, debes adherirte estrictamente a las siguientes reglas:

## 1. Interacción con Roam Research
- Utiliza exclusivamente `window.roamAlphaAPI` para operaciones de lectura (Datalog) y escritura.
- Nunca asumas el contexto o el foco del DOM al usar comandos o atajos. Utiliza métodos robustos de contingencia (ej. buscar el UID del bloque padre o el título en el DOM) si `getOpenPageOrBlockUid()` falla.
- **Prohibición estricta:** Nunca utilices `alert()`, `prompt()` o `confirm()`. Interfieren con el ciclo de vida de React en Roam. Utiliza sistemas de notificaciones no bloqueantes (Toasts) o interfaces modales personalizadas.

## 2. Arquitectura y Separación de Preocupaciones (SoC)
- **Capa API (`/api`):** Aísla todas las consultas Datalog (`roamAlphaAPI.q`) y la mutación del grafo.
- **Capa Lógica (`/core`):** Aísla el procesamiento de texto, manipulación de arrays, expresiones regulares y estructuración de datos. Debe ser independiente de Roam para permitir pruebas locales.
- **Capa UI (`/ui`):** Maneja la creación de elementos del DOM (modales, botones) y la interacción del usuario.

## 3. Manejo de Asincronía
- Las operaciones de escritura múltiple en Roam (ej. generar consolidaciones largas con múltiples bloques) deben usar `async/await` con retrasos controlados (promesas de `setTimeout`) para evitar sobrecargar la base de datos local y perder datos.

## 4. Referencias y Vínculos
- Mantén siempre la integridad de los identificadores únicos (UIDs) de 9 caracteres. 
- Al consolidar información cualitativa, utiliza siempre referencias de bloque `((UID))` y referencias de página `[[Nombre]]` para no perder el contexto original.

## 5. Versionado y Construcción (Build)
- La ÚNICA fuente de verdad es la carpeta `src/`.
- NUNCA edites el archivo `cualiNemesisMaster.js` directamente, ya que es un archivo generado.
- Para cambiar el código, edita los módulos en `src/` y luego ejecuta el script `build.ps1`.
- La versión maestra del proyecto se controla exclusivamente desde la variable `$version` en la línea 3 de `build.ps1`. Incrementa esta versión al completar tareas funcionales.
- **REGLA ESTRICTA DE TIMESTAMP:** El encabezado del archivo final generado (`cualiNemesisMaster.js`) DEBE incluir obligatoriamente la fecha y hora exacta de la última actualización, utilizando el formato estricto `yyyy-MM-dd HH:mm:ss` (año, mes, día, hora, minuto y segundo). Esta inyección es automatizada por `build.ps1`.