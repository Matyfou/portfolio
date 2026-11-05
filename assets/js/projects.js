const projectGlows = [...document.querySelectorAll(".project-glow")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let currentCardVideo = null;

function closeOverlay(overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";

    if (currentCardVideo) {
        currentCardVideo.play().catch(() => {});
        currentCardVideo = null;
    }
}

// Project cards open their matching overlay.
document.querySelectorAll(".project").forEach((project) => {
    project.addEventListener("click", () => {
        const overlay = document.getElementById(`${project.id}Overlay`);
        if (!overlay) return;

        // Avoid decoding the card video behind the overlay.
        currentCardVideo = project.querySelector("video");
        if (currentCardVideo) {
            currentCardVideo.pause();
        }

        overlay.classList.add("active");
        document.body.style.overflow = "hidden";
    });
});

// Clicking the overlay backdrop closes it; clicks inside the content do not.
document.querySelectorAll(".overlay").forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
        if (!event.target.closest(".overlayContent")) {
            closeOverlay(overlay);
        }
    });
});

// Close any open overlay when the SPA changes page.
document.addEventListener("pagechange", () => {
    document.querySelectorAll(".overlay.active").forEach(closeOverlay);
});

// Move the project card glow with the pointer.
document.addEventListener("mousemove", (event) => {
    projectGlows.forEach((card) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--gx", `${event.clientX - rect.left}px`);
        card.style.setProperty("--gy", `${event.clientY - rect.top}px`);
    });
});

// Videos are loaded only when they approach the viewport. This keeps the
// initial payload small while preserving autoplay once a card is visible.
const lazyVideos = [...document.querySelectorAll("video[data-src]")];

function loadVideo(video) {
    if (video.dataset.loaded) return;

    video.dataset.loaded = "true";
    video.muted = true;

    if (video.dataset.poster) {
        video.poster = video.dataset.poster;
    }

    const webm = document.createElement("source");
    webm.src = video.dataset.src;
    webm.type = "video/webm";
    video.append(webm);

    if (video.dataset.srcMp4) {
        const mp4 = document.createElement("source");
        mp4.src = video.dataset.srcMp4;
        mp4.type = "video/mp4";
        video.append(mp4);
    }

    video.load();
}

if ("IntersectionObserver" in window) {
    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const video = entry.target;

            if (!entry.isIntersecting) {
                video.pause();
                return;
            }

            if (reduceMotion.matches) {
                if (video.dataset.poster) {
                    video.poster = video.dataset.poster;
                }
                return;
            }

            loadVideo(video);
            video.play().catch(() => {});
        });
    }, { rootMargin: "200px 0px" });

    lazyVideos.forEach((video) => videoObserver.observe(video));
} else {
    lazyVideos.forEach(loadVideo);
}
