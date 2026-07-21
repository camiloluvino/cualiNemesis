# CualiNemesis 📄🧪

CualiNemesis es un plugin avanzado para **Roam Research** diseñado para asistir en el **Análisis Cualitativo Asistido por Computadora (CAQDAS)**. Permite extraer, estructurar y consolidar información codificada jerárquicamente utilizando namespaces dentro de tu base de conocimiento.

---

## 🚀 Características Principales

* 📐 **Diseño Compacto Unificado (v0.8.1):** Fusión de la barra de pestañas (izquierda) y los controles de herramientas (derecha) en una sola fila horizontal (`cuali-tabs`). Los botones e indicadores se alternan de forma dinámica según la pestaña activa, liberando espacio vertical significativo para concentrarse en las tablas de datos. El buscador de cada pestaña se despliega de forma toggleable directamente debajo al presionar 🔍.

CualiNemesis cuenta con un panel analítico dividido en tres pestañas optimizadas para flujos de trabajo cualitativos a gran escala:

### 1. 📂 Exportación Contextual
* Extrae todos los códigos y citas aplicadas a los bloques de la página activa en tiempo real.
* Renderiza los códigos en una estructura de tabla de árbol (TreeTable) interactiva con checkboxes en cascada (marcado, desmarcado y estado indeterminado) y columnas dedicadas para el **Código** y la cantidad de **Citas**. La columna de fuentes se oculta automáticamente por estar dentro del contexto de una única entrevista.
* **Exportación dual:**
  * **Copiar al portapapeles:** Genera un texto con tabulaciones listas para pegar en cualquier página de Roam conservando la jerarquía.
  * **Generar reporte:** Crea automáticamente una página organizada bajo el namespace `codebook/entrevistas/...` en Roam con los nombres de los ítems seleccionados y referencias dinámicas de bloques `((UID))` organizados jerárquicamente.
* **Buscador interactivo con selección transversal:**
  * Filtra códigos y citas en tiempo real.
  * **Auto-selección al exportar:** Si hay texto en el buscador al hacer clic en exportar (Copiar/Crear página), se seleccionan automáticamente solo los nodos coincidentes de forma transversal.
* **Herramientas de selección masiva (Toolbar):** Botones `Expandir todo` (⊞), `Colapsar todo` (⊟), `Seleccionar todo` (☑), `Deseleccionar todo` (☐) y `Seleccionar filtrados` (☑*), además de un buscador desplegable (🔍).

### 2. 👥 Casos (Entidades Empíricas)
* Renderiza los casos y sus códigos en una estructura de tabla de árbol (TreeTable) interactiva y jerárquica de tres columnas: **Caso**, **Código** y **Citas**.
* **Remoción de prefijos:** Limpia visualmente las páginas de casos eliminando el prefijo `entrevistadx/` para mostrar solo el nombre del entrevistado.
* **Agrupación por Caso:** Agrupa todas las categorías y códigos cualitativos jerárquicamente bajo su respectivo caso, permitiendo ver de manera detallada qué códigos han sido aplicados a qué entrevistado y cuántas citas tienen.
* **Exportación y selección masiva:**
  * **Copiar al portapapeles:** Copia los casos y códigos seleccionados respetando la jerarquía para pegar directamente en Roam.
  * **Generar reporte:** Genera una página consolidada bajo el namespace `codebook/casos/...` en Roam con las referencias de los bloques asociados.
  * **Auto-selección al exportar:** Al exportar con un término de búsqueda activo, pre-selecciona automáticamente los nodos que coinciden con el filtro de forma transversal.
  * **Herramientas de selección masiva (Toolbar):** Botones `Expandir todo` (⊞), `Colapsar todo` (⊟), `Seleccionar todo` (☑), `Deseleccionar todo` (☐) y `Seleccionar filtrados` (☑*), además de un buscador desplegable (🔍).
* **Navegación Rápida:** Botón discreto `↗️` (visible en hover) que abre instantáneamente el caso o código seleccionado en la interfaz principal de Roam y cierra el panel.
* Buscador integrado en tiempo real para filtrar casos y códigos simultáneamente.

