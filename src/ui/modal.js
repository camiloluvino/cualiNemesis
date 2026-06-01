function updateNodeCheckedState(node, checked) {
    node.checked = checked;
    for (const childName in node.children) {
        updateNodeCheckedState(node.children[childName], checked);
    }
}

function updateDescendantCheckboxes(liElement, checked) {
    const descendantCheckboxes = liElement.querySelectorAll('input[type="checkbox"]');
    descendantCheckboxes.forEach(cb => {
        cb.checked = checked;
        cb.indeterminate = false;
        if (cb._node) cb._node.checked = checked;
    });
}

function updateAncestorStates(checkbox) {
    let parentLi = checkbox.closest('ul').closest('li');
    while (parentLi) {
        const parentCheckbox = parentLi.querySelector(':scope > .node-header > input[type="checkbox"]');
        if (!parentCheckbox) break;

        const childCheckboxes = Array.from(parentLi.querySelector(':scope > ul').querySelectorAll(':scope > li > .node-header > input[type="checkbox"]'));
        
        const allChecked = childCheckboxes.every(cb => cb.checked && !cb.indeterminate);
        const allUnchecked = childCheckboxes.every(cb => !cb.checked && !cb.indeterminate);

        if (allChecked) {
            parentCheckbox.checked = true;
            parentCheckbox.indeterminate = false;
            if (parentCheckbox._node) parentCheckbox._node.checked = true;
        } else if (allUnchecked) {
            parentCheckbox.checked = false;
            parentCheckbox.indeterminate = false;
            if (parentCheckbox._node) parentCheckbox._node.checked = false;
        } else {
            parentCheckbox.checked = false;
            parentCheckbox.indeterminate = true;
            if (parentCheckbox._node) parentCheckbox._node.checked = false;
        }

        parentLi = parentLi.parentElement.closest('li');
    }
}

