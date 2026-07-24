# Logo Hôtel Makarim — asset source

`logo-makarim-source.jpg` : logo officiel fourni par l'utilisateur (225×225, fond blanc), destiné à une intégration ultérieure — **pas encore câblé nulle part** dans l'application.

Usages prévus, à faire dans une session dédiée :
- Logo affiché dans `AppSidebar` (remplace le badge « M » générique actuel).
- Favicon (`frontend/public/favicon.svg` reste le favicon actif tant que ce logo n'est pas décliné en SVG/PNG optimisé).
- En-tête des documents PDF générés côté backend (fiche de police — `police/utils/police-record.pdf.ts` — et toute future facture/reçu, module `billing`).

Le fichier source (JPEG) devra probablement être retravaillé (fond transparent, déclinaisons de taille) avant intégration réelle — conservé tel que fourni pour l'instant.
