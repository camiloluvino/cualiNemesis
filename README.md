# CualiNemesis 📄🧪

CualiNemesis es un plugin avanzado para **Roam Research** diseñado para asistir en el **Análisis Cualitativo Asistido por Computadora (CAQDAS)**. Permite extraer, estructurar y consolidar información codificada jerárquicamente utilizando namespaces dentro de tu base de conocimiento.

---

## 🚀 Características Principales

CualiNemesis cuenta con un panel analítico dividido en tres pestañas optimizadas para flujos de trabajo cualitativos a gran escala:

### 1. 📂 Exportación Contextual
* Extrae todos los códigos y citas aplicadas a los bloques de la página activa en tiempo real.
* Renderiza los códigos en una interfaz de árbol jerárquico interactivo con checkboxes en cascada (marcado, desmarcado y estado indeterminado).
* **Exportación dual:**
  * **Copiar al portapapeles:** Genera un texto con tabulaciones listas para pegar en cualquier página de Roam conservando la jerarquía.
  * **Crear nueva página:** Crea automáticamente una página consolidada en Roam con referencias dinámicas de bloques `((UID))` organizados jerárquicamente.
* Buscador interactivo integrado para filtrar códigos y citas en páginas densas.

### 2. 👥 Casos (Entidades Empíricas)
* Lista de forma ordenada todas las páginas en el namespace de entrevistas/sujetos (prefijo `entrevistadx/`).
* **Filtro de Casos Raíz:** Limpia automáticamente la visualización mostrando únicamente las entidades principales (ej. `entrevistadx/Castro`), ocultando subpáginas de transcripciones secundarias.
* **Navegación Rápida:** Botón discreto `↗️ Ir a página` (visible al pasar el cursor) que abre instantáneamente el caso seleccionado en la interfaz principal de Roam y cierra el panel.
* Buscador integrado en tiempo real para encontrar casos rápidamente.

### 3. 🗺️ Codificación (Codebook Global)
* Muestra el mapa de códigos del proyecto agrupado en namespaces jerárquicos: Dominios (`dom/`), Dimensiones (`dim/`), Categorías (`cat/`), Códigos (`cod/`) y Memos (`memo/`).
* Renderiza el Codebook global en una estructura de árbol interactivo con carpetas colapsables (`📁` / `📄`).
* **Navegación Rápida:** Botón discreto `↗️` en cada nodo (visible en hover) para ir a la página de ese código directamente.
* **Filtro Inteligente de Descendientes:** Al buscar un código en el Codebook, la interfaz no solo muestra los ancestros (para dar contexto jerárquico), sino que **muestra y expande automáticamente todos sus descendientes**.
* Botones de control global de `Expandir todo` y `Colapsar todo`.

---

## 🛠️ Instalación y Uso en Roam Research

1. En tu grafo de Roam Research, crea una página llamada `[[roam/js]]` (si no existe ya).
2. Añade un bloque de código JavaScript configurado como `JavaScript Code Block` y copia el contenido completo del archivo generado `cualiNemesisMaster.js`.
3. Añade un bloque hijo que diga `{{[[roam/js]]}}` para habilitar el plugin.
4. Para abrir el panel, abre la paleta de comandos de Roam (`Ctrl+P` o `Cmd+P`), busca `CualiNemesis: Abrir Extractor Cualitativo` y presiona Enter.

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
