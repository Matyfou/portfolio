// Applique le thème sauvegardé dès le chargement du script (avant DOMContentLoaded),
// pour que bgShader.js lise directement les bonnes couleurs à chaque page
// (sinon : lerp sombre → clair à chaque changement de page).
const root = document.documentElement;
if (localStorage.getItem("theme") === "light") {
    root.classList.add("light");
}

document.addEventListener("DOMContentLoaded", () => {
    // ---- Dark/Light mode ----
    const btn = document.querySelector(".theme-btn");

    function updateButton() {
        btn.textContent = root.classList.contains("light")
        ? "☀️ clair"
        : "sombre 🌙";
    }

    updateButton();
    btn.addEventListener("click", () => {
        root.classList.toggle("light");
        localStorage.setItem("theme", root.classList.contains("light") ? "light" : "dark");
        updateButton();
        window.bgShaderOnThemeChange();
    });
});
