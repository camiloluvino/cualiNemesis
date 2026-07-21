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



