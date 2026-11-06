# Application du design system Apple · v7 (2026-11)

Branche : `arena/0f048ea4-makarimpms`. Périmètre : `prototype/` uniquement (aucune
modification de `backend/` ni de `frontend/`). Décision associée : **RD-034**.

## 1. Ce qui est retiré

| Élément | Statut | Motif |
| --- | --- | --- |
| Palette sable (`--color-sand-*`, fond crème) | **supprimé** | refus explicite du commanditaire ; les tokens deviennent neutres (`mist-50 #fafafc`, `mist-100 #f5f5f7`, `mist-200 #e8e8ed`, `mist-300 #d2d2d7`) |
| Bleu majorelle `#2f4090` | remplacé | accent unique `#0066cc` (Action Blue) |
| Terre cuite `#ab5135` | remplacée | graphite `#424245` : plus d'accent chaud, le mobilier s'efface |
| Titre serif Marcellus | retiré | la pile SF Pro n'a pas de serif d'affichage ; `@fontsource/marcellus` n'est plus importé |
| Motif zellige | retiré | aucun fond décoratif dans le système ; la classe subsiste, vide, pour ne rien casser |
| Ombres de carte (`shadow-card`) | supprimées | une seule ombre autorisée, réservée à la modale |
| Dégradé de la sparkline | conservé | il encode une donnée (aire sous la courbe), pas une décoration |
| Tirets cadratins (`—`) dans l'interface | purgés (188 occurrences) | règle anti-slop : séparateur `·` ou deux-points |

## 2. Tokens (source : `prototype/src/index.css`)

- **Surfaces** : `surface #ffffff`, `mist-50 #fafafc`, `mist-100 #f5f5f7`, `mist-200 #e8e8ed`, `mist-300 #d2d2d7`, `nav #000000`.
- **Encre** : `ink #1d1d1f`, `ink-2 #333333`, `ink-3 #6e6e73` (4,6:1 sur parchemin).
- **Filets** : `line #e0e0e0`, `line-soft #f0f0f0`, `line-strong #86868b` (3,5:1 sur blanc, WCAG 1.4.11).
- **Accent** : `maj #0066cc`, `maj-700 #0055a5`, `maj-100 #e6f0fb`, `maj-50 #f3f8fe`. Focus : `#0071e3`.
- **États** : jade `#0f6b3f`, safran `#8a5300`, rouge `#c42120`, graphite `#424245`, chacun avec sa teinte à 8-10 %.
- **Typographie** : `'SF Pro Text'` / `'SF Pro Display'`, repli `-apple-system`, `system-ui`, `Segoe UI`, `Geist Variable`. Affichage 600 avec tracking `-0.28 px` à `-0.5 px` ; corps 15 px / 1,47 (densité d'exploitation, contre 17 px sur un site vitrine) ; tableaux 11-13 px.
- **Rayons** : 8 px (contrôles, champs, boutons d'outil), 14-18 px (cartes, panneaux, modales), pilule (boutons d'action). Aucune autre valeur.
- **Élévation** : `shadow-card` transparent ; `shadow-pop` uniquement pour la modale et le panneau latéral.

## 3. Composants repris

- `Button` : pilule, hauteurs 32/40/48 px, `scale(0.95)` au press, quatre variantes (primary bleu, utilitaire bordé, discret, danger). Le bouton « terra » devient encre pleine.
- `Card` : rayon 18 px, filet 1 px, fond blanc, aucune ombre.
- `CardHeader` : titre 17 px / 600 tracking `-0.374 px`, sous-titre 13 px `ink-3`.
- `Pill` : 11-12 px, rayon pilule, teintes à faible saturation, jamais seule porteuse d'information.
- `Stat` : libellé 13 px en casse normale (plus d'eyebrow systématique), valeur 32 px / 600.
- `Modal` / `Drawer` : fond blanc, rayon 18 px, en-tête 21 px, ombre unique.
- `Sidebar` : noir `#000000`, marque blanche, item actif `bg-white/12` + texte blanc 600, badge neutre ; le bloc « Ce soir » devient une tuile `white/6` avec anneau `#2997ff`.
- `Topbar` : 56 px, fond blanc translucide flouté, titre 17 px, recherche en pilule bordée.
- `Login` : colonne gauche noire (tuile produit), titre 40 px tracking `-0.5 px`, corps 17 px, formulaire à champs 44 px rayon 11 px, bouton pilule pleine largeur.

## 4. Densité : ce qui n'a pas été appliqué

Le système Apple est calibré pour des pages de marketing (sections de 80 px, corps 17 px,
une idée par écran). Un poste de réception affiche simultanément 30 chambres, 8 arrivées,
les folios et la caisse. Trois écarts assumés, tous documentés :

1. **Corps 15 px** au lieu de 17 px, tableaux 11-13 px (lisibilité conservée, largeur maîtrisée).
2. **Tableaux denses conservés** : les grilles de chambres, le planning de salle et les registres gardent leur hauteur de ligne ; les rayons et pilules s'appliquent au chrome, pas aux cellules.
3. **Libellés de section en petites capitales** conservés dans la navigation et les en-têtes de registre : ce sont des repères de balayage, pas des accroches marketing.

## 5. Vérifications

- Bundle esbuild : OK. Build Vite de production : OK (`dist/` supprimé après contrôle).
- Smoke jsdom : portail, session, alerte no-show, panneau de suivi, modale de suivi, exports CSV/Excel, clôture de journée. **0 erreur applicative.**
- Contrôle automatisé : aucune occurrence de `—` dans le DOM rendu ; aucun token `sand-` restant ; aucun `hover` avec translation verticale ; aucune couleur brute (`bg-[#…]`, `bg-amber`, etc.) dans `src/`.

## 6. Reste ouvert

- Les documents imprimés (factures, fiches de police, rapports) gardent une typographie sérif ? **Non** : ils utilisent la même pile, en noir sur blanc, sans couleur d'accent. La question d'une refonte des formulaires légaux pré-imprimés reste hors périmètre.
- `@fontsource/marcellus` reste déclaré dans `package.json` mais n'est plus importé : à retirer lors de la prochaine mise à jour des dépendances.
- Le mode sombre n'est pas implémenté : le système Apple en prévoit un, mais un PMS de réception fonctionne en plein jour et l'ajouter doublerait la surface de test visuel.
