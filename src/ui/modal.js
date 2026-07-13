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
    setTimeout(() => {
        if (res && res.length > 0) {
            window.roamAlphaAPI.ui.mainWindow.openPage({page: {uid: res[0][0]}});
        } else {
            window.roamAlphaAPI.ui.mainWindow.openPage({page: {title: title}});
        }
    }, 100);
}

function getAggregateCites(node) {
    let count = node.cites.length;
    for (const childName in node.children) {
        count += getAggregateCites(node.children[childName]);
    }
    return count;
}

function recolectarNodosChecked(node, list = []) {
    if (node) {
        if (node.checked && node.fullName) {
            list.push(node);
        }
        if (node.children) {
            for (const childName in node.children) {
                recolectarNodosChecked(node.children[childName], list);
            }
        }
    }
    return list;
}

function mostrarModalGestion(nodos, scope, onComplete) {
    if (nodos.length === 0) {
        mostrarNotificacion("No has seleccionado ninguna categoría para gestionar.");
        return;
    }

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    // 1. Calculate total citations (cites) and unique sources (page title or interviewee name) affected
    let totalCitas = 0;
    const sourcesSet = new Set();
    const uniqueCodes = new Set();

    nodos.forEach(node => {
        if (node.cites) {
            totalCitas += node.cites.length;
            node.cites.forEach(c => {
                if (c.page) {
                    sourcesSet.add(c.page);
                }
            });
        }
        if (node.fullName) {
            uniqueCodes.add(node.fullName);
        }
    });

    // Create a new modal overlay specifically for this management action
    const mOverlay = document.createElement("div");
    mOverlay.style.position = "fixed";
    mOverlay.style.top = "0"; mOverlay.style.left = "0";
    mOverlay.style.width = "100%"; mOverlay.style.height = "100%";
    mOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
    mOverlay.style.zIndex = "10001";
    mOverlay.style.display = "flex";
    mOverlay.style.justifyContent = "center";
    mOverlay.style.alignItems = "center";

    const mContainer = document.createElement("div");
    mContainer.className = "cn-gestion-modal";

    const titleEl = document.createElement("h4");
    titleEl.className = "cn-gestion-title";
    titleEl.innerHTML = "⚠️ Gestión de Categorías Seleccionadas";
    mContainer.appendChild(titleEl);

    const descEl = document.createElement("div");
    descEl.style.fontSize = "13px";
    descEl.style.lineHeight = "1.5";
    descEl.innerHTML = `Has seleccionado <strong>${uniqueCodes.size}</strong> categorías con un total de <strong>${totalCitas}</strong> citas registradas en <strong>${sourcesSet.size}</strong> páginas de codificación.`;
    mContainer.appendChild(descEl);

    // List of selected categories
    const listEl = document.createElement("ul");
    listEl.className = "cn-gestion-list";
    Array.from(uniqueCodes).sort().forEach(code => {
        const li = document.createElement("li");
        li.innerText = `• ${code}`;
        listEl.appendChild(li);
    });
    mContainer.appendChild(listEl);

    // Options container
    const optionsWrapper = document.createElement("div");
    optionsWrapper.style.display = "flex";
    optionsWrapper.style.flexDirection = "column";
    optionsWrapper.style.gap = "12px";

    // Option A: Desenlazar
    const optA = document.createElement("div");
    optA.className = "cn-gestion-option active";
    optA.innerHTML = `
        <div class="cn-option-header">
            <input type="radio" name="cn-gestion-mode" id="cn-mode-unlink" checked style="cursor: pointer;">
            <label for="cn-mode-unlink" style="cursor: pointer; font-weight: 600;">Desenlazar (quitar [[ ]])</label>
        </div>
        <div class="cn-option-desc">Los corchetes se eliminan pero el texto permanece como texto plano en los bloques.<br>Ejemplo: [[${Array.from(uniqueCodes)[0] || 'codigo'}]] → ${Array.from(uniqueCodes)[0] || 'codigo'}</div>
    `;
    
    // Option B: Eliminar texto
    const optB = document.createElement("div");
    optB.className = "cn-gestion-option";
    optB.innerHTML = `
        <div class="cn-option-header">
            <input type="radio" name="cn-gestion-mode" id="cn-mode-delete" style="cursor: pointer;">
            <label for="cn-mode-delete" style="cursor: pointer; font-weight: 600;">Eliminar (reemplazar con [[CÓDIGO ELIMINADO]])</label>
        </div>
        <div class="cn-option-desc">La referencia se reemplaza por [[CÓDIGO ELIMINADO]] en todos los bloques donde aparece para preservar la integridad de la entrevista original.</div>
    `;

    // Extra checkbox for deleting pages (only relevant when deleting text)
    const extraCheckboxContainer = document.createElement("label");
    extraCheckboxContainer.style.display = "none"; // Hidden by default, shown when Opt B is active
    extraCheckboxContainer.style.alignItems = "center";
    extraCheckboxContainer.style.gap = "8px";
    extraCheckboxContainer.style.fontSize = "13px";
    extraCheckboxContainer.style.cursor = "pointer";
    extraCheckboxContainer.style.paddingLeft = "24px";
    extraCheckboxContainer.style.marginTop = "-6px";
    extraCheckboxContainer.innerHTML = `
        <input type="checkbox" id="cn-delete-pages" style="cursor: pointer;">
        <span>También eliminar las páginas del grafo de Roam (${uniqueCodes.size} páginas)</span>
    `;

    optA.onclick = () => {
        optA.classList.add("active");
        optB.classList.remove("active");
        optA.querySelector("input").checked = true;
        extraCheckboxContainer.style.display = "none";
    };

    optB.onclick = () => {
        optB.classList.add("active");
        optA.classList.remove("active");
        optB.querySelector("input").checked = true;
        extraCheckboxContainer.style.display = "flex";
    };

    optionsWrapper.appendChild(optA);
    optionsWrapper.appendChild(optB);
    optionsWrapper.appendChild(extraCheckboxContainer);
    mContainer.appendChild(optionsWrapper);

    // Progress bar container (initially hidden)
    const progressWrapper = document.createElement("div");
    progressWrapper.style.display = "none";
    progressWrapper.style.flexDirection = "column";
    progressWrapper.style.gap = "6px";
    progressWrapper.innerHTML = `
        <div style="font-size: 12px; color: var(--sol-base01);" id="cn-progress-text">Procesando...</div>
        <div class="cn-progress-container">
            <div class="cn-progress-bar" id="cn-progress-bar"></div>
        </div>
    `;
    mContainer.appendChild(progressWrapper);

    // Action buttons
    const actionsEl = document.createElement("div");
    actionsEl.className = "cuali-buttons";
    actionsEl.style.marginTop = "12px";

    const btnCancel = document.createElement("button");
    btnCancel.className = "cuali-btn cuali-btn-cancel";
    btnCancel.innerText = "Cancelar";
    btnCancel.onclick = () => {
        document.body.removeChild(mOverlay);
    };

    const btnExecute = document.createElement("button");
    btnExecute.className = "cuali-btn";
    btnExecute.style.backgroundColor = "rgba(220, 50, 47, 0.08)";
    btnExecute.style.border = "1px solid #dc322f";
    btnExecute.style.color = "#dc322f";
    btnExecute.innerText = "⚠️ Ejecutar";
    
    btnExecute.onclick = async () => {
        const unlinkMode = document.getElementById("cn-mode-unlink").checked;
        const deletePagesChecked = document.getElementById("cn-delete-pages").checked;

        // Disable buttons during execution
        btnCancel.disabled = true;
        btnExecute.disabled = true;
        btnCancel.style.opacity = "0.5";
        btnExecute.style.opacity = "0.5";
        optA.style.pointerEvents = "none";
        optB.style.pointerEvents = "none";
        extraCheckboxContainer.style.pointerEvents = "none";

        progressWrapper.style.display = "flex";
        const progressBar = document.getElementById("cn-progress-bar");
        const progressText = document.getElementById("cn-progress-text");

        // 1. Gather all blocks to update
        const blocksToUpdate = [];
        // Map from blockUid to set of category names to unlink/delete in it
        const blockCategoryMap = {};

        nodos.forEach(node => {
            if (node.cites && node.fullName) {
                node.cites.forEach(cite => {
                    if (cite.uid) {
                        if (!blockCategoryMap[cite.uid]) {
                            blockCategoryMap[cite.uid] = new Set();
                            blocksToUpdate.push(cite.uid);
                        }
                        blockCategoryMap[cite.uid].add(node.fullName);
                    }
                });
            }
        });

        // Helper to escape regex
        const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // 2. Process blocks sequentially
        const totalBlocks = blocksToUpdate.length;
        let processedBlocks = 0;

        for (const blockUid of blocksToUpdate) {
            processedBlocks++;
            const pct = Math.round((processedBlocks / totalBlocks) * 100);
            progressBar.style.width = `${pct}%`;
            progressText.innerText = `Actualizando bloque ${processedBlocks} de ${totalBlocks}...`;

            try {
                // Get current block text
                const currentText = obtenerTextoBloque(blockUid);
                if (currentText !== null) {
                    let newText = currentText;
                    const categories = blockCategoryMap[blockUid];

                    for (const catName of categories) {
                        const escapedCat = escapeRegExp(catName);
                        if (unlinkMode) {
                            // Replace [[category]] with category
                            const regex = new RegExp('\\[\\[' + escapedCat + '\\]\\]', 'g');
                            newText = newText.replace(regex, catName);
                        } else {
                            // Replace [[category]] or #[[category]] with [[CÓDIGO ELIMINADO]]
                            const regex = new RegExp('#?\\[\\[' + escapedCat + '\\]\\]', 'g');
                            newText = newText.replace(regex, '[[CÓDIGO ELIMINADO]]');
                        }
                    }

                    if (!unlinkMode) {
                        // Clean up double spaces resulting from deletion
                        newText = newText.replace(/ {2,}/g, ' ');
                    }

                    // Check if block is empty or contains only whitespace/punctuation
                    if (!unlinkMode && /^\s*$/.test(newText)) {
                        // Delete block
                        await eliminarBloqueRoam(blockUid);
                    } else {
                        // Update block
                        await actualizarTextoBloque(blockUid, newText.trim());
                    }
                }
            } catch (err) {
                console.error(`Error processing block ${blockUid}:`, err);
            }

            // Sleep a small bit for rate limiting
            await sleep(50);
        }

        // 3. Optional: Delete pages from Roam
        if (!unlinkMode && deletePagesChecked) {
            progressText.innerText = `Eliminando páginas del grafo...`;
            progressBar.style.width = `99%`;
            await sleep(200);

            for (const catName of uniqueCodes) {
                try {
                    const pageUid = obtenerUIDPaginaPorTitulo(catName);
                    if (pageUid) {
                        await eliminarPaginaRoam(pageUid);
                    }
                } catch (err) {
                    console.error(`Error deleting page ${catName}:`, err);
                }
                await sleep(50);
            }
        }

        progressText.innerText = `¡Completado con éxito!`;
        progressBar.style.width = `100%`;
        await sleep(500);

        // Remove overlay and notify
        document.body.removeChild(mOverlay);
        mostrarNotificacion(`Se procesaron ${totalBlocks} bloques correctamente.`);

        // Force clear global caches and call tab complete callback
        refrescarCachesGlobales();
        if (onComplete) {
            onComplete();
        }
    };

    actionsEl.appendChild(btnCancel);
    actionsEl.appendChild(btnExecute);
    mContainer.appendChild(actionsEl);

    mOverlay.appendChild(mContainer);
    document.body.appendChild(mOverlay);
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

function renderNodeHTML(node, hideSources = false, depth = 0) {
    const config = obtenerConfiguracionPlugin();
    const casePrefix = config.prefijoCasos.toLowerCase();
    const li = document.createElement("li");
    li.style.listStyleType = "none";
    li.style.margin = "0px 0";

    const rowDiv = document.createElement("div");
    rowDiv.className = "node-row";
    rowDiv.style.display = "flex";
    rowDiv.style.alignItems = "center";
    rowDiv.style.justifyContent = "space-between";
    rowDiv.style.width = "100%";
    rowDiv.style.padding = "4px 12px";
    rowDiv.style.transition = "all 0.2s ease";
    rowDiv.style.borderBottom = "1px solid var(--sol-base2)";

    const headerDiv = document.createElement("div");
    headerDiv.className = "node-header";
    headerDiv.style.display = "flex";
    headerDiv.style.alignItems = "center";
    headerDiv.style.flex = "1";
    headerDiv.style.minWidth = "0";
    headerDiv.style.borderRight = "1px solid rgba(147, 161, 161, 0.15)";
    headerDiv.style.paddingRight = "12px";
    headerDiv.style.boxSizing = "border-box";

    const hasChildren = Object.keys(node.children).length > 0;
    let toggleIcon = null;

    if (hasChildren) {
        toggleIcon = document.createElement("span");
        toggleIcon.className = "tree-toggle";
        toggleIcon.innerText = node.isIndividuallyPivoted ? "▼ " : "▶ ";
        toggleIcon.style.cursor = "pointer";
        toggleIcon.style.marginRight = "4px";
        toggleIcon.style.fontFamily = "monospace";
        toggleIcon.style.fontSize = "12px";
        toggleIcon.style.color = "var(--sol-base1)";
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

    // No folder/file emojis (keeps style clean and airy)

    const labelSpan = document.createElement("span");
    labelSpan.className = "node-label";
    if (node.isIndividuallyPivoted) {
        labelSpan.innerText = "🗂️ " + node.name;
        labelSpan.style.color = "var(--sol-blue)";
    } else {
        labelSpan.innerText = node.name;
    }
    labelSpan.style.cursor = "pointer";
    labelSpan.style.textOverflow = "ellipsis";
    labelSpan.style.overflow = "hidden";
    labelSpan.style.whiteSpace = "nowrap";
    
    if (depth === 0) {
        labelSpan.style.fontWeight = "600";
        labelSpan.style.fontSize = "14px";
        if (!node.isIndividuallyPivoted) {
            labelSpan.style.color = "var(--sol-base01)";
        }
        rowDiv.classList.add("node-depth-0");
    } else if (depth === 1) {
        labelSpan.style.fontWeight = "500";
        labelSpan.style.fontSize = "14px";
        if (!node.isIndividuallyPivoted) {
            labelSpan.style.color = "var(--sol-base01)";
        }
    } else {
        labelSpan.style.fontWeight = "400";
        labelSpan.style.fontSize = "13px";
        if (!node.isIndividuallyPivoted) {
            labelSpan.style.color = "var(--sol-base1)";
        }
    }
    
    labelSpan.onclick = () => {
        checkbox.click();
    };

    if (!hideSources) {
        labelSpan.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!node.isIndividuallyPivoted) {
                node.originalState = cloneSubtree(node);
                pivotNode(node, noDuplicarCompartidos);
                node.isIndividuallyPivoted = true;
            } else {
                if (node.originalState) {
                    node.children = {};
                    for (const childName in node.originalState.children) {
                        node.children[childName] = cloneSubtree(node.originalState.children[childName]);
                    }
                    node.cites = [...node.originalState.cites];
                    node.isIndividuallyPivoted = false;
                    node.originalState = null;
                }
            }
            
            const nuevoLi = renderNodeHTML(node, hideSources, depth);
            if (li.parentNode) {
                li.parentNode.replaceChild(nuevoLi, li);
            }
        };
        labelSpan.title = "Clic derecho para agrupar por fuentes este código";
    }
    
    headerDiv.appendChild(labelSpan);

    const goBtn = document.createElement("button");
    goBtn.className = "cuali-btn-tool cuali-go-btn";
    goBtn.style.padding = "2px 6px";
    goBtn.style.fontSize = "11px";
    goBtn.style.marginLeft = "auto";
    goBtn.style.flexShrink = "0";
    goBtn.innerText = "↗";
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
    citesCol.style.boxSizing = "border-box";
    citesCol.style.paddingLeft = "12px";
    if (!hideSources) {
        citesCol.style.borderRight = "1px solid rgba(147, 161, 161, 0.15)";
        citesCol.style.paddingRight = "12px";
    }
    rowDiv.appendChild(citesCol);

    if (!hideSources) {
        // Column 3: Sources (Pills / Chips)
        const sourcesCol = document.createElement("div");
        sourcesCol.className = "node-sources-col";
        sourcesCol.style.boxSizing = "border-box";
        sourcesCol.style.paddingLeft = "12px";
        
        if (uniqueSources.length > 0 && !hasChildren) {
            const formattedSources = uniqueSources.map(s => {
                if (s.toLowerCase().startsWith(casePrefix + "/")) {
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
        ul.style.borderLeft = "1px solid rgba(147, 161, 161, 0.3)";
        ul.style.marginLeft = "6px";
        ul.style.marginTop = "2px";
        ul.style.marginBottom = "2px";
        ul.style.display = node.isIndividuallyPivoted ? "block" : "none";
        
        const childNamesSorted = Object.keys(node.children).sort();
        childNamesSorted.forEach(childName => {
            ul.appendChild(renderNodeHTML(node.children[childName], hideSources, depth + 1));
        });
        li.appendChild(ul);
    }

    return li;
}

function renderCodebookNodeHTML(node) {
    const li = document.createElement("li");
    li.style.listStyleType = "none";
    li.style.margin = "0px 0";

    const headerDiv = document.createElement("div");
    headerDiv.className = "node-header";
    headerDiv.style.display = "flex";
    headerDiv.style.alignItems = "center";
    headerDiv.style.padding = "4px 12px";
    headerDiv.style.transition = "background-color 0.15s ease";

    const hasChildren = Object.keys(node.children).length > 0;

    if (hasChildren) {
        const toggleIcon = document.createElement("span");
        toggleIcon.className = "tree-toggle";
        toggleIcon.innerText = "▶ ";
        toggleIcon.style.cursor = "pointer";
        toggleIcon.style.marginRight = "4px";
        toggleIcon.style.fontFamily = "monospace";
        toggleIcon.style.fontSize = "12px";
        toggleIcon.style.color = "var(--sol-base1)";
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

    // No folder/file emojis

    const labelSpan = document.createElement("span");
    labelSpan.className = "node-label";
    labelSpan.innerText = node.name;
    labelSpan.style.fontSize = "14px";
    labelSpan.style.color = "var(--sol-base01)";
    headerDiv.appendChild(labelSpan);

    const goBtn = document.createElement("button");
    goBtn.className = "cuali-btn-tool cuali-go-btn";
    goBtn.style.padding = "2px 6px";
    goBtn.style.fontSize = "11px";
    goBtn.style.marginLeft = "auto";
    goBtn.innerText = "↗";
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
        ul.style.borderLeft = "1px solid rgba(147, 161, 161, 0.3)";
        ul.style.marginLeft = "6px";
        ul.style.marginTop = "2px";
        ul.style.marginBottom = "2px";
        ul.style.display = "none";
        
        const childNamesSorted = Object.keys(node.children).sort();
        childNamesSorted.forEach(childName => {
            ul.appendChild(renderCodebookNodeHTML(node.children[childName]));
        });
        li.appendChild(ul);
    }

    return li;
}

function renderMemoNodeHTML(node, memoContentMap) {
    const li = document.createElement("li");
    li.style.listStyleType = "none";
    li.style.margin = "0px 0";

    const headerDiv = document.createElement("div");
    headerDiv.className = "node-header";
    headerDiv.style.display = "flex";
    headerDiv.style.alignItems = "center";
    headerDiv.style.padding = "4px 12px";
    headerDiv.style.transition = "background-color 0.15s ease";

    const hasChildren = Object.keys(node.children).length > 0;

    // Columna 1: Memo (jerárquico)
    const colMemoDiv = document.createElement("div");
    colMemoDiv.className = "col-memo";
    colMemoDiv.style.display = "flex";
    colMemoDiv.style.alignItems = "center";

    if (hasChildren) {
        const toggleIcon = document.createElement("span");
        toggleIcon.className = "tree-toggle";
        toggleIcon.innerText = "▶ ";
        toggleIcon.style.cursor = "pointer";
        toggleIcon.style.marginRight = "4px";
        toggleIcon.style.fontFamily = "monospace";
        toggleIcon.style.fontSize = "12px";
        toggleIcon.style.color = "var(--sol-base1)";
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
        colMemoDiv.appendChild(toggleIcon);
    } else {
        const spacer = document.createElement("span");
        spacer.style.display = "inline-block";
        spacer.style.width = "14px";
        colMemoDiv.appendChild(spacer);
    }

    const labelSpan = document.createElement("span");
    labelSpan.className = "node-label";
    labelSpan.innerText = node.name;
    labelSpan.style.fontSize = "14px";
    labelSpan.style.color = "var(--sol-base01)";
    colMemoDiv.appendChild(labelSpan);

    const memoData = memoContentMap[node.fullName];
    if (memoData) {
        const goBtn = document.createElement("button");
        goBtn.className = "cuali-btn-tool cuali-go-btn";
        goBtn.style.padding = "2px 6px";
        goBtn.style.fontSize = "11px";
        goBtn.style.marginLeft = "8px";
        goBtn.innerText = "↗";
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
        colMemoDiv.appendChild(goBtn);
    }

    headerDiv.appendChild(colMemoDiv);

    // Columna 2: Preview
    const colPreviewDiv = document.createElement("div");
    colPreviewDiv.className = "col-preview";
    colPreviewDiv.style.display = "flex";
    colPreviewDiv.style.alignItems = "center";
    
    if (memoData && memoData.preview) {
        const previewSpan = document.createElement("span");
        previewSpan.className = "memo-preview-text";
        previewSpan.innerText = memoData.preview;
        previewSpan.title = memoData.preview;
        colPreviewDiv.appendChild(previewSpan);
    }
    headerDiv.appendChild(colPreviewDiv);

    // Columna 3: Vínculos (badges)
    const colLinksDiv = document.createElement("div");
    colLinksDiv.className = "col-links";
    colLinksDiv.style.display = "flex";
    colLinksDiv.style.alignItems = "center";

    if (memoData && memoData.linkedCodes && memoData.linkedCodes.length > 0) {
        const badgesContainer = document.createElement("div");
        badgesContainer.className = "memo-badge-container";
        
        memoData.linkedCodes.forEach(codeTitle => {
            const badge = document.createElement("span");
            badge.className = "memo-badge";
            badge.innerText = codeTitle.replace(/^(?:dom|dim|cat|cod)\//i, "");
            badge.title = `Ir a [[${codeTitle}]]`;
            badge.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const overlay = document.getElementById("extractor-cualitativo-overlay");
                if (overlay) {
                    document.body.removeChild(overlay);
                }
                abrirPaginaPorTitulo(codeTitle);
            };
            badgesContainer.appendChild(badge);
        });
        colLinksDiv.appendChild(badgesContainer);
    }
    headerDiv.appendChild(colLinksDiv);

    li.appendChild(headerDiv);

    if (hasChildren) {
        const ul = document.createElement("ul");
        ul.style.paddingLeft = "20px";
        ul.style.borderLeft = "1px solid rgba(147, 161, 161, 0.3)";
        ul.style.marginLeft = "6px";
        ul.style.marginTop = "2px";
        ul.style.marginBottom = "2px";
        ul.style.display = "none";
        
        const childNamesSorted = Object.keys(node.children).sort();
        childNamesSorted.forEach(childName => {
            ul.appendChild(renderMemoNodeHTML(node.children[childName], memoContentMap));
        });
        li.appendChild(ul);
    }

    return li;
}

function renderCategoryNodeHTML(node, depth = 0) {
    const config = obtenerConfiguracionPlugin();
    const casePrefix = config.prefijoCasos.toLowerCase();
    const li = document.createElement("li");
    li.style.listStyleType = "none";
    li.style.margin = "0px 0";

    const rowDiv = document.createElement("div");
    rowDiv.className = "node-row";
    rowDiv.style.display = "flex";
    rowDiv.style.alignItems = "center";
    rowDiv.style.justifyContent = "space-between";
    rowDiv.style.width = "100%";
    rowDiv.style.padding = "4px 12px";
    rowDiv.style.transition = "all 0.2s ease";
    rowDiv.style.borderBottom = "1px solid var(--sol-base2)";

    const headerDiv = document.createElement("div");
    headerDiv.className = "node-header col-cat-name";
    headerDiv.style.borderRight = "1px solid rgba(147, 161, 161, 0.15)";
    headerDiv.style.paddingRight = "12px";
    headerDiv.style.boxSizing = "border-box";

    const hasChildren = Object.keys(node.children).length > 0;
    const isUncategorizedNode = node.fullName === "__sin_categorizar__";
    let toggleIcon = null;

    if (hasChildren) {
        toggleIcon = document.createElement("span");
        toggleIcon.className = "tree-toggle";
        toggleIcon.innerText = "▶ ";
        toggleIcon.style.cursor = "pointer";
        toggleIcon.style.marginRight = "4px";
        toggleIcon.style.fontFamily = "monospace";
        toggleIcon.style.fontSize = "12px";
        toggleIcon.style.color = "var(--sol-base1)";
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

    let checkbox = null;
    if (!isUncategorizedNode) {
        checkbox = document.createElement("input");
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
    }

    const labelSpan = document.createElement("span");
    labelSpan.className = "node-label";
    labelSpan.innerText = node.name;
    labelSpan.style.cursor = "pointer";
    labelSpan.style.textOverflow = "ellipsis";
    labelSpan.style.overflow = "hidden";
    labelSpan.style.whiteSpace = "nowrap";
    
    if (depth === 0) {
        labelSpan.style.fontWeight = "600";
        labelSpan.style.fontSize = "14px";
        labelSpan.style.color = "var(--sol-base01)";
        rowDiv.classList.add("node-depth-0");
        
        if (isUncategorizedNode) {
            rowDiv.style.fontStyle = "italic";
            rowDiv.style.color = "var(--sol-base1)";
        }
    } else {
        labelSpan.style.fontWeight = "400";
        labelSpan.style.fontSize = "13px";
        labelSpan.style.color = "var(--sol-base1)";
    }
    
    if (checkbox) {
        labelSpan.onclick = () => {
            checkbox.click();
        };
    }

    headerDiv.appendChild(labelSpan);

    if (depth > 0) {
        const goBtn = document.createElement("button");
        goBtn.className = "cuali-btn-tool cuali-go-btn";
        goBtn.style.padding = "2px 6px";
        goBtn.style.fontSize = "11px";
        goBtn.style.marginLeft = "auto";
        goBtn.style.flexShrink = "0";
        goBtn.innerText = "↗";
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
    }

    if (depth === 0 && !isUncategorizedNode) {
        const goBtn = document.createElement("button");
        goBtn.className = "cuali-btn-tool cuali-go-btn";
        goBtn.style.padding = "2px 6px";
        goBtn.style.fontSize = "11px";
        goBtn.style.marginLeft = "auto";
        goBtn.style.flexShrink = "0";
        goBtn.innerText = "↗";
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

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "cuali-btn-tool cuali-go-btn";
        deleteBtn.style.padding = "2px 6px";
        deleteBtn.style.fontSize = "11px";
        deleteBtn.style.marginLeft = "4px";
        deleteBtn.style.flexShrink = "0";
        deleteBtn.style.color = "var(--sol-red)";
        deleteBtn.style.borderColor = "rgba(220, 50, 47, 0.2)";
        deleteBtn.innerText = "🗑️";
        deleteBtn.title = `Eliminar categoría: ${node.name}`;
        deleteBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm(`¿Estás seguro de que deseas eliminar la categoría "${node.name}"? Esta acción eliminará la página de la categoría [[${node.fullName}]] en Roam, pero no borrará los códigos ni las citas.`)) {
                await eliminarCategoriaRoam(node.uid);
                mostrarNotificacion("Categoría eliminada.");
                refrescarCachesGlobales();
                renderTabCategorias();
            }
        };
        headerDiv.appendChild(deleteBtn);
    }

    rowDiv.appendChild(headerDiv);

    const totalCodes = depth === 0 && !isUncategorizedNode ? Object.keys(node.children).length : 0;
    const totalCites = getAggregateCites(node);
    const uniqueSources = Array.from(getAggregateSources(node)).sort();

    const codesCol = document.createElement("div");
    codesCol.className = "node-cat-codes-col";
    codesCol.style.borderRight = "1px solid rgba(147, 161, 161, 0.15)";
    codesCol.innerText = depth === 0 && !isUncategorizedNode ? totalCodes : "-";
    rowDiv.appendChild(codesCol);

    const citesCol = document.createElement("div");
    citesCol.className = "node-cat-cites-col";
    citesCol.style.borderRight = "1px solid rgba(147, 161, 161, 0.15)";
    citesCol.innerText = totalCites > 0 ? totalCites : "-";
    rowDiv.appendChild(citesCol);

    const sourcesCol = document.createElement("div");
    sourcesCol.className = "node-cat-sources-col";
    
    if (uniqueSources.length > 0 && (depth > 0 || (depth === 0 && !hasChildren))) {
        const formattedSources = uniqueSources.map(s => {
            if (s.toLowerCase().startsWith(casePrefix + "/")) {
                const parts = s.split('/');
                if (parts.length >= 2) return parts[1];
            }
            return s;
        });
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

    li.appendChild(rowDiv);

    if (hasChildren) {
        const ul = document.createElement("ul");
        ul.style.paddingLeft = "20px";
        ul.style.borderLeft = "1px solid rgba(147, 161, 161, 0.3)";
        ul.style.marginLeft = "6px";
        ul.style.marginTop = "2px";
        ul.style.marginBottom = "2px";
        ul.style.display = "none";
        
        const childNamesSorted = Object.keys(node.children).sort();
        childNamesSorted.forEach(childName => {
            ul.appendChild(renderCategoryNodeHTML(node.children[childName], depth + 1));
        });
        li.appendChild(ul);
    }

    return li;
}

function renderCasoNodeHTML(node, isCase = false, depth = 0) {
    const li = document.createElement("li");
    li.style.listStyleType = "none";
    li.style.margin = "0px 0";

    const rowDiv = document.createElement("div");
    rowDiv.className = "node-row";
    rowDiv.style.display = "flex";
    rowDiv.style.alignItems = "center";
    rowDiv.style.justifyContent = "space-between";
    rowDiv.style.width = "100%";
    rowDiv.style.padding = "4px 12px";
    rowDiv.style.transition = "all 0.2s ease";
    rowDiv.style.borderBottom = "1px solid var(--sol-base2)";

    const casoCol = document.createElement("div");
    casoCol.className = "node-caso-col";
    casoCol.style.width = "200px";
    casoCol.style.flexShrink = "0";
    casoCol.style.display = "flex";
    casoCol.style.alignItems = "center";
    casoCol.style.overflow = "hidden";
    casoCol.style.textOverflow = "ellipsis";
    casoCol.style.whiteSpace = "nowrap";
    casoCol.style.borderRight = "1px solid rgba(147, 161, 161, 0.15)";
    casoCol.style.paddingRight = "12px";
    casoCol.style.boxSizing = "border-box";

    const codeCol = document.createElement("div");
    codeCol.className = "node-code-col";
    codeCol.style.flex = "1";
    codeCol.style.display = "flex";
    codeCol.style.alignItems = "center";
    codeCol.style.minWidth = "0";
    codeCol.style.overflow = "hidden";
    codeCol.style.textOverflow = "ellipsis";
    codeCol.style.whiteSpace = "nowrap";
    codeCol.style.borderRight = "1px solid rgba(147, 161, 161, 0.15)";
    codeCol.style.paddingLeft = "12px";
    codeCol.style.paddingRight = "12px";
    codeCol.style.boxSizing = "border-box";

    const citesCol = document.createElement("div");
    citesCol.className = "node-cites-col";
    citesCol.style.width = "100px";
    citesCol.style.textAlign = "center";
    citesCol.style.flexShrink = "0";
    citesCol.style.fontSize = "13px";
    citesCol.style.fontWeight = "600";
    citesCol.style.color = "var(--sol-base00)";
    citesCol.style.paddingLeft = "12px";
    citesCol.style.boxSizing = "border-box";

    const hasChildren = Object.keys(node.children).length > 0;
    
    let toggleIcon = null;
    if (hasChildren) {
        toggleIcon = document.createElement("span");
        toggleIcon.className = "tree-toggle";
        toggleIcon.innerText = "▶ ";
        toggleIcon.style.cursor = "pointer";
        toggleIcon.style.marginRight = "4px";
        toggleIcon.style.fontFamily = "monospace";
        toggleIcon.style.fontSize = "12px";
        toggleIcon.style.color = "var(--sol-base1)";
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

    // No folder/file emojis

    const labelSpan = document.createElement("span");
    labelSpan.className = "node-label";
    labelSpan.innerText = node.name;
    labelSpan.style.cursor = "pointer";
    labelSpan.style.textOverflow = "ellipsis";
    labelSpan.style.overflow = "hidden";
    labelSpan.style.whiteSpace = "nowrap";
    if (depth === 0) {
        labelSpan.style.fontWeight = "600";
        labelSpan.style.fontSize = "14px";
        labelSpan.style.color = "var(--sol-base01)";
        rowDiv.classList.add("node-depth-0");
    } else if (depth === 1) {
        labelSpan.style.fontWeight = "500";
        labelSpan.style.fontSize = "14px";
        labelSpan.style.color = "var(--sol-base01)";
    } else {
        labelSpan.style.fontWeight = "400";
        labelSpan.style.fontSize = "13px";
        labelSpan.style.color = "var(--sol-base1)";
    }
    labelSpan.onclick = () => {
        checkbox.click();
    };

    const goBtn = document.createElement("button");
    goBtn.className = "cuali-btn-tool cuali-go-btn";
    goBtn.style.padding = "2px 6px";
    goBtn.style.fontSize = "11px";
    goBtn.style.marginLeft = "auto";
    goBtn.style.flexShrink = "0";
    goBtn.innerText = "↗";
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
        casoCol.appendChild(labelSpan);
        casoCol.appendChild(goBtn);
        
        codeCol.innerHTML = "&nbsp;";
    } else {
        casoCol.innerHTML = "&nbsp;";
        
        codeCol.appendChild(checkbox);
        if (toggleIcon) codeCol.appendChild(toggleIcon);
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
        ul.style.borderLeft = "1px solid rgba(147, 161, 161, 0.3)";
        ul.style.marginLeft = "6px";
        ul.style.marginTop = "2px";
        ul.style.marginBottom = "2px";
        ul.style.display = "none";
        
        const childNamesSorted = Object.keys(node.children).sort();
        childNamesSorted.forEach(childName => {
            ul.appendChild(renderCasoNodeHTML(node.children[childName], false, depth + 1));
        });
        li.appendChild(ul);
    }

    return li;
}

function generarTextoPortapapeles(node, indentLevel = 0, numAbove = 0, numBelow = 0, plainText = false) {
    let text = "";
    const indent = "\t".repeat(indentLevel);
    
    if (node.name !== "root") {
        text += `${indent}[[${node.fullName}]]\n`;
        if (node.checked) {
            node.cites.forEach(citeUid => {
                const context = obtenerContextoBloque(citeUid.uid, numAbove, numBelow);
                if (context.length === 1 && !context[0].isContext) {
                    if (plainText) {
                        text += `${indent}\t[Cita] ${context[0].string}\n`;
                    } else {
                        text += `${indent}\t((${citeUid.uid}))\n`;
                    }
                } else {
                    if (plainText) {
                        context.forEach(b => {
                            const prefix = b.isContext ? "[Contexto] " : "[Cita] ";
                            text += `${indent}\t${prefix}${b.string}\n`;
                        });
                    } else {
                        text += `${indent}\tCita con contexto:\n`;
                        context.forEach(b => {
                            text += `${indent}\t\t((${b.uid}))${b.isContext ? ' *(Contexto)*' : ''}\n`;
                        });
                    }
                }
            });
        }
    }
    
    const childIndentLevel = node.name === "root" ? 0 : indentLevel + 1;
    const childNamesSorted = Object.keys(node.children).sort();
    for (const childName of childNamesSorted) {
        const childNode = node.children[childName];
        if (nodoSeleccionadoOHijosSeleccionados(childNode)) {
            text += generarTextoPortapapeles(childNode, childIndentLevel, numAbove, numBelow, plainText);
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
    
    // Identificamos los nodos de nivel superior (ej. Categorías raíz) para que sean "inmunes" y siempre se muestren
    const topLevelLis = Array.from(container.querySelectorAll(':scope > ul > li'));
    
    lis.forEach(li => {
        if (topLevelLis.includes(li)) {
            li.style.display = "";
        } else {
            li.style.display = "none";
        }
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

function seleccionarNodosFiltrados(container, query, rootNodeObj) {
    const q = query.toLowerCase().trim();
    if (!q) {
        mostrarNotificacion("Escribe un término de búsqueda para filtrar y seleccionar.");
        return;
    }

    if (rootNodeObj) updateNodeCheckedState(rootNodeObj, false);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
        cb.indeterminate = false;
        if (cb._node) cb._node.checked = false;
    });

    let checkCount = 0;
    checkboxes.forEach(cb => {
        if (!cb._node) return;
        if (cb._node.name.toLowerCase().includes(q)) {
            cb.checked = true;
            cb._node.checked = true;
            checkCount++;
        }
    });

    if (checkCount > 0) {
        mostrarNotificacion(`Seleccionados ${checkCount} códigos coincidentes.`);
    } else {
        mostrarNotificacion("No se encontraron coincidencias para seleccionar.");
    }
}

function crearInterfazModal(rootNode, pageTitle, pageUid) {
    const config = obtenerConfiguracionPlugin();
    let codebookTreeRoot = null;
    let casosTreeRoot = null;
    let arbolPivotado = false;
    let noDuplicarCompartidos = false;
    let smartGroupingContainer = null;
    
    let numBloquesArriba = 0;
    let numBloquesAbajo = 0;
    let exportarTextoPlano = false;

    let existingStyles = document.getElementById("cuali-nemesis-styles");
    if (existingStyles) {
        existingStyles.remove();
    }
    const styleTag = document.createElement("style");
    styleTag.id = "cuali-nemesis-styles";
    styleTag.innerHTML = `
        #extractor-cualitativo-overlay {
            --sol-base03: #002b36;
            --sol-base02: #000000;
            --sol-base01: #000000;
            --sol-base00: #000000;
            --sol-base0:  #222222;
            --sol-base1:  #555555;
            --sol-base2:  #f2f1ed;
            --sol-base3:  #fcfcfa;
            
            --sol-yellow:  #b58900;
            --sol-orange:  #cb4b16;
            --sol-red:     #dc322f;
            --sol-magenta: #d33682;
            --sol-violet:  #6c71c4;
            --sol-blue:    #268bd2;
            --sol-cyan:    #2aa198;
            --sol-green:   #859900;

            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: rgba(7, 54, 66, 0.25);
            backdrop-filter: blur(6px);
            transition: all 0.3s ease;
        }
        .cuali-modal {
            background: var(--sol-base3);
            padding: 16px 24px;
            border-radius: 16px;
            width: 95vw;
            max-width: 1450px;
            height: 90vh;
            box-shadow: 0 30px 60px -15px rgba(7, 54, 66, 0.12), 0 15px 30px -10px rgba(0, 0, 0, 0.04);
            border: 1px solid rgba(147, 161, 161, 0.25);
            display: flex;
            flex-direction: column;
            color: var(--sol-base01);
            font-size: 14px;
            font-weight: 400;
            letter-spacing: 0.01em;
            line-height: 1.5;
        }
        .cuali-header {
            font-family: Georgia, serif;
            font-size: 1.3rem;
            font-weight: 400;
            color: var(--sol-base02);
            margin-top: 0;
            margin-bottom: 8px;
            border-bottom: 1px solid rgba(147, 161, 161, 0.2);
            padding-bottom: 6px;
            letter-spacing: 0.02em;
        }
        
        /* Tabs Styles */
        .cuali-tabs {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-bottom: 1px solid rgba(147, 161, 161, 0.2);
            margin-bottom: 6px;
            gap: 12px;
            min-height: 36px;
        }
        .cuali-tabs-left {
            display: flex;
            gap: 12px;
            align-items: flex-end;
            flex-shrink: 0;
        }
        .cuali-tabs-right {
            display: none;
            gap: 4px;
            align-items: center;
            flex-wrap: wrap;
            margin-left: auto;
            padding-bottom: 4px;
            justify-content: flex-end;
        }
        .cuali-tab-btn {
            padding: 4px 8px 8px 8px;
            background: transparent;
            border: none;
            border-bottom: 2px solid transparent;
            font-size: 14px;
            font-weight: 600;
            color: var(--sol-base01);
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .cuali-tab-btn:hover {
            color: var(--sol-base02);
        }
        .cuali-tab-btn.active {
            color: var(--sol-blue);
            border-bottom: 2.5px solid var(--sol-blue);
            font-weight: 700;
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
            background: var(--sol-base3);
            border: 1px solid rgba(147, 161, 161, 0.15);
            border-radius: 8px;
            padding: 12px 16px;
            overflow-y: auto;
            flex: 1;
        }
        .cuali-list-box.cuali-tree-container {
            border-top: none;
            border-radius: 0 0 8px 8px;
            padding: 8px 0;
        }
        .cuali-list-item {
            padding: 10px 16px;
            border-bottom: 1px solid rgba(147, 161, 161, 0.1);
            font-size: 14px;
            color: var(--sol-base00);
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: all 0.2s ease;
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
            font-weight: 700;
            font-size: 12px;
            color: var(--sol-base01);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            padding: 6px 12px;
            background-color: rgba(147, 161, 161, 0.22);
            border: 1px solid rgba(147, 161, 161, 0.15);
            border-bottom: 2.5px solid rgba(147, 161, 161, 0.35);
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
            border-bottom: 1px solid rgba(147, 161, 161, 0.1);
            transition: all 0.2s ease;
        }

        .node-cites-col {
            width: 100px;
            text-align: center;
            font-size: 13px;
            font-weight: 600;
            color: var(--sol-base00);
            flex-shrink: 0;
            font-variant-numeric: tabular-nums;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
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
            background-color: rgba(38, 139, 210, 0.04);
            color: var(--sol-blue);
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            max-width: 130px;
            overflow: hidden;
            text-overflow: ellipsis;
            display: inline-block;
            border: 1px solid rgba(38, 139, 210, 0.2);
        }
        .cuali-tag-more {
            background-color: rgba(147, 161, 161, 0.05);
            color: var(--sol-base01);
            border-color: rgba(147, 161, 161, 0.2);
            cursor: help;
        }
        .cuali-group-title {
            font-weight: 500;
            font-size: 12px;
            color: var(--sol-base1);
            text-transform: uppercase;
            margin-top: 16px;
            margin-bottom: 6px;
            letter-spacing: 0.08em;
        }
        .cuali-group-title:first-child {
            margin-top: 0;
        }
        
        /* Search Inputs */
        .cuali-search-input {
            width: 100%;
            padding: 6px 12px;
            margin-bottom: 6px;
            border: 1px solid rgba(147, 161, 161, 0.2);
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box;
            outline: none;
            background-color: var(--sol-base3);
            color: var(--sol-base01);
            transition: all 0.25s ease;
            font-weight: 400;
        }
        .cuali-search-input:focus {
            border-color: var(--sol-blue);
            box-shadow: 0 0 0 3px rgba(38, 139, 210, 0.1);
            background-color: var(--sol-base3);
        }
        .cuali-search-input::placeholder {
            color: var(--sol-base1);
        }
        
        /* Toolbar */
        .cuali-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }
        .cuali-toolbar-left {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
            align-items: center;
        }
        .cuali-btn-tool[title] {
            position: relative;
        }
        .cuali-btn-tool[title]:hover::after {
            content: attr(title);
            position: absolute;
            top: calc(100% + 6px);
            bottom: auto;
            left: 50%;
            transform: translateX(-50%);
            background: var(--sol-base02, #073642);
            color: var(--sol-base2, #eee8d5);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            white-space: nowrap;
            z-index: 10000;
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .cuali-toolbar-separator {
            width: 1px;
            height: 18px;
            background: rgba(147, 161, 161, 0.2);
            margin: 0 4px;
        }
        .cuali-btn-tool {
            background: transparent;
            border: 1px solid rgba(147, 161, 161, 0.2);
            border-radius: 4px;
            color: var(--sol-base1);
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            padding: 2px 6px;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .cuali-btn-tool:hover {
            color: var(--sol-blue);
            background: rgba(38, 139, 210, 0.05);
            border-radius: 4px;
            transform: translateY(-0.5px);
        }
        
        /* Bottom Buttons */
        .cuali-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 8px;
        }
        .cuali-btn {
            padding: 8px 20px;
            border-radius: 8px;
            font-weight: 500;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            outline: none;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            letter-spacing: 0.02em;
        }
        .cuali-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(7, 54, 66, 0.05);
        }
        .cuali-btn:active {
            transform: translateY(1px);
        }
        .cuali-btn-cancel {
            background: transparent;
            border: 1px solid var(--sol-base1);
            color: var(--sol-base1);
        }
        .cuali-btn-cancel:hover {
            background: rgba(147, 161, 161, 0.06);
            color: var(--sol-base02);
            border-color: var(--sol-base0);
        }
        .cuali-btn-clipboard {
            background: rgba(133, 153, 0, 0.04);
            border: 1px solid var(--sol-green);
            color: var(--sol-green);
        }
        .cuali-btn-clipboard:hover {
            background: rgba(133, 153, 0, 0.1);
            color: #738600;
            border-color: #738600;
        }
        .cuali-btn-page {
            background: rgba(38, 139, 210, 0.04);
            border: 1px solid var(--sol-blue);
            color: var(--sol-blue);
        }
        .cuali-btn-page:hover {
            background: rgba(38, 139, 210, 0.1);
            color: #1e71ab;
            border-color: #1e71ab;
        }
        /* hover logic cleaned up */

        input[type="checkbox"] {
            accent-color: var(--sol-blue);
            cursor: pointer;
        }
        .node-depth-0 {
            background-color: rgba(242, 241, 237, 0.4);
        }

        /* Toggle Button Styles */
        .cuali-view-toggle {
            display: inline-flex;
            border: 1px solid rgba(147, 161, 161, 0.25);
            border-radius: 6px;
            overflow: hidden;
            margin-left: 12px;
            background-color: var(--sol-base3);
        }
        .cuali-view-toggle-btn {
            padding: 3px 10px;
            font-size: 11px;
            font-weight: 500;
            border: none;
            background: transparent;
            color: var(--sol-base1);
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .cuali-view-toggle-btn.active {
            background: rgba(38, 139, 210, 0.1);
            color: var(--sol-blue);
            font-weight: 600;
        }
        .cuali-view-toggle-btn:hover:not(.active) {
            background: rgba(147, 161, 161, 0.06);
            color: var(--sol-base01);
        }
        
        .cn-info-note {
            font-size: 11px;
            color: var(--sol-base1);
            font-style: italic;
            margin-top: 6px;
            margin-bottom: 2px;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 5px 10px;
            background-color: rgba(147, 161, 161, 0.05);
            border-left: 3px solid rgba(147, 161, 161, 0.2);
            border-radius: 0 4px 4px 0;
        }
        
        /* Modal Gestión / Eliminación */
        .cn-gestion-modal {
            background-color: #fcfcfa;
            border: 1px solid rgba(147, 161, 161, 0.3);
            border-radius: 12px;
            padding: 24px;
            width: 500px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            color: var(--sol-base01);
            display: flex;
            flex-direction: column;
            gap: 16px;
            z-index: 10000;
        }
        .cn-gestion-title {
            font-family: Georgia, serif;
            font-size: 18px;
            font-weight: 700;
            color: var(--sol-base02);
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .cn-gestion-list {
            max-height: 120px;
            overflow-y: auto;
            border: 1px solid rgba(147, 161, 161, 0.15);
            border-radius: 6px;
            padding: 8px 12px;
            background-color: rgba(147, 161, 161, 0.02);
            font-family: monospace;
            font-size: 12px;
            margin: 0;
            list-style: none;
        }
        .cn-gestion-list li {
            padding: 2px 0;
        }
        .cn-gestion-option {
            display: flex;
            flex-direction: column;
            gap: 4px;
            border: 1px solid rgba(147, 161, 161, 0.15);
            border-radius: 8px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .cn-gestion-option:hover {
            background-color: rgba(38, 139, 210, 0.02);
            border-color: rgba(38, 139, 210, 0.2);
        }
        .cn-gestion-option.active {
            background-color: rgba(38, 139, 210, 0.05);
            border-color: var(--sol-blue);
        }
        .cn-option-header {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: 14px;
        }
        .cn-option-desc {
            font-size: 12px;
            color: var(--sol-base1);
            padding-left: 24px;
        }
        .cn-progress-container {
            width: 100%;
            background-color: rgba(147, 161, 161, 0.15);
            border-radius: 4px;
            height: 8px;
            overflow: hidden;
            margin-top: 8px;
        }
        .cn-progress-bar {
            height: 100%;
            background-color: var(--sol-blue);
            width: 0%;
            transition: width 0.1s ease;
        }
        
        /* Estilos Pestaña Memos */
        .col-memo {
            flex: 2;
            min-width: 250px;
        }
        .col-preview {
            flex: 3;
            min-width: 300px;
            padding-left: 12px;
            padding-right: 12px;
            border-right: 1px solid rgba(147, 161, 161, 0.15);
            border-left: 1px solid rgba(147, 161, 161, 0.15);
            box-sizing: border-box;
        }
        .col-links {
            flex: 2;
            min-width: 200px;
            padding-left: 12px;
            box-sizing: border-box;
        }
        .memo-preview-text {
            font-size: 12px;
            color: var(--sol-base1);
            font-style: italic;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 450px;
        }
        .memo-badge-container {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            max-height: 40px;
            overflow-y: auto;
        }
        .memo-badge {
            background-color: rgba(38, 139, 210, 0.08);
            color: var(--sol-blue);
            border: 1px solid rgba(38, 139, 210, 0.2);
            border-radius: 4px;
            padding: 1px 6px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;
        }
        .memo-badge:hover {
            background-color: var(--sol-blue);
            color: #ffffff;
        }
        
        /* Category-specific columns */
        .col-cat-name { flex: 2; display: flex; align-items: center; min-width: 0; }
        .col-cat-codes { flex: 0 0 100px; text-align: center; justify-content: center; }
        .col-cat-cites { flex: 0 0 100px; text-align: center; justify-content: center; }
        .col-cat-sources { flex: 1.5; display: flex; flex-wrap: wrap; gap: 4px; }
        
        .node-cat-codes-col { flex: 0 0 100px; text-align: center; font-family: monospace; font-size: 13px; color: var(--sol-base1); }
        .node-cat-cites-col { flex: 0 0 100px; text-align: center; font-family: monospace; font-size: 13px; color: var(--sol-base1); }
        .node-cat-sources-col { flex: 1.5; display: flex; flex-wrap: wrap; gap: 4px; min-width: 0; }

        /* Edit category modal overlay */
        .cuali-cat-edit-overlay {
            position: absolute;
            inset: 0;
            background: rgba(7, 54, 66, 0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            border-radius: 16px;
            backdrop-filter: blur(4px);
        }
        .cuali-cat-edit-modal {
            background: var(--sol-base3);
            border: 1px solid rgba(147, 161, 161, 0.25);
            border-radius: 12px;
            padding: 20px;
            width: 90%;
            max-width: 650px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 50px rgba(7, 54, 66, 0.15);
            color: var(--sol-base01);
            font-family: inherit;
        }
        .cuali-cat-edit-title {
            font-family: Georgia, serif;
            font-size: 1.2rem;
            color: var(--sol-base02);
            margin-top: 0;
            margin-bottom: 12px;
            border-bottom: 1px solid rgba(147, 161, 161, 0.15);
            padding-bottom: 6px;
        }
        .cuali-cat-edit-field {
            margin-bottom: 12px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .cuali-cat-edit-field label {
            font-weight: 600;
            font-size: 13px;
        }
        .cuali-cat-edit-input {
            padding: 6px 10px;
            border: 1px solid rgba(147, 161, 161, 0.3);
            border-radius: 6px;
            font-size: 13px;
            background: var(--sol-base3);
            color: var(--sol-base01);
        }
        .cuali-cat-edit-input:focus {
            outline: none;
            border-color: var(--sol-blue);
        }
        
        .cuali-uncategorized-separator {
            border-top: 1px dashed rgba(147, 161, 161, 0.3);
            margin: 12px 0;
        }
    `;
    document.head.appendChild(styleTag);

    const configListeners = [];
    function notificarCambioConfiguracion() {
        configListeners.forEach(listener => listener());
    }

    function crearSeccionConfiguracionExportacion() {
        const container = document.createElement("div");
        container.className = "cuali-export-config-row";
        container.style.display = "flex";
        container.style.alignItems = "center";
        container.style.gap = "16px";
        container.style.marginBottom = "8px";
        container.style.padding = "6px 12px";
        container.style.backgroundColor = "rgba(147, 161, 161, 0.05)";
        container.style.borderRadius = "8px";
        container.style.border = "1px solid rgba(147, 161, 161, 0.15)";
        container.style.fontSize = "13px";
        container.style.color = "var(--sol-base01)";

        const titleLabel = document.createElement("span");
        titleLabel.style.fontWeight = "600";
        titleLabel.style.marginRight = "auto";
        titleLabel.innerHTML = "⚙️ Configuración de Exportación:";

        // Above input
        const labelArriba = document.createElement("label");
        labelArriba.style.display = "flex";
        labelArriba.style.alignItems = "center";
        labelArriba.style.gap = "6px";
        labelArriba.innerHTML = "Bloques arriba:";
        
        const inputArriba = document.createElement("input");
        inputArriba.type = "number";
        inputArriba.min = "0";
        inputArriba.max = "10";
        inputArriba.value = numBloquesArriba;
        inputArriba.style.width = "45px";
        inputArriba.style.padding = "3px 6px";
        inputArriba.style.border = "1px solid rgba(147, 161, 161, 0.2)";
        inputArriba.style.borderRadius = "4px";
        inputArriba.style.backgroundColor = "var(--sol-base3)";
        inputArriba.style.color = "var(--sol-base01)";
        inputArriba.onchange = () => {
            numBloquesArriba = Math.max(0, parseInt(inputArriba.value) || 0);
            notificarCambioConfiguracion();
        };
        labelArriba.appendChild(inputArriba);

        // Below input
        const labelAbajo = document.createElement("label");
        labelAbajo.style.display = "flex";
        labelAbajo.style.alignItems = "center";
        labelAbajo.style.gap = "6px";
        labelAbajo.innerHTML = "Bloques abajo:";
        
        const inputAbajo = document.createElement("input");
        inputAbajo.type = "number";
        inputAbajo.min = "0";
        inputAbajo.max = "10";
        inputAbajo.value = numBloquesAbajo;
        inputAbajo.style.width = "45px";
        inputAbajo.style.padding = "3px 6px";
        inputAbajo.style.border = "1px solid rgba(147, 161, 161, 0.2)";
        inputAbajo.style.borderRadius = "4px";
        inputAbajo.style.backgroundColor = "var(--sol-base3)";
        inputAbajo.style.color = "var(--sol-base01)";
        inputAbajo.onchange = () => {
            numBloquesAbajo = Math.max(0, parseInt(inputAbajo.value) || 0);
            notificarCambioConfiguracion();
        };
        labelAbajo.appendChild(inputAbajo);

        // Plain text checkbox
        const labelTextoPlano = document.createElement("label");
        labelTextoPlano.style.display = "flex";
        labelTextoPlano.style.alignItems = "center";
        labelTextoPlano.style.gap = "6px";
        labelTextoPlano.style.cursor = "pointer";
        labelTextoPlano.title = "Resuelve las referencias ((UID)) a su texto real para pegarlo en IA externas.";
        
        const checkboxTextoPlano = document.createElement("input");
        checkboxTextoPlano.type = "checkbox";
        checkboxTextoPlano.checked = exportarTextoPlano;
        checkboxTextoPlano.style.cursor = "pointer";
        checkboxTextoPlano.onchange = () => {
            exportarTextoPlano = checkboxTextoPlano.checked;
            notificarCambioConfiguracion();
        };
        
        labelTextoPlano.appendChild(checkboxTextoPlano);
        labelTextoPlano.appendChild(document.createTextNode("Exportar texto plano (IA/Externo)"));

        container.appendChild(titleLabel);
        container.appendChild(labelArriba);
        container.appendChild(labelAbajo);
        container.appendChild(labelTextoPlano);

        configListeners.push(() => {
            inputArriba.value = numBloquesArriba;
            inputAbajo.value = numBloquesAbajo;
            checkboxTextoPlano.checked = exportarTextoPlano;
        });

        return container;
    }

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
    
    const tabsLeft = document.createElement("div");
    tabsLeft.className = "cuali-tabs-left";
    
    const btnTabExportacion = document.createElement("button");
    btnTabExportacion.className = "cuali-tab-btn active";
    btnTabExportacion.innerText = "Exportación Contextual";
    
    const btnTabCasos = document.createElement("button");
    btnTabCasos.className = "cuali-tab-btn";
    btnTabCasos.innerText = "Casos";
    
    const btnTabCodebook = document.createElement("button");
    btnTabCodebook.className = "cuali-tab-btn";
    btnTabCodebook.innerText = "Codificación";
    
    const btnTabMemos = document.createElement("button");
    btnTabMemos.className = "cuali-tab-btn";
    btnTabMemos.innerText = "Memos";
    
    const btnTabCategorias = document.createElement("button");
    btnTabCategorias.className = "cuali-tab-btn";
    btnTabCategorias.innerText = "Categorías";
    
    tabsLeft.appendChild(btnTabExportacion);
    tabsLeft.appendChild(btnTabCasos);
    tabsLeft.appendChild(btnTabCodebook);
    tabsLeft.appendChild(btnTabMemos);
    tabsLeft.appendChild(btnTabCategorias);
    tabsNav.appendChild(tabsLeft);

    const controlsExport = document.createElement("div");
    controlsExport.className = "cuali-tabs-right";
    controlsExport.style.display = "flex"; // Active initially
    
    const controlsCasos = document.createElement("div");
    controlsCasos.className = "cuali-tabs-right";
    
    const controlsCodebook = document.createElement("div");
    controlsCodebook.className = "cuali-tabs-right";

    const controlsMemos = document.createElement("div");
    controlsMemos.className = "cuali-tabs-right";

    const controlsCategorias = document.createElement("div");
    controlsCategorias.className = "cuali-tabs-right";

    tabsNav.appendChild(controlsExport);
    tabsNav.appendChild(controlsCasos);
    tabsNav.appendChild(controlsCodebook);
    tabsNav.appendChild(controlsMemos);
    tabsNav.appendChild(controlsCategorias);
    
    modal.appendChild(tabsNav);

    // Tab Contents Containers
    const tabExportacion = document.createElement("div");
    tabExportacion.className = "cuali-tab-content active";
    
    const tabCasos = document.createElement("div");
    tabCasos.className = "cuali-tab-content";
    
    const tabCodebook = document.createElement("div");
    tabCodebook.className = "cuali-tab-content";

    const tabMemos = document.createElement("div");
    tabMemos.className = "cuali-tab-content";

    const tabCategorias = document.createElement("div");
    tabCategorias.className = "cuali-tab-content";

    // --- POPULATE TAB: EXPORTACION ---
    const btnExpandAll = document.createElement("button");
    btnExpandAll.className = "cuali-btn-tool";
    btnExpandAll.innerText = "⊞";
    btnExpandAll.title = "Expandir todo";
    btnExpandAll.onclick = (e) => {
        e.preventDefault();
        const uls = treeContainer.querySelectorAll("ul");
        uls.forEach(ul => ul.style.display = "block");
        const toggles = treeContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▼ ");
    };

    const btnCollapseAll = document.createElement("button");
    btnCollapseAll.className = "cuali-btn-tool";
    btnCollapseAll.innerText = "⊟";
    btnCollapseAll.title = "Colapsar todo";
    btnCollapseAll.onclick = (e) => {
        e.preventDefault();
        const uls = treeContainer.querySelectorAll("ul");
        uls.forEach(ul => {
            if (ul !== treeContainer.querySelector("ul")) {
                ul.style.display = "none";
            }
        });
        const toggles = treeContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▶ ");
    };

    const btnSelectAll = document.createElement("button");
    btnSelectAll.className = "cuali-btn-tool";
    btnSelectAll.innerText = "☑";
    btnSelectAll.title = "Seleccionar todo";
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
    btnDeselectAll.innerText = "☐";
    btnDeselectAll.title = "Deseleccionar todo";
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

    const btnSelectFiltered = document.createElement("button");
    btnSelectFiltered.className = "cuali-btn-tool";
    btnSelectFiltered.innerText = "☑*";
    btnSelectFiltered.title = "Seleccionar filtrados";
    btnSelectFiltered.onclick = (e) => {
        e.preventDefault();
        seleccionarNodosFiltrados(treeContainer, searchExportInput.value, rootNode);
    };

    const btnGestionarExportacion = document.createElement("button");
    btnGestionarExportacion.className = "cuali-btn-tool";
    btnGestionarExportacion.innerHTML = "🗑️ Gestionar";
    btnGestionarExportacion.style.color = "#dc322f";
    btnGestionarExportacion.style.borderColor = "rgba(220, 50, 47, 0.2)";
    btnGestionarExportacion.onclick = (e) => {
        e.preventDefault();
        const nodos = recolectarNodosChecked(rootNode);
        mostrarModalGestion(nodos, "contextual", () => {
            renderTabExportacion(true);
            renderTabCategorias();
        });
    };

    const btnToggleSearchExport = document.createElement("button");
    btnToggleSearchExport.className = "cuali-btn-tool";
    btnToggleSearchExport.innerText = "🔍";
    btnToggleSearchExport.title = "Mostrar / Ocultar Buscador";
    btnToggleSearchExport.onclick = (e) => {
        e.preventDefault();
        searchExportInput.style.display = searchExportInput.style.display === "none" ? "block" : "none";
        if (searchExportInput.style.display === "block") searchExportInput.focus();
    };

    controlsExport.appendChild(btnGestionarExportacion);
    
    const sepExport1 = document.createElement("div");
    sepExport1.className = "cuali-toolbar-separator";
    controlsExport.appendChild(sepExport1);
    
    controlsExport.appendChild(btnToggleSearchExport);
    
    const sepExport2 = document.createElement("div");
    sepExport2.className = "cuali-toolbar-separator";
    controlsExport.appendChild(sepExport2);
    
    controlsExport.appendChild(btnExpandAll);
    controlsExport.appendChild(btnCollapseAll);
    
    const sepExport3 = document.createElement("div");
    sepExport3.className = "cuali-toolbar-separator";
    controlsExport.appendChild(sepExport3);
    
    controlsExport.appendChild(btnSelectAll);
    controlsExport.appendChild(btnDeselectAll);
    controlsExport.appendChild(btnSelectFiltered);

    const infoNoteExport = document.createElement("div");
    infoNoteExport.className = "cn-info-note";
    infoNoteExport.innerHTML = `ℹ️ <em>Códigos extraídos de los bloques de la página activa. Se detecta toda referencia <code>[[...]]</code> que contenga <code>/</code> en su nombre (indicando un namespace jerárquico).</em>`;

    const searchExportInput = document.createElement("input");
    searchExportInput.type = "text";
    searchExportInput.className = "cuali-search-input";
    searchExportInput.placeholder = "🔍 Filtrar códigos de la página activa...";
    searchExportInput.style.display = "none";
    
    const tableHeaderExport = document.createElement("div");
    tableHeaderExport.className = "cuali-table-header";
    tableHeaderExport.innerHTML = `
        <div class="col-header col-code" style="border-right: 1px solid rgba(147, 161, 161, 0.15); padding-right: 12px; box-sizing: border-box;">Código</div>
        <div class="col-header col-cites" style="padding-left: 12px; box-sizing: border-box;">Citas</div>
    `;
    
    const treeContainer = document.createElement("div");
    treeContainer.className = "cuali-list-box cuali-tree-container";
    
    searchExportInput.oninput = () => {
        filtrarArbolDOM(treeContainer, searchExportInput.value);
    };

    function renderTabExportacion(rebuild = true) {
        treeContainer.innerHTML = "";
        
        if (rebuild) {
            const blocks = obtenerBloquesDePagina(pageUid);
            const codeMap = procesarBloques(blocks);
            const codeMapWithObjects = {};
            for (const [code, uids] of Object.entries(codeMap)) {
                codeMapWithObjects[code] = uids.map(uid => ({ uid: uid, page: pageTitle }));
            }
            rootNode = construirArbolCodigos(codeMapWithObjects);
        }
        
        const rootUl = document.createElement("ul");
        rootUl.style.paddingLeft = "0";
        rootUl.style.margin = "0";
        
        if (rootNode && Object.keys(rootNode.children).length > 0) {
            const childNamesSorted = Object.keys(rootNode.children).sort();
            childNamesSorted.forEach(childName => {
                rootUl.appendChild(renderNodeHTML(rootNode.children[childName], true, 0));
            });
        } else {
            rootUl.innerHTML = "<li style='color: var(--sol-base1); padding: 10px;'>No hay códigos en la página activa.</li>";
        }
        
        treeContainer.appendChild(rootUl);
        
        if (searchExportInput.value) {
            filtrarArbolDOM(treeContainer, searchExportInput.value);
        }
    }
    
    renderTabExportacion(false);
    tabExportacion.appendChild(searchExportInput);
    tabExportacion.appendChild(tableHeaderExport);
    tabExportacion.appendChild(treeContainer);
    tabExportacion.appendChild(infoNoteExport);
    
    const exportButtons = document.createElement("div");
    exportButtons.className = "cuali-buttons";
    
    const btnClipboard = document.createElement("button");
    btnClipboard.className = "cuali-btn cuali-btn-clipboard";
    btnClipboard.innerText = "Copiar al portapapeles";
    btnClipboard.onclick = async (e) => {
        e.preventDefault();
        if (searchExportInput.value.trim() !== "") {
            seleccionarNodosFiltrados(treeContainer, searchExportInput.value, rootNode);
        }
        if (!rootNode || !nodoSeleccionadoOHijosSeleccionados(rootNode)) {
            mostrarNotificacion("Selecciona al menos un código.");
            return;
        }
        const clipboardText = generarTextoPortapapeles(rootNode, 0, numBloquesArriba, numBloquesAbajo, exportarTextoPlano);
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
        if (searchExportInput.value.trim() !== "") {
            seleccionarNodosFiltrados(treeContainer, searchExportInput.value, rootNode);
        }
        if (!rootNode || !nodoSeleccionadoOHijosSeleccionados(rootNode)) {
            mostrarNotificacion("Selecciona al menos un código.");
            return;
        }
        document.body.removeChild(overlay);
        await generarPaginaConsolidadaArbol(pageTitle, rootNode, numBloquesArriba, numBloquesAbajo, exportarTextoPlano);
    };

    exportButtons.appendChild(btnClipboard);
    exportButtons.appendChild(btnPage);
    
    const configSectionExport = crearSeccionConfiguracionExportacion();
    tabExportacion.appendChild(configSectionExport);
    tabExportacion.appendChild(exportButtons);

    // --- POPULATE TAB: CASOS ---
    const btnExpandCasos = document.createElement("button");
    btnExpandCasos.className = "cuali-btn-tool";
    btnExpandCasos.innerText = "⊞";
    btnExpandCasos.title = "Expandir todo";
    btnExpandCasos.onclick = (e) => {
        e.preventDefault();
        const uls = listCasosContainer.querySelectorAll("ul");
        uls.forEach(ul => ul.style.display = "block");
        const toggles = listCasosContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▼ ");
    };

    const btnCollapseCasos = document.createElement("button");
    btnCollapseCasos.className = "cuali-btn-tool";
    btnCollapseCasos.innerText = "⊟";
    btnCollapseCasos.title = "Colapsar todo";
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
    btnCasosSelectAll.innerText = "☑";
    btnCasosSelectAll.title = "Seleccionar todo";
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
    btnCasosDeselectAll.innerText = "☐";
    btnCasosDeselectAll.title = "Deseleccionar todo";
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

    const btnCasosSelectFiltered = document.createElement("button");
    btnCasosSelectFiltered.className = "cuali-btn-tool";
    btnCasosSelectFiltered.innerText = "☑*";
    btnCasosSelectFiltered.title = "Seleccionar filtrados";
    btnCasosSelectFiltered.onclick = (e) => {
        e.preventDefault();
        seleccionarNodosFiltrados(listCasosContainer, searchCasosInput.value, casosTreeRoot);
    };
    
    const btnGestionarCasos = document.createElement("button");
    btnGestionarCasos.className = "cuali-btn-tool";
    btnGestionarCasos.innerHTML = "🗑️ Gestionar";
    btnGestionarCasos.style.color = "#dc322f";
    btnGestionarCasos.style.borderColor = "rgba(220, 50, 47, 0.2)";
    btnGestionarCasos.onclick = (e) => {
        e.preventDefault();
        const nodos = recolectarNodosChecked(casosTreeRoot);
        mostrarModalGestion(nodos, "casos", () => {
            renderTabCasos();
            renderTabCodebook(true);
            renderTabCategorias();
        });
    };

    const btnToggleSearchCasos = document.createElement("button");
    btnToggleSearchCasos.className = "cuali-btn-tool";
    btnToggleSearchCasos.innerText = "🔍";
    btnToggleSearchCasos.title = "Mostrar / Ocultar Buscador";
    btnToggleSearchCasos.onclick = (e) => {
        e.preventDefault();
        searchCasosInput.style.display = searchCasosInput.style.display === "none" ? "block" : "none";
        if (searchCasosInput.style.display === "block") searchCasosInput.focus();
    };

    const btnRefreshCasos = document.createElement("button");
    btnRefreshCasos.className = "cuali-btn-tool";
    btnRefreshCasos.innerText = "🔄";
    btnRefreshCasos.title = "Refrescar Listas";
    btnRefreshCasos.onclick = (e) => {
        e.preventDefault();
        refrescarCachesGlobales();
        renderTabCasos();
        renderTabCodebook();
        renderTabCategorias();
        mostrarNotificacion("Listas refrescadas exitosamente.");
    };

    controlsCasos.appendChild(btnGestionarCasos);
    
    const sepCasos1 = document.createElement("div");
    sepCasos1.className = "cuali-toolbar-separator";
    controlsCasos.appendChild(sepCasos1);
    
    controlsCasos.appendChild(btnToggleSearchCasos);
    
    const sepCasos2 = document.createElement("div");
    sepCasos2.className = "cuali-toolbar-separator";
    controlsCasos.appendChild(sepCasos2);
    
    controlsCasos.appendChild(btnExpandCasos);
    controlsCasos.appendChild(btnCollapseCasos);
    
    const sepCasos3 = document.createElement("div");
    sepCasos3.className = "cuali-toolbar-separator";
    controlsCasos.appendChild(sepCasos3);
    
    controlsCasos.appendChild(btnCasosSelectAll);
    controlsCasos.appendChild(btnCasosDeselectAll);
    controlsCasos.appendChild(btnCasosSelectFiltered);
    
    const sepCasos4 = document.createElement("div");
    sepCasos4.className = "cuali-toolbar-separator";
    controlsCasos.appendChild(sepCasos4);
    
    controlsCasos.appendChild(btnRefreshCasos);

    const infoNoteCasos = document.createElement("div");
    infoNoteCasos.className = "cn-info-note";
    infoNoteCasos.innerHTML = `ℹ️ <em>Casos obtenidos de todas las páginas <code>${config.prefijoCasos}/[Nombre]</code> del grafo. Los códigos se extraen de las subpáginas <code>${config.prefijoCasos}/[Nombre]/${config.sufijoAnalisis}</code>.</em>`;
    
    const searchCasosInput = document.createElement("input");
    searchCasosInput.type = "text";
    searchCasosInput.className = "cuali-search-input";
    searchCasosInput.placeholder = "🔍 Filtrar casos por nombre o códigos...";
    searchCasosInput.style.display = "none";

    const tableHeaderCasos = document.createElement("div");
    tableHeaderCasos.className = "cuali-table-header";
    tableHeaderCasos.innerHTML = `
        <div class="col-header" style="width: 200px; flex-shrink: 0; border-right: 1px solid rgba(147, 161, 161, 0.15); padding-right: 12px; box-sizing: border-box;">Caso</div>
        <div class="col-header col-code" style="flex: 1; border-right: 1px solid rgba(147, 161, 161, 0.15); padding-left: 12px; padding-right: 12px; box-sizing: border-box;">Código</div>
        <div class="col-header col-cites" style="width: 100px; text-align: center; flex-shrink: 0; padding-left: 12px; box-sizing: border-box;">Citas</div>
    `;

    const listCasosContainer = document.createElement("div");
    listCasosContainer.className = "cuali-list-box cuali-tree-container";

    searchCasosInput.oninput = () => {
        filtrarArbolDOM(listCasosContainer, searchCasosInput.value);
    };
    
    tabCasos.appendChild(searchCasosInput);
    tabCasos.appendChild(tableHeaderCasos);
    tabCasos.appendChild(listCasosContainer);
    tabCasos.appendChild(infoNoteCasos);

    const casosButtons = document.createElement("div");
    casosButtons.className = "cuali-buttons";
    
    const btnCasosClipboard = document.createElement("button");
    btnCasosClipboard.className = "cuali-btn cuali-btn-clipboard";
    btnCasosClipboard.innerText = "Copiar al portapapeles";
    btnCasosClipboard.onclick = async (e) => {
        e.preventDefault();
        if (searchCasosInput.value.trim() !== "") {
            seleccionarNodosFiltrados(listCasosContainer, searchCasosInput.value, casosTreeRoot);
        }
        if (!casosTreeRoot || !nodoSeleccionadoOHijosSeleccionados(casosTreeRoot)) {
            mostrarNotificacion("Selecciona al menos un caso o código.");
            return;
        }
        const clipboardText = generarTextoPortapapeles(casosTreeRoot, 0, numBloquesArriba, numBloquesAbajo, exportarTextoPlano);
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
        if (searchCasosInput.value.trim() !== "") {
            seleccionarNodosFiltrados(listCasosContainer, searchCasosInput.value, casosTreeRoot);
        }
        if (!casosTreeRoot || !nodoSeleccionadoOHijosSeleccionados(casosTreeRoot)) {
            mostrarNotificacion("Selecciona al menos un caso o código.");
            return;
        }
        document.body.removeChild(overlay);
        await generarPaginaConsolidadaArbol("Casos Consolidados", casosTreeRoot, numBloquesArriba, numBloquesAbajo, exportarTextoPlano);
    };

    casosButtons.appendChild(btnCasosClipboard);
    casosButtons.appendChild(btnCasosPage);
    
    const configSectionCasos = crearSeccionConfiguracionExportacion();
    tabCasos.appendChild(configSectionCasos);
    tabCasos.appendChild(casosButtons);

    function fixCasosTreeFullNames(node, isRoot = true) {
        if (isRoot) {
            for (const childName in node.children) {
                const caseNode = node.children[childName];
                caseNode.fullName = config.prefijoCasos + "/" + caseNode.name;
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
        ["dom", "dim", "cat", "cod"].forEach(key => {
            todosLosTitulos.push(...cb[key]);
        });
        const codeMapGlobal = obtenerReferenciasDeCodigos(todosLosTitulos);

        const caseCodeMap = {};
        const casos = obtenerCasosGlobal();
        
        if (casos.length === 0) {
            listCasosContainer.innerHTML = `<div class='cuali-list-item' style='color: var(--sol-base1);'>No se encontraron casos (páginas que inician con ${config.prefijoCasos}/)</div>`;
            return;
        }

        const casePrefixLower = config.prefijoCasos.toLowerCase() + "/";
        casos.forEach(caso => {
            const caseName = caso.toLowerCase().startsWith(casePrefixLower) ? caso.substring(casePrefixLower.length) : caso;
            caseCodeMap[caseName] = []; 
        });

        for (const [codePath, cites] of Object.entries(codeMapGlobal)) {
            cites.forEach(cite => {
                const pageParts = (cite.page || "").split('/');
                if (pageParts.length >= 2 && pageParts[0].toLowerCase() === config.prefijoCasos.toLowerCase()) {
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
                rootUl.appendChild(renderCasoNodeHTML(casosTreeRoot.children[childName], true, 0));
            });
        } else {
            rootUl.innerHTML = "<li style='color: var(--sol-base1); padding: 10px;'>No hay códigos asociados a los casos.</li>";
        }
        
        listCasosContainer.appendChild(rootUl);

        if (searchCasosInput.value) {
            filtrarArbolDOM(listCasosContainer, searchCasosInput.value);
        }
    }

    // --- POPULATE TAB: CODEBOOK ---
    const btnExpandCodebook = document.createElement("button");
    btnExpandCodebook.className = "cuali-btn-tool";
    btnExpandCodebook.innerText = "⊞";
    btnExpandCodebook.title = "Expandir todo";
    btnExpandCodebook.onclick = (e) => {
        e.preventDefault();
        const uls = listCodebookContainer.querySelectorAll("ul");
        uls.forEach(ul => ul.style.display = "block");
        const toggles = listCodebookContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▼ ");
    };

    const btnCollapseCodebook = document.createElement("button");
    btnCollapseCodebook.className = "cuali-btn-tool";
    btnCollapseCodebook.innerText = "⊟";
    btnCollapseCodebook.title = "Colapsar todo";
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
    btnCodebookSelectAll.innerText = "☑";
    btnCodebookSelectAll.title = "Seleccionar todo";
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
    btnCodebookDeselectAll.innerText = "☐";
    btnCodebookDeselectAll.title = "Deseleccionar todo";
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

    const btnCodebookSelectFiltered = document.createElement("button");
    btnCodebookSelectFiltered.className = "cuali-btn-tool";
    btnCodebookSelectFiltered.innerText = "☑*";
    btnCodebookSelectFiltered.title = "Seleccionar filtrados";
    btnCodebookSelectFiltered.onclick = (e) => {
        e.preventDefault();
        seleccionarNodosFiltrados(listCodebookContainer, searchCodebookInput.value, codebookTreeRoot);
    };

    const btnGestionarCodebook = document.createElement("button");
    btnGestionarCodebook.className = "cuali-btn-tool";
    btnGestionarCodebook.innerHTML = "🗑️ Gestionar";
    btnGestionarCodebook.style.color = "#dc322f";
    btnGestionarCodebook.style.borderColor = "rgba(220, 50, 47, 0.2)";
    btnGestionarCodebook.onclick = (e) => {
        e.preventDefault();
        const nodos = recolectarNodosChecked(codebookTreeRoot);
        mostrarModalGestion(nodos, "codebook", () => {
            renderTabCodebook(true);
            renderTabCasos();
            renderTabCategorias();
        });
    };

    smartGroupingContainer = document.createElement("label");
    smartGroupingContainer.style.display = "flex";
    smartGroupingContainer.style.alignItems = "center";
    smartGroupingContainer.style.gap = "4px";
    smartGroupingContainer.style.fontSize = "12px";
    smartGroupingContainer.style.cursor = "pointer";
    smartGroupingContainer.style.marginLeft = "12px";
    smartGroupingContainer.style.color = "var(--sol-base1)";
    smartGroupingContainer.title = "No duplicar códigos compartidos por múltiples fuentes (mantenerlos al nivel del padre)";

    const chkSmartGrouping = document.createElement("input");
    chkSmartGrouping.type = "checkbox";
    chkSmartGrouping.id = "cuali-smart-grouping";
    chkSmartGrouping.style.cursor = "pointer";
    chkSmartGrouping.onchange = () => {
        noDuplicarCompartidos = chkSmartGrouping.checked;
        if (arbolPivotado && codebookTreeRoot && codebookTreeRoot.originalState) {
            codebookTreeRoot = cloneSubtree(codebookTreeRoot.originalState);
            const levelVal = selectPivotLevel.value;
            if (levelVal === "auto") {
                for (const childName in codebookTreeRoot.children) {
                    const child = codebookTreeRoot.children[childName];
                    child.originalState = codebookTreeRoot.originalState.children[childName];
                    pivotNode(child, true);
                }
            } else {
                const depth = parseInt(levelVal, 10);
                pivotAtDepth(codebookTreeRoot, depth, 0, noDuplicarCompartidos);
            }
            renderTabCodebook(false);
        }
    };
    
    smartGroupingContainer.appendChild(chkSmartGrouping);
    smartGroupingContainer.appendChild(document.createTextNode("No duplicar"));

    // Selector de nivel de pivote (Profundidad)
    const lblPivotLevel = document.createElement("span");
    lblPivotLevel.innerText = "Nivel:";
    lblPivotLevel.style.marginLeft = "12px";
    lblPivotLevel.style.fontSize = "12px";
    lblPivotLevel.style.color = "var(--sol-base1)";

    const selectPivotLevel = document.createElement("select");
    selectPivotLevel.id = "cuali-pivot-level";
    selectPivotLevel.style.marginLeft = "6px";
    selectPivotLevel.style.padding = "2px 6px";
    selectPivotLevel.style.borderRadius = "4px";
    selectPivotLevel.style.border = "1px solid var(--sol-base2)";
    selectPivotLevel.style.backgroundColor = "var(--sol-base3)";
    selectPivotLevel.style.color = "var(--sol-base00)";
    selectPivotLevel.style.fontSize = "12px";
    selectPivotLevel.style.cursor = "pointer";
    
    const options = [
        { value: "1", text: "Nivel 1" },
        { value: "2", text: "Nivel 2" },
        { value: "3", text: "Nivel 3" },
        { value: "4", text: "Nivel 4" },
        { value: "auto", text: "Automático (Todos)" }
    ];
    
    options.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.text = opt.text;
        selectPivotLevel.appendChild(option);
    });

    selectPivotLevel.onchange = () => {
        if (arbolPivotado && codebookTreeRoot && codebookTreeRoot.originalState) {
            codebookTreeRoot = cloneSubtree(codebookTreeRoot.originalState);
            const levelVal = selectPivotLevel.value;
            if (levelVal === "auto") {
                for (const childName in codebookTreeRoot.children) {
                    const child = codebookTreeRoot.children[childName];
                    child.originalState = codebookTreeRoot.originalState.children[childName];
                    pivotNode(child, true);
                }
            } else {
                const depth = parseInt(levelVal, 10);
                pivotAtDepth(codebookTreeRoot, depth, 0, noDuplicarCompartidos);
            }
            renderTabCodebook(false);
        }
    };

    // Botón para agrupar globalmente por fuentes (Pivote Global)
    const btnPivotGlobal = document.createElement("button");
    btnPivotGlobal.className = "cuali-btn-tool";
    btnPivotGlobal.style.marginLeft = "12px";
    btnPivotGlobal.style.fontWeight = "500";
    btnPivotGlobal.innerHTML = "🗂️ Agrupar";
    btnPivotGlobal.title = "Agrupar todo el árbol de códigos bajo sus respectivas fuentes";
    btnPivotGlobal.onclick = (e) => {
        e.preventDefault();
        arbolPivotado = !arbolPivotado;
        if (arbolPivotado) {
            btnPivotGlobal.innerHTML = "📋 Restaurar";
            btnPivotGlobal.style.backgroundColor = "var(--sol-blue)";
            btnPivotGlobal.style.color = "white";
            
            if (codebookTreeRoot) {
                codebookTreeRoot.originalState = cloneSubtree(codebookTreeRoot);
                const levelVal = selectPivotLevel.value;
                if (levelVal === "auto") {
                    for (const childName in codebookTreeRoot.children) {
                        const child = codebookTreeRoot.children[childName];
                        child.originalState = codebookTreeRoot.originalState.children[childName];
                        pivotNode(child, true);
                    }
                } else {
                    const depth = parseInt(levelVal, 10);
                    pivotAtDepth(codebookTreeRoot, depth, 0, noDuplicarCompartidos);
                }
            }
            renderTabCodebook(false);
        } else {
            btnPivotGlobal.innerHTML = "🗂️ Agrupar";
            btnPivotGlobal.style.backgroundColor = "";
            btnPivotGlobal.style.color = "";
            
            if (codebookTreeRoot && codebookTreeRoot.originalState) {
                codebookTreeRoot = cloneSubtree(codebookTreeRoot.originalState);
            }
            renderTabCodebook(false);
        }
    };

    const btnToggleSearchCodebook = document.createElement("button");
    btnToggleSearchCodebook.className = "cuali-btn-tool";
    btnToggleSearchCodebook.innerText = "🔍";
    btnToggleSearchCodebook.title = "Mostrar / Ocultar Buscador";
    btnToggleSearchCodebook.onclick = (e) => {
        e.preventDefault();
        searchCodebookInput.style.display = searchCodebookInput.style.display === "none" ? "block" : "none";
        if (searchCodebookInput.style.display === "block") searchCodebookInput.focus();
    };

    const btnRefreshCodebook = document.createElement("button");
    btnRefreshCodebook.className = "cuali-btn-tool";
    btnRefreshCodebook.innerText = "🔄";
    btnRefreshCodebook.title = "Refrescar Listas";
    btnRefreshCodebook.onclick = btnRefreshCasos.onclick;

    controlsCodebook.appendChild(btnGestionarCodebook);
    controlsCodebook.appendChild(btnPivotGlobal);
    controlsCodebook.appendChild(smartGroupingContainer);
    controlsCodebook.appendChild(lblPivotLevel);
    controlsCodebook.appendChild(selectPivotLevel);
    
    const sepCB1 = document.createElement("div");
    sepCB1.className = "cuali-toolbar-separator";
    controlsCodebook.appendChild(sepCB1);
    
    controlsCodebook.appendChild(btnToggleSearchCodebook);
    
    const sepCB2 = document.createElement("div");
    sepCB2.className = "cuali-toolbar-separator";
    controlsCodebook.appendChild(sepCB2);
    
    controlsCodebook.appendChild(btnExpandCodebook);
    controlsCodebook.appendChild(btnCollapseCodebook);
    
    const sepCB3 = document.createElement("div");
    sepCB3.className = "cuali-toolbar-separator";
    controlsCodebook.appendChild(sepCB3);
    
    controlsCodebook.appendChild(btnCodebookSelectAll);
    controlsCodebook.appendChild(btnCodebookDeselectAll);
    controlsCodebook.appendChild(btnCodebookSelectFiltered);
    
    const sepCB4 = document.createElement("div");
    sepCB4.className = "cuali-toolbar-separator";
    controlsCodebook.appendChild(sepCB4);
    
    controlsCodebook.appendChild(btnRefreshCodebook);
    
    const searchCodebookInput = document.createElement("input");
    searchCodebookInput.type = "text";
    searchCodebookInput.className = "cuali-search-input";
    searchCodebookInput.placeholder = "🔍 Filtrar codebook por nombre o nivel jerárquico...";
    searchCodebookInput.style.display = "none";

    const tableHeaderCodebook = document.createElement("div");
    tableHeaderCodebook.className = "cuali-table-header";
    tableHeaderCodebook.innerHTML = `
        <div class="col-header col-code" style="border-right: 1px solid rgba(147, 161, 161, 0.15); padding-right: 12px; box-sizing: border-box;">Código</div>
        <div class="col-header col-cites" style="border-right: 1px solid rgba(147, 161, 161, 0.15); padding-left: 12px; padding-right: 12px; box-sizing: border-box;">Citas</div>
        <div class="col-header col-sources" style="padding-left: 12px; box-sizing: border-box;">Fuentes</div>
    `;

    const listCodebookContainer = document.createElement("div");
    listCodebookContainer.className = "cuali-list-box cuali-tree-container";

    searchCodebookInput.oninput = () => {
        filtrarArbolDOM(listCodebookContainer, searchCodebookInput.value);
    };

    const infoNoteCodebook = document.createElement("div");
    infoNoteCodebook.className = "cn-info-note";
    infoNoteCodebook.innerHTML = `ℹ️ <em>Codebook global construido a partir de las páginas del grafo con prefijos cualitativos reconocidos: <code>dom/</code>, <code>dim/</code>, <code>cat/</code> y <code>cod/</code>. Las citas se contabilizan únicamente desde páginas de transcripción (<code>${config.prefijoCasos}/.../${config.sufijoAnalisis}</code>).</em>`;

    tabCodebook.appendChild(searchCodebookInput);
    tabCodebook.appendChild(tableHeaderCodebook);
    tabCodebook.appendChild(listCodebookContainer);
    tabCodebook.appendChild(infoNoteCodebook);

    const codebookButtons = document.createElement("div");
    codebookButtons.className = "cuali-buttons";
    
    const btnCodebookClipboard = document.createElement("button");
    btnCodebookClipboard.className = "cuali-btn cuali-btn-clipboard";
    btnCodebookClipboard.innerText = "Copiar al portapapeles";
    btnCodebookClipboard.onclick = async (e) => {
        e.preventDefault();
        if (searchCodebookInput.value.trim() !== "") {
            seleccionarNodosFiltrados(listCodebookContainer, searchCodebookInput.value, codebookTreeRoot);
        }
        if (!codebookTreeRoot || !nodoSeleccionadoOHijosSeleccionados(codebookTreeRoot)) {
            mostrarNotificacion("Selecciona al menos un código.");
            return;
        }
        const clipboardText = generarTextoPortapapeles(codebookTreeRoot, 0, numBloquesArriba, numBloquesAbajo, exportarTextoPlano);
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
        if (searchCodebookInput.value.trim() !== "") {
            seleccionarNodosFiltrados(listCodebookContainer, searchCodebookInput.value, codebookTreeRoot);
        }
        if (!codebookTreeRoot || !nodoSeleccionadoOHijosSeleccionados(codebookTreeRoot)) {
            mostrarNotificacion("Selecciona al menos un código.");
            return;
        }
        document.body.removeChild(overlay);
        await generarPaginaConsolidadaArbol("Codebook Global", codebookTreeRoot, numBloquesArriba, numBloquesAbajo, exportarTextoPlano);
    };

    codebookButtons.appendChild(btnCodebookClipboard);
    codebookButtons.appendChild(btnCodebookPage);
    
    const configSectionCodebook = crearSeccionConfiguracionExportacion();
    tabCodebook.appendChild(configSectionCodebook);
    tabCodebook.appendChild(codebookButtons);

    // --- POPULATE TAB: MEMOS ---
    const btnExpandMemos = document.createElement("button");
    btnExpandMemos.className = "cuali-btn-tool";
    btnExpandMemos.innerText = "⊞";
    btnExpandMemos.title = "Expandir todo";
    btnExpandMemos.onclick = (e) => {
        e.preventDefault();
        const uls = listMemosContainer.querySelectorAll("ul");
        uls.forEach(ul => ul.style.display = "block");
        const toggles = listMemosContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▼ ");
    };

    const btnCollapseMemos = document.createElement("button");
    btnCollapseMemos.className = "cuali-btn-tool";
    btnCollapseMemos.innerText = "⊟";
    btnCollapseMemos.title = "Colapsar todo";
    btnCollapseMemos.onclick = (e) => {
        e.preventDefault();
        const uls = listMemosContainer.querySelectorAll("ul");
        uls.forEach(ul => {
            if (ul !== listMemosContainer.querySelector("ul")) {
                ul.style.display = "none";
            }
        });
        const toggles = listMemosContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▶ ");
    };

    const btnToggleSearchMemos = document.createElement("button");
    btnToggleSearchMemos.className = "cuali-btn-tool";
    btnToggleSearchMemos.innerText = "🔍";
    btnToggleSearchMemos.title = "Buscar memo";
    btnToggleSearchMemos.onclick = (e) => {
        e.preventDefault();
        if (searchMemosInput.style.display === "none") {
            searchMemosInput.style.display = "block";
            btnToggleSearchMemos.classList.add("active");
            searchMemosInput.focus();
        } else {
            searchMemosInput.style.display = "none";
            searchMemosInput.value = "";
            filtrarArbolDOM(listMemosContainer, "");
            btnToggleSearchMemos.classList.remove("active");
        }
    };

    const btnRefreshMemos = document.createElement("button");
    btnRefreshMemos.className = "cuali-btn-tool";
    btnRefreshMemos.innerText = "🔄";
    btnRefreshMemos.title = "Refrescar Memos";
    btnRefreshMemos.onclick = (e) => {
        e.preventDefault();
        refrescarCachesGlobales();
        renderTabMemos();
    };

    controlsMemos.appendChild(btnExpandMemos);
    controlsMemos.appendChild(btnCollapseMemos);
    
    const sepM1 = document.createElement("div");
    sepM1.className = "cuali-toolbar-separator";
    controlsMemos.appendChild(sepM1);
    
    controlsMemos.appendChild(btnToggleSearchMemos);
    
    const sepM2 = document.createElement("div");
    sepM2.className = "cuali-toolbar-separator";
    controlsMemos.appendChild(sepM2);
    
    controlsMemos.appendChild(btnRefreshMemos);

    const searchMemosInput = document.createElement("input");
    searchMemosInput.type = "text";
    searchMemosInput.className = "cuali-search-input";
    searchMemosInput.placeholder = "🔍 Filtrar memos por nombre o nivel jerárquico...";
    searchMemosInput.style.display = "none";
    searchMemosInput.oninput = () => {
        filtrarArbolDOM(listMemosContainer, searchMemosInput.value);
    };

    const tableHeaderMemos = document.createElement("div");
    tableHeaderMemos.className = "cuali-table-header";
    tableHeaderMemos.innerHTML = `
        <div class="col-header col-memo" style="padding-right: 12px; box-sizing: border-box;">Memo</div>
        <div class="col-header col-preview" style="padding-left: 12px; padding-right: 12px; box-sizing: border-box;">Preview</div>
        <div class="col-header col-links" style="padding-left: 12px; box-sizing: border-box;">Códigos Vinculados</div>
    `;

    const listMemosContainer = document.createElement("div");
    listMemosContainer.className = "cuali-list-box cuali-tree-container";

    const infoNoteMemos = document.createElement("div");
    infoNoteMemos.className = "cn-info-note";
    infoNoteMemos.innerHTML = `ℹ️ <em>Memos del investigador (<code>memo/</code>). Las reflexiones se organizan por su jerarquía de namespace. El preview muestra los primeros bloques de texto y vincula códigos referenciados.</em>`;

    tabMemos.appendChild(searchMemosInput);
    tabMemos.appendChild(tableHeaderMemos);
    tabMemos.appendChild(listMemosContainer);
    tabMemos.appendChild(infoNoteMemos);

    // --- POPULATE TAB: CATEGORIAS ---
    const btnExpandCategorias = document.createElement("button");
    btnExpandCategorias.className = "cuali-btn-tool";
    btnExpandCategorias.innerText = "⊞";
    btnExpandCategorias.title = "Expandir todo";
    btnExpandCategorias.onclick = (e) => {
        e.preventDefault();
        const uls = listCategoriasContainer.querySelectorAll("ul");
        uls.forEach(ul => ul.style.display = "block");
        const toggles = listCategoriasContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▼ ");
    };

    const btnCollapseCategorias = document.createElement("button");
    btnCollapseCategorias.className = "cuali-btn-tool";
    btnCollapseCategorias.innerText = "⊟";
    btnCollapseCategorias.title = "Colapsar todo";
    btnCollapseCategorias.onclick = (e) => {
        e.preventDefault();
        const uls = listCategoriasContainer.querySelectorAll("ul");
        uls.forEach(ul => {
            if (ul !== listCategoriasContainer.querySelector("ul")) {
                ul.style.display = "none";
            }
        });
        const toggles = listCategoriasContainer.querySelectorAll(".tree-toggle");
        toggles.forEach(toggle => toggle.innerText = "▶ ");
    };

    const btnSelectAllCat = document.createElement("button");
    btnSelectAllCat.className = "cuali-btn-tool";
    btnSelectAllCat.innerText = "☑";
    btnSelectAllCat.title = "Seleccionar todo";
    btnSelectAllCat.onclick = (e) => {
        e.preventDefault();
        // Check if there is an active search filter in Categorías tab
        const searchInput = tabCategorias.querySelector('.cuali-search-input');
        if (searchInput && searchInput.value.trim() !== "" && searchInput.style.display !== "none") {
            seleccionarNodosFiltrados(listCategoriasContainer, searchInput.value, categoriasTreeRoot);
        } else {
            if (categoriasTreeRoot) {
                updateNodeCheckedState(categoriasTreeRoot, true);
                const checkboxes = listCategoriasContainer.querySelectorAll("input[type='checkbox']");
                checkboxes.forEach(cb => {
                    cb.checked = true;
                    cb.indeterminate = false;
                });
            }
        }
    };

    const btnDeselectAllCat = document.createElement("button");
    btnDeselectAllCat.className = "cuali-btn-tool";
    btnDeselectAllCat.innerText = "☐";
    btnDeselectAllCat.title = "Deseleccionar todo";
    btnDeselectAllCat.onclick = (e) => {
        e.preventDefault();
        if (categoriasTreeRoot) {
            updateNodeCheckedState(categoriasTreeRoot, false);
            const checkboxes = listCategoriasContainer.querySelectorAll("input[type='checkbox']");
            checkboxes.forEach(cb => {
                cb.checked = false;
                cb.indeterminate = false;
            });
        }
    };

    const btnRefreshCategorias = document.createElement("button");
    btnRefreshCategorias.className = "cuali-btn-tool";
    btnRefreshCategorias.innerText = "🔄";
    btnRefreshCategorias.title = "Refrescar Categorías";
    btnRefreshCategorias.onclick = (e) => {
        e.preventDefault();
        refrescarCachesGlobales();
        renderTabCategorias();
    };

    controlsCategorias.appendChild(btnExpandCategorias);
    controlsCategorias.appendChild(btnCollapseCategorias);
    
    const sepC1 = document.createElement("div");
    sepC1.className = "cuali-toolbar-separator";
    controlsCategorias.appendChild(sepC1);
    
    controlsCategorias.appendChild(btnSelectAllCat);
    controlsCategorias.appendChild(btnDeselectAllCat);
    
    const sepC3 = document.createElement("div");
    sepC3.className = "cuali-toolbar-separator";
    controlsCategorias.appendChild(sepC3);
    
    controlsCategorias.appendChild(btnRefreshCategorias);

    const searchCategoriasInput = document.createElement("input");
    searchCategoriasInput.type = "text";
    searchCategoriasInput.className = "cuali-search-input";
    searchCategoriasInput.placeholder = "🔍 Filtrar categorías o códigos por nombre...";
    searchCategoriasInput.style.display = "block";
    searchCategoriasInput.oninput = () => {
        filtrarArbolDOM(listCategoriasContainer, searchCategoriasInput.value);
    };

    const tableHeaderCategorias = document.createElement("div");
    tableHeaderCategorias.className = "cuali-table-header";
    tableHeaderCategorias.innerHTML = `
        <div class="col-header col-cat-name" style="border-right: 1px solid rgba(147, 161, 161, 0.15); padding-right: 12px; box-sizing: border-box; justify-content: space-between;">
            <span>Categoría / Código</span>
            <button id="btn-header-nueva-cat" class="cuali-btn-tool" style="padding: 2px 6px; font-size: 11px; color: var(--sol-blue); border-color: rgba(38, 139, 210, 0.2);" title="Crear nueva categoría analítica">➕</button>
        </div>
        <div class="col-header col-cat-codes" style="border-right: 1px solid rgba(147, 161, 161, 0.15); padding-left: 12px; padding-right: 12px; box-sizing: border-box;">Códigos</div>
        <div class="col-header col-cat-cites" style="border-right: 1px solid rgba(147, 161, 161, 0.15); padding-left: 12px; padding-right: 12px; box-sizing: border-box;">Citas</div>
        <div class="col-header col-cat-sources" style="padding-left: 12px; box-sizing: border-box;">Fuentes</div>
    `;

    const btnHeaderNuevaCat = tableHeaderCategorias.querySelector("#btn-header-nueva-cat");
    btnHeaderNuevaCat.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        cualiCustomPrompt("Nombre de la nueva categoría analítica:", async (nombre) => {
            if (nombre && nombre.trim()) {
                const currentCategories = leerCategoriasDesdeRoam();
                const normalized = nombre.trim();
                if (currentCategories[normalized]) {
                    mostrarNotificacion("Ya existe una categoría con ese nombre.");
                    return;
                }
                await crearCategoriaRoam(normalized);
                mostrarNotificacion("Categoría creada.");
                refrescarCachesGlobales();
                renderTabCategorias();
            }
        });
    };

    const listCategoriasContainer = document.createElement("div");
    listCategoriasContainer.className = "cuali-list-box cuali-tree-container";

    const infoNoteCategorias = document.createElement("div");
    infoNoteCategorias.className = "cn-info-note";
    infoNoteCategorias.innerHTML = `ℹ️ <em>Categorías analíticas. Cada categoría se guarda como una página en Roam (ej: <code>[[categoría/Mi Categoría]]</code>) y sus códigos asociados como referencias dentro de ella. Esto te permite editar y gestionar tus categorías directamente en tu grafo de Roam.</em>`;
    
    const buttonsCategorias = document.createElement("div");
    buttonsCategorias.className = "cuali-buttons";
    buttonsCategorias.style.display = "flex";
    buttonsCategorias.style.gap = "8px";
    buttonsCategorias.style.marginTop = "8px";

    const btnCategoriasClipboard = document.createElement("button");
    btnCategoriasClipboard.className = "cuali-btn cuali-btn-primary";
    btnCategoriasClipboard.innerText = "📋 Copiar citas seleccionadas";
    btnCategoriasClipboard.onclick = async (e) => {
        e.preventDefault();
        if (searchCategoriasInput.value.trim() !== "") {
            seleccionarNodosFiltrados(listCategoriasContainer, searchCategoriasInput.value, categoriasTreeRoot);
        }
        if (!categoriasTreeRoot || !nodoSeleccionadoOHijosSeleccionados(categoriasTreeRoot)) {
            mostrarNotificacion("Selecciona al menos un código o categoría.");
            return;
        }
        const clipboardText = generarTextoPortapapeles(categoriasTreeRoot, 0, 
            0,
            0,
            false
        );
        await navigator.clipboard.writeText(clipboardText.trim());
        mostrarNotificacion("Citas copiadas en formato árbol por categorías.");
    };

    const btnCategoriasPage = document.createElement("button");
    btnCategoriasPage.className = "cuali-btn cuali-btn-primary";
    btnCategoriasPage.innerText = "📄 Crear página consolidada";
    btnCategoriasPage.onclick = async (e) => {
        e.preventDefault();
        if (searchCategoriasInput.value.trim() !== "") {
            seleccionarNodosFiltrados(listCategoriasContainer, searchCategoriasInput.value, categoriasTreeRoot);
        }
        if (!categoriasTreeRoot || !nodoSeleccionadoOHijosSeleccionados(categoriasTreeRoot)) {
            mostrarNotificacion("Selecciona al menos un código o categoría.");
            return;
        }
        document.body.removeChild(overlay);
        await generarPaginaConsolidadaArbol("Categorías Analíticas", categoriasTreeRoot,
            0,
            0,
            false
        );
    };

    function obtenerNodosSeleccionadosEnCategorias(treeNode, parentNode = null, result = { categorias: [], codesByCat: {} }) {
        if (!treeNode) return result;
        
        if (treeNode.checked && treeNode.name !== "root") {
            const isCategory = parentNode && parentNode.name === "root" && treeNode.name !== "__sin_categorizar__";
            if (isCategory) {
                result.categorias.push(treeNode);
            } else if (treeNode.fullName && treeNode.fullName.startsWith("cod/")) {
                const parentUid = parentNode ? parentNode.uid : null;
                const parentName = parentNode ? parentNode.name : null;
                if (!result.codesByCat[parentName]) {
                    result.codesByCat[parentName] = {
                        uid: parentUid,
                        node: parentNode,
                        codes: []
                    };
                }
                result.codesByCat[parentName].codes.push(treeNode.fullName);
            }
        }
        
        for (const childName in treeNode.children) {
            obtenerNodosSeleccionadosEnCategorias(treeNode.children[childName], treeNode, result);
        }
        
        return result;
    }

    const btnVincular = document.createElement("button");
    btnVincular.className = "cuali-btn";
    btnVincular.style.color = "var(--sol-blue)";
    btnVincular.style.borderColor = "rgba(38, 139, 210, 0.4)";
    btnVincular.innerText = "🔗 Vincular seleccionados";
    btnVincular.onclick = async (e) => {
        e.preventDefault();
        const sel = obtenerNodosSeleccionadosEnCategorias(categoriasTreeRoot);
        
        if (sel.categorias.length !== 1) {
            mostrarNotificacion("Selecciona exactamente 1 categoría para vincular.");
            return;
        }
        
        const targetCategory = sel.categorias[0];
        const codesToLink = [];
        for (const catName in sel.codesByCat) {
            codesToLink.push(...sel.codesByCat[catName].codes);
        }
        
        if (codesToLink.length === 0) {
            mostrarNotificacion("Selecciona al menos 1 código para vincular.");
            return;
        }
        
        btnVincular.disabled = true;
        btnVincular.innerText = "Vinculando...";
        try {
            await vincularCodigosACategoria(targetCategory.uid, codesToLink);
            mostrarNotificacion(`Códigos vinculados a "${targetCategory.name}".`);
            refrescarCachesGlobales();
            renderTabCategorias();
        } catch (err) {
            console.error(err);
            mostrarNotificacion("Error al vincular códigos.");
        } finally {
            btnVincular.disabled = false;
            btnVincular.innerText = "🔗 Vincular seleccionados";
        }
    };

    const btnDesvincular = document.createElement("button");
    btnDesvincular.className = "cuali-btn";
    btnDesvincular.style.color = "var(--sol-orange)";
    btnDesvincular.style.borderColor = "rgba(203, 75, 22, 0.4)";
    btnDesvincular.innerText = "✂️ Desvincular seleccionados";
    btnDesvincular.onclick = async (e) => {
        e.preventDefault();
        const sel = obtenerNodosSeleccionadosEnCategorias(categoriasTreeRoot);
        
        let totalDesvinculados = 0;
        btnDesvincular.disabled = true;
        btnDesvincular.innerText = "Desvinculando...";
        try {
            for (const catName in sel.codesByCat) {
                if (catName === "__sin_categorizar__" || !sel.codesByCat[catName].uid) {
                    continue;
                }
                const catUid = sel.codesByCat[catName].uid;
                const codesToRemove = sel.codesByCat[catName].codes;
                
                if (codesToRemove.length > 0) {
                    await desvincularCodigosDeCategoria(catUid, codesToRemove);
                    totalDesvinculados += codesToRemove.length;
                }
            }
            
            if (totalDesvinculados === 0) {
                mostrarNotificacion("Selecciona códigos dentro de categorías para desvincular.");
                btnDesvincular.disabled = false;
                btnDesvincular.innerText = "✂️ Desvincular seleccionados";
                return;
            }
            
            mostrarNotificacion("Códigos desvinculados.");
            refrescarCachesGlobales();
            renderTabCategorias();
        } catch (err) {
            console.error(err);
            mostrarNotificacion("Error al desvincular.");
        } finally {
            btnDesvincular.disabled = false;
            btnDesvincular.innerText = "✂️ Desvincular seleccionados";
        }
    };

    buttonsCategorias.appendChild(btnCategoriasClipboard);
    buttonsCategorias.appendChild(btnCategoriasPage);
    buttonsCategorias.appendChild(btnVincular);
    buttonsCategorias.appendChild(btnDesvincular);

    tabCategorias.appendChild(searchCategoriasInput);
    tabCategorias.appendChild(tableHeaderCategorias);
    tabCategorias.appendChild(listCategoriasContainer);
    tabCategorias.appendChild(infoNoteCategorias);
    tabCategorias.appendChild(buttonsCategorias);

    let categoriasTreeRoot = null;

    function renderTabCategorias() {
        listCategoriasContainer.innerHTML = "";
        
        const categoriasMap = leerCategoriasDesdeRoam();
        const cb = obtenerCodebookGlobal();
        const codTitles = cb["cod"] || [];
        const codeRefsMap = obtenerReferenciasDeCodigos(codTitles);
        
        categoriasTreeRoot = construirArbolCategorias(categoriasMap, codeRefsMap);
        
        const rootUl = document.createElement("ul");
        rootUl.style.paddingLeft = "0";
        rootUl.style.margin = "0";
        
        if (categoriasTreeRoot && Object.keys(categoriasTreeRoot.children).length > 0) {
            const childNamesSorted = Object.keys(categoriasTreeRoot.children).sort();
            
            childNamesSorted.forEach(childName => {
                if (childName === "__sin_categorizar__") return;
                rootUl.appendChild(renderCategoryNodeHTML(categoriasTreeRoot.children[childName], 0));
            });
            
            if (categoriasTreeRoot.children["__sin_categorizar__"]) {
                const sepLi = document.createElement("li");
                sepLi.className = "cuali-uncategorized-separator";
                sepLi.style.listStyleType = "none";
                rootUl.appendChild(sepLi);
                
                rootUl.appendChild(renderCategoryNodeHTML(categoriasTreeRoot.children["__sin_categorizar__"], 0));
            }
        } else {
            const emptyLi = document.createElement("li");
            emptyLi.style.cssText = "color: var(--sol-base1); padding: 10px; list-style-type: none; display: flex; align-items: center; gap: 10px;";
            emptyLi.innerHTML = `No hay categorías analíticas. <button class="cuali-btn cuali-btn-primary" style="padding: 4px 8px;">➕ Crear primera categoría</button>`;
            emptyLi.querySelector("button").onclick = (e) => btnHeaderNuevaCat.click();
            rootUl.appendChild(emptyLi);
        }
        
        listCategoriasContainer.appendChild(rootUl);
        
        if (searchCategoriasInput.value) {
            filtrarArbolDOM(listCategoriasContainer, searchCategoriasInput.value);
        }
    }



    let memosTreeRoot = null;

    function renderTabCodebook(rebuild = true) {
        listCodebookContainer.innerHTML = "";
        
        if (rebuild || !codebookTreeRoot) {
            const cb = obtenerCodebookGlobal();
            const todosLosTitulos = [];
            ["dom", "dim", "cat", "cod"].forEach(key => {
                todosLosTitulos.push(...cb[key]);
            });
            const codeMapGlobal = obtenerReferenciasDeCodigos(todosLosTitulos);
            
            codebookTreeRoot = construirArbolCodigos(codeMapGlobal);
            
            if (arbolPivotado) {
                codebookTreeRoot.originalState = cloneSubtree(codebookTreeRoot);
                const levelVal = selectPivotLevel.value;
                if (levelVal === "auto") {
                    for (const childName in codebookTreeRoot.children) {
                        const child = codebookTreeRoot.children[childName];
                        child.originalState = codebookTreeRoot.originalState.children[childName];
                        pivotNode(child, true);
                    }
                } else {
                    const depth = parseInt(levelVal, 10);
                    pivotAtDepth(codebookTreeRoot, depth, 0, noDuplicarCompartidos);
                }
            }
        }
        
        const rootUl = document.createElement("ul");
        rootUl.style.paddingLeft = "0";
        rootUl.style.margin = "0";

        tableHeaderCodebook.innerHTML = `
            <div class="col-header col-code" style="border-right: 1px solid rgba(147, 161, 161, 0.15); padding-right: 12px; box-sizing: border-box;">Código</div>
            <div class="col-header col-cites" style="border-right: 1px solid rgba(147, 161, 161, 0.15); padding-left: 12px; padding-right: 12px; box-sizing: border-box;">Citas</div>
            <div class="col-header col-sources" style="padding-left: 12px; box-sizing: border-box;">Fuentes</div>
        `;
        
        if (codebookTreeRoot && Object.keys(codebookTreeRoot.children).length > 0) {
            const childNamesSorted = Object.keys(codebookTreeRoot.children).sort();
            childNamesSorted.forEach(childName => {
                rootUl.appendChild(renderNodeHTML(codebookTreeRoot.children[childName], false, 0));
            });
        } else {
            rootUl.innerHTML = "<li style='color: var(--sol-base1); padding: 10px;'>No hay códigos en el codebook.</li>";
        }
        
        listCodebookContainer.appendChild(rootUl);
        
        // Apply existing filter if any text is typed
        if (searchCodebookInput.value) {
            filtrarArbolDOM(listCodebookContainer, searchCodebookInput.value);
        }
    }

    function renderTabMemos() {
        listMemosContainer.innerHTML = "";
        
        const cb = obtenerCodebookGlobal();
        const memoTitles = cb["memo"] || [];
        
        if (memoTitles.length === 0) {
            listMemosContainer.innerHTML = "<li style='color: var(--sol-base1); padding: 10px; list-style-type: none;'>No hay memos en el codebook.</li>";
            return;
        }

        const memoContentMap = obtenerContenidoMemos(memoTitles);
        
        const dummyMap = {};
        memoTitles.forEach(t => dummyMap[t] = []);
        
        memosTreeRoot = construirArbolCodigos(dummyMap);
        
        const rootUl = document.createElement("ul");
        rootUl.style.paddingLeft = "0";
        rootUl.style.margin = "0";
        
        if (memosTreeRoot && Object.keys(memosTreeRoot.children).length > 0) {
            const childNamesSorted = Object.keys(memosTreeRoot.children).sort();
            childNamesSorted.forEach(childName => {
                rootUl.appendChild(renderMemoNodeHTML(memosTreeRoot.children[childName], memoContentMap));
            });
        } else {
            rootUl.innerHTML = "<li style='color: var(--sol-base1); padding: 10px; list-style-type: none;'>No hay memos en el codebook.</li>";
        }
        
        listMemosContainer.appendChild(rootUl);
        
        if (searchMemosInput.value) {
            filtrarArbolDOM(listMemosContainer, searchMemosInput.value);
        }
    }

    // Initial Render of Global Tabs
    renderTabCasos();
    renderTabCodebook();
    renderTabMemos();
    renderTabCategorias();

    modal.appendChild(tabExportacion);
    modal.appendChild(tabCasos);
    modal.appendChild(tabCodebook);
    modal.appendChild(tabMemos);
    modal.appendChild(tabCategorias);

    // Cancel Button at the very bottom (global for the modal)
    const globalFooter = document.createElement("div");
    globalFooter.style.display = "flex";
    globalFooter.style.justifyContent = "flex-start";
    globalFooter.style.marginTop = "8px";
    
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
        { btn: btnTabExportacion, content: tabExportacion, controls: controlsExport },
        { btn: btnTabCasos, content: tabCasos, controls: controlsCasos },
        { btn: btnTabCodebook, content: tabCodebook, controls: controlsCodebook },
        { btn: btnTabMemos, content: tabMemos, controls: controlsMemos },
        { btn: btnTabCategorias, content: tabCategorias, controls: controlsCategorias }
    ];

    tabs.forEach(tab => {
        tab.btn.onclick = (e) => {
            e.preventDefault();
            tabs.forEach(t => {
                t.btn.classList.remove("active");
                t.content.classList.remove("active");
                t.controls.style.display = "none";
            });
            tab.btn.classList.add("active");
            tab.content.classList.add("active");
            tab.controls.style.display = "flex";
        };
    });
}
