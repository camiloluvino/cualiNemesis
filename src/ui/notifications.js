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
