# Portfolio
## Matt DELAPORTE

This is a static SPA (presentation, projects, contact) whose HTML is assembled server-side by nginx using SSI (Server Side Includes). index.html contains <!--#include ... --> directives for the header, footer and page fragments, which browsers, python -m http.server, file:// and most static hosts can’t process. So the site only renders correctly when served by nginx with ssi on; and the SPA routes (/presentation, /projets, /contact) mapped to index.html.
