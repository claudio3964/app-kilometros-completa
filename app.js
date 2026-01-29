console.log("🚀 BOOTSTRAP COT INICIADO");

document.addEventListener("DOMContentLoaded", () => {
    console.log("Sistema listo");

    // Inicializaciones legacy
    if (window.initStorage) initStorage();
    if (window.initUI) initUI();
    if (window.initAuth) initAuth();

    // AUTO LOGIN
    console.log("🚀 AUTO BOOTSTRAP");
    const user = localStorage.getItem("travelUser");

    if (user) {
        showScreen("mainScreen");
    } else {
        showScreen("loginScreen");
    }
});

