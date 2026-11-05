# Portfolio — Matt DELAPORTE

Site statique sous forme de SPA (présentation, projets, contact). Le HTML est
assemblé côté serveur par **nginx** avec **SSI (Server Side Includes)**.

## Important : nginx est obligatoire pour les includes

`index.html` ne contient pas directement le header, le footer et les trois
pages. Il contient des directives SSI :

```html
<!--#include virtual="/partials/header.html" -->
<!--#include virtual="/fragments/presentation.html" -->
<!--#include virtual="/fragments/projets.html" -->
<!--#include virtual="/fragments/contact.html" -->
<!--#include virtual="/partials/footer.html" -->
```

Un navigateur ne sait pas interpréter ces directives : il les affiche telles
quelles. Il en va de même pour `python -m http.server`, `file://` et la plupart
des hébergeurs statiques.

Il faut donc servir le site avec **nginx configuré pour SSI**, notamment :

```nginx
ssi on;

location = /presentation { try_files /index.html =404; }
location = /projets      { try_files /index.html =404; }
location = /contact      { try_files /index.html =404; }

location /partials/  { internal; }
location /fragments/ { internal; }
```

La configuration complète et prête à l'emploi se trouve dans
`docker/nginx/default.conf`. Sans elle, les fragments ne sont pas inclus et le
site ne s'affiche pas correctement.

## Lancer le site en local

```bash
docker compose up -d
```

Le site est disponible sur <http://localhost:8080> (redirection vers
`/presentation`).

## Structure

- `index.html` — coquille SPA et directives SSI.
- `partials/` — header et footer inclus par SSI.
- `fragments/` — contenu des pages et overlays des projets.
- `assets/css/`, `assets/js/` — styles, thème, shader, navigation SPA.
- `assets/images/` — images, vidéos optimisées et posters.
- `../docker/nginx/default.conf` — configuration nginx (SSI, routes SPA,
  cache, proxy du formulaire).

## Quelques notes

- Les vignettes animées des cartes sont des **WebP animés 800 px**, 20 fps,
  de même résolution que les overlays. Elles s'animent sans dépendre de la
  politique d'autoplay des vidéos et restent chargées à l'approche du viewport.
  La première carte affiche d'abord un poster statique puis charge l'animation,
  pour ne pas retarder le LCP.
- Les vidéos des overlays sont en **800 px de large**, 20 fps, sans audio, avec
  un WebM VP9 principal et un MP4 H.264 de secours. Elles sont chargées au clic
  sur la carte, dans le geste utilisateur, donc la lecture est autorisée.
- Les images et vidéos ont des dimensions explicites pour éviter les sauts de
  mise en page.
- Les médias et polices sont mis en cache **24 h**. Les CSS/JS sont versionnés
  par query string et mis en cache plus longtemps. Les routes SPA ne sont pas
  mises en cache.
