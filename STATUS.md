# Estado del Proyecto (STATUS)

## Fase Actual: Ajustes de Usabilidad y Navegación (V 0.6.0 - Local)

### Completado
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



### En Progreso / Tareas Inmediatas
- [ ] Implementar entorno de pruebas locales (Mocking de bloques y páginas) independiente de Roam.

### Roadmap (Próximas Funcionalidades)
- [ ] **Matriz de Co-ocurrencia:** Herramienta para identificar bloques que contienen múltiples códigos simultáneamente (cruces analíticos).
- [ ] **Parámetros de contexto:** Toggles en la interfaz para incluir "bloque padre" o "bloques hijos" en la extracción, ampliando el contexto de la cita.