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
        const parentCheckbox = parentLi.querySelector(':scope > .node-row input[type="checkbox"]');
        if (!parentCheckbox) break;

        const childCheckboxes = Array.from(parentLi.querySelector(':scope > ul').querySelectorAll(':scope > li > .node-row input[type="checkbox"]'));
        
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

function abrirPaginaPorTitulo(title) {
    const res = window.roamAlphaAPI.q(`[:find ?uid :in $ ?title :where [?p :node/title ?title] [?p :block/uid ?uid]]`, title);
    if (res && res.length > 0) {
        window.roamAlphaAPI.ui.mainWindow.openPage({page: {uid: res[0][0]}});
    } else {
        window.roamAlphaAPI.ui.mainWindow.openPage({page: {title: title}});
    }
}

function getAggregateCites(node) {
    let count = node.cites.length;
    for (const childName in node.children) {
        count += getAggregateCites(node.children[childName]);
    }
    return count;
}

function getAggregateSources(node) {
    const sources = new Set();
    node.cites.forEach(c => {
        if (c.page) sources.add(c.page);
    });
    for (const childName in node.children) {
        const childSources = getAggregateSources(node.children[childName]);
        childSources.forEach(s => sources.add(s));
    }
    return sources;
}

function renderNodeHTML(node, hideSources = false) {
    const li = document.createElement("li");
    li.style.listStyleType = "none";
    li.style.margin = "2px 0";

    const rowDiv = document.createElement("div");
    rowDiv.className = "node-row";
    rowDiv.style.display = "flex";
    rowDiv.style.alignItems = "center";
    rowDiv.style.justifyContent = "space-between";
    rowDiv.style.width = "100%";
    rowDiv.style.padding = "4px 8px";
    rowDiv.style.transition = "background-color 0.15s ease";
    rowDiv.style.borderBottom = "1px solid #edf2f7";

    const headerDiv = document.createElement("div");
    headerDiv.className = "node-header";
    headerDiv.style.display = "flex";
    headerDiv.style.alignItems = "center";
    headerDiv.style.flex = "1";
    headerDiv.style.minWidth = "0";

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
    checkbox.style.flexShrink = "0";
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
    folderIcon.style.flexShrink = "0";
    headerDiv.appendChild(folderIcon);

    const labelSpan = document.createElement("span");
    labelSpan.className = "node-label";
    labelSpan.innerText = node.name;
    labelSpan.style.fontSize = "14px";
    labelSpan.style.color = "#2d3748";
    labelSpan.style.cursor = "pointer";
    labelSpan.style.textOverflow = "ellipsis";
    labelSpan.style.overflow = "hidden";
    labelSpan.style.whiteSpace = "nowrap";
    labelSpan.onclick = () => {
        checkbox.click();
    };
    headerDiv.appendChild(labelSpan);

    const goBtn = document.createElement("button");
    goBtn.className = "cuali-btn-tool cuali-go-btn";
    goBtn.style.padding = "2px 6px";
    goBtn.style.fontSize = "11px";
    goBtn.style.marginLeft = "auto";
    goBtn.style.flexShrink = "0";
    goBtn.innerText = "↗️";
    goBtn.title = `Ir a [[${node.fullName}]]`;
    goBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const overlay = document.getElementById("extractor-cualitativo-overlay");
        if (overlay) {
            document.body.removeChild(overlay);
        }
        abrirPaginaPorTitulo(node.fullName);
    };
    headerDiv.appendChild(goBtn);
    rowDiv.appendChild(headerDiv);

    // Calculate aggregated quotes and unique sources
    const totalCites = getAggregateCites(node);
    const uniqueSources = Array.from(getAggregateSources(node)).sort();

    // Column 2: Citation Count
    const citesCol = document.createElement("div");
    citesCol.className = "node-cites-col";
    citesCol.innerText = totalCites > 0 ? totalCites : "-";
    rowDiv.appendChild(citesCol);

    if (!hideSources) {
        // Column 3: Sources (Pills / Chips)
        const sourcesCol = document.createElement("div");
        sourcesCol.className = "node-sources-col";
        
        if (uniqueSources.length > 0 && !hasChildren) {
            const formattedSources = uniqueSources.map(s => {
                if (s.startsWith("entrevistadx/")) {
                    const parts = s.split('/');
                    if (parts.length >= 2) return parts[1];
                }
                return s;
            });
            // Ensure formatted names are unique
            const uniqueFormatted = Array.from(new Set(formattedSources));
            
            const maxChipsToShow = 2;
            const chipsToShow = uniqueFormatted.slice(0, maxChipsToShow);
            const remaining = uniqueFormatted.length - maxChipsToShow;
            
            chipsToShow.forEach(sourceName => {
                const chip = document.createElement("span");
                chip.className = "cuali-tag";
                chip.innerText = sourceName;
                chip.title = sourceName;
                sourcesCol.appendChild(chip);
            });
            
            if (remaining > 0) {
                const moreChip = document.createElement("span");
                moreChip.className = "cuali-tag cuali-tag-more";
                moreChip.innerText = `+${remaining} más`;
                moreChip.title = uniqueFormatted.join(", ");
                sourcesCol.appendChild(moreChip);
            }
        } else {
            sourcesCol.innerText = "";
        }
        rowDiv.appendChild(sourcesCol);
    }

    li.appendChild(rowDiv);

    if (hasChildren) {
        const ul = document.createElement("ul");
        ul.style.paddingLeft = "20px";
        ul.style.borderLeft = "1px dashed #cbd5e0";
        ul.style.marginLeft = "6px";
        ul.style.marginTop = "2px";
        ul.style.marginBottom = "2px";
        
        const childNamesSorted = Object.keys(node.children).sort();
        childNamesSorted.forEach(childName => {
            ul.appendChild(renderNodeHTML(node.children[childName], hideSources));
        });
        li.appendChild(ul);
    }

    return li;
}

