# Walkthrough: Pivote Híbrido (Selector de Nivel Global y Clic Derecho Contextual)

Hemos implementado la **Opción D** del plan de diseño para permitir un pivoteo flexible y sofisticado de los códigos cualitativos por fuentes. Esto combina un control de profundidad global mediante un selector en la barra de herramientas y la capacidad de pivotar/despivotar códigos de forma individual mediante un clic derecho intuitivo.

## Cambios Realizados

### 1. Motor de Árbol Jerárquico
- **Propiedad `isIndividuallyPivoted` en `TreeNode`**: Permite al renderizador saber si un nodo específico ha sido pivotado localmente (mediante clic derecho).
- **Función de Profundidad `pivotAtDepth` en `src/core/extractor.js`**:
  - Recorre el árbol de forma recursiva hasta alcanzar el nivel $N$ seleccionado (`targetDepth`).
  - Al llegar a ese nivel, ejecuta la transformación de pivote (`pivotNode`) sobre dicho nodo, reestructurando únicamente esa rama y dejando intactos los niveles superiores.
- **Soporte para el modo "Automático (Todos)"**: Realiza la agrupación inteligente (Smart Grouping) recursiva en el Nivel 1.

### 2. Interfaz Global (Barra de Herramientas del Codebook)
- **Selector de Profundidad (`<select id="cuali-pivot-level">`)**:
  - Añadido junto al botón de agrupación global.
  - Ofrece opciones: `Nivel 1`, `Nivel 2`, `Nivel 3`, `Nivel 4` y `Automático (Todos)`.
  - Al cambiar de opción, si el árbol ya está agrupado, se recalculan y actualizan los pivotes a la profundidad elegida de forma instantánea.
- **Integración y Refresco Síncrono**: Tanto el checkbox de "No duplicar" como el botón global y el selector de nivel se mantienen en perfecta sincronía.

### 3. Clic Derecho Contextual (Pivote por Nodo)
- **Evento `oncontextmenu` en `labelSpan`**:
  - Al hacer clic derecho sobre la etiqueta de cualquier nodo que no esté ocultando fuentes:
    - **Si no está pivotado**: Guarda su subárbol en `node.originalState`, ejecuta `pivotNode(node, noDuplicarCompartidos)` exclusivamente para ese código, marca `isIndividuallyPivoted = true` y expande automáticamente el subárbol para ver las fuentes resultantes.
    - **Si ya está pivotado**: Restaura su subárbol original a partir de `node.originalState`, limpia su estado y vuelve a colapsarlo.
- **Redibujado Local Eficiente**: El evento reemplaza únicamente el elemento `<li>` del nodo afectado en el DOM en caliente (`li.parentNode.replaceChild(...)`), sin reconstruir todo el árbol de códigos ni perder el foco.
- **Estilos Visuales**: Un nodo pivotado individualmente muestra el prefijo `🗂️` y su texto se resalta en azul (`var(--sol-blue)`), haciéndolo fácilmente identificable.

---

## Verificación

### 1. Construcción (Build)
- Se ejecutó `build.ps1` exitosamente para concatenar e integrar el código de `src/core/extractor.js` y `src/ui/modal.js` en el archivo final `cualiNemesisMaster.js`.

### 2. Validación y Pruebas en Roam Research
1. Carga el nuevo script `cualiNemesisMaster.js` en tu espacio de trabajo de Roam.
2. Abre la pestaña **Codebook** del Extractor Cualitativo.
3. **Pivote Global por Nivel**:
   - Selecciona `Nivel 2` en el desplegable "Nivel" y haz clic en **"🗂️ Agrupar árbol por fuentes"**:
     - Los códigos de Nivel 1 (ej. `cod`, `dim`) se mostrarán intactos.
     - Los subcódigos del Nivel 2 (ej. `amistades`) se agruparán bajo sus respectivas fuentes (`milena`, `matilda`), reestructurando el árbol a partir de ahí.
   - Cambia al `Nivel 3` o `Automático (Todos)` y observa cómo el árbol se reajusta dinámicamente según el nivel de profundidad.
   - Haz clic en **"📋 Restaurar estructura original"** para devolver el árbol a su estado normal.
4. **Pivote Contextual por Nodo (Clic Derecho)**:
   - En el árbol normal, haz clic derecho sobre un código (ej. `cod/amistades/cercanas`):
     - El código pasará a mostrar el prefijo `🗂️`, su color cambiará a azul, y se expandirá de inmediato para mostrar las fuentes (`milena`, `matilda`) directamente debajo de él.
     - Comprueba que el resto del árbol de códigos sigue exactamente en su estado original y no ha sido afectado.
   - Haz clic derecho de nuevo sobre el mismo código para revertir el pivote individual y restaurar su estructura y estado colapsado original de forma perfecta.
