// CualiNemesis v0.13.0 - Last Updated: 2026-07-21 15:38:01

// File: ui/notifications.js
function mostrarNotificacion(mensaje) {
    const toast = document.createElement("div");
    toast.innerText = mensaje;
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.backgroundColor = "#eee8d5";
    toast.style.color = "#073642";
    toast.style.border = "1px solid #93a1a1";
    toast.style.padding = "10px 20px";
    toast.style.borderRadius = "8px";
    toast.style.zIndex = "10000";
    toast.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
    toast.style.transition = "opacity 0.15s ease";
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 3000);
}

function cualiCustomPrompt(mensaje, callback) {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
    overlay.style.zIndex = "10001";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";

    const box = document.createElement("div");
    box.style.backgroundColor = "var(--sol-base3, white)";
    box.style.padding = "20px";
    box.style.borderRadius = "8px";
    box.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";
    box.style.minWidth = "300px";
    box.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    const label = document.createElement("div");
    label.innerText = mensaje;
    label.style.color = "var(--sol-base00, black)";
    label.style.fontWeight = "bold";

    const input = document.createElement("input");
    input.type = "text";
    input.style.padding = "8px";
    input.style.border = "1px solid var(--sol-base1, #93a1a1)";
    input.style.borderRadius = "4px";
    
    const btnContainer = document.createElement("div");
    btnContainer.style.display = "flex";
    btnContainer.style.justifyContent = "flex-end";
    btnContainer.style.gap = "10px";
    btnContainer.style.marginTop = "5px";

    const btnCancel = document.createElement("button");
    btnCancel.innerText = "Cancelar";
    btnCancel.className = "cuali-btn";
    btnCancel.onclick = () => {
        document.body.removeChild(overlay);
        callback(null);
    };

    const btnOk = document.createElement("button");
    btnOk.innerText = "Aceptar";
    btnOk.className = "cuali-btn cuali-btn-primary";
    btnOk.onclick = () => {
        document.body.removeChild(overlay);
        callback(input.value);
    };

    input.onkeydown = (e) => {
        if (e.key === "Enter") {
            btnOk.click();
        } else if (e.key === "Escape") {
            btnCancel.click();
        }
    };

    btnContainer.appendChild(btnCancel);
    btnContainer.appendChild(btnOk);
    
    box.appendChild(label);
    box.appendChild(input);
    box.appendChild(btnContainer);
    overlay.appendChild(box);

    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 50);
}


// File: api/roamApi.js
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function obtenerContextoActual() {
    let uid = window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
    
    let resPage = window.roamAlphaAPI.q(`[:find ?title :in $ ?uid :where [?p :block/uid ?uid] [?p :node/title ?title]]`, uid || "");
    if (resPage && resPage.length > 0) return { uid: uid, title: resPage[0][0] };

    let resBlock = window.roamAlphaAPI.q(`[:find ?puid ?title :in $ ?buid :where [?b :block/uid ?buid] [?b :block/page ?p] [?p :block/uid ?puid] [?p :node/title ?title]]`, uid || "");
    if (resBlock && resBlock.length > 0) return { uid: resBlock[0][0], title: resBlock[0][1] };

    const titleDOM = document.querySelector('.rm-title-display');
    if (titleDOM) {
        let title = titleDOM.innerText;
        let resDom = window.roamAlphaAPI.q(`[:find ?u :in $ ?t :where [?p :node/title ?t] [?p :block/uid ?u]]`, title);
        if (resDom && resDom.length > 0) return { uid: resDom[0][0], title: title };
    }

    return null;
}

function obtenerBloquesDePagina(pageUid) {
    if (!pageUid) return [];
    return window.roamAlphaAPI.q(`
        [:find ?uid ?str
         :in $ ?page_uid
         :where
         [?page :block/uid ?page_uid]
         [?b :block/page ?page]
         [?b :block/uid ?uid]
         [?b :block/string ?str]]
    `, pageUid);
}

function nodoSeleccionadoOHijosSeleccionados(node) {
    if (node.checked) return true;
    for (const childName in node.children) {
        if (nodoSeleccionadoOHijosSeleccionados(node.children[childName])) {
            return true;
        }
    }
    return false;
}

function obtenerBloquesHijosConOrden(parentUid) {
    const res = window.roamAlphaAPI.q(`
        [:find ?uid ?str ?order
         :in $ ?parent_uid
         :where
         [?parent :block/uid ?parent_uid]
         [?parent :block/children ?b]
         [?b :block/uid ?uid]
         [?b :block/string ?str]
         [?b :block/order ?order]]
    `, parentUid);
    
    if (!res) return [];
    
    const blocks = res.map(r => ({
        uid: r[0],
        string: r[1] || "",
        order: r[2]
    }));
    
    blocks.sort((a, b) => a.order - b.order);
    return blocks;
}

async function sincronizarArbolDiff(node, parentUid, order, numAbove = 0, numBelow = 0, plainText = false) {
    const currentBlocks = obtenerBloquesHijosConOrden(parentUid);
    const expectedString = `[[${node.fullName}]]`;
    
    let nodeUid = null;
    let existingIndex = -1;
    for (let i = 0; i < currentBlocks.length; i++) {
        if (currentBlocks[i].string === expectedString) {
            nodeUid = currentBlocks[i].uid;
            existingIndex = i;
            break;
        }
    }
    
    if (!nodeUid) {
        nodeUid = window.roamAlphaAPI.util.generateUID();
        window.roamAlphaAPI.createBlock({
            location: {"parent-uid": parentUid, order: order},
            block: {string: expectedString, uid: nodeUid}
        });
        await sleep(50);
    } else if (existingIndex !== order) {
        window.roamAlphaAPI.moveBlock({
            location: {"parent-uid": parentUid, order: order},
            block: {uid: nodeUid}
        });
        await sleep(30);
    }
    
    await sincronizarHijosDiff(node, nodeUid, numAbove, numBelow, plainText);
}

async function sincronizarHijosDiff(node, nodeBlockUid, numAbove, numBelow, plainText) {
    const currentBlocks = obtenerBloquesHijosConOrden(nodeBlockUid);
    
    const expectedChildren = [];
    
    if (node.checked) {
        for (const citeUid of node.cites) {
            const context = obtenerContextoBloque(citeUid.uid, numAbove, numBelow);
            if (context.length === 1 && !context[0].isContext) {
                const blockStr = plainText ? (context[0].string || "") : `((${citeUid.uid}))`;
                expectedChildren.push({ type: 'cite', expectedString: blockStr });
            } else {
                expectedChildren.push({ type: 'cite_context', expectedString: "Cita con contexto:", contextBlocks: context });
            }
        }
    }
    
    const childNamesSorted = Object.keys(node.children).sort();
    for (const childName of childNamesSorted) {
        const childNode = node.children[childName];
        if (nodoSeleccionadoOHijosSeleccionados(childNode)) {
            expectedChildren.push({ type: 'node', expectedString: `[[${childNode.fullName}]]`, node: childNode });
        }
    }
    
    const currentMap = {};
    const usedBlocks = new Set();
    
    for (const b of currentBlocks) {
        if (!currentMap[b.string]) currentMap[b.string] = [];
        currentMap[b.string].push(b);
    }
    
    const matchedUids = [];
    for (let i = 0; i < expectedChildren.length; i++) {
        const expected = expectedChildren[i];
        if (currentMap[expected.expectedString] && currentMap[expected.expectedString].length > 0) {
            const b = currentMap[expected.expectedString].shift();
            matchedUids[i] = b.uid;
            usedBlocks.add(b.uid);
        } else {
            matchedUids[i] = null;
        }
    }
    
    for (const b of currentBlocks) {
        if (!usedBlocks.has(b.uid)) {
            window.roamAlphaAPI.deleteBlock({block: {uid: b.uid}});
            await sleep(50);
        }
    }
    
    for (let i = 0; i < expectedChildren.length; i++) {
        const expected = expectedChildren[i];
        let blockUid = matchedUids[i];
        
        if (!blockUid) {
            blockUid = window.roamAlphaAPI.util.generateUID();
            window.roamAlphaAPI.createBlock({
                location: {"parent-uid": nodeBlockUid, order: i},
                block: {string: expected.expectedString, uid: blockUid}
            });
            await sleep(50);
        } else {
            window.roamAlphaAPI.moveBlock({
                location: {"parent-uid": nodeBlockUid, order: i},
                block: {uid: blockUid}
            });
            await sleep(30);
        }
        
        if (expected.type === 'node') {
            await sincronizarHijosDiff(expected.node, blockUid, numAbove, numBelow, plainText);
        } else if (expected.type === 'cite_context') {
            await sincronizarContextoRecursivo(expected.contextBlocks, blockUid, plainText);
        }
    }
}

async function sincronizarContextoRecursivo(contextBlocks, containerUid, plainText) {
    const currentBlocks = obtenerBloquesHijosConOrden(containerUid);
    
    const expectedStrings = contextBlocks.map(b => {
        if (plainText) {
            const prefix = b.isContext ? "[Contexto] " : "[Cita] ";
            return `${prefix}${b.string}`;
        } else {
            return `((${b.uid}))${b.isContext ? ' *(Contexto)*' : ''}`;
        }
    });
    
    const currentMap = {};
    const usedBlocks = new Set();
    
    for (const b of currentBlocks) {
        if (!currentMap[b.string]) currentMap[b.string] = [];
        currentMap[b.string].push(b);
    }
    
    const matchedUids = [];
    for (let i = 0; i < expectedStrings.length; i++) {
        const str = expectedStrings[i];
        if (currentMap[str] && currentMap[str].length > 0) {
            const b = currentMap[str].shift();
            matchedUids[i] = b.uid;
            usedBlocks.add(b.uid);
        } else {
            matchedUids[i] = null;
        }
    }
    
    for (const b of currentBlocks) {
        if (!usedBlocks.has(b.uid)) {
            window.roamAlphaAPI.deleteBlock({block: {uid: b.uid}});
            await sleep(50);
        }
    }
    
    for (let i = 0; i < expectedStrings.length; i++) {
        const str = expectedStrings[i];
        let blockUid = matchedUids[i];
        
        if (!blockUid) {
            blockUid = window.roamAlphaAPI.util.generateUID();
            window.roamAlphaAPI.createBlock({
                location: {"parent-uid": containerUid, order: i},
                block: {string: str, uid: blockUid}
            });
            await sleep(50);
        } else {
            window.roamAlphaAPI.moveBlock({
                location: {"parent-uid": containerUid, order: i},
                block: {uid: blockUid}
            });
            await sleep(30);
        }
    }
}

