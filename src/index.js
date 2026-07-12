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
