# Composants partagés manquants — Makarim PMS v1 (frontend)

Constat de départ (`docs/audits/PHASE_08_FRONTEND.md` §1) : `components/ui/` ne contient que 6 primitives shadcn/ui (`badge`, `button`, `dialog`, `input`, `label`, `select`). Chaque page à données tabulaires recompose sa propre structure. Ce document liste les composants dont l'absence a été identifiée comme un manque réel pour développer les écrans de `CARTOGRAPHIE_ECRANS.md` — pas une liste théorique de tout ce qu'un design system pourrait contenir.

## Composants à construire avant les écrans qui en dépendent

| Composant | Écrans qui en dépendent | Pourquoi il manque aujourd'hui | Priorité de construction |
|---|---|---|---|
| `table` (tri, pagination simple) | É-06 (audit log, table dense filtrable), É-03 (journal de notifications), Reporting (déjà construit sans lui, à harmoniser plus tard) | Chaque page tabulaire recompose sa propre structure en `div`/`grid` (constat Phase 8) | Haute — bloque É-06 en particulier |
| `form` structuré (regroupement label+input+erreur, cohérent avec `class-validator` du backend) | É-01 (police), tout formulaire multi-champs futur | Les formulaires existants (ex. `ReplenishForm` dans Stock) recomposent leur propre structure champ par champ | Haute — É-01 est un chantier bloquant |
| `select` avec recherche (combobox) | É-01 (type de pièce, nationalité), potentiellement `GuestPicker` existant à harmoniser | Le `select` actuel est une primitive simple, pas de recherche intégrée | Moyenne |
| `date-picker` | É-01 (date de naissance), tout écran futur avec saisie de date manuelle (l'existant utilise `<input type="date">` natif, fonctionnel mais visuellement basique) | Aucun composant date dédié dans `components/ui/` | Moyenne |
| `toast` / notification transverse | Tous les écrans — remplacerait le pattern actuel « erreur affichée en ligne dans la page » pour les confirmations de succès (aujourd'hui aucune confirmation visuelle homogène de succès n'existe, seulement l'absence d'erreur) | Absent, confirmé Phase 8 | Moyenne — améliore l'UX sans bloquer un écran précis |
| `tabs` | É-03 (templates vs journal), potentiellement le détail de séjour (billing/payments/police regroupés) | Absent — les pages existantes simulent un « tabs » avec un `useState` local et des boutons (`StockPage.tsx`, confirmé lecture Phase 4/session précédente) | Moyenne |
| `badge` de statut sémantique étendu | É-04 (statut de mapping OTA), É-02 (statut self-checkin) | Le `badge` existant fonctionne mais sans variante sémantique standardisée (succès/attention/erreur) au-delà de `destructive` déjà utilisé | Basse — extension du composant existant, pas une création |
| `file-upload` (drag & drop, preview image) | É-05 (scan document-ocr) | Aucun composant d'upload de fichier n'existe dans le frontend actuel | Moyenne — spécifique à un seul écran secondaire |
| `diff-viewer` (affichage `oldValue`/`newValue`) | É-06 (audit log) | Spécifique et jamais nécessaire jusqu'ici | Basse — peut démarrer en JSON brut lisible et être amélioré ensuite |
| `error-boundary` | Transverse, tous les écrans | Confirmé absent (Phase 8 §3) — aujourd'hui une erreur de rendu React non gérée casse silencieusement la page sans message clair | Haute — filet de sécurité transverse, indépendant d'un écran précis |

## Ce qui n'est PAS un manque à combler dans ce chantier

- **Un routeur** (deep linking) : identifié comme manquant en Phase 8, mais c'est une décision d'architecture de navigation, pas un composant partagé — traité séparément dans `PLAN_DEVELOPPEMENT_FRONTEND.md` si retenu.
- **Un state manager global** : la Phase 8/9 n'a identifié aucune duplication ni incohérence liée à l'absence de state manager — introduire Redux/Zustand n'est pas justifié par un constat d'audit. **CH-011 (terminé, session courante)** n'a finalement pas nécessité de `AuthContext` séparé non plus : un seul consommateur des permissions (`AppSidebar`) existait au moment de l'implémentation, l'état `permissions` vit directement dans `App.tsx` et lui est transmis en prop — cohérent avec l'absence de state manager global, un Context dédié aurait été une abstraction prématurée pour un seul consommateur (à réintroduire si un second consommateur apparaît).

## Ordre de construction recommandé

1. `error-boundary` (transverse, gratuit, protège tous les écrans futurs dès maintenant).
2. `form` structuré + `date-picker` (débloquent directement É-01, le chantier frontend le plus urgent).
3. `table` (débloque É-06 et améliore la maintenabilité des écrans existants à données tabulaires, sans les réécrire dans l'immédiat — nouvelle construction seulement).
4. `tabs`, `select` recherche, `toast` (améliorations transverses, à construire au fil de l'eau selon les écrans qui en profitent).
5. `file-upload`, `diff-viewer` (spécifiques à un seul écran chacun, à construire seulement quand cet écran précis est engagé).
