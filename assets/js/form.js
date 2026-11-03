// Formulaire de contact : envoie les données à l'API /api/form.
// L'API attend un objet JSON dont le champ "arg" contient le JSON du message.
document.getElementById("form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const form = this;
    const data = {
        email: form.email.value,
        object: form.objet.value,
        message: form.message.value,
    };

    try {
        const response = await fetch("/api/form", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ arg: JSON.stringify(data) }),
        });

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        document.getElementById("confirmation").style.display = "block";
        form.reset();
    } catch (error) {
        console.error(error);
    }
});
