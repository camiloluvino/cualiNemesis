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