### 3. 🗺️ Codificación (Codebook Global)
* Muestra el mapa de códigos del proyecto agrupado en namespaces jerárquicos: Dominios (`dom/`), Categorías (`cat/`) y Códigos (`cod/`).
* Renderiza el Codebook global en una estructura de tabla de árbol (TreeTable) interactiva con checkboxes en cascada y tres columnas: **Código**, **Citas** (cantidad total de citas asociadas) y **Fuentes** (entrevistados vinculados).
* **Pivote Híbrido por Fuentes (v0.7.0):**
  * **Selector de Nivel Global:** Permite agrupar el árbol cualitativo completo por fuentes a una profundidad específica (`Nivel 1`, `Nivel 2`, `Nivel 3`, `Nivel 4`) o de forma inteligente recursiva (`Automático`).
  * **Pivote Contextual por Nodo (Clic Derecho):** Permite hacer clic derecho sobre la etiqueta de cualquier código para pivotar o despivotar individualmente ese código y sus descendientes. El código pivotado cambia de color a azul y se le añade el prefijo `🗂️` con despliegue automático del subárbol.
* **Filtrado y Visualización de Fuentes:**
  * **Conteo empírico estricto:** Solo se contabilizan y muestran citas provenientes de páginas con formato `entrevistadx/[Nombre]/transcripción/a analizar`, ignorando páginas de referencia manual o codificación.
  * **Formato limpio:** Se extrae solo el nombre del entrevistado en formato de etiqueta compacta (chip visual).
  * **Especificidad en hoja:** Las etiquetas de fuentes se muestran únicamente en los códigos del último nivel jerárquico (nodos hoja) para no saturar las categorías y carpetas padre.
* **Extracción global y selección inteligente:**
  * **Copiar al portapapeles:** Copia los códigos seleccionados y sus citas en formato árbol.
  * **Generar reporte:** Genera una página consolidada bajo el namespace `codebook/códigos/...` en Roam con referencias de bloque de todo el grafo para los códigos seleccionados.
  * **Auto-selección al exportar:** Pre-selecciona de manera inteligente los nodos coincidentes con la búsqueda al usar cualquiera de los botones de exportación.
  * **Herramientas de selección masiva (Toolbar):** Botones `Expandir todo` (⊞), `Colapsar todo` (⊟), `Seleccionar todo` (☑), `Deseleccionar todo` (☐) y `Seleccionar filtrados` (☑*), además de un buscador desplegable (🔍) y refresco de caché (🔄).
* **Navegación Rápida:** Botón discreto `↗️` en cada nodo (visible en hover) para ir a la página de ese código directamente.
* **Filtro Inteligente de Descendientes:** Al buscar un código en el Codebook, la interfaz no solo muestra los ancestros (para dar contexto jerárquico), sino que **muestra y expande automáticamente todos sus descendientes**.

### 4. 📝 Memos (Reflexiones del Investigador) (v0.9.0)
* **Separación Conceptual:** Aísla el namespace `memo/` en su propia pestaña dedicada, retirándolos de las pestañas de codificación analítica para mantener flujos metodológicos limpios.
* **Renderizado Jerárquico:** Muestra la estructura jerárquica organizativa de los memos (por ejemplo: `memo/caso`, `memo/dimensiones`, etc.) en un árbol interactivo.
* **Preview en Tiempo Real:** Visualiza directamente los primeros bloques de texto de la página del memo, permitiendo leer reflexiones conceptuales sin salir del panel.
* **Mapeo de Códigos Vinculados:** Detecta referencias a códigos cualitativos (`[[cod/...]]`, `[[cat/...]]`, etc.) en el texto del memo y las renderiza como etiquetas (badges) compactos e interactivos en una columna dedicada.
* **Navegación Interactiva:** 
  - El botón `↗` en la fila del memo navega instantáneamente a su página de reflexiones y cierra el modal.
  - Al hacer clic en cualquier badge de código vinculado, el modal se cierra y te posiciona directamente en la página de dicho código en Roam.
* **Toolbar Simplificada:** Controles contextuales para expandir/colapsar el árbol de memos, buscador interactivo integrado y botón de actualización de caché.