function renderCodebookNodeHTML(node) {
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

    const folderIcon = document.createElement("span");
    folderIcon.innerText = hasChildren ? "📁 " : "📄 ";
    folderIcon.style.marginRight = "6px";
    folderIcon.style.fontSize = "14px";
    headerDiv.appendChild(folderIcon);

    const labelSpan = document.createElement("span");
    labelSpan.className = "node-label";
    labelSpan.innerText = node.name;
    labelSpan.style.fontSize = "14px";
    labelSpan.style.color = "#2d3748";
    headerDiv.appendChild(labelSpan);

    const goBtn = document.createElement("button");
    goBtn.className = "cuali-btn-tool cuali-go-btn";
    goBtn.style.padding = "2px 6px";
    goBtn.style.fontSize = "11px";
    goBtn.style.marginLeft = "auto";
    goBtn.innerText = "↗️";
    goBtn.title = `Ir a [[${node.fullName}]]`;
    goBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const overlay = document.getElementById("extractor-cualitativo-overlay");
        if (overlay) {
            document.body.removeChild(overlay);
        }
        abrirPaginaPorTitulo(node.fullName);
    };
    headerDiv.appendChild(goBtn);

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
            ul.appendChild(renderCodebookNodeHTML(node.children[childName]));
        });
        li.appendChild(ul);
    }

    return li;
}

