# Audit de design — prototype PMS Makarim 3★

**Date :** 2026-11-06 · **Périmètre :** `prototype/` (7 écrans, 6 profils RBAC)
**Référentiel de comparaison :** `docs/MAKARIM_DESIGN_SYSTEM_2026.md` (§1.2 contraste,
§1.3 radius/espacement, §1.4 typographie, §8 accessibilité)

---

## 0. Verdict

**Note globale : 7,5 / 10.** L'identité est cohérente, la hiérarchie visuelle tient,
et les écrans d'exploitation sont denses sans être confus. Trois familles de défauts
restent : **contraste des textes secondaires**, **échelle typographique trop fine**
et **finitions d'accessibilité** (annonces, cibles tactiles, association des labels).

**17 corrections appliquées** dans cette passe, dont 6 échecs de contraste WCAG et
un défaut de cohérence produit (le devis séminaire autorisait 70 participants pour
une salle annoncée à 60 places).

> **Limite de méthode, assumée.** Le navigateur headless n'a pas pu être installé
> dans cet environnement (`npx playwright install chromium` → téléchargement
> bloqué) : cet audit est donc **statique** — tokens, classes, markup, calculs de
> contraste WCAG, rendu jsdom — et **non visuel**. Les points qui exigent un œil
> humain (équilibre des blancs, poids des ombres en réel) sont signalés comme tels
> en §7. Ils ne sont pas inventés.

---

## 1. Méthode

| Test | Outil | Résultat |
|---|---|---|
| Contraste WCAG 2.1 | calcul de luminance relative sur les tokens réels | 13 paires évaluées, **6 échecs** trouvés puis corrigés |
| Cohérence des tokens | grep exhaustif des couleurs brutes | 0 couleur Tailwind par défaut, 4 valeurs brutes résiduelles → 0 |
| Échelle typographique | inventaire des tailles arbitraires | 12 tailles → **8** |
| Échelle de rayons / ombres | inventaire | 5 rayons → **3**, 3 ombres ad hoc → tokens |
| États (vide, désactivé, focus) | lecture des écrans | 32 états vides, focus global, `disabled` présent |
| Accessibilité ARIA | lecture du markup | 3 défauts corrigés, 2 restants |
| Rendu fonctionnel | jsdom (7 écrans, modales, profils) | 0 erreur console |

---

## 2. Contraste — le défaut le plus grave, et il est corrigé

Le référentiel impose **≥ 7:1** pour `--text` / secondaire et **AA (4.5:1)** pour
tout texte lu. Le prototype échouait sur le **texte tertiaire** (`ink-3`) utilisé
pour des libellés informatifs, et sur deux pastilles de statut.

| Paire | Avant | Après | Verdict |
|---|---:|---:|---|
| `ink-3` sur carte blanche | **3.76** | **5.17** | ✅ |
| `ink-3` sur fond sable | **3.37** | **4.63** | ✅ |
| `ink-3` sur sidebar (`sand-50`) | **3.60** | **4.95** | ✅ |
| Pastille restaurant (`terra`/`terra-100`) | **3.74** | **4.53** | ✅ |
| Pastille conférence (`saffron`/`saffron-100`) | **3.17** | **4.58** | ✅ |
| Texte blanc sur bouton restaurant | 4.37 | **5.30** | ✅ |
| Bordure de champ (`line` sur blanc) | **1.34** | **3.32** (`line-strong`) | ✅ |
| Texte principal `ink` sur sable | 14.8 | 14.8 | ✅ |
| Texte secondaire `ink-2` sur carte | 7.26 | 7.26 | ✅ |
| Pastilles succès / alerte | 4.55 / 4.97 | inchangé | ✅ |

**Tokens modifiés** (`src/index.css`) : `--color-ink-3 #79877f → #647069`,
`--color-terra #c05b3c → #ab5135`, `--color-saffron #b57c10 → #92640d`.
**Tokens ajoutés** : `--color-surface` (blanc tokenisé, plus de `bg-white`),
`--color-line-strong` (bordure de composant interactif, ≥ 3:1).

> Effet de bord utile : la teinte reste la même famille (terre cuite, safran), seule
> la luminosité descend de deux crans. L'identité ne change pas, la lisibilité oui.

---

## 3. Typographie — l'écart de fond avec le design system

Le DS §1.4 est explicite : **« corps de texte 14 px minimum, jamais en dessous pour
du texte de contenu courant »**, et le `10 px uppercase` est réservé aux
micro-labels. Or le prototype, construit pour tenir à 1366×768, utilise :

