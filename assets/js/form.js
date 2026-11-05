const form = document.getElementById("form");

// The API expects a JSON body whose "arg" field contains the message JSON.
form?.addEventListener("submit", async (event) => {
    event.preventDefault();

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
            throw new Error(`HTTP ${response.status}`);
        }

        document.getElementById("confirmation").style.display = "block";
        form.reset();
    } catch (error) {
        console.error(error);
    }
});