async function crearBloquesRecursivo(node, parentUid, order, numAbove = 0, numBelow = 0, plainText = false) {
    const nodeUid = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createBlock({
        location: {"parent-uid": parentUid, order: order},
        block: {string: `[[${node.fullName}]]`, uid: nodeUid}
    });
    await sleep(50);

    let childOrder = 0;
    if (node.checked) {
        for (const citeUid of node.cites) {
            const context = obtenerContextoBloque(citeUid.uid, numAbove, numBelow);
            if (context.length === 1 && !context[0].isContext) {
                const blockStr = plainText ? (context[0].string || "") : `((${citeUid.uid}))`;
                window.roamAlphaAPI.createBlock({
                    location: {"parent-uid": nodeUid, order: childOrder},
                    block: {string: blockStr}
                });
                childOrder++;
                await sleep(50);
            } else {
                const containerUid = window.roamAlphaAPI.util.generateUID();
                window.roamAlphaAPI.createBlock({
                    location: {"parent-uid": nodeUid, order: childOrder},
                    block: {string: `Cita con contexto:`, uid: containerUid}
                });
                childOrder++;
                await sleep(50);
                
                let subOrder = 0;
                for (const b of context) {
                    let blockStr = "";
                    if (plainText) {
                        const prefix = b.isContext ? "[Contexto] " : "[Cita] ";
                        blockStr = `${prefix}${b.string}`;
                    } else {
                        blockStr = `((${b.uid}))${b.isContext ? ' *(Contexto)*' : ''}`;
                    }
                    window.roamAlphaAPI.createBlock({
                        location: {"parent-uid": containerUid, order: subOrder},
                        block: {string: blockStr}
                    });
                    subOrder++;
                    await sleep(50);
                }
            }
        }
    }
    
    const childNamesSorted = Object.keys(node.children).sort();
    for (const childName of childNamesSorted) {
        const childNode = node.children[childName];
        if (nodoSeleccionadoOHijosSeleccionados(childNode)) {
            await crearBloquesRecursivo(childNode, nodeUid, childOrder, numAbove, numBelow, plainText);
            childOrder++;
        }
    }
}