function renderCasoNodeHTML(node, isCase = false) {
    const li = document.createElement("li");
    li.style.listStyleType = "none";
    li.style.margin = "2px 0";

    const rowDiv = document.createElement("div");
    rowDiv.className = "node-row";
    rowDiv.style.display = "flex";
    rowDiv.style.alignItems = "center";
    rowDiv.style.justifyContent = "space-between";
    rowDiv.style.width = "100%";
    rowDiv.style.padding = "4px 8px";
    rowDiv.style.transition = "background-color 0.15s ease";
    rowDiv.style.borderBottom = "1px solid #edf2f7";

    const casoCol = document.createElement("div");
    casoCol.className = "node-caso-col";
    casoCol.style.width = "200px";
    casoCol.style.flexShrink = "0";
    casoCol.style.display = "flex";
    casoCol.style.alignItems = "center";
    casoCol.style.overflow = "hidden";
    casoCol.style.textOverflow = "ellipsis";
    casoCol.style.whiteSpace = "nowrap";

    const codeCol = document.createElement("div");
    codeCol.className = "node-code-col";
    codeCol.style.flex = "1";
    codeCol.style.display = "flex";
    codeCol.style.alignItems = "center";
    codeCol.style.minWidth = "0";
    codeCol.style.overflow = "hidden";
    codeCol.style.textOverflow = "ellipsis";
    codeCol.style.whiteSpace = "nowrap";

    const citesCol = document.createElement("div");
    citesCol.className = "node-cites-col";
    citesCol.style.width = "100px";
    citesCol.style.textAlign = "center";
    citesCol.style.flexShrink = "0";
    citesCol.style.fontSize = "13px";
    citesCol.style.fontWeight = "600";
    citesCol.style.color = "#4a5568";

    const hasChildren = Object.keys(node.children).length > 0;
    
    let toggleIcon = null;
    if (hasChildren) {
        toggleIcon = document.createElement("span");
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
    } else {
        toggleIcon = document.createElement("span");
        toggleIcon.style.display = "inline-block";
        toggleIcon.style.width = "14px";
        toggleIcon.style.marginRight = "4px";
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = node.checked;
    checkbox._node = node;
    checkbox.style.marginRight = "8px";
    checkbox.style.cursor = "pointer";
    checkbox.style.flexShrink = "0";
    checkbox.onchange = () => {
        const isChecked = checkbox.checked;
        checkbox.indeterminate = false;
        
        updateNodeCheckedState(node, isChecked);
        updateDescendantCheckboxes(li, isChecked);
        updateAncestorStates(checkbox);
    };

    const folderIcon = document.createElement("span");
    folderIcon.innerText = hasChildren ? "📁 " : "📄 ";
    folderIcon.style.marginRight = "6px";
    folderIcon.style.fontSize = "14px";
    folderIcon.style.flexShrink = "0";

    const labelSpan = document.createElement("span");
    labelSpan.className = "node-label";
    labelSpan.innerText = node.name;
    labelSpan.style.fontSize = "14px";
    labelSpan.style.color = "#2d3748";
    labelSpan.style.cursor = "pointer";
    labelSpan.style.textOverflow = "ellipsis";
    labelSpan.style.overflow = "hidden";
    labelSpan.style.whiteSpace = "nowrap";
    labelSpan.onclick = () => {
        checkbox.click();
    };

    const goBtn = document.createElement("button");
    goBtn.className = "cuali-btn-tool cuali-go-btn";
    goBtn.style.padding = "2px 6px";
    goBtn.style.fontSize = "11px";
    goBtn.style.marginLeft = "auto";
    goBtn.style.flexShrink = "0";
    goBtn.innerText = "↗️";
    goBtn.title = `Ir a [[${node.fullName}]]`;
    goBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const overlay = document.getElementById("extractor-cualitativo-overlay");
        if (overlay) {
            document.body.removeChild(overlay);
        }
        abrirPaginaPorTitulo(node.fullName);
    };

    if (isCase) {
        casoCol.appendChild(checkbox);
        if (toggleIcon) casoCol.appendChild(toggleIcon);
        casoCol.appendChild(folderIcon);
        casoCol.appendChild(labelSpan);
        casoCol.appendChild(goBtn);
        
        codeCol.innerHTML = "&nbsp;";
    } else {
        casoCol.innerHTML = "&nbsp;";
        
        codeCol.appendChild(checkbox);
        if (toggleIcon) codeCol.appendChild(toggleIcon);
        codeCol.appendChild(folderIcon);
        codeCol.appendChild(labelSpan);
        codeCol.appendChild(goBtn);
    }

    const totalCites = getAggregateCites(node);
    citesCol.innerText = totalCites > 0 ? totalCites : "-";

    rowDiv.appendChild(casoCol);
    rowDiv.appendChild(codeCol);
    rowDiv.appendChild(citesCol);
    li.appendChild(rowDiv);

    if (hasChildren) {
        const ul = document.createElement("ul");
        ul.style.paddingLeft = "20px";
        ul.style.borderLeft = "1px dashed #cbd5e0";
        ul.style.marginLeft = "6px";
        ul.style.marginTop = "2px";
        ul.style.marginBottom = "2px";
        
        const childNamesSorted = Object.keys(node.children).sort();
        childNamesSorted.forEach(childName => {
            ul.appendChild(renderCasoNodeHTML(node.children[childName], false));
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
                text += `${indent}\t((${citeUid.uid}))\n`;
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

function filtrarArbolDOM(container, query) {
    const lis = container.querySelectorAll('li');
    const q = query.toLowerCase().trim();
    if (!q) {
        lis.forEach(li => {
            li.style.display = "";
        });
        return;
    }
    
    lis.forEach(li => {
        li.style.display = "none";
    });
    
    lis.forEach(li => {
        const labelSpan = li.querySelector(':scope > .node-row .node-label');
        if (labelSpan && labelSpan.innerText.toLowerCase().includes(q)) {
            let curr = li;
            while (curr && curr.tagName === 'LI') {
                curr.style.display = "";
                const parentUl = curr.parentElement;
                if (parentUl && parentUl.tagName === 'UL') {
                    parentUl.style.display = "block";
                    const parentLi = parentUl.parentElement;
                    if (parentLi && parentLi.tagName === 'LI') {
                        const toggle = parentLi.querySelector(':scope > .node-row .tree-toggle');
                        if (toggle) toggle.innerText = "▼ ";
                    }
                }
                curr = parentUl ? parentUl.parentElement : null;
            }

            // Show all descendants of matching node
            const descendants = li.querySelectorAll('li');
            descendants.forEach(descLi => {
                descLi.style.display = "";
            });
            const descendantUls = li.querySelectorAll('ul');
            descendantUls.forEach(descUl => {
                descUl.style.display = "block";
                const parentLi = descUl.parentElement;
                if (parentLi && parentLi.tagName === 'LI') {
                    const toggle = parentLi.querySelector(':scope > .node-row .tree-toggle');
                    if (toggle) toggle.innerText = "▼ ";
                }
            });
        }
    });
}

function filtrarCasos(container, query) {
    const items = container.querySelectorAll('.cuali-list-item');
    const q = query.toLowerCase().trim();
    items.forEach(item => {
        if (item.innerText.toLowerCase().includes(q)) {
            item.style.display = "";
        } else {
            item.style.display = "none";
        }
    });
}

function crearInterfazModal(rootNode, pageTitle) {
    let codebookTreeRoot = null;
    let casosTreeRoot = null;
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
            width: 90vw;
            max-width: 1200px;
            height: 85vh;
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
            border: 1px solid #cbd5e0;
            border-radius: 8px;
            padding: 12px;
            overflow-y: auto;
            flex: 1;
        }
        .cuali-list-box.cuali-tree-container {
            border-top: none;
            border-radius: 0 0 8px 8px;
        }
        .cuali-list-item {
            padding: 6px 8px;
            border-bottom: 1px solid #edf2f7;
            font-size: 14px;
            color: #2d3748;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: background-color 0.15s ease;
        }
        .cuali-list-item:hover {
            background-color: #edf2f7;
            border-radius: 4px;
        }
        .cuali-list-item:last-child {
            border-bottom: none;
        }
        .cuali-go-btn {
            opacity: 0;
            transition: opacity 0.15s ease;
        }
        .node-row:hover .cuali-go-btn,
        .cuali-list-item:hover .cuali-go-btn {
            opacity: 1;
        }

        /* Tree Table Column Styles */
        .cuali-table-header {
            display: flex;
            align-items: center;
            font-weight: 600;
            font-size: 11px;
            color: #4a5568;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 8px 12px;
            background-color: #edf2f7;
            border: 1px solid #cbd5e0;
            border-bottom: 2px solid #cbd5e0;
            border-radius: 6px 6px 0 0;
            margin-top: 4px;
        }
        .col-code {
            flex: 1;
        }
        .col-cites {
            width: 100px;
            text-align: center;
            flex-shrink: 0;
        }
        .col-sources {
            width: 300px;
            flex-shrink: 0;
            padding-left: 8px;
        }

        .node-row {
            border-bottom: 1px solid #edf2f7;
        }
        .node-row:hover {
            background-color: #edf2f7;
            border-radius: 4px;
        }

        .node-cites-col {
            width: 100px;
            text-align: center;
            font-size: 13px;
            font-weight: 600;
            color: #4a5568;
            flex-shrink: 0;
        }
        .node-sources-col {
            width: 300px;
            display: flex;
            gap: 4px;
            align-items: center;
            flex-wrap: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex-shrink: 0;
            font-size: 12px;
            padding-left: 8px;
        }
        .cuali-tag {
            background-color: #e0e7ff;
            color: #4f46e5;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            white-space: nowrap;
            max-width: 130px;
            overflow: hidden;
            text-overflow: ellipsis;
            display: inline-block;
        }
        .cuali-tag-more {
            background-color: #e2e8f0;
            color: #4a5568;
            cursor: help;
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
        
        /* Search Inputs */
        .cuali-search-input {
            width: 100%;
            padding: 8px 12px;
            margin-bottom: 12px;
            border: 1px solid #cbd5e0;
            border-radius: 6px;
            font-size: 14px;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.15s ease;
        }
        .cuali-search-input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
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
        /* hover logic cleaned up */
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

    const btnSelectAll = document.createElement("button");
    btnSelectAll.className = "cuali-btn-tool";
    btnSelectAll.innerText = "Seleccionar todo";
    btnSelectAll.onclick = (e) => {
        e.preventDefault();
        if (rootNode) updateNodeCheckedState(rootNode, true);
        const checkboxes = treeContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
            cb.indeterminate = false;
            if (cb._node) cb._node.checked = true;
        });
    };

    const btnDeselectAll = document.createElement("button");
    btnDeselectAll.className = "cuali-btn-tool";
    btnDeselectAll.innerText = "Deseleccionar todo";
    btnDeselectAll.onclick = (e) => {
        e.preventDefault();
        if (rootNode) updateNodeCheckedState(rootNode, false);
        const checkboxes = treeContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = false;
            cb.indeterminate = false;
            if (cb._node) cb._node.checked = false;
        });
    };

    toolbarLeft.appendChild(btnExpandAll);
    toolbarLeft.appendChild(btnCollapseAll);
    toolbarLeft.appendChild(btnSelectAll);
    toolbarLeft.appendChild(btnDeselectAll);
    toolbar.appendChild(toolbarLeft);

    const searchExportInput = document.createElement("input");
    searchExportInput.type = "text";
    searchExportInput.className = "cuali-search-input";
    searchExportInput.placeholder = "🔍 Filtrar códigos de la página activa...";
    
    const tableHeaderExport = document.createElement("div");
    tableHeaderExport.className = "cuali-table-header";
    tableHeaderExport.innerHTML = `
        <div class="col-header col-code">Código</div>
        <div class="col-header col-cites">Citas</div>
    `;
    
    const treeContainer = document.createElement("div");
    treeContainer.className = "cuali-list-box cuali-tree-container";
    
    searchExportInput.oninput = () => {
        filtrarArbolDOM(treeContainer, searchExportInput.value);
    };
    
    const rootUl = document.createElement("ul");
    rootUl.style.paddingLeft = "0";
    rootUl.style.margin = "0";
    
    if (rootNode && Object.keys(rootNode.children).length > 0) {
        const childNamesSorted = Object.keys(rootNode.children).sort();
        childNamesSorted.forEach(childName => {
            rootUl.appendChild(renderNodeHTML(rootNode.children[childName], true));
        });
    } else {
        rootUl.innerHTML = "<li style='color: #a0aec0; padding: 10px;'>No hay códigos en la página activa.</li>";
    }
    
    treeContainer.appendChild(rootUl);
    
    tabExportacion.appendChild(toolbar);
    tabExportacion.appendChild(searchExportInput);
    tabExportacion.appendChild(tableHeaderExport);
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
    
    const toolbarCasosLeft = document.createElement("div");
    toolbarCasosLeft.className = "cuali-toolbar-left";
    
    const btnExpandCasos = document.createElement("button");
    btnExpandCasos.className = "cuali-btn-tool";
    btnExpandCasos.innerText = "Expandir todo";
    btnExpandCasos.onclick = (e) => {
        e.preventDefault();
        const uls = listCasosContainer.querySelectorAll("ul");
        uls.forEach(ul => ul.style.display = "block");
        const toggles = listCasosContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▼ ");
    };

    const btnCollapseCasos = document.createElement("button");
    btnCollapseCasos.className = "cuali-btn-tool";
    btnCollapseCasos.innerText = "Colapsar todo";
    btnCollapseCasos.onclick = (e) => {
        e.preventDefault();
        const uls = listCasosContainer.querySelectorAll("ul");
        uls.forEach(ul => {
            if (ul !== listCasosContainer.querySelector("ul")) {
                ul.style.display = "none";
            }
        });
        const toggles = listCasosContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▶ ");
    };

    const btnCasosSelectAll = document.createElement("button");
    btnCasosSelectAll.className = "cuali-btn-tool";
    btnCasosSelectAll.innerText = "Seleccionar todo";
    btnCasosSelectAll.onclick = (e) => {
        e.preventDefault();
        if (casosTreeRoot) updateNodeCheckedState(casosTreeRoot, true);
        const checkboxes = listCasosContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
            cb.indeterminate = false;
            if (cb._node) cb._node.checked = true;
        });
    };

    const btnCasosDeselectAll = document.createElement("button");
    btnCasosDeselectAll.className = "cuali-btn-tool";
    btnCasosDeselectAll.innerText = "Deseleccionar todo";
    btnCasosDeselectAll.onclick = (e) => {
        e.preventDefault();
        if (casosTreeRoot) updateNodeCheckedState(casosTreeRoot, false);
        const checkboxes = listCasosContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = false;
            cb.indeterminate = false;
            if (cb._node) cb._node.checked = false;
        });
    };
    
    toolbarCasosLeft.appendChild(btnExpandCasos);
    toolbarCasosLeft.appendChild(btnCollapseCasos);
    toolbarCasosLeft.appendChild(btnCasosSelectAll);
    toolbarCasosLeft.appendChild(btnCasosDeselectAll);
    toolbarCasos.appendChild(toolbarCasosLeft);

    const toolbarCasosRight = document.createElement("div");
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
    toolbarCasosRight.appendChild(btnRefreshCasos);
    toolbarCasos.appendChild(toolbarCasosRight);
    
    const searchCasosInput = document.createElement("input");
    searchCasosInput.type = "text";
    searchCasosInput.className = "cuali-search-input";
    searchCasosInput.placeholder = "🔍 Filtrar casos por nombre o códigos...";

    const tableHeaderCasos = document.createElement("div");
    tableHeaderCasos.className = "cuali-table-header";
    tableHeaderCasos.innerHTML = `
        <div class="col-header" style="width: 200px; flex-shrink: 0;">Caso</div>
        <div class="col-header col-code" style="flex: 1;">Código</div>
        <div class="col-header col-cites" style="width: 100px; text-align: center; flex-shrink: 0;">Citas</div>
    `;

    const listCasosContainer = document.createElement("div");
    listCasosContainer.className = "cuali-list-box cuali-tree-container";

    searchCasosInput.oninput = () => {
        filtrarArbolDOM(listCasosContainer, searchCasosInput.value);
    };
    
    tabCasos.appendChild(toolbarCasos);
    tabCasos.appendChild(searchCasosInput);
    tabCasos.appendChild(tableHeaderCasos);
    tabCasos.appendChild(listCasosContainer);

    const casosButtons = document.createElement("div");
    casosButtons.className = "cuali-buttons";
    
    const btnCasosClipboard = document.createElement("button");
    btnCasosClipboard.className = "cuali-btn cuali-btn-clipboard";
    btnCasosClipboard.innerText = "Copiar al portapapeles";
    btnCasosClipboard.onclick = async (e) => {
        e.preventDefault();
        if (!casosTreeRoot || !nodoSeleccionadoOHijosSeleccionados(casosTreeRoot)) {
            mostrarNotificacion("Selecciona al menos un caso o código.");
            return;
        }
        const clipboardText = generarTextoPortapapeles(casosTreeRoot);
        try {
            await navigator.clipboard.writeText(clipboardText.trim());
            mostrarNotificacion("Casos copiados en formato árbol.");
        } catch (err) {
            mostrarNotificacion("Error al copiar al portapapeles.");
            console.error(err);
        }
    };
    
    const btnCasosPage = document.createElement("button");
    btnCasosPage.className = "cuali-btn cuali-btn-page";
    btnCasosPage.innerText = "Crear nueva página";
    btnCasosPage.onclick = async (e) => {
        e.preventDefault();
        if (!casosTreeRoot || !nodoSeleccionadoOHijosSeleccionados(casosTreeRoot)) {
            mostrarNotificacion("Selecciona al menos un caso o código.");
            return;
        }
        document.body.removeChild(overlay);
        await generarPaginaConsolidadaArbol("Casos Consolidados", casosTreeRoot);
    };

    casosButtons.appendChild(btnCasosClipboard);
    casosButtons.appendChild(btnCasosPage);
    tabCasos.appendChild(casosButtons);

    function fixCasosTreeFullNames(node, isRoot = true) {
        if (isRoot) {
            for (const childName in node.children) {
                const caseNode = node.children[childName];
                caseNode.fullName = "entrevistadx/" + caseNode.name;
                fixCasosTreeFullNames(caseNode, false);
            }
        } else {
            for (const childName in node.children) {
                const codeNode = node.children[childName];
                const slashIndex = codeNode.fullName.indexOf('/');
                if (slashIndex !== -1) {
                    codeNode.fullName = codeNode.fullName.substring(slashIndex + 1);
                }
                fixCasosTreeFullNames(codeNode, false);
            }
        }
    }

    function renderTabCasos() {
        listCasosContainer.innerHTML = "";
        
        const cb = obtenerCodebookGlobal();
        const todosLosTitulos = [];
        ["dom", "dim", "cat", "cod", "memo"].forEach(key => {
            todosLosTitulos.push(...cb[key]);
        });
        const codeMapGlobal = obtenerReferenciasDeCodigos(todosLosTitulos);

        const caseCodeMap = {};
        const casos = obtenerCasosGlobal();
        
        if (casos.length === 0) {
            listCasosContainer.innerHTML = "<div class='cuali-list-item' style='color: #a0aec0;'>No se encontraron casos (páginas que inician con entrevistadx/)</div>";
            return;
        }

        casos.forEach(caso => {
            const caseName = caso.replace(/^entrevistadx\//i, "");
            caseCodeMap[caseName] = []; 
        });

        for (const [codePath, cites] of Object.entries(codeMapGlobal)) {
            cites.forEach(cite => {
                const pageParts = (cite.page || "").split('/');
                if (pageParts.length >= 2 && pageParts[0].toLowerCase() === "entrevistadx") {
                    const caseName = pageParts[1];
                    if (caseCodeMap[caseName] !== undefined) {
                        const fullPath = `${caseName}/${codePath}`;
                        if (!caseCodeMap[fullPath]) caseCodeMap[fullPath] = [];
                        caseCodeMap[fullPath].push(cite);
                    }
                }
            });
        }

        casosTreeRoot = construirArbolCodigos(caseCodeMap);
        fixCasosTreeFullNames(casosTreeRoot, true);

        const rootUl = document.createElement("ul");
        rootUl.style.paddingLeft = "0";
        rootUl.style.margin = "0";
        
        if (casosTreeRoot && Object.keys(casosTreeRoot.children).length > 0) {
            const childNamesSorted = Object.keys(casosTreeRoot.children).sort();
            childNamesSorted.forEach(childName => {
                rootUl.appendChild(renderCasoNodeHTML(casosTreeRoot.children[childName], true));
            });
        } else {
            rootUl.innerHTML = "<li style='color: #a0aec0; padding: 10px;'>No hay códigos asociados a los casos.</li>";
        }
        
        listCasosContainer.appendChild(rootUl);

        if (searchCasosInput.value) {
            filtrarArbolDOM(listCasosContainer, searchCasosInput.value);
        }
    }

    // --- POPULATE TAB: CODEBOOK ---
    const toolbarCodebook = document.createElement("div");
    toolbarCodebook.className = "cuali-toolbar";
    
    const toolbarCodebookLeft = document.createElement("div");
    toolbarCodebookLeft.className = "cuali-toolbar-left";
    
    const btnExpandCodebook = document.createElement("button");
    btnExpandCodebook.className = "cuali-btn-tool";
    btnExpandCodebook.innerText = "Expandir todo";
    btnExpandCodebook.onclick = (e) => {
        e.preventDefault();
        const uls = listCodebookContainer.querySelectorAll("ul");
        uls.forEach(ul => ul.style.display = "block");
        const toggles = listCodebookContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▼ ");
    };

    const btnCollapseCodebook = document.createElement("button");
    btnCollapseCodebook.className = "cuali-btn-tool";
    btnCollapseCodebook.innerText = "Colapsar todo";
    btnCollapseCodebook.onclick = (e) => {
        e.preventDefault();
        const uls = listCodebookContainer.querySelectorAll("ul");
        uls.forEach(ul => {
            if (ul !== listCodebookContainer.querySelector("ul")) {
                ul.style.display = "none";
            }
        });
        const toggles = listCodebookContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▶ ");
    };

    const btnCodebookSelectAll = document.createElement("button");
    btnCodebookSelectAll.className = "cuali-btn-tool";
    btnCodebookSelectAll.innerText = "Seleccionar todo";
    btnCodebookSelectAll.onclick = (e) => {
        e.preventDefault();
        if (codebookTreeRoot) updateNodeCheckedState(codebookTreeRoot, true);
        const checkboxes = listCodebookContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
            cb.indeterminate = false;
            if (cb._node) cb._node.checked = true;
        });
    };

    const btnCodebookDeselectAll = document.createElement("button");
    btnCodebookDeselectAll.className = "cuali-btn-tool";
    btnCodebookDeselectAll.innerText = "Deseleccionar todo";
    btnCodebookDeselectAll.onclick = (e) => {
        e.preventDefault();
        if (codebookTreeRoot) updateNodeCheckedState(codebookTreeRoot, false);
        const checkboxes = listCodebookContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = false;
            cb.indeterminate = false;
            if (cb._node) cb._node.checked = false;
        });
    };

    toolbarCodebookLeft.appendChild(btnExpandCodebook);
    toolbarCodebookLeft.appendChild(btnCollapseCodebook);
    toolbarCodebookLeft.appendChild(btnCodebookSelectAll);
    toolbarCodebookLeft.appendChild(btnCodebookDeselectAll);
    toolbarCodebook.appendChild(toolbarCodebookLeft);
    
    const btnRefreshCodebook = document.createElement("button");
    btnRefreshCodebook.className = "cuali-btn-tool";
    btnRefreshCodebook.innerText = "🔄 Refrescar Listas";
    btnRefreshCodebook.onclick = btnRefreshCasos.onclick;
    toolbarCodebook.appendChild(btnRefreshCodebook);
    
    const searchCodebookInput = document.createElement("input");
    searchCodebookInput.type = "text";
    searchCodebookInput.className = "cuali-search-input";
    searchCodebookInput.placeholder = "🔍 Filtrar codebook por nombre o nivel jerárquico...";

    const tableHeaderCodebook = document.createElement("div");
    tableHeaderCodebook.className = "cuali-table-header";
    tableHeaderCodebook.innerHTML = `
        <div class="col-header col-code">Código</div>
        <div class="col-header col-cites">Citas</div>
        <div class="col-header col-sources">Fuentes</div>
    `;

    const listCodebookContainer = document.createElement("div");
    listCodebookContainer.className = "cuali-list-box cuali-tree-container";

    searchCodebookInput.oninput = () => {
        filtrarArbolDOM(listCodebookContainer, searchCodebookInput.value);
    };

    tabCodebook.appendChild(toolbarCodebook);
    tabCodebook.appendChild(searchCodebookInput);
    tabCodebook.appendChild(tableHeaderCodebook);
    tabCodebook.appendChild(listCodebookContainer);

    const codebookButtons = document.createElement("div");
    codebookButtons.className = "cuali-buttons";
    
    const btnCodebookClipboard = document.createElement("button");
    btnCodebookClipboard.className = "cuali-btn cuali-btn-clipboard";
    btnCodebookClipboard.innerText = "Copiar al portapapeles";
    btnCodebookClipboard.onclick = async (e) => {
        e.preventDefault();
        if (!codebookTreeRoot || !nodoSeleccionadoOHijosSeleccionados(codebookTreeRoot)) {
            mostrarNotificacion("Selecciona al menos un código.");
            return;
        }
        const clipboardText = generarTextoPortapapeles(codebookTreeRoot);
        try {
            await navigator.clipboard.writeText(clipboardText.trim());
            mostrarNotificacion("Códigos copiados en formato árbol.");
        } catch (err) {
            mostrarNotificacion("Error al copiar al portapapeles.");
            console.error(err);
        }
    };
    
    const btnCodebookPage = document.createElement("button");
    btnCodebookPage.className = "cuali-btn cuali-btn-page";
    btnCodebookPage.innerText = "Crear nueva página";
    btnCodebookPage.onclick = async (e) => {
        e.preventDefault();
        if (!codebookTreeRoot || !nodoSeleccionadoOHijosSeleccionados(codebookTreeRoot)) {
            mostrarNotificacion("Selecciona al menos un código.");
            return;
        }
        document.body.removeChild(overlay);
        await generarPaginaConsolidadaArbol("Codebook Global", codebookTreeRoot);
    };

    codebookButtons.appendChild(btnCodebookClipboard);
    codebookButtons.appendChild(btnCodebookPage);
    tabCodebook.appendChild(codebookButtons);

    function renderTabCodebook() {
        listCodebookContainer.innerHTML = "";
        const cb = obtenerCodebookGlobal();
        
        // Build global tree with references
        const todosLosTitulos = [];
        ["dom", "dim", "cat", "cod", "memo"].forEach(key => {
            todosLosTitulos.push(...cb[key]);
        });
        const codeMapGlobal = obtenerReferenciasDeCodigos(todosLosTitulos);
        codebookTreeRoot = construirArbolCodigos(codeMapGlobal);
        
        const rootUl = document.createElement("ul");
        rootUl.style.paddingLeft = "0";
        rootUl.style.margin = "0";
        
        if (codebookTreeRoot && Object.keys(codebookTreeRoot.children).length > 0) {
            const childNamesSorted = Object.keys(codebookTreeRoot.children).sort();
            childNamesSorted.forEach(childName => {
                rootUl.appendChild(renderNodeHTML(codebookTreeRoot.children[childName]));
            });
        } else {
            rootUl.innerHTML = "<li style='color: #a0aec0; padding: 10px;'>No hay códigos en el codebook.</li>";
        }
        
        listCodebookContainer.appendChild(rootUl);
        
        // Apply existing filter if any text is typed
        if (searchCodebookInput.value) {
            filtrarArbolDOM(listCodebookContainer, searchCodebookInput.value);
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
