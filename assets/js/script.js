
// ---- Outline bright effect ----

document.addEventListener('mousemove', e => {
    document.querySelectorAll('.project-glow').forEach(card => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--gx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--gy', (e.clientY - r.top) + 'px');
    });
});

// ---- Projects interaction ----

document.querySelectorAll(".project").forEach(project =>
{
    project.onclick = () =>
    {
        const overlayId = project.id + "Overlay";
        const overlay = document.getElementById(overlayId);
        if(!overlay) return;

        overlay.classList.add("active");
        document.body.style.overflow = "hidden";

        // clic sur le fond ferme l'overlay
        overlay.onclick = () =>
        {
            overlay.classList.remove("active");
            document.body.style.overflow = "";
        };

        // empêcher fermeture si clic sur le contenu
        const content = overlay.querySelector(".overlayContent");
        if(content)
        {
            content.onclick = (e) => e.stopPropagation();
        }
    };
});
