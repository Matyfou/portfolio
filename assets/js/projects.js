const projectGlows = [...document.querySelectorAll(".project-glow")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function closeOverlay(overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
}

// Project cards open their matching overlay.
document.querySelectorAll(".project").forEach((project) => {
    project.addEventListener("click", () => {
        const overlay = document.getElementById(`${project.id}Overlay`);
        if (!overlay) return;

        overlay.classList.add("active");
        document.body.style.overflow = "hidden";

        // Start the first overlay video from this user gesture. This keeps
        // playback allowed even with strict autoplay policies, and the video
        // is muted anyway.
        if (!reduceMotion.matches) {
            const overlayVideo = overlay.querySelector("video[data-src]");
            if (overlayVideo) {
                loadVideo(overlayVideo);
                overlayVideo.play().catch(() => {});
            }
        }
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

// Animated WebP thumbnails are loaded only when they approach the viewport,
// so a long projects page does not download every animation up front.
const lazyImages = [...document.querySelectorAll("img[data-src]")];

if ("IntersectionObserver" in window) {
    const loadImage = (image) => {
        image.src = image.dataset.src;
        if (image.dataset.srcset) {
            image.srcset = image.dataset.srcset;
        }
    };

    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const image = entry.target;
            const delay = Number(image.dataset.delay || 0);
            imageObserver.unobserve(image);

            // The first card uses a small static poster for the initial paint
            // so a heavy animated WebP does not delay LCP. The animation then
            // replaces the poster once the page has settled.
            if (delay) {
                setTimeout(() => loadImage(image), delay);
            } else {
                loadImage(image);
            }
        });
    }, { rootMargin: "200px 0px" });

    lazyImages.forEach((image) => imageObserver.observe(image));
} else {
    lazyImages.forEach((image) => {
        image.src = image.dataset.src;
    });
}

// Overlay videos are loaded only when they become visible (overlay opened).
// This keeps the initial payload small.
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