function renderNodeHTML(node) {
    const li = document.createElement("li");
    li.style.listStyleType = "none";
    li.style.margin = "4px 0";

    const headerDiv = document.createElement("div");
    headerDiv.className = "node-header";
    headerDiv.style.display = "flex";
    headerDiv.style.alignItems = "center";
    headerDiv.style.padding = "2px 4px";
    headerDiv.style.transition = "background-color 0.15s ease";

    const hasChildren = Object.keys(node.children).length > 0;

    if (hasChildren) {
        const toggleIcon = document.createElement("span");
        toggleIcon.className = "tree-toggle";
        toggleIcon.innerText = "▼ ";
        toggleIcon.style.cursor = "pointer";
        toggleIcon.style.marginRight = "4px";
        toggleIcon.style.fontFamily = "monospace";
        toggleIcon.style.fontSize = "12px";
        toggleIcon.style.color = "#718096";
        toggleIcon.style.width = "14px";
        toggleIcon.style.display = "inline-block";
        toggleIcon.style.textAlign = "center";
        
        toggleIcon.onclick = () => {
            const childUl = li.querySelector("ul");
            if (childUl) {
                if (childUl.style.display === "none") {
                    childUl.style.display = "block";
                    toggleIcon.innerText = "▼ ";
                } else {
                    childUl.style.display = "none";
                    toggleIcon.innerText = "▶ ";
                }
            }
        };
        headerDiv.appendChild(toggleIcon);
    } else {
        const spacer = document.createElement("span");
        spacer.style.display = "inline-block";
        spacer.style.width = "14px";
        headerDiv.appendChild(spacer);
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = node.checked;
    checkbox._node = node;
    checkbox.style.marginRight = "8px";
    checkbox.style.cursor = "pointer";
    checkbox.onchange = () => {
        const isChecked = checkbox.checked;
        checkbox.indeterminate = false;
        
        updateNodeCheckedState(node, isChecked);
        updateDescendantCheckboxes(li, isChecked);
        updateAncestorStates(checkbox);
    };
    headerDiv.appendChild(checkbox);

    const folderIcon = document.createElement("span");
    folderIcon.innerText = hasChildren ? "📁 " : "📄 ";
    folderIcon.style.marginRight = "6px";
    folderIcon.style.fontSize = "14px";
    headerDiv.appendChild(folderIcon);

    const labelSpan = document.createElement("span");
    const citesText = node.cites.length > 0 ? ` (${node.cites.length} citas)` : "";
    labelSpan.innerText = `${node.name}${citesText}`;
    labelSpan.style.fontSize = "14px";
    labelSpan.style.color = "#2d3748";
    labelSpan.style.cursor = "pointer";
    labelSpan.onclick = () => {
        checkbox.click();
    };
    headerDiv.appendChild(labelSpan);

    li.appendChild(headerDiv);

    if (hasChildren) {
        const ul = document.createElement("ul");
        ul.style.paddingLeft = "20px";
        ul.style.borderLeft = "1px dashed #cbd5e0";
        ul.style.marginLeft = "6px";
        ul.style.marginTop = "2px";
        ul.style.marginBottom = "2px";
        
        const childNamesSorted = Object.keys(node.children).sort();
        childNamesSorted.forEach(childName => {
            ul.appendChild(renderNodeHTML(node.children[childName]));
        });
        li.appendChild(ul);
    }

    return li;
}

function generarTextoPortapapeles(node, indentLevel = 0) {
    let text = "";
    const indent = "\t".repeat(indentLevel);
    
    if (node.name !== "root") {
        text += `${indent}[[${node.fullName}]]\n`;
        if (node.checked) {
            node.cites.forEach(citeUid => {
                text += `${indent}\t((${citeUid}))\n`;
            });
        }
    }
    
    const childIndentLevel = node.name === "root" ? 0 : indentLevel + 1;
    const childNamesSorted = Object.keys(node.children).sort();
    for (const childName of childNamesSorted) {
        const childNode = node.children[childName];
        if (nodoSeleccionadoOHijosSeleccionados(childNode)) {
            text += generarTextoPortapapeles(childNode, childIndentLevel);
        }
    }
    return text;
}

function crearInterfazModal(rootNode, pageTitle) {
    let existingStyles = document.getElementById("cuali-nemesis-styles");
    if (existingStyles) {
        existingStyles.remove();
    }
    
    const styleTag = document.createElement("style");
    styleTag.id = "cuali-nemesis-styles";
    styleTag.innerHTML = `
        #extractor-cualitativo-overlay {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
        }
        .cuali-modal {
            background: #ffffff;
            padding: 24px;
            border-radius: 12px;
            width: 700px;
            max-height: 85vh;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
        }
        .cuali-header {
            font-size: 1.25rem;
            font-weight: 600;
            color: #1a202c;
            margin-top: 0;
            margin-bottom: 12px;
        }
        
        /* Tabs Styles */
        .cuali-tabs {
            display: flex;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 16px;
        }
        .cuali-tab-btn {
            padding: 10px 16px;
            background: transparent;
            border: none;
            border-bottom: 2px solid transparent;
            font-size: 14px;
            font-weight: 500;
            color: #718096;
            cursor: pointer;
            transition: all 0.2s;
            margin-right: 8px;
        }
        .cuali-tab-btn:hover {
            color: #2d3748;
        }
        .cuali-tab-btn.active {
            color: #3b82f6;
            border-bottom-color: #3b82f6;
        }
        .cuali-tab-content {
            display: none;
            flex-direction: column;
            flex: 1;
            overflow: hidden;
        }
        .cuali-tab-content.active {
            display: flex;
        }
        
        /* Lists and Trees */
        .cuali-list-box {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            overflow-y: auto;
            flex: 1;
            max-height: 50vh;
        }
        .cuali-list-item {
            padding: 6px 8px;
            border-bottom: 1px solid #edf2f7;
            font-size: 14px;
            color: #2d3748;
        }
        .cuali-list-item:last-child {
            border-bottom: none;
        }
        .cuali-group-title {
            font-weight: 600;
            font-size: 12px;
            color: #a0aec0;
            text-transform: uppercase;
            margin-top: 16px;
            margin-bottom: 6px;
            letter-spacing: 0.05em;
        }
        .cuali-group-title:first-child {
            margin-top: 0;
        }
        
        /* Toolbar */
        .cuali-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        .cuali-toolbar-left {
            display: flex;
            gap: 8px;
        }
        .cuali-btn-tool {
            padding: 4px 10px;
            font-size: 12px;
            background: #edf2f7;
            border: 1px solid #cbd5e0;
            color: #4a5568;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.15s ease;
        }
        .cuali-btn-tool:hover {
            background: #e2e8f0;
            color: #2d3748;
        }
        
        /* Bottom Buttons */
        .cuali-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 16px;
        }
        .cuali-btn {
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 500;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
            outline: none;
        }
        .cuali-btn-cancel {
            background: #fff;
            border: 1px solid #cbd5e0;
            color: #4a5568;
        }
        .cuali-btn-cancel:hover {
            background: #f7fafc;
            border-color: #a0aec0;
        }
        .cuali-btn-clipboard {
            background: #10b981;
            border: none;
            color: #fff;
        }
        .cuali-btn-clipboard:hover {
            background: #059669;
        }
        .cuali-btn-page {
            background: #3b82f6;
            border: none;
            color: #fff;
        }
        .cuali-btn-page:hover {
            background: #2563eb;
        }
        .node-header:hover {
            background-color: #edf2f7;
            border-radius: 4px;
        }
    `;
    document.head.appendChild(styleTag);

    const overlay = document.createElement("div");
    overlay.id = "extractor-cualitativo-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0"; overlay.style.left = "0"; 
    overlay.style.width = "100%"; overlay.style.height = "100%";
    overlay.style.zIndex = "9999";
    overlay.style.display = "flex"; 
    overlay.style.justifyContent = "center"; 
    overlay.style.alignItems = "center";

    const modal = document.createElement("div");
    modal.className = "cuali-modal";
    
    const header = document.createElement("h3");
    header.className = "cuali-header";
    header.innerText = "Dispositivo Analítico: CualiNemesis";
    modal.appendChild(header);

    // Build Tabs Navigation
    const tabsNav = document.createElement("div");
    tabsNav.className = "cuali-tabs";
    
    const btnTabExportacion = document.createElement("button");
    btnTabExportacion.className = "cuali-tab-btn active";
    btnTabExportacion.innerText = "Exportación Contextual";
    
    const btnTabCasos = document.createElement("button");
    btnTabCasos.className = "cuali-tab-btn";
    btnTabCasos.innerText = "Casos (Empírico)";
    
    const btnTabCodebook = document.createElement("button");
    btnTabCodebook.className = "cuali-tab-btn";
    btnTabCodebook.innerText = "Codificación (Analítico)";
    
    tabsNav.appendChild(btnTabExportacion);
    tabsNav.appendChild(btnTabCasos);
    tabsNav.appendChild(btnTabCodebook);
    modal.appendChild(tabsNav);

    // Tab Contents Containers
    const tabExportacion = document.createElement("div");
    tabExportacion.className = "cuali-tab-content active";
    
    const tabCasos = document.createElement("div");
    tabCasos.className = "cuali-tab-content";
    
    const tabCodebook = document.createElement("div");
    tabCodebook.className = "cuali-tab-content";

    // --- POPULATE TAB: EXPORTACION ---
    const toolbar = document.createElement("div");
    toolbar.className = "cuali-toolbar";
    const toolbarLeft = document.createElement("div");
    toolbarLeft.className = "cuali-toolbar-left";

    const btnExpandAll = document.createElement("button");
    btnExpandAll.className = "cuali-btn-tool";
    btnExpandAll.innerText = "Expandir todo";
    btnExpandAll.onclick = (e) => {
        e.preventDefault();
        const uls = treeContainer.querySelectorAll("ul");
        uls.forEach(ul => ul.style.display = "block");
        const toggles = treeContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▼ ");
    };

    const btnCollapseAll = document.createElement("button");
    btnCollapseAll.className = "cuali-btn-tool";
    btnCollapseAll.innerText = "Colapsar todo";
    btnCollapseAll.onclick = (e) => {
        e.preventDefault();
        const uls = treeContainer.querySelectorAll("ul");
        uls.forEach(ul => {
            if (ul !== rootUl) {
                ul.style.display = "none";
            }
        });
        const toggles = treeContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▶ ");
    };

    toolbarLeft.appendChild(btnExpandAll);
    toolbarLeft.appendChild(btnCollapseAll);
    toolbar.appendChild(toolbarLeft);
    tabExportacion.appendChild(toolbar);

    const treeContainer = document.createElement("div");
    treeContainer.className = "cuali-list-box";
    
    const rootUl = document.createElement("ul");
    rootUl.style.paddingLeft = "0";
    rootUl.style.margin = "0";
    
    if (rootNode && Object.keys(rootNode.children).length > 0) {
        const childNamesSorted = Object.keys(rootNode.children).sort();
        childNamesSorted.forEach(childName => {
            rootUl.appendChild(renderNodeHTML(rootNode.children[childName]));
        });
    } else {
        rootUl.innerHTML = "<li style='color: #a0aec0; padding: 10px;'>No hay códigos en la página activa.</li>";
    }
    
    treeContainer.appendChild(rootUl);
    tabExportacion.appendChild(treeContainer);
    
    const exportButtons = document.createElement("div");
    exportButtons.className = "cuali-buttons";
    
    const btnClipboard = document.createElement("button");
    btnClipboard.className = "cuali-btn cuali-btn-clipboard";
    btnClipboard.innerText = "Copiar al portapapeles";
    btnClipboard.onclick = async (e) => {
        e.preventDefault();
        if (!rootNode || !nodoSeleccionadoOHijosSeleccionados(rootNode)) {
            mostrarNotificacion("Selecciona al menos un código.");
            return;
        }
        const clipboardText = generarTextoPortapapeles(rootNode);
        try {
            await navigator.clipboard.writeText(clipboardText.trim());
            mostrarNotificacion("Códigos copiados en formato árbol.");
        } catch (err) {
            mostrarNotificacion("Error al copiar al portapapeles.");
            console.error(err);
        }
    };
    
    const btnPage = document.createElement("button");
    btnPage.className = "cuali-btn cuali-btn-page";
    btnPage.innerText = "Crear nueva página";
    btnPage.onclick = async (e) => {
        e.preventDefault();
        if (!rootNode || !nodoSeleccionadoOHijosSeleccionados(rootNode)) {
            mostrarNotificacion("Selecciona al menos un código.");
            return;
        }
        document.body.removeChild(overlay);
        await generarPaginaConsolidadaArbol(pageTitle, rootNode);
    };

    exportButtons.appendChild(btnClipboard);
    exportButtons.appendChild(btnPage);
    tabExportacion.appendChild(exportButtons);

    // --- POPULATE TAB: CASOS ---
    const toolbarCasos = document.createElement("div");
    toolbarCasos.className = "cuali-toolbar";
    toolbarCasos.style.justifyContent = "flex-end";
    
    const btnRefreshCasos = document.createElement("button");
    btnRefreshCasos.className = "cuali-btn-tool";
    btnRefreshCasos.innerText = "🔄 Refrescar Listas";
    btnRefreshCasos.onclick = (e) => {
        e.preventDefault();
        refrescarCachesGlobales();
        renderTabCasos();
        renderTabCodebook();
        mostrarNotificacion("Listas refrescadas exitosamente.");
    };
    toolbarCasos.appendChild(btnRefreshCasos);
    tabCasos.appendChild(toolbarCasos);

    const listCasosContainer = document.createElement("div");
    listCasosContainer.className = "cuali-list-box";
    tabCasos.appendChild(listCasosContainer);

    function renderTabCasos() {
        listCasosContainer.innerHTML = "";
        const casos = obtenerCasosGlobal();
        if (casos.length === 0) {
            listCasosContainer.innerHTML = "<div class='cuali-list-item' style='color: #a0aec0;'>No se encontraron casos (páginas que inician con entrevistadx/)</div>";
        } else {
            casos.forEach(caso => {
                const item = document.createElement("div");
                item.className = "cuali-list-item";
                item.innerText = `📄 ${caso}`;
                listCasosContainer.appendChild(item);
            });
        }
    }

    // --- POPULATE TAB: CODEBOOK ---
    const toolbarCodebook = document.createElement("div");
    toolbarCodebook.className = "cuali-toolbar";
    toolbarCodebook.style.justifyContent = "flex-end";
    
    const btnRefreshCodebook = document.createElement("button");
    btnRefreshCodebook.className = "cuali-btn-tool";
    btnRefreshCodebook.innerText = "🔄 Refrescar Listas";
    btnRefreshCodebook.onclick = btnRefreshCasos.onclick;
    toolbarCodebook.appendChild(btnRefreshCodebook);
    tabCodebook.appendChild(toolbarCodebook);

    const listCodebookContainer = document.createElement("div");
    listCodebookContainer.className = "cuali-list-box";
    tabCodebook.appendChild(listCodebookContainer);

    function renderTabCodebook() {
        listCodebookContainer.innerHTML = "";
        const codebook = obtenerCodebookGlobal();
        
        const labels = {
            "dom": "Dominios (dom/)",
            "dim": "Dimensiones (dim/)",
            "cat": "Categorías (cat/)",
            "cod": "Códigos (cod/)",
            "memo": "Memos (memo/)"
        };
        
        ["dom", "dim", "cat", "cod", "memo"].forEach(key => {
            const arr = codebook[key];
            if (arr.length > 0) {
                const title = document.createElement("div");
                title.className = "cuali-group-title";
                title.innerText = labels[key];
                listCodebookContainer.appendChild(title);
                
                arr.forEach(codItem => {
                    const item = document.createElement("div");
                    item.className = "cuali-list-item";
                    item.innerText = `🏷️ ${codItem}`;
                    listCodebookContainer.appendChild(item);
                });
            }
        });
        
        if (listCodebookContainer.innerHTML === "") {
            listCodebookContainer.innerHTML = "<div class='cuali-list-item' style='color: #a0aec0;'>No se encontraron elementos en el codebook.</div>";
        }
    }

    // Initial Render of Global Tabs
    renderTabCasos();
    renderTabCodebook();

    modal.appendChild(tabExportacion);
    modal.appendChild(tabCasos);
    modal.appendChild(tabCodebook);

    // Cancel Button at the very bottom (global for the modal)
    const globalFooter = document.createElement("div");
    globalFooter.style.display = "flex";
    globalFooter.style.justifyContent = "flex-start";
    globalFooter.style.marginTop = "10px";
    
    const btnCancelGlobal = document.createElement("button");
    btnCancelGlobal.className = "cuali-btn cuali-btn-cancel";
    btnCancelGlobal.innerText = "Cerrar Panel";
    btnCancelGlobal.onclick = (e) => {
        e.preventDefault();
        document.body.removeChild(overlay);
    };
    globalFooter.appendChild(btnCancelGlobal);
    modal.appendChild(globalFooter);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Tabs Logic
    const tabs = [
        { btn: btnTabExportacion, content: tabExportacion },
        { btn: btnTabCasos, content: tabCasos },
        { btn: btnTabCodebook, content: tabCodebook }
    ];

    tabs.forEach(tab => {
        tab.btn.onclick = (e) => {
            e.preventDefault();
            tabs.forEach(t => {
                t.btn.classList.remove("active");
                t.content.classList.remove("active");
            });
            tab.btn.classList.add("active");
            tab.content.classList.add("active");
        };
    });
}
