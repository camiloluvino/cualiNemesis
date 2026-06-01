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

async function crearBloquesRecursivo(node, parentUid, order) {
    const nodeUid = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createBlock({
        location: {"parent-uid": parentUid, order: order},
        block: {string: `[[${node.fullName}]]`, uid: nodeUid}
    });
    await sleep(50);

    let childOrder = 0;
    if (node.checked) {
        for (const citeUid of node.cites) {
            window.roamAlphaAPI.createBlock({
                location: {"parent-uid": nodeUid, order: childOrder},
                block: {string: `((${citeUid}))`}
            });
            childOrder++;
            await sleep(50);
        }
    }
    
    const childNamesSorted = Object.keys(node.children).sort();
    for (const childName of childNamesSorted) {
        const childNode = node.children[childName];
        if (nodoSeleccionadoOHijosSeleccionados(childNode)) {
            await crearBloquesRecursivo(childNode, nodeUid, childOrder);
            childOrder++;
        }
    }
}

async function generarPaginaConsolidadaArbol(originalTitle, rootNode) {
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
            await crearBloquesRecursivo(childNode, newPageUid, order);
            order++;
        }
    }
    
    window.roamAlphaAPI.ui.mainWindow.openPage({page: {uid: newPageUid}});
}

let cacheCasos = null;
let cacheCodebook = null;

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
    obtenerCasosGlobal();
    obtenerCodebookGlobal();
}

