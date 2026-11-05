// Apply the saved theme and JS flag before the first paint.
const root = document.documentElement;
root.classList.add("js");

if (localStorage.getItem("theme") === "light") {
    root.classList.add("light");
}

document.addEventListener("DOMContentLoaded", () => {
    const button = document.querySelector(".theme-btn");
    if (!button) return;

    const updateButton = () => {
        button.textContent = root.classList.contains("light")
            ? "☀️ clair"
            : "sombre 🌙";
    };

    updateButton();

    button.addEventListener("click", () => {
        root.classList.toggle("light");
        localStorage.setItem(
            "theme",
            root.classList.contains("light") ? "light" : "dark",
        );
        updateButton();
        document.dispatchEvent(new Event("themechange"));
    });
});