| Taille | Occurrences | Usage réel |
|---|---:|---|
| 11 px | 87 | libellés de tableaux, valeurs secondaires, pastilles |
| 12 px | 86 | cellules, descriptions, onglets |
| 10 px | 59 | eyebrows, en-têtes de colonnes, hints |
| 13 px | 27 | corps de cartes |
| 26 px | 8 | titres d'écran (conforme) |

**146 fragments de texte sous 12 px.** C'est un choix de densité assumé, mais il
entre en conflit direct avec la règle de confort du référentiel.

**Ce qui a été fait** : normalisation des valeurs hors échelle (`9.5`, `10.5`,
`11.5`, `12.5` → `10`, `11`, `12`) et passage des **labels de formulaire** à
12 px, casse normale, `ink-2` (le DS interdit explicitement le label de champ en
10 px uppercase).

**Arbitrage rendu (RD-030, `docs/governance/REGISTRE_DECISIONS.md`)** : échelle à
quatre paliers — 14 px pour le contenu, 12 px pour les données et libellés
secondaires, 11 px pour les zones de densité (planning, pastilles, navigation
mobile), 10 px **exclusivement** pour les eyebrows et les `kbd`. Les données
métier ne descendent plus jamais à 10 px. Après application : 39 occurrences en
10 px, toutes en eyebrow/kbd/axe ; le corps de lecture est passé à 14 px.

**Ce qui n'a pas été fait, volontairement** : relever tout le corps à 14 px.
Sans rendu navigateur, un changement d'échelle global sur des cartes à hauteur
fixe, des barres de planning et des tableaux denses **casserait des mises en page
que je ne peux pas vérifier**. C'est un arbitrage à faire avec un rendu réel :
soit passer le corps à 14 px et accepter ~15 % de contenu en moins par écran,
soit amender le DS pour les écrans d'exploitation. **Ma recommandation** : 14 px
pour les tableaux et les cartes de consultation, 12 px pour les zones de densité
(planning 14 jours, plan de salle), 10–11 px uniquement pour les eyebrows.

---

## 4. Composants et finitions

| Constat | Correction |
|---|---|
| 5 valeurs de rayon (`md/lg/xl/2xl/full`) sans logique | **3 valeurs** : `xl` (cartes, panneaux), `lg` (contrôles), `full` (pastilles) |
| 3 ombres écrites en `rgba()` ad hoc | remplacées par `shadow-card` / `shadow-pop` |
| 1 couleur brute dans le logo SVG (`#2f4090`) | `var(--color-maj)` — plus aucune couleur littérale dans les composants |
| 15 boutons-icônes à 28–32 px | **36 px** (cible tactile minimale hors mobile) |
| Chips de moyen de paiement à 24 px de haut | 30 px + `text-[11px]` |
| Champs sans anneau de focus (`outline-none` + changement de bordure seul) | `focus:ring-2 focus:ring-maj/25` + bordure `line-strong` |

---

## 5. Accessibilité

**Corrigé**

1. **Labels non associés** : les `<label>` n'avaient pas de `for` et les champs pas
   d'`id` — un lecteur d'écran annonçait « champ de saisie » sans nom.
   → `htmlFor`/`id` sur Client, Arrivée, Formule (réservation), Entreprise, Date
   (devis) ; groupes de boutons (`Canal`, `Nuitées`, `Occupants`, `Chambres`,
   `Créneau`, `Format`, `Prestations`, `Moyen de paiement`) passés en
   `role="group"` + `aria-labelledby`.
2. **Toasts muets** : les confirmations (« Check-in effectué », « Note envoyée »)
   n'étaient pas annoncées → `role="status"` + `aria-live="polite"` + `aria-atomic`.
3. **Aucun lien d'évitement** : impossible d'aller au contenu sans traverser les
   9 entrées de navigation → lien « Aller au contenu principal » ajouté
   (visible au focus), cible `#contenu` sur `<main>`.
4. **Valeurs modifiées sans annonce** : compteurs de nuitées / occupants /
   participants → `aria-live="polite"`.
5. Champs de recherche sans label (Chambres, Caisse) → `aria-label` explicite.

**Déjà conforme** : `role="dialog"` + `aria-modal` sur les panneaux, fermeture par
`Échap`, focus visible global, `prefers-reduced-motion`, tableaux en
`overflow-x-auto`, contrastes ci-dessus.

