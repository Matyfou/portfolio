// Applique le thème sauvegardé AVANT le premier paint (script bloquant
// chargé dans le <head>). Sans ça : un flash sombre à chaque changement de page,
// le temps que le parse atteigne les scripts du <body>.
if (localStorage.getItem("theme") === "light") {
    document.documentElement.classList.add("light");
}
