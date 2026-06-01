function mostrarNotificacion(mensaje) {
    const toast = document.createElement("div");
    toast.innerText = mensaje;
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.backgroundColor = "#333";
    toast.style.color = "#fff";
    toast.style.padding = "10px 20px";
    toast.style.borderRadius = "5px";
    toast.style.zIndex = "10000";
    toast.style.fontFamily = "sans-serif";
    toast.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 3000);
}
