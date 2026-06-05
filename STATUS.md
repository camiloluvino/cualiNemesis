# Estado del Proyecto (STATUS)

## Fase Actual: Notas Informativas y Gestión de Eliminación de Categorías (V 0.8.0)

### Completado
- [x] **Gestión y Eliminación de Categorías (v0.8.0):** Implementado el botón `🗑️ Gestionar seleccionados` en las tres pestañas. Añadido un modal de confirmación con impacto detallado. Soporta dos modos: "Desenlazar" (quitar corchetes `[[  ]]`) y "Eliminar" (reemplazar por el enlace auditable `[[CÓDIGO ELIMINADO]]` para preservar la integridad de la entrevista y rastrear eliminaciones vía backlinks). Opcionalmente borra las páginas correspondientes en Roam. Ejecución secuencial espaciada para rate limiting con barra de progreso.
- [x] **Notas de Origen de Datos (v0.8.0):** Agregada una nota descriptiva sutil `.cn-info-note` debajo de la barra de herramientas de cada pestaña detallando la procedencia exacta de la información y criterios de filtrado.
- [x] **Pivote Híbrido por Fuentes (v0.7.0):** Implementada la Opción D para pivotar el árbol de códigos por fuente. Incluye un selector global de profundidad (Niveles 1-4 y Automático) en la barra de herramientas y la capacidad de pivotar/despivotar códigos individuales haciendo clic derecho contextualmente con redibujado local en caliente y estilos visuales diferenciados.
- [x] **Selección Transversal por Búsqueda (v0.6.4):** Añadido el botón `🔍 Seleccionar filtrados` en las tres pestañas del panel analítico. Permite seleccionar de forma transversal todos los códigos/casos que coincidan con la cadena del buscador.
- [x] **Auto-selección en Exportación (v0.6.4):** Integrada la selección transversal inteligente directamente en los botones de exportación (Copiar al portapapeles y Crear nueva página). Si el buscador de la pestaña tiene texto, se pre-seleccionan de forma automática los nodos coincidentes antes de exportar, manteniendo la jerarquía estructurada.
- [x] **Compactación de Elementos de Interfaz (v0.6.3):** Reducción de márgenes y paddings en el modal general, encabezados, pestañas, buscador y toolbar para maximizar el área de trabajo y permitir una visualización panorámica óptima.
- [x] **Eliminación de Resaltado Hover en Filas (v0.6.3):** Remoción de los cambios de color y transformaciones de desplazamiento al pasar el ratón por encima de los elementos de la tabla para evitar fatiga y distracciones visuales, manteniendo el botón `↗` oculto hasta hacer hover.
- [x] Consulta Datalog para extracción de bloques codificados en la página actual.
- [x] Lógica de filtrado de códigos basada en expresiones regulares y namespaces (`/`).
- [x] Interfaz de usuario modal para selección de códigos a procesar.
- [x] Función de exportación dual (Generación de página nueva en Roam vs. Copiar al portapapeles respetando tabulaciones).
- [x] Contingencia para captura de contexto (UID) mitigando pérdida de foco de la paleta de comandos.
- [x] Refactorización: Separar el prototipo monolítico en módulos (`api`, `core`, `ui`) (v0.1.1).
- [x] Estructura de árbol jerárquico para procesamiento de códigos (`TreeNode`, `construirArbolCodigos`) (v0.2.0).
- [x] UI de árbol interactivo con checkboxes en cascada y carpetas colapsables (v0.2.0).
- [x] Exportador jerárquico recursivo en formato árbol para portapapeles y Roam Research (v0.2.0).
- [x] Rediseño UI en 3 Pestañas (v0.3.0).
- [x] **Ampliación del Panel (v0.4.0):** Modal expandido a `90vw` (máx. `1200px`) y `85vh` para acomodar visualizaciones complejas de datos.
- [x] **Buscadores Interactivos (v0.4.0):** Filtros dinámicos en tiempo real en las tres pestañas (Casos, Codificación global y Exportación contextual).
- [x] **Codebook como Árbol Jerárquico (v0.4.0):** Reconstrucción del listado global de códigos bajo una estructura unificada de árbol colapsable con soporte para filtros recursivos que preservan la jerarquía de los ancestros.
- [x] **Filtrado de Casos Raíz (v0.4.1):** Exclusión de subpáginas en el listado de entrevistas para centrarse únicamente en las entidades raíz (ej: `entrevistadx/Castro`).
- [x] **Navegación Rápida a Roam (v0.4.1):** Botón discreto (↗️) visible al pasar el cursor (hover) sobre cada caso y código para abrir directamente la página de Roam y cerrar el modal.
- [x] **Filtro de Descendientes de Árbol (v0.4.1):** Al buscar en el Codebook, se muestran y expanden automáticamente todos los descendientes de los nodos coincidentes.
- [x] **Selección y Extracción Global en Codebook (v0.4.2):** Habilitada la selección de códigos mediante casillas de verificación directamente en la pestaña de Codificación (Analítico), permitiendo extraer citas en todo el grafo (hacia portapapeles o nueva página).
- [x] **Botones de Selección Masiva (v0.4.2):** Botones de "Seleccionar todo" y "Deseleccionar todo" añadidos en las barras de herramientas de las pestañas de Exportación Contextual y Codificación (Analítico).
- [x] **Visualización en Tabla de Árbol (TreeTable) (v0.5.0):** Evolución del diseño de árbol a una tabla de árbol de 3 columnas (Código, Citas, Fuentes) que optimiza el espacio y la lectura analítica.
- [x] **Filtrado de Fuentes de Transcripción (v0.5.0):** Restricción en el conteo del Codebook global para considerar únicamente citas en páginas de transcripción activas (`entrevistadx/[Nombre]/transcripción/a analizar`), ignorando las páginas de codificación o referencia manual.
- [x] **Visualización Simplificada de Entrevistados (v0.5.0):** Se extrae únicamente el nombre del entrevistado en la columna "Fuentes" y se restringe su visualización exclusivamente a los códigos de nivel hoja (nodos de último nivel) para evitar ruido visual en categorías superiores.
- [x] **Agrupación Jerárquica y Vista TreeTable en Casos (v0.6.0):** Transformación de la pestaña "Casos" de un listado plano a un árbol interactivo en formato tabla (TreeTable) de 3 columnas (Caso, Código, Citas).
- [x] **Remoción de Prefijos en Casos (v0.6.0):** Limpieza visual quitando el prefijo `entrevistadx/` en la columna "Caso" para un diseño más limpio.
- [x] **Exportación y Control Masivo en Casos (v0.6.0):** Implementación de botones "Seleccionar todo", "Deseleccionar todo" y de exportación a portapapeles/página para la pestaña Casos, permitiendo consolidar la información agrupada por caso.
- [x] **Rediseño Estético Elegante y Aireado (v0.6.1):** Adopción de la tipografía Serif `Georgia` para encabezados principales, mayor espaciado (padding vertical) en filas de nodos, fuentes más delgadas y visualmente ligeras.
- [x] **Paleta Desaturada Claro Marfil (v0.6.1):** Fondo marfil (`#fcfcfa`) and arena (`#f2f1ed`) ultra suaves y desaturados para mitigar la fatiga visual.
- [x] **Limpieza de Emojis Chillonas (v0.6.1):** Eliminación de emojis de carpetas amarillas y documentos en las listas del árbol para mayor sobriedad.
- [x] **Botones Outlined Sutiles (v0.6.1):** Reemplazo de fondos sólidos y pesados de botones por bordes finos de color y fondos translúcidos elegantes.
- [x] **Optimización de Altura de Listas (v0.6.1):** Ajuste de la altura total a `90vh` y compresión de márgenes de elementos secundarios para maximizar la superficie de visualización útil de los paneles de códigos y casos.
- [x] **Separación Visual de Columnas (v0.6.1):** Incorporación de bordes verticales de división y márgenes de alineación (padding) en las tablas de todas las pestañas para mayor legibilidad y claridad analítica.
- [x] **Pestañas Más Prominentes (v0.6.1):** Ajuste de peso tipográfico (font-weight: 600 inactivas / 700 activa) en las pestañas de navegación principal para diferenciarlas fácilmente del contenido de las tablas.
- [x] **Toolbar de Acciones con Iconos Unicode (v0.6.2):** Incorporación de iconos contextuales (`⊞`, `⊟`, `☑`, `☐`) y bordes sutiles en los botones de herramientas para diferenciarlos claramente del contenido.
- [x] **Jerarquía Visual del Árbol de Datos (v0.6.2):** Diferenciación visual de nodos según su profundidad (`depth`), con fondos sutiles y textos en negrita para la raíz (Nivel 0) y tamaños de fuente reducidos con colores atenuados para subcódigos.
- [x] **Líneas de Conexión Continuas (v0.6.2):** Reemplazo de líneas discontinuas en el árbol por líneas sólidas finas para un flujo visual más limpio.
- [x] **Alineación de Números Monospaciados (v0.6.2):** Uso de fuentes `monospace` y `tabular-nums` en la columna de conteo de citas para una alineación y legibilidad óptimas.
- [x] **Checkboxes Estilizados en Azul Solarized (v0.6.2):** Adición de la propiedad `accent-color` de forma global para que las casillas adopten el tono azul corporativo de la interfaz.

### En Progreso / Tareas Inmediatas
- [ ] Implementar entorno de pruebas locales (Mocking de bloques y páginas) independiente de Roam.

### Roadmap (Próximas Funcionalidades)
- [ ] **Matriz de Co-ocurrencia:** Herramienta para identificar bloques que contienen múltiples códigos simultáneamente (cruces analíticos).
- [ ] **Parámetros de contexto:** Toggles en la interfaz para incluir "bloque padre" o "bloques hijos" en la extracción, ampliando el contexto de la cita.