function generarNombreDinamico(basePath, rootNode) {
    let seleccionados = [];

    function traverse(node) {
        if (!node) return;
        if (node.name === "root") {
            if (node.children) {
                Object.keys(node.children).sort().forEach(k => traverse(node.children[k]));
            }
            return;
        }

        if (node.checked) {
            let nombreLimpio = node.name ? node.name.replace(/^(cod|cat|dom)\//, "") : "";
            if (nombreLimpio.includes("/")) {
                let parts = nombreLimpio.split("/");
                nombreLimpio = parts[parts.length - 1];
            }
            if (nombreLimpio) {
                seleccionados.push(nombreLimpio);
            }
        } else if (node.children) {
            Object.keys(node.children).sort().forEach(k => traverse(node.children[k]));
        }
    }

    traverse(rootNode);

    let sufijo = "";
    if (seleccionados.length === 0) return basePath;
    if (seleccionados.length === 1) sufijo = seleccionados[0];
    else if (seleccionados.length <= 3) sufijo = seleccionados.join("_");
    else sufijo = seleccionados.slice(0, 2).join("_") + "_y_mas";

    return `${basePath}/${sufijo}`;
}

async function generarPaginaConsolidadaArbol(namespacePath, rootNode, numAbove = 0, numBelow = 0, plainText = false) {
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const newTitle = `${namespacePath}/${timestamp}`;
    const newPageUid = window.roamAlphaAPI.util.generateUID();
    
    window.roamAlphaAPI.createPage({page: {title: newTitle, uid: newPageUid}});
    await sleep(200);

    let order = 0;
    const topLevelNamesSorted = Object.keys(rootNode.children).sort();
    for (const childName of topLevelNamesSorted) {
        const childNode = rootNode.children[childName];
        if (nodoSeleccionadoOHijosSeleccionados(childNode)) {
            await crearBloquesRecursivo(childNode, newPageUid, order, numAbove, numBelow, plainText);
            order++;
        }
    }
    
    window.roamAlphaAPI.ui.mainWindow.openPage({page: {uid: newPageUid}});
}

let cacheCasos = null;
let cacheCodebook = null;
let cacheCategorias = null;
let cacheConfiguracion = null;

function obtenerConfiguracionPlugin() {
    if (cacheConfiguracion) return cacheConfiguracion;

    const defaultConfig = {
        prefijoCasos: "entrevistadx",
        sufijoAnalisis: "transcripción/a analizar",
        sincronizarJerarquia: true,
        prefijosSincronizacion: ["cod", "cat"]
    };

    const configPageUid = obtenerUIDPaginaPorTitulo("cualiNemesis/Configuración");
    if (!configPageUid) {
        cacheConfiguracion = defaultConfig;
        return defaultConfig;
    }

    const bloques = obtenerBloquesDePagina(configPageUid) || [];
    const config = { ...defaultConfig };
    
    let prefijosBlockUid = null;
    let prefijosTextoPadre = "";

    bloques.forEach(b => {
        const str = b[1] ? b[1].trim() : "";
        
        const matchPrefijo = str.match(/^Prefijo de casos::\s*(.+)$/i);
        if (matchPrefijo) {
            config.prefijoCasos = matchPrefijo[1].trim();
        }
        
        const matchSufijo = str.match(/^Sufijo de análisis::\s*(.+)$/i);
        if (matchSufijo) {
            config.sufijoAnalisis = matchSufijo[1].trim();
        }

        const matchSincronizar = str.match(/^Sincronizar jerarquía::\s*(.+)$/i);
        if (matchSincronizar) {
            const val = matchSincronizar[1].trim().toLowerCase();
            config.sincronizarJerarquia = (val === "sí" || val === "si" || val === "yes" || val === "true");
        }

        const matchPrefijosSync = str.match(/^Prefijos a sincronizar::\s*(.*)$/is);
        if (matchPrefijosSync) {
            prefijosBlockUid = b[0];
            prefijosTextoPadre = matchPrefijosSync[1];
        }
    });

    if (prefijosBlockUid) {
        const hijos = obtenerBloquesHijosConOrden(prefijosBlockUid);
        if (hijos && hijos.length > 0) {
            config.prefijosSincronizacion = hijos
                .map(h => h.string.trim().replace(/^\[\[/, "").replace(/\]\]$/, "").trim().toLowerCase())
                .filter(p => p.length > 0);
        } else if (prefijosTextoPadre) {
            // Retrocompatibilidad
            config.prefijosSincronizacion = prefijosTextoPadre.split(/[\n,]+/)
                .map(p => p.trim().replace(/^\[\[/, "").replace(/\]\]$/, "").trim().toLowerCase())
                .filter(p => p.length > 0);
        } else {
            config.prefijosSincronizacion = [];
        }
    }

    cacheConfiguracion = config;
    return cacheConfiguracion;
}

async function guardarConfiguracionPlugin(nuevaConfig) {
    const pageTitle = "cualiNemesis/Configuración";
    let configPageUid = obtenerUIDPaginaPorTitulo(pageTitle);
    
    if (!configPageUid) {
        configPageUid = window.roamAlphaAPI.util.generateUID();
        window.roamAlphaAPI.createPage({page: {title: pageTitle, uid: configPageUid}});
        await sleep(100);
    }

    const bloques = obtenerBloquesDePagina(configPageUid) || [];
    
    const configMap = {
        prefijoCasos: `Prefijo de casos:: ${nuevaConfig.prefijoCasos}`,
        sufijoAnalisis: `Sufijo de análisis:: ${nuevaConfig.sufijoAnalisis}`,
        sincronizarJerarquia: `Sincronizar jerarquía:: ${nuevaConfig.sincronizarJerarquia ? 'sí' : 'no'}`,
        prefijosSincronizacion: `Prefijos a sincronizar::`
    };

    const keysMap = {
        prefijoCasos: /^Prefijo de casos::/i,
        sufijoAnalisis: /^Sufijo de análisis::/i,
        sincronizarJerarquia: /^Sincronizar jerarquía::/i,
        prefijosSincronizacion: /^Prefijos a sincronizar::/i
    };

    const blockUids = {};
    bloques.forEach(b => {
        const uid = b[0];
        const str = b[1] ? b[1].trim() : "";
        for (const [key, regex] of Object.entries(keysMap)) {
            if (regex.test(str)) {
                blockUids[key] = uid;
            }
        }
    });

    let order = 0;
    for (const [key, text] of Object.entries(configMap)) {
        let currentUid = blockUids[key];
        if (currentUid) {
            window.roamAlphaAPI.updateBlock({block: {uid: currentUid, string: text}});
        } else {
            currentUid = window.roamAlphaAPI.util.generateUID();
            window.roamAlphaAPI.createBlock({
                location: { "parent-uid": configPageUid, order: order },
                block: { string: text, uid: currentUid }
            });
        }
        
        // Si es la sincronización de prefijos, manejar los bloques hijos (viñetas)
        if (key === 'prefijosSincronizacion') {
            await sleep(50);
            const hijosExistentes = obtenerBloquesHijosConOrden(currentUid);
            for (const hijo of hijosExistentes) {
                window.roamAlphaAPI.deleteBlock({block: {uid: hijo.uid}});
            }
            await sleep(50);
            let childOrder = 0;
            for (const p of nuevaConfig.prefijosSincronizacion) {
                window.roamAlphaAPI.createBlock({
                    location: { "parent-uid": currentUid, order: childOrder },
                    block: { string: `[[${p}]]` }
                });
                childOrder++;
                await sleep(20);
            }
        }
        
        order++;
        await sleep(50);
    }

    cacheConfiguracion = null;
    cacheCasos = null;
    cacheCodebook = null;
    cacheCategorias = null;
    
    obtenerConfiguracionPlugin();
}


function obtenerCasosGlobal() {
    if (cacheCasos) return cacheCasos;
    const config = obtenerConfiguracionPlugin();
    const prefixMatch = config.prefijoCasos + "/";
    const res = window.roamAlphaAPI.q(`
        [:find ?title 
         :in $ ?prefix
         :where 
         [?p :node/title ?title] 
         [(clojure.string/starts-with? ?title ?prefix)]]
    `, prefixMatch);
    cacheCasos = res.map(r => r[0])
                    .filter(title => {
                        const parts = title.split('/');
                        return parts.length === 2 && parts[1].trim().length > 0;
                    })
                    .sort();
    return cacheCasos;
}

function obtenerCodebookGlobal() {
    if (cacheCodebook) return cacheCodebook;
    
    // In Roam Datalog, the or clause must be grouped properly, or we can just fetch all pages and filter in JS if it's faster,
    // but a query with OR is efficient enough. Let's use a simple query finding all titles and filtering in JS to avoid Datalog complex syntax issues, since JS filter is extremely fast on thousands of strings.
    const res = window.roamAlphaAPI.q(`[:find ?title :where [?p :node/title ?title]]`);
    
    const allTitles = res.map(r => r[0] || "");
    
    const grouped = {
        "dom": [],
        "cat": [],
        "cod": [],
        "memo": []
    };
    
    allTitles.forEach(title => {
        if (title.startsWith("dom/")) grouped["dom"].push(title);
        else if (title.startsWith("cat/")) grouped["cat"].push(title);
        else if (title.startsWith("cod/")) grouped["cod"].push(title);
        else if (title.startsWith("memo/")) grouped["memo"].push(title);
    });
    
    for (const key in grouped) {
        grouped[key].sort();
    }
    
    cacheCodebook = grouped;
    return cacheCodebook;
}
function refrescarCacheCasos() {
    cacheCasos = null;
    return obtenerCasosGlobal();
}

function refrescarCacheCodebook() {
    cacheCodebook = null;
    return obtenerCodebookGlobal();
}

function refrescarCacheCategorias() {
    cacheCategorias = null;
    return leerCategoriasDesdeRoam();
}

function refrescarCachesGlobales(sincronizar = false) {
    cacheCasos = null;
    cacheCodebook = null;
    cacheCategorias = null;
    cacheConfiguracion = null;
    obtenerConfiguracionPlugin();
    obtenerCasosGlobal();
    obtenerCodebookGlobal();
    leerCategoriasDesdeRoam();
    
    // Ejecutar sincronización de jerarquía en segundo plano de manera asíncrona
    // (solo si sincronizar=true; operaciones como borrar una categoría no afectan
    //  la jerarquía cod/dim/cat y no necesitan reconstruir esas páginas)
    if (sincronizar) {
        sincronizarJerarquiaRoam().catch(err => {
            console.error("Error al sincronizar jerarquía de códigos:", err);
        });
    }
}

function obtenerBloquesDirectosDePagina(pageUid) {
    if (!pageUid) return [];
    return window.roamAlphaAPI.q(`
        [:find ?uid ?str
         :in $ ?page_uid
         :where
         [?page :block/uid ?page_uid]
         [?page :block/children ?b]
         [?b :block/uid ?uid]
         [?b :block/string ?str]]
    `, pageUid) || [];
}

async function sincronizarJerarquiaRoam() {
    const config = obtenerConfiguracionPlugin();
    if (!config.sincronizarJerarquia) return;

    const cb = obtenerCodebookGlobal();
    const prefijos = config.prefijosSincronizacion;
    if (!prefijos || prefijos.length === 0) return;

    // 1. Obtener todos los títulos para construir el árbol global
    const todosLosTitulos = [];
    ["dom", "cat", "cod"].forEach(key => {
        if (cb[key]) {
            todosLosTitulos.push(...cb[key]);
        }
    });

    if (todosLosTitulos.length === 0) return;

    // 2. Construir árbol global en memoria
    const codeMapGlobal = obtenerReferenciasDeCodigos(todosLosTitulos);
    const rootNode = construirArbolCodigos(codeMapGlobal);

    // Helper recursivo para marcar selección basada en el prefijo
    function marcarNodosPorPrefijo(node, prefix) {
        if (node.fullName === prefix || node.fullName.startsWith(prefix + "/")) {
            node.checked = true;
        } else {
            node.checked = false;
        }
        for (const childName in node.children) {
            marcarNodosPorPrefijo(node.children[childName], prefix);
        }
    }

    // 3. Iterar por cada prefijo a sincronizar
    for (const prefix of prefijos) {
        const parts = prefix.split('/');
        let groupName = parts[0];

        const prefixesToFlatten = ["cod", "cat", "dom", "memos"];
        try {
            if (typeof obtenerConfiguracionPlugin === 'function') {
                const configPlugin = obtenerConfiguracionPlugin();
                if (configPlugin && configPlugin.prefijoCasos) {
                    prefixesToFlatten.push(configPlugin.prefijoCasos.toLowerCase());
                }
            }
        } catch (e) {}

        if (parts.length >= 2 && prefixesToFlatten.includes(parts[0].toLowerCase())) {
            groupName = parts[0] + '/' + parts[1];
        }

        const groupNode = rootNode.children[groupName];
        if (!groupNode) continue;

        // Clonar el subárbol del grupo para no interferir con otras sincronizaciones
        const groupClone = cloneSubtree(groupNode);
        
        // Marcar nodos seleccionados para el prefijo actual
        marcarNodosPorPrefijo(groupClone, prefix);

        // Si ningún nodo de este grupo quedó seleccionado, no sincronizar
        if (!nodoSeleccionadoOHijosSeleccionados(groupClone)) continue;

        // Encontrar o crear la página del prefijo en Roam
        let pageUid = obtenerUIDPaginaPorTitulo(prefix);
        if (!pageUid) {
            pageUid = window.roamAlphaAPI.util.generateUID();
            window.roamAlphaAPI.createPage({page: {title: prefix, uid: pageUid}});
            await sleep(100);
        }

        // Antes borrábamos todo, ahora usamos diff-and-patch
        await sincronizarArbolDiff(groupClone, pageUid, 0, 0, 0, false);
    }
}

function obtenerReferenciasDeCodigos(titulos) {
    if (!titulos || titulos.length === 0) return {};
    const res = window.roamAlphaAPI.q(`
        [:find ?title ?buid ?pageTitle
         :in $ [?title ...]
         :where
         [?p :node/title ?title]
         [?b :block/refs ?p]
         [?b :block/uid ?buid]
         [?b :block/page ?page]
         [?page :node/title ?pageTitle]
        ]
    `, titulos);
    
    const map = {};
    titulos.forEach(t => map[t] = []);
    
    const config = obtenerConfiguracionPlugin();
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedPrefix = escapeRegExp(config.prefijoCasos);
    const escapedSuffix = escapeRegExp(config.sufijoAnalisis)
        .replace(/[oó]/ig, '[oó]')
        .replace(/[aá]/ig, '[aá]')
        .replace(/[eé]/ig, '[eé]')
        .replace(/[ií]/ig, '[ií]')
        .replace(/[uú]/ig, '[uú]');
    
    const validPagePattern = new RegExp(`^${escapedPrefix}\\/[^/]+\\/${escapedSuffix}$`, 'i');
    
    if (res) {
        res.forEach(([title, buid, pageTitle]) => {
            if (map[title] && validPagePattern.test(pageTitle || "")) {
                map[title].push({ uid: buid, page: pageTitle });
            }
        });
    }
    return map;
}

function obtenerTextoBloque(blockUid) {
    const res = window.roamAlphaAPI.q(`[:find ?str :in $ ?uid :where [?b :block/uid ?uid] [?b :block/string ?str]]`, blockUid);
    if (res && res.length > 0) return res[0][0];
    return "";
}

function obtenerHermanosBloque(blockUid) {
    const res = window.roamAlphaAPI.q(`
        [:find ?parentUid ?childUid ?childOrder
         :in $ ?blockUid
         :where
         [?b :block/uid ?blockUid]
         [?parent :block/children ?b]
         [?parent :block/uid ?parentUid]
         [?parent :block/children ?c]
         [?c :block/uid ?childUid]
         [?c :block/order ?childOrder]]
    `, blockUid);
    if (!res || res.length === 0) return [];
    
    // Convert to objects
    const siblings = res.map(r => ({
        parentUid: r[0],
        uid: r[1],
        order: r[2]
    }));
    
    // Sort by order
    siblings.sort((a, b) => a.order - b.order);
    return siblings;
}

function obtenerContextoBloque(blockUid, numAbove = 0, numBelow = 0) {
    const siblings = obtenerHermanosBloque(blockUid);
    if (siblings.length === 0) {
        return [{ uid: blockUid, string: obtenerTextoBloque(blockUid) || "", isContext: false }];
    }
    
    const targetIndex = siblings.findIndex(s => s.uid === blockUid);
    if (targetIndex === -1) {
        return [{ uid: blockUid, string: obtenerTextoBloque(blockUid) || "", isContext: false }];
    }
    
    const startIndex = Math.max(0, targetIndex - numAbove);
    const endIndex = Math.min(siblings.length - 1, targetIndex + numBelow);
    
    const contextBlocks = [];
    for (let i = startIndex; i <= endIndex; i++) {
        const sib = siblings[i];
        contextBlocks.push({
            uid: sib.uid,
            string: obtenerTextoBloque(sib.uid) || "",
            isContext: sib.uid !== blockUid
        });
    }
    return contextBlocks;
}

function actualizarTextoBloque(blockUid, nuevoTexto) {
    return window.roamAlphaAPI.updateBlock({block: {uid: blockUid, string: nuevoTexto}});
}

function eliminarBloqueRoam(blockUid) {
    return window.roamAlphaAPI.deleteBlock({block: {uid: blockUid}});
}

function obtenerUIDPaginaPorTitulo(titulo) {
    const res = window.roamAlphaAPI.q(`[:find ?uid :in $ ?t :where [?p :node/title ?t] [?p :block/uid ?uid]]`, titulo);
    if (res && res.length > 0) return res[0][0];
    return null;
}

function eliminarPaginaRoam(uidPagina) {
    return window.roamAlphaAPI.deletePage({page: {uid: uidPagina}});
}

function obtenerContenidoMemos(memoTitles) {
    const map = {};
    if (!memoTitles || memoTitles.length === 0) return map;
    
    const codePattern = /\[\[((?:dom|dim|cat|cod)\/[^\]]+)\]\]/g;
    
    memoTitles.forEach(title => {
        const uid = obtenerUIDPaginaPorTitulo(title);
        if (!uid) {
            map[title] = { preview: "(Sin contenido)", linkedCodes: [] };
            return;
        }
        
        const bloques = obtenerBloquesDePagina(uid);
        if (!bloques || bloques.length === 0) {
            map[title] = { preview: "(Sin contenido)", linkedCodes: [] };
            return;
        }
        
        const nonHtmlBlocks = bloques
            .map(b => b[1] ? b[1].trim() : "")
            .filter(str => str.length > 0);
            
        const previewText = nonHtmlBlocks.slice(0, 3).join(" | ");
        
        const linkedCodesSet = new Set();
        bloques.forEach(b => {
            const str = b[1] || "";
            let match;
            codePattern.lastIndex = 0;
            while ((match = codePattern.exec(str)) !== null) {
                linkedCodesSet.add(match[1]);
            }
        });
        
        map[title] = {
            preview: previewText.length > 120 ? previewText.substring(0, 120) + "..." : previewText || "(Sin contenido)",
            linkedCodes: Array.from(linkedCodesSet).sort()
        };
    });
    
    return map;
}

