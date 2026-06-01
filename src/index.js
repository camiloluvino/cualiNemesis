function iniciarExtractorCualitativo() {
    const contexto = obtenerContextoActual();
    
    if (!contexto) {
        mostrarNotificacion("Error: No se pudo detectar la página. Asegúrate de estar en la vista de la entrevista.");
        return;
    }

    const { uid: pageUid, title: pageTitle } = contexto;
    const blocks = obtenerBloquesDePagina(pageUid);

    const codeMap = procesarBloques(blocks);

    if (Object.keys(codeMap).length === 0) {
        mostrarNotificacion("Aviso: No se encontraron códigos en esta página.");
    }

    const rootNode = construirArbolCodigos(codeMap);

    crearInterfazModal(rootNode, pageTitle);
}

window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Cualitativo: Extraer códigos de la página actual",
    callback: () => iniciarExtractorCualitativo()
});