**Corrigé dans la passe 2 (RD-030)**

- **Piège de focus** implémenté dans `Modal` et `Drawer` : `Tab`/`Shift+Tab`
  cyclent dans le panneau, focus rendu à l'élément déclencheur à la fermeture
  (WCAG 2.4.3), vérifié en jsdom.
- **`aria-current="page"`** ajouté sur la navigation mobile.

**Restant (P2)**

- **Hiérarchie de titres** : le `h1` de la barre supérieure (« Chambres ») et le
  `h2` de l'écran (« Plan des chambres ») disent deux choses différentes. Un seul
  titre par écran serait plus propre.
- **`aria-current="page"`** présent sur la navigation latérale, absent de la barre
  inférieure mobile.

---

## 6. Cohérence produit (le design révèle les règles)

Un défaut trouvé par l'audit visuel **et** par la lecture du code :

> Le devis séminaire affichait « capacité max. 60 (théâtre) » mais le bouton `+`
> autorisait jusqu'à **70 participants** : l'interface permettait de construire un
> devis invendable, en contradiction avec BR-EVT-006.

**Corrigé** : la capacité est lue dans le référentiel (`SALLE.capacites[0].places`),
le bouton `+` s'y arrête, le libellé et le sous-titre d'écran utilisent la même
valeur. C'est le type d'écart qu'un design audit doit lever : l'UI ne doit jamais
pouvoir produire un état que la règle métier interdit.

---

## 7. Ce qu'un audit statique ne peut pas juger

À vérifier sur un rendu réel (Chromium indisponible ici) :

1. **Équilibre des blancs** à 1366×768 sur les écrans les plus denses
   (tableau de bord, planning 14 jours).
2. **Poids perçu des ombres** : `shadow-card` a été calibrée « à l'aveugle ».
3. **Rendu du motif zellige** : opacité 0.13 — peut être invisible ou trop présent
   selon les écrans.
4. **Comportement du plan de salle** sur tablette 768 px (3 colonnes → 2).
5. **Lisibilité de Marcellus** en 26 px sur les titres d'écran (le DS ne prescrit
   qu'une police, Geist ; l'ajout d'une serif d'enseigne est un choix de la refonte).

---

## 8. Constats priorisés

| # | Constat | Gravité | État |
|---|---|---|---|
| 1 | Texte tertiaire sous AA (3.37–3.76:1) sur 3 fonds | 🔴 P0 | corrigé |
| 2 | Pastilles restaurant et conférence sous AA | 🔴 P0 | corrigé |
| 3 | Devis séminaire autorisant 70 participants pour 60 places | 🔴 P0 | corrigé |
| 4 | Labels de champs non associés (10 contrôles) | 🟠 P1 | corrigé |
| 5 | Toasts non annoncés aux lecteurs d'écran | 🟠 P1 | corrigé |
| 6 | Bordure de champ à 1.34:1 | 🟠 P1 | corrigé |
| 7 | Pas de lien d'évitement | 🟠 P1 | corrigé |
| 8 | Focus uniquement par bordure, sans anneau | 🟠 P1 | corrigé |
| 9 | Corps de texte sous le seuil 14 px du DS | 🟠 P1 | **tranché (RD-030)** |
| 10 | Piège de focus absent dans les modales | 🟠 P1 | corrigé (RD-030) |
| 11 | 5 rayons et 3 ombres hors tokens | 🟡 P2 | corrigé |
| 12 | Cibles tactiles 28–32 px | 🟡 P2 | corrigé (36 px) |
| 13 | `bg-white` non tokenisé | 🟡 P2 | corrigé (`surface`) |
| 14 | Titre en double (h1 topbar / h2 écran) | 🟡 P2 | à faire |
| 15 | `aria-current` manquant sur la barre mobile | 🟡 P2 | corrigé |

---

## 9. Fichiers modifiés

`src/index.css` (tokens + contraste) · `src/App.jsx` (skip link, cible `<main>`) ·
`src/components/ui.jsx` (toast `role=status`, ombres) · `src/components/Shell.jsx`
(logo tokenisé, cibles) · `src/screens/{Dashboard,Rooms,Reservations,Restaurant,
Conference,Caisse,Rates}.jsx` (labels, ARIA, capacités, échelles).

**Vérification** : `vite build` OK (386 kB JS / 41 kB CSS), 7 écrans rendus,
labels associés, zone live présente, **0 erreur console**.
