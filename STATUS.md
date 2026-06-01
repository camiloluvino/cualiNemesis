# Estado del Proyecto (STATUS)

## Fase Actual: Prototipado y Validación (V 0.2.0)

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

### En Progreso / Tareas Inmediatas
- [ ] Implementar entorno de pruebas locales (Mocking de bloques y páginas) independiente de Roam.

### Roadmap (Próximas Funcionalidades)
- [ ] **Dashboard del Codebook:** Panel para listar todos los códigos activos en el grafo y visualizar frecuencias/fundamentación.
- [ ] **Matriz de Co-ocurrencia:** Herramienta para identificar bloques que contienen múltiples códigos simultáneamente (cruces analíticos).
- [ ] **Parámetros de contexto:** Toggles en la interfaz para incluir "bloque padre" o "bloques hijos" en la extracción, ampliando el contexto de la cita.