function leerCategoriasDesdeRoam() {
    if (cacheCategorias) return cacheCategorias;
    
    const res = window.roamAlphaAPI.q(`[:find ?uid ?title :where [?p :node/title ?title] [?p :block/uid ?uid]]`) || [];
    const catPages = res.filter(r => r[1] && r[1].startsWith("categoría/"));
    
    const map = {};
    catPages.forEach(r => {
        const pageUid = r[0];
        const fullTitle = r[1];
        const catName = fullTitle.substring("categoría/".length);
        
        const blocks = window.roamAlphaAPI.q(`
            [:find ?bstr ?buid
             :in $ ?pageUid
             :where
             [?page :block/uid ?pageUid]
             [?page :block/children ?b]
             [?b :block/string ?bstr]
             [?b :block/uid ?buid]
            ]
        `, pageUid) || [];
        
        const codes = [];
        const codeUids = {};
        
        blocks.forEach(b => {
            const bstr = b[0] || "";
            const buid = b[1];
            
            const str = bstr.trim();
            let codeTitle = null;
            if (str.startsWith("[[") && str.endsWith("]]")) {
                const inner = str.slice(2, -2);
                if (inner.startsWith("cod/")) {
                    codeTitle = inner;
                }
            } else if (str.startsWith("cod/")) {
                codeTitle = str;
            }
            
            if (codeTitle) {
                if (!codes.includes(codeTitle)) {
                    codes.push(codeTitle);
                }
                codeUids[codeTitle] = buid;
            }
        });
        
        map[catName] = {
            uid: pageUid,
            codes: codes,
            codeUids: codeUids
        };
    });
    
    cacheCategorias = map;
    return cacheCategorias;
}

async function crearCategoriaRoam(nombre) {
    if (!nombre || !nombre.trim()) return;
    const pageTitle = "categoría/" + nombre.trim();
    
    let pageUid = obtenerUIDPaginaPorTitulo(pageTitle);
    if (!pageUid) {
        pageUid = window.roamAlphaAPI.util.generateUID();
        window.roamAlphaAPI.createPage({page: {title: pageTitle, uid: pageUid}});
        await sleep(100);
    }
    cacheCategorias = null;
    return pageUid;
}

async function eliminarCategoriaRoam(uid, titulo) {
    if (!uid) return;
    // Obtener título antes de borrar si no se proporcionó
    if (!titulo) {
        const res = window.roamAlphaAPI.q(`[:find ?t :in $ ?u :where [?p :block/uid ?u] [?p :node/title ?t]]`, uid);
        titulo = (res && res.length > 0) ? res[0][0] : `(uid: ${uid})`;
    }
    window.roamAlphaAPI.deletePage({page: {uid: uid}});
    await sleep(100);
    cacheCategorias = null;
    await registrarEliminacion(titulo, "Categoría");
}

async function actualizarCodigosCategoriaRoam(pageUid, codigosDeseados) {
    if (!pageUid) return;
    
    const blocks = window.roamAlphaAPI.q(`
        [:find ?buid ?bstr
         :in $ ?pageUid
         :where
         [?page :block/uid ?pageUid]
         [?page :block/children ?b]
         [?b :block/uid ?buid]
         [?b :block/string ?bstr]
        ]
    `, pageUid) || [];
    
    const currentCodeToBlockUid = {};
    blocks.forEach(b => {
        const buid = b[0];
        const bstr = b[1] || "";
        const str = bstr.trim();
        let codeTitle = null;
        if (str.startsWith("[[") && str.endsWith("]]")) {
            const inner = str.slice(2, -2);
            if (inner.startsWith("cod/")) {
                codeTitle = inner;
            }
        } else if (str.startsWith("cod/")) {
            codeTitle = str;
        }
        
        if (codeTitle) {
            currentCodeToBlockUid[codeTitle] = buid;
        }
    });
    
    const currentCodes = Object.keys(currentCodeToBlockUid);
    
    const toDelete = currentCodes.filter(c => !codigosDeseados.includes(c));
    for (const code of toDelete) {
        const buid = currentCodeToBlockUid[code];
        window.roamAlphaAPI.deleteBlock({block: {uid: buid}});
        await sleep(50);
    }
    
    const toAdd = codigosDeseados.filter(c => !currentCodes.includes(c));
    let order = blocks.length;
    for (const code of toAdd) {
        const blockUid = window.roamAlphaAPI.util.generateUID();
        window.roamAlphaAPI.createBlock({
            location: {"parent-uid": pageUid, order: order},
            block: {string: `[[${code}]]`, uid: blockUid}
        });
        order++;
        await sleep(50);
    }
    
    cacheCategorias = null;
}

async function vincularCodigosACategoria(pageUid, codeNames) {
    if (!pageUid || !codeNames || codeNames.length === 0) return;
    
    const currentCategories = leerCategoriasDesdeRoam();
    let catInfo = null;
    for (const info of Object.values(currentCategories)) {
        if (info.uid === pageUid) {
            catInfo = info;
            break;
        }
    }
    const currentCodes = catInfo ? (catInfo.codes || []) : [];
    const updatedCodes = Array.from(new Set([...currentCodes, ...codeNames]));
    
    await actualizarCodigosCategoriaRoam(pageUid, updatedCodes);
}

async function desvincularCodigosDeCategoria(pageUid, codeNames) {
    if (!pageUid || !codeNames || codeNames.length === 0) return;
    
    const currentCategories = leerCategoriasDesdeRoam();
    let catInfo = null;
    for (const info of Object.values(currentCategories)) {
        if (info.uid === pageUid) {
            catInfo = info;
            break;
        }
    }
    const currentCodes = catInfo ? (catInfo.codes || []) : [];
    const updatedCodes = currentCodes.filter(c => !codeNames.includes(c));
    
    await actualizarCodigosCategoriaRoam(pageUid, updatedCodes);
}

const PAGINA_REGISTRO_ELIMINACIONES = "cualiNemesis/Registro de eliminaciones";

async function registrarEliminacion(titulo, tipo) {
    if (!titulo) return;
    
    let pageUid = obtenerUIDPaginaPorTitulo(PAGINA_REGISTRO_ELIMINACIONES);
    if (!pageUid) {
        pageUid = window.roamAlphaAPI.util.generateUID();
        window.roamAlphaAPI.createPage({page: {title: PAGINA_REGISTRO_ELIMINACIONES, uid: pageUid}});
        await sleep(100);
    }
    
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString("es-CL", { year: "numeric", month: "2-digit", day: "2-digit" });
    const hora = ahora.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    // Texto plano sin corchetes para no generar referencias
    const entrada = `${fecha} ${hora} — ${tipo}: ${titulo}`;
    
    // Contar bloques existentes para insertar al inicio (order 0 = más reciente arriba)
    const blockUid = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createBlock({
        location: {"parent-uid": pageUid, order: 0},
        block: {string: entrada, uid: blockUid}
    });
    await sleep(50);
}

async function registrarEliminacionMultiple(titulos, tipo) {
    if (!titulos || titulos.length === 0) return;
    
    let pageUid = obtenerUIDPaginaPorTitulo(PAGINA_REGISTRO_ELIMINACIONES);
    if (!pageUid) {
        pageUid = window.roamAlphaAPI.util.generateUID();
        window.roamAlphaAPI.createPage({page: {title: PAGINA_REGISTRO_ELIMINACIONES, uid: pageUid}});
        await sleep(100);
    }
    
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString("es-CL", { year: "numeric", month: "2-digit", day: "2-digit" });
    const hora = ahora.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    
    // Bloque padre con resumen
    const parentBlockUid = window.roamAlphaAPI.util.generateUID();
    const resumen = `${fecha} ${hora} — ${tipo} (${titulos.length} páginas eliminadas)`;
    window.roamAlphaAPI.createBlock({
        location: {"parent-uid": pageUid, order: 0},
        block: {string: resumen, uid: parentBlockUid}
    });
    await sleep(50);
    
    // Sub-bloques con cada título (texto plano)
    let order = 0;
    for (const titulo of titulos) {
        const childUid = window.roamAlphaAPI.util.generateUID();
        window.roamAlphaAPI.createBlock({
            location: {"parent-uid": parentBlockUid, order: order},
            block: {string: titulo, uid: childUid}
        });
        order++;
        await sleep(30);
    }
}






// File: core/extractor.js
class TreeNode {
    constructor(name, fullName = "") {
        this.name = name;
        this.fullName = fullName;
        this.cites = [];
        this.children = {};
        this.checked = false;
        this.isIndividuallyPivoted = false;
    }
}

function procesarBloques(blocks) {
    const codeMap = {};
    const regex = /\[\[(.*?)\]\]/g;

    blocks.forEach(block => {
        const blockUid = block[0];
        const str = block[1];
        let match;
        
        while ((match = regex.exec(str)) !== null) {
            const code = match[1];
            if (code.includes("/")) { 
                if (!codeMap[code]) codeMap[code] = [];
                codeMap[code].push(blockUid);
            }
        }
    });
    return codeMap;
}

function construirArbolCodigos(codeMap) {
    const root = new TreeNode("root");
    
    for (const [codePath, uids] of Object.entries(codeMap)) {
        const originalParts = codePath.split('/');
        let parts = [];
        
        const prefixesToFlatten = ["cod", "cat", "dom", "memos"];
        try {
            if (typeof obtenerConfiguracionPlugin === 'function') {
                const config = obtenerConfiguracionPlugin();
                if (config && config.prefijoCasos) {
                    prefixesToFlatten.push(config.prefijoCasos.toLowerCase());
                }
            }
        } catch (e) {}

        if (originalParts.length >= 2 && prefixesToFlatten.includes(originalParts[0].toLowerCase())) {
            parts.push(originalParts[0] + '/' + originalParts[1]);
            parts.push(...originalParts.slice(2));
        } else {
            parts = originalParts;
        }
        
        let current = root;
        let runningPath = "";
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            runningPath = runningPath ? `${runningPath}/${part}` : part;
            
            if (!current.children[part]) {
                current.children[part] = new TreeNode(part, runningPath);
            }
            current = current.children[part];
            
            if (i === parts.length - 1) {
                current.cites.push(...uids);
            }
        }
    }
    
    return root;
}

