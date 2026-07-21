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

async function generarPaginaConsolidadaArbol(originalTitle, rootNode, numAbove = 0, numBelow = 0, plainText = false) {
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const newTitle = `Consolidado: ${originalTitle} (${timestamp})`;
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
        prefijosSincronizacion: ["cod", "dim", "cat"]
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
        "dim": [],
        "cat": [],
        "cod": [],
        "memo": []
    };
    
    allTitles.forEach(title => {
        if (title.startsWith("dom/")) grouped["dom"].push(title);
        else if (title.startsWith("dim/")) grouped["dim"].push(title);
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
    ["dom", "dim", "cat", "cod"].forEach(key => {
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

        const prefixesToFlatten = ["cod", "cat", "dim", "dom", "memos"];
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