### 5. 🗑️ Gestión y Eliminación de Categorías (Auditable)
* Permite desenlazar o eliminar las categorías cualitativas seleccionadas directamente desde la interfaz en cualquiera de las pestañas.
* **Modo Desenlazar**: Remueve los corchetes `[[  ]]` de las referencias, convirtiéndolas en texto plano (ej: `[[cod/afect]]` → `cod/afect`).
* **Modo Eliminar (Auditable)**: Reemplaza las referencias seleccionadas con la etiqueta de página `[[CÓDIGO ELIMINADO]]`. Esto conserva la estructura de texto íntegra de la entrevista original y te permite usar los backlinks nativos de Roam sobre la página `[[CÓDIGO ELIMINADO]]` para auditar exactamente qué codificaciones fueron removidas y en qué bloques.
* **Borrado de Páginas**: Opción de eliminar la página correspondiente en el grafo de Roam para cada código borrado.
* **Registro de Auditoría Silencioso**: Cada página de categoría o código eliminado por el plugin se registra de forma automática en la página `cualiNemesis/Registro de eliminaciones` con marca de tiempo y en formato de texto plano para evitar la creación indeseada de páginas fantasmas.
* **Barra de Progreso y Rate Limiting**: Ejecuta los cambios de forma secuencial y espaciada con una barra de progreso en tiempo real para evitar errores de API en Roam.

### 6. ⚙️ Configuración Dinámica y Bidireccional (v0.12.0)
* **Pestaña de configuración integrada:** Se añadió una pestaña dedicada de "Configuración" en el panel de CualiNemesis que permite editar los parámetros sin salir de la aplicación.
* **Acceso Directo al Registro**: Incluye un botón "📋 Ver registro" para navegar instantáneamente a la página del historial de eliminaciones.
* **Sincronización bidireccional:** Lee y escribe directamente en la página `cualiNemesis/Configuración` de Roam. Al guardar la configuración en la app, se actualizan los bloques correspondientes en Roam y se recarga en caliente la interfaz del plugin.
* **Prefijo de casos dinámico:** Personaliza la etiqueta para agrupar tus casos (por defecto `entrevistadx`).
* **Sufijo de análisis dinámico:** Define la subruta de las transcripciones que contienen el material codificado (por defecto `transcripción/a analizar`), con tolerancia inteligente de tildes (ej: `aAnalizar`).
* **Sincronización de jerarquía en páginas:** Sincroniza automáticamente la estructura del árbol de códigos en las páginas de Roam de manera nativa (ej: la página `[[cod/norm]]` tendrá bloques automáticos apuntando a `[[cod/norm/tension]]` y `[[cod/norm/afect]]`).
  * Atributo `Sincronizar jerarquía:: Sí/No` (por defecto: Sí).
  * Atributo `Prefijos a sincronizar:: cod, dim, cat` (por defecto: `cod, dim, cat`).

---

## 🛠️ Instalación y Uso en Roam Research

1. En tu grafo de Roam Research, crea una página llamada `[[roam/js]]` (si no existe ya).
2. Añade un bloque de código JavaScript configurado como `JavaScript Code Block` y copia el contenido completo del archivo generado `cualiNemesisMaster.js`.
3. Añade un bloque hijo que diga `{{[[roam/js]]}}` para habilitar el plugin.
4. Para abrir el panel, abre la paleta de comandos de Roam (`Ctrl+P` o `Cmd+P`), busca `CualiNemesis: Abrir panel (Extracción, Categorías, IA)` y presiona Enter. Se puede abrir desde cualquier lugar del grafo (adoptando "Vista Global" si no se está en una entrevista).

---

## ⚙️ Desarrollo y Compilación

Este proyecto sigue una arquitectura modular y estructurada:

* `src/api/roamApi.js`: Maneja las llamadas a la API de Roam (`window.roamAlphaAPI`), consultas Datalog y manipulación del grafo.
* `src/core/extractor.js`: Procesa expresiones regulares y estructura los datos cualitativos en árboles jerárquicos (`TreeNode`).
* `src/ui/modal.js`: Controla la interfaz de usuario, CSS, eventos y renderizado de componentes.
* `src/ui/notifications.js`: Módulos de alerta Toasts no bloqueantes.
* `src/index.js`: Inicializador del plugin y registro del comando en la paleta de Roam.

### Compilar el archivo maestro
NUNCA edites el archivo `cualiNemesisMaster.js` directamente. Para compilar los módulos de `/src`:

1. Abre PowerShell en la carpeta raíz del proyecto.
2. Ejecuta el script de construcción:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\build.ps1
   ```
   *Esto generará automáticamente `cualiNemesisMaster.js` con el encabezado de versión y timestamp actualizado.*