function cloneSubtree(node) {
    const clone = new TreeNode(node.name, node.fullName);
    clone.checked = node.checked;
    clone.isPivoted = node.isPivoted;
    clone.isIndividuallyPivoted = node.isIndividuallyPivoted;
    clone.cites = [...node.cites];
    for (const childName in node.children) {
        clone.children[childName] = cloneSubtree(node.children[childName]);
    }
    if (node.originalState) {
        clone.originalState = cloneSubtree(node.originalState);
    }
    return clone;
}

function collectCitesBySource(curr, relativePath = []) {
    const sourceMap = {};
    const config = obtenerConfiguracionPlugin();
    const casePrefix = config.prefijoCasos.toLowerCase();
    
    curr.cites.forEach(cite => {
        const pageParts = (cite.page || "").split('/');
        let sourceName = cite.page || "Desconocido";
        if (pageParts.length >= 2 && pageParts[0].toLowerCase() === casePrefix) {
            sourceName = pageParts[1];
        }
        
        if (!sourceMap[sourceName]) {
            sourceMap[sourceName] = {};
        }
        const relKey = relativePath.join('/');
        if (!sourceMap[sourceName][relKey]) {
            sourceMap[sourceName][relKey] = {
                fullName: curr.fullName,
                name: curr.name,
                cites: []
            };
        }
        sourceMap[sourceName][relKey].cites.push(cite);
    });
    
    for (const childName in curr.children) {
        const childNode = curr.children[childName];
        const childMap = collectCitesBySource(childNode, [...relativePath, childName]);
        
        for (const [sourceName, relNodes] of Object.entries(childMap)) {
            if (!sourceMap[sourceName]) {
                sourceMap[sourceName] = {};
            }
            for (const [relKey, nodeInfo] of Object.entries(relNodes)) {
                if (!sourceMap[sourceName][relKey]) {
                    sourceMap[sourceName][relKey] = {
                        fullName: nodeInfo.fullName,
                        name: nodeInfo.name,
                        cites: []
                    };
                }
                sourceMap[sourceName][relKey].cites.push(...nodeInfo.cites);
            }
        }
    }
    
    if (relativePath.length > 0) {
        const relKey = relativePath.join('/');
        for (const sourceName of Object.keys(sourceMap)) {
            if (!sourceMap[sourceName][relKey]) {
                sourceMap[sourceName][relKey] = {
                    fullName: curr.fullName,
                    name: curr.name,
                    cites: []
                };
            }
        }
    }
    
    return sourceMap;
}

function precalcularFuentes(node) {
    const sources = new Set();
    const config = obtenerConfiguracionPlugin();
    const casePrefix = config.prefijoCasos.toLowerCase();
    
    node.cites.forEach(c => {
        const pageParts = (c.page || "").split('/');
        let sourceName = c.page || "Desconocido";
        if (pageParts.length >= 2 && pageParts[0].toLowerCase() === casePrefix) {
            sourceName = pageParts[1];
        }
        sources.add(sourceName);
    });
    for (const childName in node.children) {
        const childNode = node.children[childName];
        const childSources = precalcularFuentes(childNode);
        childSources.forEach(s => sources.add(s));
    }
    node._sources = sources;
    return sources;
}

function transformarNodoSmart(node) {
    if (Object.keys(node.children).length === 0 && node.cites.length === 0) {
        return node;
    }
    if (node._sources && node._sources.size <= 1) {
        return node;
    }
    
    const config = obtenerConfiguracionPlugin();
    const casePrefix = config.prefijoCasos.toLowerCase();
    
    const newChildren = {};
    const citesBySource = {};
    node.cites.forEach(cite => {
        const pageParts = (cite.page || "").split('/');
        let sourceName = cite.page || "Desconocido";
        if (pageParts.length >= 2 && pageParts[0].toLowerCase() === casePrefix) {
            sourceName = pageParts[1];
        }
        if (!citesBySource[sourceName]) citesBySource[sourceName] = [];
        citesBySource[sourceName].push(cite);
    });
    
    const exclusiveChildren = {};
    const sharedChildren = [];
    
    for (const childName in node.children) {
        const child = node.children[childName];
        if (child._sources && child._sources.size === 1) {
            const sourceName = Array.from(child._sources)[0];
            if (!exclusiveChildren[sourceName]) {
                exclusiveChildren[sourceName] = [];
            }
            exclusiveChildren[sourceName].push(child);
        } else {
            sharedChildren.push(child);
        }
    }
    
    const allSources = new Set([
        ...Object.keys(exclusiveChildren),
        ...Object.keys(citesBySource)
    ]);
    
    allSources.forEach(sourceName => {
        const sourceNode = new TreeNode(sourceName, `${config.prefijoCasos}/${sourceName}`);
        sourceNode.checked = node.checked;
        
        if (exclusiveChildren[sourceName]) {
            exclusiveChildren[sourceName].forEach(child => {
                sourceNode.children[child.name] = child;
            });
        }
        if (citesBySource[sourceName]) {
            sourceNode.cites.push(...citesBySource[sourceName]);
        }
        newChildren[sourceName] = sourceNode;
    });
    
    sharedChildren.forEach(child => {
        const transformed = transformarNodoSmart(child);
        newChildren[child.name] = transformed;
    });
    
    node.cites = [];
    node.children = newChildren;
    return node;
}

function pivotNode(node, noDuplicar) {
    if (noDuplicar) {
        precalcularFuentes(node);
        transformarNodoSmart(node);
    } else {
        const sourceMap = collectCitesBySource(node, []);
        const newChildren = {};
        
        const config = obtenerConfiguracionPlugin();
        for (const sourceName in sourceMap) {
            const sourceNode = new TreeNode(sourceName, `${config.prefijoCasos}/${sourceName}`);
            sourceNode.checked = node.checked;
            
            if (sourceMap[sourceName][""]) {
                sourceNode.cites.push(...sourceMap[sourceName][""].cites);
            }
            
            for (const [relKey, nodeInfo] of Object.entries(sourceMap[sourceName])) {
                if (relKey === "") continue;
                const parts = relKey.split('/');
                let current = sourceNode;
                
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    if (!current.children[part]) {
                        const intermediateKey = parts.slice(0, i + 1).join('/');
                        const intermediateInfo = sourceMap[sourceName][intermediateKey];
                        current.children[part] = new TreeNode(part, intermediateInfo ? intermediateInfo.fullName : "");
                        
                        const partPath = parts.slice(0, i + 1);
                        if (node.originalState) {
                            current.children[part].checked = findOriginalCheckedState(node.originalState.children, partPath);
                        } else {
                            current.children[part].checked = false;
                        }
                    }
                    current = current.children[part];
                    
                    if (i === parts.length - 1) {
                        current.cites.push(...nodeInfo.cites);
                        if (node.originalState) {
                            current.checked = findOriginalCheckedState(node.originalState.children, parts);
                        } else {
                            current.checked = false;
                        }
                    }
                }
            }
            newChildren[sourceName] = sourceNode;
        }
        node.cites = [];
        node.children = newChildren;
    }
}

function findOriginalCheckedState(originalChildren, parts) {
    let current = { children: originalChildren };
    for (const part of parts) {
        if (current.children && current.children[part]) {
            current = current.children[part];
        } else {
            return false;
        }
    }
    return current.checked;
}

function pivotAtDepth(node, targetDepth, currentDepth = 0, noDuplicar = false) {
    if (!node) return;
    if (currentDepth === targetDepth) {
        pivotNode(node, noDuplicar);
        return;
    }
    for (const childName in node.children) {
        pivotAtDepth(node.children[childName], targetDepth, currentDepth + 1, noDuplicar);
    }
}

function construirArbolCategorias(categoriasMap, codeRefsMap) {
    const root = new TreeNode("root");
    const assignedCodes = new Set();
    
    for (const [catName, catInfo] of Object.entries(categoriasMap)) {
        const catNode = new TreeNode(catName, "categoría/" + catName);
        catNode.uid = catInfo.uid;
        const codes = catInfo.codes || [];
        
        codes.forEach(codeName => {
            assignedCodes.add(codeName);
            const codeNode = new TreeNode(codeName, codeName);
            codeNode.cites = codeRefsMap[codeName] || [];
            catNode.children[codeName] = codeNode;
        });
        
        root.children[catName] = catNode;
    }
    
    const uncategorizedCodes = [];
    for (const codeName of Object.keys(codeRefsMap)) {
        if (!assignedCodes.has(codeName) && codeName.startsWith("cod/")) {
            uncategorizedCodes.push(codeName);
        }
    }
    
    if (uncategorizedCodes.length > 0) {
        const uncatNode = new TreeNode("Sin categorizar", "__sin_categorizar__");
        uncategorizedCodes.forEach(codeName => {
            const codeNode = new TreeNode(codeName, codeName);
            codeNode.cites = codeRefsMap[codeName] || [];
            uncatNode.children[codeName] = codeNode;
        });
        root.children["__sin_categorizar__"] = uncatNode;
    }
    
    return root;
}





