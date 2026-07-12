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

function obtenerCasosGlobal() {
    if (cacheCasos) return cacheCasos;
    const res = window.roamAlphaAPI.q(`
        [:find ?title 
         :where 
         [?p :node/title ?title] 
         [(clojure.string/starts-with? ?title "entrevistadx/")]]
    `);
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

function refrescarCachesGlobales() {
    cacheCasos = null;
    cacheCodebook = null;
    cacheCategorias = null;
    obtenerCasosGlobal();
    obtenerCodebookGlobal();
    leerCategoriasDesdeRoam();
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
    
    const validPagePattern = /^entrevistadx\/[^/]+\/transcripci[óo]n\/a analizar$/i;
    
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

async function eliminarCategoriaRoam(uid) {
    if (!uid) return;
    window.roamAlphaAPI.deletePage({page: {uid: uid}});
    await sleep(100);
    cacheCategorias = null;
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




