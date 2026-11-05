const pages = [...document.querySelectorAll("[data-page]")];

function scrollTop() {
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;

    html.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    html.style.scrollBehavior = previous;
}

let activeTransition = null;
let currentPage = null;

function show(path, animate = true) {
    const target = pages.find((page) => page.dataset.path === path) || pages[0];
    if (!target) return;

    currentPage = target;

    const update = () => {
        const page = currentPage;
        if (!page) return;

        pages.forEach((item) => {
            item.classList.toggle("active", item === page);
        });

        if (page.dataset.title) {
            document.title = page.dataset.title;
        }

        scrollTop();

        document.querySelectorAll("a[data-link]").forEach((link) => {
            if (new URL(link.href).pathname === page.dataset.path) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });

        document.body.style.overflow = "";
        document.dispatchEvent(new Event("pagechange"));
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!animate || !document.startViewTransition || reduceMotion) {
        update();
        return;
    }

    // Do not stack transitions: update immediately if one is already running.
    if (activeTransition) {
        activeTransition.skipTransition();
        activeTransition = null;
        update();
        return;
    }

    const transition = document.startViewTransition(update);
    activeTransition = transition;

    const clear = () => {
        if (activeTransition === transition) {
            activeTransition = null;
        }
    };

    transition.ready.catch(() => {});
    transition.updateCallbackDone.catch(() => {});
    transition.finished.then(clear, clear);
}

function goTo(link) {
    const path = new URL(link.href).pathname;
    if (path !== location.pathname) {
        history.pushState({}, "", path);
    }

    show(path);
}

let pointerNavigationLink = null;

// Navigate on mouse press. The following click is ignored to avoid double navigation.
document.addEventListener("pointerdown", (event) => {
    if (event.defaultPrevented || !event.isPrimary || event.button !== 0 ||
        event.pointerType !== "mouse" ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
    }

    const link = event.target.closest("a[data-link]");
    if (!link) return;

    event.preventDefault();
    pointerNavigationLink = link;
    goTo(link);
});

function clearPointerNavigation() {
    setTimeout(() => {
        pointerNavigationLink = null;
    }, 0);
}

document.addEventListener("pointerup", clearPointerNavigation);
document.addEventListener("pointercancel", clearPointerNavigation);

// Keyboard, touch and programmatic activation still use click.
document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
    }

    const link = event.target.closest("a[data-link]");
    if (!link) return;

    event.preventDefault();

    if (link === pointerNavigationLink) {
        pointerNavigationLink = null;
        return;
    }

    goTo(link);
});

window.addEventListener("popstate", () => show(location.pathname));

show(location.pathname, false);