// File: ui/modal.js
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
    if (scope === "limpieza") {
        titleEl.innerHTML = "🧹 Limpieza de Códigos Muertos Seleccionados";
    } else {
        titleEl.innerHTML = "⚠️ Gestión de Categorías Seleccionadas";
    }
    mContainer.appendChild(titleEl);

    const descEl = document.createElement("div");
    descEl.style.fontSize = "13px";
    descEl.style.lineHeight = "1.5";
    if (scope === "limpieza") {
        descEl.innerHTML = `Has seleccionado <strong>${uniqueCodes.size}</strong> códigos de último nivel (hojas) sin citas en entrevistas.`;
    } else {
        descEl.innerHTML = `Has seleccionado <strong>${uniqueCodes.size}</strong> categorías con un total de <strong>${totalCitas}</strong> citas registradas en <strong>${sourcesSet.size}</strong> páginas de codificación.`;
    }
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

    if (scope === "limpieza") {
        optB.classList.add("active");
        optA.classList.remove("active");
        optB.querySelector("input").checked = true;
        optA.querySelector("input").checked = false;
        extraCheckboxContainer.style.display = "flex";
        const deletePagesInput = extraCheckboxContainer.querySelector("input");
        if (deletePagesInput) deletePagesInput.checked = true;
    }

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
        if (deletePagesChecked) {
            progressText.innerText = `Eliminando páginas del grafo...`;
            progressBar.style.width = `99%`;
            await sleep(200);

            const paginasEliminadas = [];
            for (const catName of uniqueCodes) {
                try {
                    const pageUid = obtenerUIDPaginaPorTitulo(catName);
                    if (pageUid) {
                        await eliminarPaginaRoam(pageUid);
                        paginasEliminadas.push(catName);
                    }
                } catch (err) {
                    console.error(`Error deleting page ${catName}:`, err);
                }
                await sleep(50);
            }
            
            // Registrar páginas eliminadas en el log
            if (paginasEliminadas.length > 0) {
                await registrarEliminacionMultiple(paginasEliminadas, "Gestión de códigos");
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
                refrescarCachesGlobales(false);
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
        .cn-summary-banner {
            display: flex;
            gap: 16px;
            align-items: center;
            background: rgba(38, 139, 210, 0.05);
            border: 1px solid rgba(38, 139, 210, 0.2);
            border-radius: 8px;
            padding: 8px 14px;
            margin-top: 4px;
            margin-bottom: 6px;
            font-size: 13px;
            color: var(--sol-base00);
        }
        .cn-summary-stat {
            display: flex;
            align-items: center;
            gap: 6px;
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
        
        /* Estilos Pestaña Configuración */
        .cuali-config-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
            padding: 24px;
            background: #ffffff;
            border: 1px solid rgba(147, 161, 161, 0.15);
            border-radius: 12px;
            max-width: 700px;
            margin: 20px auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }
        .cuali-config-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .cuali-config-label {
            font-weight: 600;
            font-size: 14px;
            color: var(--sol-base02);
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .cuali-config-input {
            padding: 8px 12px;
            border: 1px solid rgba(147, 161, 161, 0.3);
            border-radius: 6px;
            background: var(--sol-base3);
            font-size: 14px;
            color: var(--sol-base00);
            outline: none;
            transition: border-color 0.2s;
        }
        .cuali-config-input:focus {
            border-color: var(--sol-blue);
        }
        .cuali-config-checkbox-group {
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            user-select: none;
        }
        .cuali-config-checkbox {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }
        .cuali-config-description {
            font-size: 12px;
            color: var(--sol-base1);
            margin-top: -4px;
            line-height: 1.4;
        }
        .cuali-config-actions {
            display: flex;
            justify-content: flex-end;
            margin-top: 10px;
        }
        .cuali-config-btn-save {
            background-color: var(--sol-blue);
            color: #ffffff;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .cuali-config-btn-save:hover {
            background-color: #1b74b3;
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
    
    const btnTabCategorias = document.createElement("button");
    btnTabCategorias.className = "cuali-tab-btn";
    btnTabCategorias.innerText = "Categorías";

    const btnTabConfiguracion = document.createElement("button");
    btnTabConfiguracion.className = "cuali-tab-btn";
    btnTabConfiguracion.innerText = "Configuración";

    const btnTabLimpieza = document.createElement("button");
    btnTabLimpieza.className = "cuali-tab-btn";
    btnTabLimpieza.innerText = "Limpieza";

    const btnTabMemos = document.createElement("button");
    btnTabMemos.className = "cuali-tab-btn";
    btnTabMemos.innerText = "Memos";
    
    tabsLeft.appendChild(btnTabExportacion);
    tabsLeft.appendChild(btnTabCasos);
    tabsLeft.appendChild(btnTabCodebook);
    tabsLeft.appendChild(btnTabCategorias);
    tabsLeft.appendChild(btnTabConfiguracion);
    tabsLeft.appendChild(btnTabLimpieza);
    tabsLeft.appendChild(btnTabMemos);
    tabsNav.appendChild(tabsLeft);

    const controlsExport = document.createElement("div");
    controlsExport.className = "cuali-tabs-right";
    controlsExport.style.display = "flex"; // Active initially
    
    const controlsCasos = document.createElement("div");
    controlsCasos.className = "cuali-tabs-right";
    
    const controlsCodebook = document.createElement("div");
    controlsCodebook.className = "cuali-tabs-right";

    const controlsCategorias = document.createElement("div");
    controlsCategorias.className = "cuali-tabs-right";

    const controlsConfiguracion = document.createElement("div");
    controlsConfiguracion.className = "cuali-tabs-right";

    const controlsLimpieza = document.createElement("div");
    controlsLimpieza.className = "cuali-tabs-right";

    const controlsMemos = document.createElement("div");
    controlsMemos.className = "cuali-tabs-right";

    tabsNav.appendChild(controlsExport);
    tabsNav.appendChild(controlsCasos);
    tabsNav.appendChild(controlsCodebook);
    tabsNav.appendChild(controlsCategorias);
    tabsNav.appendChild(controlsConfiguracion);
    tabsNav.appendChild(controlsLimpieza);
    tabsNav.appendChild(controlsMemos);
    
    modal.appendChild(tabsNav);

    // Tab Contents Containers
    const tabExportacion = document.createElement("div");
    tabExportacion.className = "cuali-tab-content active";
    
    const tabCasos = document.createElement("div");
    tabCasos.className = "cuali-tab-content";
    
    const tabCodebook = document.createElement("div");
    tabCodebook.className = "cuali-tab-content";

    const tabCategorias = document.createElement("div");
    tabCategorias.className = "cuali-tab-content";

    const tabConfiguracion = document.createElement("div");
    tabConfiguracion.className = "cuali-tab-content";

    const tabLimpieza = document.createElement("div");
    tabLimpieza.className = "cuali-tab-content";

    const tabMemos = document.createElement("div");
    tabMemos.className = "cuali-tab-content";

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
    btnPage.innerText = "Generar reporte";
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
        const dynamicPath = generarNombreDinamico(`codebook/entrevistas/${pageTitle}`, rootNode);
        await generarPaginaConsolidadaArbol(dynamicPath, rootNode, numBloquesArriba, numBloquesAbajo, exportarTextoPlano);
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
        refrescarCacheCasos();
        renderTabCasos();
        mostrarNotificacion("Casos refrescados exitosamente.");
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
    btnCasosPage.innerText = "Generar reporte";
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
        const dynamicPath = generarNombreDinamico("codebook/casos", casosTreeRoot);
        await generarPaginaConsolidadaArbol(dynamicPath, casosTreeRoot, numBloquesArriba, numBloquesAbajo, exportarTextoPlano);
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
        ["dom", "cat", "cod"].forEach(key => {
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
    btnRefreshCodebook.onclick = (e) => {
        e.preventDefault();
        refrescarCacheCodebook();
        renderTabCodebook();
        mostrarNotificacion("Codebook refrescado exitosamente.");
    };

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
    infoNoteCodebook.innerHTML = `ℹ️ <em>Codebook global construido a partir de las páginas del grafo con prefijos cualitativos reconocidos: <code>dom/</code>, <code>cat/</code> y <code>cod/</code>. Las citas se contabilizan únicamente desde páginas de transcripción (<code>${config.prefijoCasos}/.../${config.sufijoAnalisis}</code>).</em>`;

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
    btnCodebookPage.innerText = "Generar reporte";
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
        const dynamicPath = generarNombreDinamico("codebook/códigos", codebookTreeRoot);
        await generarPaginaConsolidadaArbol(dynamicPath, codebookTreeRoot, numBloquesArriba, numBloquesAbajo, exportarTextoPlano);
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
        refrescarCacheCodebook();
        renderTabMemos();
        mostrarNotificacion("Memos refrescados exitosamente.");
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
        refrescarCacheCategorias();
        renderTabCategorias();
        mostrarNotificacion("Categorías refrescadas exitosamente.");
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
                refrescarCacheCategorias();
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
    btnCategoriasPage.innerText = "Generar reporte";
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
        const dynamicPath = generarNombreDinamico("codebook/categorías", categoriasTreeRoot);
        await generarPaginaConsolidadaArbol(dynamicPath, categoriasTreeRoot,
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
            ["dom", "cat", "cod"].forEach(key => {
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

    function renderTabConfiguracion() {
        tabConfiguracion.innerHTML = "";
        
        const config = obtenerConfiguracionPlugin();
        
        const container = document.createElement("div");
        container.className = "cuali-config-container";
        
        // 1. Prefijo de casos
        const groupPrefijo = document.createElement("div");
        groupPrefijo.className = "cuali-config-group";
        groupPrefijo.innerHTML = `
            <label class="cuali-config-label">📁 Prefijo de casos</label>
            <input type="text" class="cuali-config-input" id="cuali-cfg-prefijo" value="${config.prefijoCasos}">
            <div class="cuali-config-description">Prefijo en las páginas de Roam para identificar casos (ej: 'entrevistadx' detectará 'entrevistadx/Caso 1').</div>
        `;
        container.appendChild(groupPrefijo);
        
        // 2. Sufijo de análisis
        const groupSufijo = document.createElement("div");
        groupSufijo.className = "cuali-config-group";
        groupSufijo.innerHTML = `
            <label class="cuali-config-label">📝 Sufijo de análisis</label>
            <input type="text" class="cuali-config-input" id="cuali-cfg-sufijo" value="${config.sufijoAnalisis}">
            <div class="cuali-config-description">Texto para identificar los bloques a analizar en cada caso (ej: 'transcripción/a analizar').</div>
        `;
        container.appendChild(groupSufijo);
        
        // 3. Sincronizar jerarquía
        const groupSincronizar = document.createElement("div");
        groupSincronizar.className = "cuali-config-group";
        
        const labelSincronizar = document.createElement("label");
        labelSincronizar.className = "cuali-config-checkbox-group";
        
        const checkboxSincronizar = document.createElement("input");
        checkboxSincronizar.type = "checkbox";
        checkboxSincronizar.className = "cuali-config-checkbox";
        checkboxSincronizar.id = "cuali-cfg-sincronizar";
        checkboxSincronizar.checked = config.sincronizarJerarquia;
        
        labelSincronizar.appendChild(checkboxSincronizar);
        labelSincronizar.appendChild(document.createTextNode(" Sincronizar jerarquía"));
        
        groupSincronizar.appendChild(labelSincronizar);
        
        const descSincronizar = document.createElement("div");
        descSincronizar.className = "cuali-config-description";
        descSincronizar.innerText = "Sincroniza automáticamente la jerarquía de páginas de Roam con los namespaces definidos.";
        groupSincronizar.appendChild(descSincronizar);
        
        container.appendChild(groupSincronizar);
        
        // 4. Prefijos a sincronizar
        const groupPrefijosSync = document.createElement("div");
        groupPrefijosSync.className = "cuali-config-group";
        
        const labelPrefijos = document.createElement("label");
        labelPrefijos.className = "cuali-config-label";
        labelPrefijos.innerText = "🏷️ Prefijos a sincronizar";
        groupPrefijosSync.appendChild(labelPrefijos);
        
        const textareaPrefijos = document.createElement("textarea");
        textareaPrefijos.id = "cuali-cfg-prefijos-sync";
        textareaPrefijos.className = "cuali-config-input";
        textareaPrefijos.rows = "4";
        textareaPrefijos.style.resize = "vertical";
        textareaPrefijos.style.minHeight = "80px";
        textareaPrefijos.style.marginTop = "6px";
        textareaPrefijos.style.marginBottom = "8px";
        textareaPrefijos.style.lineHeight = "1.8";
        textareaPrefijos.style.padding = "10px";
        textareaPrefijos.style.fontFamily = "monospace";
        
        textareaPrefijos.value = config.prefijosSincronizacion
            .map(p => `[[${p}]]`)
            .join("\n");
        
        groupPrefijosSync.appendChild(textareaPrefijos);
        
        const descPrefijos = document.createElement("div");
        descPrefijos.className = "cuali-config-description";
        descPrefijos.style.marginTop = "6px";
        descPrefijos.innerText = "Páginas que se deben poblar automáticamente con sus citas y estructura (ej: 'cod', 'dim', 'cod/descarga').";
        groupPrefijosSync.appendChild(descPrefijos);
        
        container.appendChild(groupPrefijosSync);
        
        // 5. Actions (Save Button)
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "cuali-config-actions";
        
        const btnSave = document.createElement("button");
        btnSave.className = "cuali-config-btn-save";
        btnSave.innerText = "Guardar Configuración";
        btnSave.onclick = async (e) => {
            e.preventDefault();
            btnSave.disabled = true;
            btnSave.innerText = "Guardando...";
            
            const prefijoCasosVal = document.getElementById("cuali-cfg-prefijo").value.trim();
            const sufijoAnalisisVal = document.getElementById("cuali-cfg-sufijo").value.trim();
            const sincronizarJerarquiaVal = document.getElementById("cuali-cfg-sincronizar").checked;
            const prefijosSincronizacionVal = document.getElementById("cuali-cfg-prefijos-sync").value
                .split("\n")
                .map(p => p.trim().replace(/^\[\[/, "").replace(/\]\]$/, "").trim())
                .filter(p => p.length > 0);
                
            if (!prefijoCasosVal || !sufijoAnalisisVal) {
                mostrarNotificacion("Error: El prefijo de casos y el sufijo de análisis son obligatorios.");
                btnSave.disabled = false;
                btnSave.innerText = "Guardar Configuración";
                return;
            }
            
            try {
                await guardarConfiguracionPlugin({
                    prefijoCasos: prefijoCasosVal,
                    sufijoAnalisis: sufijoAnalisisVal,
                    sincronizarJerarquia: sincronizarJerarquiaVal,
                    prefijosSincronizacion: prefijosSincronizacionVal
                });
                
                mostrarNotificacion("Configuración guardada correctamente en Roam.");
                
                // Recargar las otras pestañas que dependen de la configuración
                refrescarCachesGlobales();
                renderTabCasos();
                renderTabCodebook(true);
                renderTabMemos();
                renderTabCategorias();
                renderTabLimpieza(true);
                
            } catch (err) {
                console.error(err);
                mostrarNotificacion("Error al guardar la configuración: " + err.message);
            } finally {
                btnSave.disabled = false;
                btnSave.innerText = "Guardar Configuración";
            }
        };
        
        actionsDiv.appendChild(btnSave);
        container.appendChild(actionsDiv);
        
        // 6. Registro de eliminaciones
        const groupRegistro = document.createElement("div");
        groupRegistro.className = "cuali-config-group";
        groupRegistro.style.borderTop = "1px solid rgba(147, 161, 161, 0.15)";
        groupRegistro.style.paddingTop = "16px";
        groupRegistro.style.marginTop = "8px";
        
        const labelRegistro = document.createElement("label");
        labelRegistro.className = "cuali-config-label";
        labelRegistro.innerText = "🗂️ Registro de eliminaciones";
        groupRegistro.appendChild(labelRegistro);
        
        const descRegistro = document.createElement("div");
        descRegistro.className = "cuali-config-description";
        descRegistro.innerText = "Historial de páginas eliminadas por el plugin. Útil para auditar cambios y recuperar títulos si fuera necesario.";
        groupRegistro.appendChild(descRegistro);
        
        const btnVerRegistro = document.createElement("button");
        btnVerRegistro.className = "cuali-btn cuali-btn-tool";
        btnVerRegistro.style.marginTop = "8px";
        btnVerRegistro.style.padding = "6px 14px";
        btnVerRegistro.style.fontSize = "13px";
        btnVerRegistro.innerText = "📋 Ver registro";
        btnVerRegistro.title = "Abrir página cualiNemesis/Registro de eliminaciones en Roam";
        btnVerRegistro.onclick = (e) => {
            e.preventDefault();
            const uid = obtenerUIDPaginaPorTitulo("cualiNemesis/Registro de eliminaciones");
            if (uid) {
                window.roamAlphaAPI.ui.mainWindow.openPage({page: {uid: uid}});
            } else {
                mostrarNotificacion("No hay registro de eliminaciones aún. Se creará automáticamente cuando se elimine una página.");
            }
        };
        groupRegistro.appendChild(btnVerRegistro);
        
        container.appendChild(groupRegistro);
        
        tabConfiguracion.appendChild(container);
    }

    // --- POPULATE TAB: LIMPIEZA ---
    const btnSearchToggleLimpieza = document.createElement("button");
    btnSearchToggleLimpieza.className = "cuali-btn-tool";
    btnSearchToggleLimpieza.innerText = "🔍";
    btnSearchToggleLimpieza.title = "Buscar código muerto";
    btnSearchToggleLimpieza.onclick = (e) => {
        e.preventDefault();
        if (searchLimpiezaInput.style.display === "none" || !searchLimpiezaInput.style.display) {
            searchLimpiezaInput.style.display = "block";
            searchLimpiezaInput.focus();
        } else {
            searchLimpiezaInput.style.display = "none";
            searchLimpiezaInput.value = "";
            filtrarLimpieza(listLimpiezaContainer, "");
        }
    };

    const btnRefreshLimpieza = document.createElement("button");
    btnRefreshLimpieza.className = "cuali-btn-tool";
    btnRefreshLimpieza.innerText = "🔄";
    btnRefreshLimpieza.title = "Recargar cachés y re-evaluar códigos muertos";
    btnRefreshLimpieza.onclick = (e) => {
        e.preventDefault();
        refrescarCachesGlobales();
        renderTabLimpieza(true);
        mostrarNotificacion("Caché actualizada y códigos re-evaluados.");
    };

    controlsLimpieza.appendChild(btnSearchToggleLimpieza);
    controlsLimpieza.appendChild(btnRefreshLimpieza);

    const searchLimpiezaInput = document.createElement("input");
    searchLimpiezaInput.type = "text";
    searchLimpiezaInput.className = "cuali-search-input";
    searchLimpiezaInput.placeholder = "🔍 Filtrar códigos muertos...";
    searchLimpiezaInput.style.display = "none";
    searchLimpiezaInput.style.marginBottom = "6px";
    searchLimpiezaInput.oninput = () => {
        filtrarLimpieza(listLimpiezaContainer, searchLimpiezaInput.value);
    };

    const summaryLimpiezaBanner = document.createElement("div");
    summaryLimpiezaBanner.className = "cn-summary-banner";

    const tableHeaderLimpieza = document.createElement("div");
    tableHeaderLimpieza.className = "cuali-table-header";
    tableHeaderLimpieza.innerHTML = `
        <span style="width: 26px; text-align: center; margin-right: 10px;">☐</span>
        <span class="col-code">CÓDIGO MUERTO</span>
        <span class="col-sources" style="width: 220px;">NAMESPACE PADRE</span>
        <span style="width: 90px; text-align: center;">ACCIONES</span>
    `;

    const listLimpiezaContainer = document.createElement("div");
    listLimpiezaContainer.className = "cuali-list-box cuali-tree-container";

    const infoNoteLimpieza = document.createElement("div");
    infoNoteLimpieza.className = "cn-info-note";
    infoNoteLimpieza.innerText = "ℹ️ Se muestran únicamente códigos de último nivel (nodos hoja) sin citas en ninguna entrevista activa. Los códigos agrupadores no se incluyen.";

    const buttonsLimpieza = document.createElement("div");
    buttonsLimpieza.className = "cuali-buttons";

    const btnSelectAllLimpieza = document.createElement("button");
    btnSelectAllLimpieza.className = "cuali-btn cuali-btn-tool";
    btnSelectAllLimpieza.innerText = "☑ Seleccionar todos";
    btnSelectAllLimpieza.onclick = (e) => {
        e.preventDefault();
        const lis = Array.from(listLimpiezaContainer.querySelectorAll("li")).filter(li => li.style.display !== "none");
        lis.forEach(li => {
            const chk = li.querySelector("input[type='checkbox']");
            if (chk) chk.checked = true;
        });
        deadCodesList.forEach(item => {
            const li = Array.from(listLimpiezaContainer.querySelectorAll("li")).find(l => l.querySelector(".col-code") && l.querySelector(".col-code").innerText === item.fullName);
            if (li && li.style.display !== "none") {
                item.checked = true;
            }
        });
    };

    const btnDeselectAllLimpieza = document.createElement("button");
    btnDeselectAllLimpieza.className = "cuali-btn cuali-btn-tool";
    btnDeselectAllLimpieza.innerText = "☐ Deseleccionar";
    btnDeselectAllLimpieza.onclick = (e) => {
        e.preventDefault();
        const chks = listLimpiezaContainer.querySelectorAll("input[type='checkbox']");
        chks.forEach(chk => chk.checked = false);
        deadCodesList.forEach(item => item.checked = false);
    };

    const btnDeleteSelectedLimpieza = document.createElement("button");
    btnDeleteSelectedLimpieza.className = "cuali-btn";
    btnDeleteSelectedLimpieza.style.backgroundColor = "rgba(220, 50, 47, 0.08)";
    btnDeleteSelectedLimpieza.style.border = "1px solid #dc322f";
    btnDeleteSelectedLimpieza.style.color = "#dc322f";
    btnDeleteSelectedLimpieza.innerText = "🗑️ Eliminar seleccionados";
    btnDeleteSelectedLimpieza.onclick = (e) => {
        e.preventDefault();
        const selectedItems = deadCodesList.filter(item => item.checked);
        if (selectedItems.length === 0) {
            mostrarNotificacion("Selecciona al menos un código muerto para eliminar.");
            return;
        }
        mostrarModalGestion(selectedItems, "limpieza", () => {
            renderTabLimpieza(true);
        });
    };

    const btnCopyListLimpieza = document.createElement("button");
    btnCopyListLimpieza.className = "cuali-btn cuali-btn-tool";
    btnCopyListLimpieza.innerText = "📋 Copiar lista";
    btnCopyListLimpieza.onclick = (e) => {
        e.preventDefault();
        if (!deadCodesList || deadCodesList.length === 0) {
            mostrarNotificacion("No hay códigos muertos para copiar.");
            return;
        }
        const textToCopy = deadCodesList.map(item => item.fullName).join("\n");
        navigator.clipboard.writeText(textToCopy).then(() => {
            mostrarNotificacion(`Se han copiado ${deadCodesList.length} códigos muertos al portapapeles.`);
        }).catch(err => {
            console.error("Error al copiar al portapapeles:", err);
            mostrarNotificacion("Error al copiar al portapapeles.");
        });
    };

    buttonsLimpieza.appendChild(btnSelectAllLimpieza);
    buttonsLimpieza.appendChild(btnDeselectAllLimpieza);
    buttonsLimpieza.appendChild(btnDeleteSelectedLimpieza);
    buttonsLimpieza.appendChild(btnCopyListLimpieza);

    tabLimpieza.appendChild(searchLimpiezaInput);
    tabLimpieza.appendChild(summaryLimpiezaBanner);
    tabLimpieza.appendChild(tableHeaderLimpieza);
    tabLimpieza.appendChild(listLimpiezaContainer);
    tabLimpieza.appendChild(infoNoteLimpieza);
    tabLimpieza.appendChild(buttonsLimpieza);

    let deadCodesList = [];

    function recolectarCodigosMuertos(node, deadCodes = []) {
        if (!node) return deadCodes;
        const isLeaf = Object.keys(node.children).length === 0;
        if (isLeaf) {
            if (node.fullName && (!node.cites || node.cites.length === 0)) {
                const config = obtenerConfiguracionPlugin();
                const casePrefix = (config.prefijoCasos || "entrevistadx").toLowerCase();
                const lowerFull = node.fullName.toLowerCase();
                
                const isMemo = lowerFull.startsWith("memo/") || lowerFull.startsWith("memos/");
                const isCase = lowerFull.startsWith(casePrefix + "/");
                
                if (!isMemo && !isCase) {
                    const parts = node.fullName.split('/');
                    const parentNamespace = parts.length > 1 ? parts.slice(0, -1).join('/') : "-";
                    
                    deadCodes.push({
                        node: node,
                        fullName: node.fullName,
                        name: node.name,
                        parentNamespace: parentNamespace,
                        cites: [],
                        checked: false
                    });
                }
            }
        } else {
            for (const childName in node.children) {
                recolectarCodigosMuertos(node.children[childName], deadCodes);
            }
        }
        return deadCodes;
    }

    function contarHojasTotales(node) {
        if (!node) return 0;
        const isLeaf = Object.keys(node.children).length === 0;
        if (isLeaf) {
            if (node.fullName) {
                const config = obtenerConfiguracionPlugin();
                const casePrefix = (config.prefijoCasos || "entrevistadx").toLowerCase();
                const lowerFull = node.fullName.toLowerCase();
                const isMemo = lowerFull.startsWith("memo/") || lowerFull.startsWith("memos/");
                const isCase = lowerFull.startsWith(casePrefix + "/");
                if (!isMemo && !isCase) return 1;
            }
            return 0;
        }
        let sum = 0;
        for (const childName in node.children) {
            sum += contarHojasTotales(node.children[childName]);
        }
        return sum;
    }

    function filtrarLimpieza(container, query) {
        const lis = container.querySelectorAll('li');
        const q = query.toLowerCase().trim();
        lis.forEach(li => {
            if (!q || li.innerText.toLowerCase().includes(q)) {
                li.style.display = "flex";
            } else {
                li.style.display = "none";
            }
        });
    }

    function renderTabLimpieza(rebuild = true) {
        if (rebuild || !deadCodesList) {
            const cb = obtenerCodebookGlobal();
            const todosLosTitulos = [];
            ["dom", "cat", "cod"].forEach(key => {
                if (cb[key]) {
                    todosLosTitulos.push(...cb[key]);
                }
            });
            const codeMapGlobal = obtenerReferenciasDeCodigos(todosLosTitulos);
            const rootNode = construirArbolCodigos(codeMapGlobal);
            
            deadCodesList = recolectarCodigosMuertos(rootNode, []);
            const totalHojas = contarHojasTotales(rootNode);
            const conCitas = Math.max(0, totalHojas - deadCodesList.length);
            
            summaryLimpiezaBanner.innerHTML = `
                <div class="cn-summary-stat">📊 <span>Total códigos hoja: <strong>${totalHojas}</strong></span></div>
                <div style="border-left: 1px solid rgba(147,161,161,0.25); height: 16px;"></div>
                <div class="cn-summary-stat">✅ <span>Con citas: <strong style="color: #2aa198;">${conCitas}</strong></span></div>
                <div style="border-left: 1px solid rgba(147,161,161,0.25); height: 16px;"></div>
                <div class="cn-summary-stat">❌ <span>Sin citas (muertos): <strong style="color: #dc322f;">${deadCodesList.length}</strong></span></div>
            `;
        }
        
        listLimpiezaContainer.innerHTML = "";
        
        if (deadCodesList.length === 0) {
            listLimpiezaContainer.innerHTML = `
                <div style="padding: 30px; text-align: center; color: var(--sol-base01); font-size: 14px;">
                    🎉 <strong>¡Codebook limpio!</strong> No se encontraron códigos muertos de último nivel sin citas.
                </div>
            `;
            return;
        }
        
        const rootUl = document.createElement("ul");
        rootUl.style.paddingLeft = "0";
        rootUl.style.margin = "0";
        
        deadCodesList.forEach(item => {
            const li = document.createElement("li");
            li.style.listStyleType = "none";
            li.className = "node-row";
            li.style.display = "flex";
            li.style.alignItems = "center";
            li.style.padding = "6px 12px";
            li.style.fontSize = "13px";
            
            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.checked = !!item.checked;
            chk.style.marginRight = "10px";
            chk.style.cursor = "pointer";
            chk.onchange = () => {
                item.checked = chk.checked;
            };
            
            const nameSpan = document.createElement("span");
            nameSpan.className = "col-code";
            nameSpan.style.fontWeight = "600";
            nameSpan.style.color = "var(--sol-base02)";
            nameSpan.innerText = item.fullName;
            
            const parentSpan = document.createElement("span");
            parentSpan.className = "col-sources";
            parentSpan.style.width = "220px";
            parentSpan.style.flexShrink = "0";
            parentSpan.innerHTML = `<span class="cuali-tag" style="background-color: rgba(108, 113, 196, 0.08); color: #6c71c4;">${item.parentNamespace}</span>`;
            
            const actionsSpan = document.createElement("span");
            actionsSpan.style.width = "90px";
            actionsSpan.style.display = "flex";
            actionsSpan.style.gap = "6px";
            actionsSpan.style.justifyContent = "center";
            actionsSpan.style.flexShrink = "0";
            
            const goBtn = document.createElement("button");
            goBtn.className = "cuali-btn cuali-go-btn";
            goBtn.style.padding = "2px 6px";
            goBtn.style.fontSize = "11px";
            goBtn.innerText = "↗";
            goBtn.title = "Navegar a la página en Roam";
            goBtn.onclick = (e) => {
                e.preventDefault();
                const pageUid = obtenerUIDPaginaPorTitulo(item.fullName);
                if (pageUid) {
                    window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: pageUid } });
                    document.body.removeChild(overlay);
                } else {
                    mostrarNotificacion("La página no existe aún en Roam.");
                }
            };
            
            const delBtn = document.createElement("button");
            delBtn.className = "cuali-btn cuali-btn-tool";
            delBtn.style.padding = "2px 6px";
            delBtn.style.fontSize = "11px";
            delBtn.innerText = "🗑️";
            delBtn.title = "Eliminar este código";
            delBtn.onclick = (e) => {
                e.preventDefault();
                mostrarModalGestion([item], "limpieza", () => {
                    renderTabLimpieza(true);
                });
            };
            
            actionsSpan.appendChild(goBtn);
            actionsSpan.appendChild(delBtn);
            
            li.appendChild(chk);
            li.appendChild(nameSpan);
            li.appendChild(parentSpan);
            li.appendChild(actionsSpan);
            
            rootUl.appendChild(li);
        });
        
        listLimpiezaContainer.appendChild(rootUl);
        
        if (searchLimpiezaInput.value) {
            filtrarLimpieza(listLimpiezaContainer, searchLimpiezaInput.value);
        }
    }

    // Initial Render of Global Tabs
    renderTabCasos();
    renderTabCodebook();
    renderTabMemos();
    renderTabCategorias();
    renderTabConfiguracion();
    renderTabLimpieza();

    modal.appendChild(tabExportacion);
    modal.appendChild(tabCasos);
    modal.appendChild(tabCodebook);
    modal.appendChild(tabCategorias);
    modal.appendChild(tabConfiguracion);
    modal.appendChild(tabLimpieza);
    modal.appendChild(tabMemos);

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
        { btn: btnTabCategorias, content: tabCategorias, controls: controlsCategorias },
        { btn: btnTabConfiguracion, content: tabConfiguracion, controls: controlsConfiguracion },
        { btn: btnTabLimpieza, content: tabLimpieza, controls: controlsLimpieza },
        { btn: btnTabMemos, content: tabMemos, controls: controlsMemos }
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


// File: index.js
function iniciarExtractorCualitativo() {
    const contexto = obtenerContextoActual() || { uid: null, title: "Vista Global" };
    
    const { uid: pageUid, title: pageTitle } = contexto;
    let rootNode = { name: "root", children: {} };

    if (pageUid) {
        const blocks = obtenerBloquesDePagina(pageUid);
        const codeMap = procesarBloques(blocks);
        const codeMapWithObjects = {};
        for (const [code, uids] of Object.entries(codeMap)) {
            codeMapWithObjects[code] = uids.map(uid => ({ uid: uid, page: pageTitle }));
        }

        if (Object.keys(codeMapWithObjects).length === 0) {
            mostrarNotificacion("Aviso: No se encontraron códigos en esta página.");
        }

        rootNode = construirArbolCodigos(codeMapWithObjects);
    }

    crearInterfazModal(rootNode, pageTitle, pageUid);
}

window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "CualiNemesis: Abrir panel (Extracción, Categorías, IA)",
    callback: () => iniciarExtractorCualitativo()
});


