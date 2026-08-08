# Makarim Design System 2026 — v1

**Statut** : document de référence, en attente de validation. Non commité (DESIGN-001C, mission read-only).
**Direction retenue** : B — Modern Operations (DESIGN-001B), seule et sans mélange avec A/C pour cette v1.
**Écran source** : maquette Dashboard desktop 1366×768 / mobile 390×844 de DESIGN-001B.

## Principe fondamental (rappel, non négociable)

Le moteur reste verrouillé : backend, contrats API, calculs, règles métier, RBAC, workflows validés, modèles Prisma, logique financière, comportement déjà couvert par les tests — **rien de tout cela ne change dans ce document ni dans les lots qui en découleront sans une décision produit séparée**. Ce document ne décrit que la couche présentation.

Légende utilisée dans tout le document, cohérente avec DESIGN-001A/B : **EXISTANT — conserver** / **EXISTANT — adapter visuellement** / **À CRÉER** / **À SUPPRIMER progressivement**.

---

## 1. Palette Makarim 2026 (extraite de la direction B)

### 1.1 Tokens de base

| Token | Valeur | Usage |
|---|---|---|
| `--background` | `#EFF3F8` | Fond de page |
| `--surface` | `#FFFFFF` | Cartes, panneaux, dialogs |
| `--surface-2` | `#E6ECF5` | Fond de sous-bloc (chip, ligne de liste, zone de recherche) |
| `--chrome-bg` | `#FFFFFF` | Fond de la sidebar — **cible corrigée DESIGN-001C, sidebar claire** (voir §1.1bis, remplace le marine profond `#0F2B52` de la première version) |
| `--chrome-text` | `#344154` | Texte de navigation par défaut (item non actif) sur chrome clair — équivalent à `--text-secondary` |
| `--chrome-border` | `#E1E7F0` | Séparateurs internes à la sidebar claire (au lieu d'une bordure sur fond sombre) |
| `--chrome-bg-alt-dark` | `#1E4A82` | **Repli documenté uniquement** — bleu de chrome sensiblement plus clair que l'ancien `#0F2B52`, à n'utiliser que si une contrainte de la maquette B impose un chrome sombre (voir §1.1bis) ; non retenu par défaut |
| `--primary` | `#175CD3` | Action principale, éléments de marque, liens |
| `--primary-hover` | `#134FB4` | État hover/actif du primary |
| `--primary-ink` | `#FFFFFF` | Texte/icône sur fond primary |
| `--primary-soft` | `#DCE8FB` | Fond pastel (badges, item de nav actif en chrome clair, icônes) |
| `--text` | `#101828` | Texte principal |
| `--text-secondary` | `#475467` | Texte secondaire — labels, hints, sous-titres (contraste ≥7:1 sur `--surface`, cf. §8) |
| `--text-tertiary` | `#6B7280` (**corrigé DESIGN-001C**, ex-`#8D97A8`, rehaussé pour rester ≥AA, voir §1.2) | Captions, méta décorative réellement dispensable — jamais un placeholder informatif ni une donnée à lire (voir règle d'usage §1.2) |
| `--border` | `#D3DCE8` | Bordures de carte, séparateurs |
| `--success` | `#0B8A55` | Statut positif |
| `--success-soft` | `#DDF3E7` | Fond badge succès |
| `--warning` | `#B54708` | Statut attention |
| `--warning-soft` | `#FBE7D6` | Fond badge attention |
| `--destructive` | `#C4271E` | Erreur, blocage, action irréversible |
| `--destructive-soft` | `#FADDDB` | Fond badge erreur |
| `--info` | `#0086C9` | Statut informatif neutre |
| `--info-soft` | `#D8F0FA` | Fond badge information |
| `--violet` | `#7A5AF8` | Canal Airbnb **et** statut housekeeping « En nettoyage » — double usage déjà pratiqué dans le code actuel (CH-063), conservé tel quel |
| `--violet-soft` | `#E8E2FE` | Fond badge violet |
| `--canal-walkin` | `#0E9384` (teal) | Canal de réservation Walk-in — remplace définitivement l'ancien token `--gold`. Aucun jaune/doré nulle part dans ce design system. |

**Confirmation explicite demandée par la mission** : aucun retour au bleu marine sombre historique (`#283379`, L=35,5%) ni à l'accent or/champagne (`--gold`, `oklch(0.728 0.138 89.7)`) — les deux sont **définitivement retirés** de ce design system. Le nouveau `--primary` (`#175CD3`) est un bleu net et plus lumineux ; le rôle décoratif que jouait l'or est repris par `--canal-walkin` (usage fonctionnel, pas décoratif) et par la variation d'intensité du `--primary` lui-même (jamais par une nouvelle couleur d'accent libre).

### 1.1bis Chrome/sidebar — cible corrigée (DESIGN-001C)

**Constat** : la v1 initiale de ce document reprenait de la maquette B un `--chrome-bg: #0F2B52` — un marine profond qui, en usage réel prolongé (sidebar visible en permanence), risquait de reconduire exactement la perception « bleu nuit trop sombre » que le pivot stratégique a explicitement rejetée pour l'interface actuelle. Corrigé ici avant toute implémentation, sans toucher à la maquette B elle-même ni à aucun code.

**Cible retenue par défaut : sidebar claire.**
- Fond de sidebar : `--chrome-bg` (`#FFFFFF`, identique à `--surface` — une séparation visuelle avec le contenu est assurée par `--chrome-border` et l'ombre `--shadow-card` portée par la sidebar, pas par un contraste de teinte).
- Item de navigation actif : fond `--primary-soft` (`#DCE8FB`) + texte/icône `--primary` (`#175CD3`) — cohérent avec le pattern déjà utilisé pour les badges (§1.1) et déjà prévu comme repli dans DESIGN-001A.
- Item de navigation inactif : texte `--chrome-text` (`#344154`, équivalent `--text-secondary`), icône assortie.
- Logo Makarim et le `--primary` restent bien visibles sur fond clair — c'est la combinaison la plus favorable à leur lisibilité, plus favorable qu'un logo clair détouré sur fond sombre.
- Topbar : reste `--surface` (`#FFFFFF`), cohérente avec la sidebar claire — l'ensemble du chrome applicatif (sidebar + topbar) devient un chrome clair unifié, seul le contenu utilise `--background` (`#EFF3F8`) pour se distinguer du chrome.

**Repli documenté (non retenu par défaut)** : si l'implémentation du Shell en DESIGN-002 révèle une raison forte de conserver un chrome sombre (ex. lisibilité de contraste sur un écran de dashboard très dense, retour utilisateur négatif sur le chrome clair en usage réel), la seconde option reste `--chrome-bg-alt-dark` (`#1E4A82`) avec `--chrome-text: #EAF0FC` — sensiblement plus clair que l'ancien `#0F2B52` (delta de luminosité perceptible, sans effet « bleu nuit »), jamais un retour au token d'origine. Ce repli doit être justifié explicitement au moment de DESIGN-002 avant d'être appliqué, pas appliqué par défaut.

**Aucune maquette ni aucun code n'est modifié à cette étape** — cette sous-section formalise uniquement la cible corrigée que DESIGN-002 devra implémenter.

### 1.2 Contraste — priorité explicite de la mission

Vérification des paires texte/fond effectivement utilisées :

| Paire | Ratio approx. | Verdict |
|---|---|---|
| `--text` (#101828) sur `--surface` (#FFFFFF) | ~16.1:1 | Largement AAA |
| `--text-secondary` (#475467) sur `--surface` (#FFFFFF) | ~7.9:1 | AAA (texte normal), largement au-dessus du seuil AA 4.5:1 |
| `--text-secondary` (#475467) sur `--background` (#EFF3F8) | ~7.3:1 | AAA |
| `--text-tertiary` (#6B7280, **corrigé DESIGN-001C**, ex-#8D97A8) sur `--surface` (#FFFFFF) | ~4.6:1 | AA — rehaussé pour ne plus jamais tomber sous le seuil AA texte normal, y compris sur les usages décoratifs (voir règle d'usage ci-dessous) |
| `--primary-ink` (#FFFFFF) sur `--primary` (#175CD3) | ~4.6:1 | AA (texte de bouton, taille ≥14px bold — conforme) |
| `--text` (#101828) sur `--chrome-bg` clair (#FFFFFF) | ~16.1:1 | AAA — chrome clair, cible corrigée §1.1bis |
| `--primary` (#175CD3) sur `--primary-soft` (#DCE8FB), item de nav actif | ~5.1:1 | AA — vérifié, à reconfirmer précisément lors de l'implémentation du Shell (DESIGN-002) |
| *(repli non retenu)* `--chrome-text` (#EAF0FC) sur `--chrome-bg-alt-dark` (#1E4A82) | ~7.2:1 | AAA — documenté pour mémoire si le repli §1.1bis est activé |

**Amélioration directe demandée par la mission** : l'actuel `--muted-foreground` du projet (`oklch(0.48 0.02 272)`, un seul gris pour tout texte secondaire) est remplacé par **deux niveaux** (`--text-secondary` à fort contraste pour tout ce qui doit être lu, `--text-tertiary` à contraste réduit réservé au non-informationnel) — résout directement le défaut « textes gris trop faibles » signalé.

**Règle d'usage clarifiée (DESIGN-001C, corrige l'ambiguïté de la v1 initiale)** :
- **Texte métier principal** (nom, montant, statut, tout ce qu'un utilisateur doit lire pour faire son travail) → toujours `--text`.
- **Information secondaire réelle** (sous-titre, hint de champ, métadonnée utile mais non primaire) → toujours `--text-secondary` (~7-8:1, jamais `--text-tertiary`).
- **`--text-tertiary`** → strictement réservé au décoratif/méta réellement dispensable (ex. un séparateur textuel, un horodatage très secondaire déjà répété ailleurs à l'écran) — **jamais** une information dont la disparition gênerait la compréhension.
- **Placeholders de formulaire** : un placeholder purement illustratif (ex. exemple de format) peut rester `--text-tertiary`. Un placeholder **informatif** (qui porte une indication nécessaire à la compréhension du champ, ex. une contrainte de saisie non répétée ailleurs) doit utiliser `--text-secondary` — la lisibilité prime sur la subtilité esthétique, y compris pour les placeholders. Le token `--text-tertiary` a par ailleurs été rehaussé (`#8D97A8` → `#6B7280`) pour qu'aucun usage résiduel ne tombe sous le seuil AA.

### 1.3 Radius, ombres, espacement, densité

| Token | Valeur |
|---|---|
| `--radius` | `10px` (cartes, dialogs, inputs) |
| `--radius-sm` | `7px` (badges, boutons, chips, lignes de liste) |
| `--radius-full` | `100px` (pills, avatars) |
| `--shadow-card` | `0 1px 2px rgba(16,24,40,.05), 0 4px 10px rgba(16,24,40,.06)` |
| `--shadow-card-hover` | `0 2px 4px rgba(16,24,40,.08), 0 10px 20px rgba(16,24,40,.10)` |
| `--gap` | `12px` — espacement standard entre blocs frères (KPI row, colonnes) |
| `--card-padding` | `14px` |
| `--sidebar-width` | `192px` (déplié) / `64px` (replié, icônes seules — comportement déjà existant à conserver) |

**Densité** : delibérément resserrée par rapport à un design « aéré » — Direction B a été choisie précisément pour son efficacité sur un poste travaillé toute la journée (moins de scroll, plus d'information visible sans naviguer). Ce choix de densité s'applique à tous les écrans migrés, pas seulement au dashboard.

### 1.4 Typographie

**Police** : `Geist Variable` — **EXISTANT, conservé**. Aucune raison de la changer n'a été trouvée en DESIGN-001A (chiffres tabulaires natifs, aucune dépendance CDN, déjà bundlée). La maquette de comparaison DESIGN-001B utilisait une pile système générique par simplicité d'exécution de l'artefact de comparaison — **ce n'est pas une décision de conception**, la v1 réelle utilise Geist Variable partout, comme aujourd'hui.

| Rôle | Taille / poids | Usage |
|---|---|---|
| Titre de page (topbar) | `19px / 800` `letter-spacing:-.01em` | `AppTopbar` — légèrement plus affirmé que l'actuel `text-base/600` |
| Titre de carte | `14px / 750` | En-tête de `Card`/`KpiCard` |
| Valeur KPI | `26px / 800`, `font-variant-numeric: tabular-nums` | Chiffre principal d'un `KpiCard` |
| Corps de texte | `14px / 400` minimum | Défaut — jamais en dessous de 14px pour du texte de contenu courant (confort de lecture sur un usage de plusieurs heures) |
| **Label de formulaire** (**corrigé DESIGN-001C**) | `12–13px / 600`, **sans uppercase obligatoire**, casse normale | Label de champ (`<label>` de `Input`/`Select`/etc.) — priorité à la lisibilité prolongée, pas à l'esthétique « eyebrow ». `10px uppercase` n'est **plus** le standard général des labels. |
| Micro-label KPI / eyebrow | `10–11px / 700`, `letter-spacing:.03em`, uppercase acceptable | Réservé aux libellés très courts et contextuels (label au-dessus d'un `KpiCard`, en-tête de colonne dense) — jamais un label de champ de formulaire |
| Information sensible/opérationnelle | Taille et contraste renforcés (`--text`, jamais `--text-tertiary`, taille égale ou supérieure au corps 14px) | Statuts bloquants, alertes (`OperationalAlert`), soldes dus, tout ce qui déclenche une action |
| **Montants (règle systématique)** | `font-mono` + `tabular-nums`, jamais autre chose, taille ≥ au contexte (jamais réduit sous 14px hors contexte KPI) | Tout montant MAD hors titre de page — généralisation de l'usage déjà partiel dans le code actuel (présent sur les folios, absent des KPI dashboard) |

**Principe rappelé (DESIGN-001C)** : Makarim est utilisé pendant des heures de suite par la réception/gouvernante/comptabilité — le confort visuel prime sur la subtilité esthétique. Le `10px uppercase` reste disponible mais uniquement pour les micro-labels/eyebrows contextuels ci-dessus, jamais comme standard général de tous les labels de formulaire.

---

## 2. Primitives Makarim — apparence et états

Convention d'états pour tout composant interactif : `default / hover / active / focus / disabled / loading`. Le focus clavier est **toujours visible** (jamais `outline:none` sans remplacement) — voir §8.

| Primitive | Fichier actuel | Décision | Détail |
|---|---|---|---|
| **Button** | `components/ui/button.tsx` | **EXISTANT — adapter visuellement** | Structure/variants (`default/outline/secondary/ghost/destructive/link`) conservés tels quels — seule la palette change (suit `--primary`/`--destructive`). `hover`: `--primary-hover`. `active`: `translate-y-px` déjà présent + `scale(0.98)` ajouté (feedback plus net, cohérent avec la densité « opérationnelle » de B). `focus`: ring 3px `--primary/50`, déjà en place. `disabled`: opacité 50%, déjà en place. `loading`: remplace le libellé par un spinner à 2px de trait (nouveau, pattern actuellement géré au cas par cas par un changement de texte type "Enregistrement…" — le texte de secours reste supporté, le spinner est additif). |
| **IconButton** | `Button` variant `icon-sm`/`icon-lg` déjà existant | **EXISTANT — conserver** | Aucun nouveau composant : `Button` couvre déjà ce besoin via ses tailles `icon-*`. |
| **Input** | `components/ui/input.tsx` | **EXISTANT — adapter visuellement** | Hauteur inchangée (`h-8`), suit la nouvelle palette. `focus`: ring `--primary/50` + bordure `--primary`. `disabled`: fond `--surface-2`, texte `--text-tertiary`. Aucun changement structurel. |
| **Select** | `components/ui/select.tsx` | **EXISTANT — conserver** | Primitif `@base-ui/react/select` déjà complet (portal, groupes, flèches de scroll) — suit la palette automatiquement via tokens, zéro changement structurel. |
| **Search** | `Input` + icône, motif déjà utilisé dans `CheckinPage.tsx` | **EXISTANT — conserver** | Pas un nouveau composant : c'est `Input` avec une icône de recherche en préfixe, déjà le patron du code actuel. |
| **Checkbox** | non trouvé comme composant partagé dans l'inventaire DESIGN-001A | **À CRÉER** | Absent de `components/ui/` aujourd'hui (aucune case à cocher stylée trouvée en dehors de champs natifs ad hoc). Nécessaire pour les futurs formulaires multi-sélection. Base `@base-ui/react/checkbox` (déjà dans la famille de primitives utilisée par le projet, aucune nouvelle dépendance). |
| **Badge** | `components/ui/badge.tsx` | **EXISTANT — adapter visuellement** | 9 variants déjà présents (`default/secondary/destructive/success/warning/info/violet/brand/outline/ghost/link`) — structure conservée, palette mise à jour. Le variant `brand` (basé sur `--primary/10`) reste pertinent. |
| **StatusBadge** | n'existe pas en tant que composant dédié — actuellement `Badge` réutilisé avec un mapping statut→variant fait à la main dans chaque écran | **À CRÉER** (fine couche au-dessus de `Badge`) | `StatusBadge` prend directement un statut métier (`Room.statut`, `Stay.statut`, `Reservation.statut`, `Invoice.statut`) et résout lui-même la variante `Badge` + le libellé, à partir d'une table de correspondance **unique et centralisée** (remplace les mappings dupliqués trouvés dans `HousekeepingPage.tsx`, `StayDetailsDialog.tsx`, `BillingTabContent.tsx`). Aucune logique métier déplacée — uniquement la correspondance statut→couleur/libellé, déjà purement présentationnelle aujourd'hui. |
| **Card** | n'existe pas | **À CRÉER** | Motif déjà dupliqué ≥4 fois identiquement (`bg-card rounded-lg border p-4`) — extraction pure, zéro changement visuel à l'écran au moment de l'extraction. |
| **KPI Card** | `KpiCard` local à `DashboardPage.tsx`, non partagé | **À CRÉER** (formalisation en composant partagé) | Voir §3 — devient un composant transversal réutilisable par tous les écrans à indicateurs (Dashboard, Housekeeping, Réservations). |
| **Alert** | n'existe pas comme composant partagé | **À CRÉER** | Factorise le bandeau d'erreur/info inline dupliqué ≥3 fois (`ReservationsCalendarPage`, `CheckinPage`, `HousekeepingPage`). Variants : info/warning/success/destructive, sur le modèle de `--*-soft` en fond + `--*` en texte/bordure gauche. |
| **Tabs** | `components/ui/tabs.tsx` | **EXISTANT — conserver** | `@base-ui/react/tabs`, sémantique ARIA correcte, déjà utilisé (`PurchaseOrdersPage`, `RestaurantPage`, et `StayDetailsDialog` depuis UX-003B) — suit la palette, aucun changement structurel. |
| **Table** | `components/ui/table.tsx` | **EXISTANT — adapter visuellement** | Structure HTML native conservée, `overflow-x-auto` intégré conservé. Nouveau : variant `density="compact"` (housekeeping, factures) vs `density="comfortable"` (écrans de consultation occasionnelle) — un seul prop, pas une réécriture. |
| **Dialog** | `components/ui/dialog.tsx` | **EXISTANT — conserver** | Standard S/M/L/XL déjà validé (UX-002B/D) — **ne pas re-litiger les dimensions**. Palette et durées de transition mises à jour (voir §7). |
| **Drawer** | n'existe pas | **À CRÉER** | Nécessaire pour la restructuration StayDetails (30/70 sur mobile, DESIGN-001A §12) et pour tout futur panneau latéral. Base : même primitif `@base-ui/react/dialog` que `Dialog`, simplement ancré à droite plutôt que centré — aucune nouvelle dépendance. |
| **Toast** | `components/ui/toast.tsx` | **EXISTANT — adapter visuellement** | Singleton `toastManager` déjà en place et déjà utilisé. Correction ciblée : bordure de succès actuellement `border-l-emerald-500` (couleur Tailwind brute) → `border-l-[--success]` (token). |
| **Tooltip** | non trouvé dans l'inventaire `components/ui/` | **À CRÉER** | Absent aujourd'hui — les `title` HTML natifs jouent ce rôle par endroits (`ReservationsCalendarPage.tsx`, badges d'alerte police). Un vrai composant `Tooltip` (`@base-ui/react/tooltip`) améliore la découvrabilité (délai d'apparition maîtrisé, positionnement automatique) sans changer l'information affichée. |
| **Skeleton** | `components/ui/skeleton.tsx` | **EXISTANT — adapter visuellement (couverture)** | Composant déjà correct, sous-utilisé (4 fichiers seulement). Aucune modification structurelle — étendre son usage à tous les écrans qui affichent encore un texte « Chargement… » brut. |
| **EmptyState** | `components/ui/empty-state.tsx` | **EXISTANT — conserver** | Déjà bien conçu et bien adopté (10 fichiers), suit la palette automatiquement. |
| **ErrorState** | `components/ui/error-state.tsx` | **EXISTANT — conserver** | Idem, bien adopté (12 fichiers). |
| **Dropdown/menus** | `@base-ui/react/select` couvre les listes de choix ; aucun composant `Menu` générique (actions contextuelles) trouvé dans l'inventaire | **À CRÉER** (Menu contextuel, distinct de `Select`) | Nécessaire pour des actions groupées (ex. menu « … » sur une ligne de tableau : Voir / Modifier / Annuler) qui n'existent pas encore sous cette forme dans le projet — actuellement ces actions sont des boutons séparés côte à côte. Base `@base-ui/react/menu`, même famille de primitives, aucune nouvelle dépendance. |

**Garde-fou explicite (répété depuis la mission)** : cette liste ne crée **aucune bibliothèque UI parallèle**. Tout ce qui est « À CRÉER » ci-dessus est soit une extraction d'un motif déjà dupliqué dans le code (Card, Alert, StatusBadge), soit construit sur un primitif `@base-ui/react` déjà présent en dépendance (Checkbox, Drawer, Tooltip, Menu) — jamais une nouvelle dépendance npm.

---

## 3. Composants métier transversaux

| Composant | Rôle | Décision |
|---|---|---|
| `EntityStatusCard` | Carte générique client/chambre/réservation : avatar, titre, sous-titre, badges, métadonnée à droite, action | **À CRÉER** — remplace les 3 blocs `<li>` dupliqués de `CheckinPage.tsx` (arrivées/départs/séjours en cours). API proposée (DESIGN-001A §7) inchangée. |
| `KpiCard` | Carte indicateur : label, valeur, hint, barre de progression optionnelle, teinte de statut (`--kpi-tone`) | **À CRÉER** (formalisation de `DashboardPage.tsx`'s `KpiCard` local en composant partagé) — réutilisé par Dashboard, et par tout écran ayant besoin d'un indicateur chiffré (ex. compteurs Housekeeping déjà existants sous forme de « chips »). |
| `OperationalAlert` | Bandeau d'alerte contextualisé à une entité (ex. « Fiche police manquante », « Solde dû au check-out ») | **À CRÉER** — variante métier au-dessus du composant générique `Alert` (§2), porte en plus un lien/action direct vers l'écran concerné. |
| `StayCard` | Spécialisation de `EntityStatusCard` pour un `Stay` (statut EN_COURS/CHECKOUT, chambre, dates, alerte police) | **À CRÉER** — utilisé par `CheckinPage`, et potentiellement une future vue « séjours actifs » ailleurs. |
| `ReservationCard` | Spécialisation de `EntityStatusCard` pour une `Reservation` (canal, dates, statut) | **À CRÉER** — utilisé par la future vue liste mobile de `ReservationsCalendarPage` (DESIGN-001A §10) et par tout écran de consultation de réservations hors calendrier. |
| `RoomStatus` | Pastille/segment visuel dédié au statut de chambre (`LIBRE_PROPRE`/`OCCUPEE`/`A_NETTOYER`/`EN_NETTOYAGE`/`EN_MAINTENANCE`), avec la correspondance couleur canonique | **À CRÉER** (fine couche au-dessus de `StatusBadge`, spécifique à `Room.statut`) — point unique de correspondance couleur pour ce statut précis, actuellement dupliqué dans `HousekeepingPage.tsx` (`STATUT_BADGE_VARIANT`). |
| `MoneyDisplay` | Affichage systématique d'un montant MAD : `font-mono tabular-nums`, jamais animé (§7) | **À CRÉER** — trivial mais **à imposer partout** pour éliminer l'incohérence actuelle (certains montants en `font-mono`, d'autres non). |
| `StepIndicator` | Indicateur d'étape pour formulaires multi-étapes | **À CRÉER** — voir §5. |
| `SectionHeader` | Titre de section + description optionnelle + action optionnelle à droite, taille cohérente avec l'échelle typographique §1.4 | **À CRÉER** — remplace les `<h2>`/`<h3>` disparates trouvés section par section (`CheckinPage.tsx`, `HousekeepingPage.tsx`, etc., chacun avec sa propre classe Tailwind légèrement différente). |
| Composants de graphiques | Voir §6 — recommandation de bibliothèque, pas d'implémentation. | **À CRÉER**, dépendant de la décision §6. |

**Objectif rappelé** : ces composants deviennent le **seul** vocabulaire visuel pour Réservations/Réception/Housekeeping/Finance — aucun écran ne doit plus réinventer sa propre carte, son propre badge de statut, ou son propre titre de section.

---

## 4. Règles responsive

Trois paliers, alignés sur les seuils demandés (desktop ≥1280px, tablette 768–1279px, mobile <768px) — légèrement différents des seuils Tailwind par défaut (`lg`=1024px) : à implémenter via un point de rupture custom `xl-makarim: 1280px` si Tailwind est conservé tel quel, pour respecter exactement la spécification produit plutôt que le défaut du framework.

| Zone | Desktop (≥1280px) | Tablette (768–1279px) | Mobile (<768px) |
|---|---|---|---|
| **Grille générale** | Contenu jusqu'à ~1400px, sidebar dépliée fixe | Contenu pleine largeur, sidebar repliable en icônes | Colonne unique |
| **Sidebar/navigation** | Fixe, 192px, dépliée par défaut (comportement existant) | Fixe, repliée en icônes par défaut (comportement existant, `AppSidebar.tsx`) | Tiroir superposé, ouvert par un bouton menu (comportement existant, à conserver) |
| **Topbar** | Titre + recherche + notifications + avatar sur une ligne | Identique, recherche peut se réduire en icône si l'espace manque | Titre + hamburger + icône notifications ; recherche déplacée dans le tiroir ou en plein écran au tap |
| **KPI** | Grille 6 colonnes (dashboard) | Grille 3 colonnes | Grille 2 colonnes, sous-ensemble priorisé (les 4 KPI les plus actionnables, cf. DESIGN-001B mobile) |
| **Cards (EntityStatusCard, etc.)** | Grille 2 colonnes pour les listes secondaires, 1 colonne pour la liste principale | 1–2 colonnes selon largeur réelle | 1 colonne, jamais de grille — empilement strict |
| **Formulaires** | Champs groupés en grille 2 colonnes par section logique | 1–2 colonnes selon le champ | 1 colonne stricte, un champ par ligne (voir §5) |
| **Dialogs/Drawers** | Dialog centré, tailles S/M/L/XL existantes inchangées | Dialog centré, marge réduite | **Drawer plein écran** pour tout contenu actuellement en dialog L/XL avec onglets (ex. futur StayDetails) ; dialog centré conservé pour les formulaires courts (S/M) |
| **Tableaux** | Table classique en colonnes | Table classique si la largeur le permet, sinon dégrade en cartes | **Toujours** dégradé en cartes empilées (patron déjà en production sur `HousekeepingPage.tsx`, généralisé) — jamais de table desktop simplement réduite avec scroll horizontal forcé |
| **Graphiques** | Pleine largeur de la carte, axes complets | Identique, densité de labels réduite si besoin | Version condensée (sparkline / barres sans labels d'axe complets), jamais un graphique desktop simplement rétréci et illisible |
| **Actions principales** | Boutons visibles dans la barre d'action | Identique | Barre d'action fixe en bas d'écran (« FAB »-like), zone tactile ≥44×44px (§8), action primaire toujours accessible sans scroller |

**Principe transversal (rappel mission)** : « le mobile n'est pas une réduction du desktop » — chaque écran migré doit avoir sa propre passe de conception mobile (déjà la pratique validée sur UX-003B pour Check-in & séjours), jamais un simple `@media` de compression.

---

## 5. Standard formulaires Makarim 2026

### 5.1 Principe

Les formulaires denses (nouvelle réservation, walk-in, check-in réservation) passent d'une vue unique à un **modèle en étapes**, sans toucher un seul champ, une seule validation, ni un seul DTO existant (`CreateReservationDto`, `WalkinCheckinDto`, backend inchangé).

### 5.2 Structure commune

1. **Regroupement logique des champs** — par exemple pour la création de réservation : (a) Client, (b) Chambre & dates, (c) Formule & tarification — regroupement déjà présent dans le code actuel (`CreateReservationDialog.tsx`), simplement explicité en étapes visuelles plutôt qu'en sections empilées dans un seul écran.
2. **`StepIndicator`** — puces numérotées avec libellé, état `à venir / actif / complété`, couleurs dérivées de `--primary`/`--border`/`--text-tertiary`. Cliquable pour revenir en arrière (jamais pour sauter en avant sans validation).
3. **Préremplissage** — dès qu'une donnée est déjà connue (ex. `pendingSelection` du calendrier réservations, ou `checkingInReservation` pour un check-in depuis réservation existante), l'étape correspondante s'affiche pré-remplie et visuellement marquée comme telle (fond légèrement teinté `--surface-2`, mention « Pré-rempli depuis… ») — jamais un remplissage silencieux qui pourrait passer pour une saisie manuelle.
4. **Résumé avant validation** — dernière étape systématique : récapitulatif de toutes les valeurs saisies, avec un lien « Modifier » par section ramenant à l'étape concernée. Reprend le calcul de prix déjà exposé (`calculatePrixTotal`), jamais recalculé côté client.
5. **Validation contextualisée** — les erreurs de validation s'affichent au niveau du champ concerné dans l'étape où il se trouve, jamais un message générique global ; si une étape déjà validée contient une erreur découverte plus tard (ex. contrainte serveur), le `StepIndicator` marque cette étape en erreur et y ramène l'utilisateur.
6. **Conservation des données entre étapes** — état de formulaire conservé en mémoire (state React local au dialog/drawer, comme c'est déjà le cas) tant que le formulaire n'est pas fermé ; naviguer entre étapes ne perd jamais de saisie.
7. **Footer d'action stable** — toujours visible, jamais dans une zone qui scrolle avec le contenu (correction déjà appliquée à `CreateReservationDialog` en UX-002B, généralisée à tous les formulaires en étapes).
8. **Version mobile** — étapes empilées verticalement, un champ par ligne, `StepIndicator` compact (puces sans libellé texte, juste un numéro + couleur d'état), footer d'action fixe en bas d'écran.

### 5.3 Cas de référence (aucune règle métier modifiée)

| Formulaire | Étapes proposées | Fichier concerné (présentation uniquement) |
|---|---|---|
| Nouvelle réservation | 1) Client 2) Chambre & dates 3) Formule & tarification 4) Résumé | `CreateReservationDialog.tsx` |
| Walk-in | 1) Client 2) Chambre & séjour 3) Résumé | `WalkinCheckinDialog.tsx` |
| Check-in réservation | 1) Vérification identité/alertes 2) Chambre & occupants 3) Résumé | `ReservationCheckinDialog.tsx` |

Ces trois dialogs partagent déjà un système de navigation par étapes fonctionnel (`WalkinCheckinDialog`/`ReservationCheckinDialog`, code dupliqué à l'identique entre les deux fichiers) — la migration consiste à **factoriser ce code dupliqué dans `StepIndicator`**, pas à réinventer le mécanisme.

---

## 6. Étude comparative — bibliothèque de dataviz (recommandation, rien installé)

Rappel du besoin réel identifié en DESIGN-001A/B : barres/tendance d'occupation (7-30 jours, `yield-forecast`), éventuellement une ventilation financière simple (`financial-summary`). Pas de besoin de graphiques 3D, cartographiques, ou de très gros volumes de points — un besoin de dataviz *opérationnelle*, pas *analytique lourde*.

| Critère | **Recharts** | **Visx** | **Nivo** |
|---|---|---|---|
| Qualité visuelle par défaut | Correcte, un peu générique out-of-the-box | Aucun style par défaut — 100% construit à la main | Très soignée par défaut, style "dashboard SaaS" marqué |
| Responsive | Bon (`ResponsiveContainer` intégré) | Manuel (Visx est bas niveau, responsive à coder) | Bon (composants responsive intégrés) |
| Accessibilité | Basique (SVG, labels ARIA partiels) | Dépend entièrement de l'implémentation | Meilleure des trois par défaut (rôles ARIA sur plusieurs composants) |
| TypeScript | Types officiels corrects | Excellents (Airbnb, très typé, modulaire) | Bons, mais API plus complexe à typer finement |
| Personnalisation avec un design system propre | Bonne, mais certains styles par défaut doivent être surchargés | **Totale** — c'est une boîte à outils (échelles D3 + primitives SVG React), pas des graphiques prêts à l'emploi | Bonne via thèmes, mais l'identité visuelle par défaut de Nivo est plus difficile à effacer complètement |
| Bundle / performance | Moyen (~95-110 kB gzip selon les modules importés) | Le plus léger si on n'importe que les sous-packages utilisés (`@visx/shape`, `@visx/scale`…) | Le plus lourd des trois (plusieurs familles de graphiques, dépendances D3 nombreuses) |
| Maintenance / écosystème | Très large adoption, maintenance active, la plus utilisée avec shadcn/ui-like projects | Maintenue par Airbnb + communauté, plus bas niveau donc moins de "magie" à maintenir dans le temps | Maintenue, mais changements d'API notables entre versions majeures par le passé |
| Courbe d'apprentissage pour l'équipe | Faible — API déclarative simple, proche de ce qu'un composant React "normal" ressemble | Plus élevée — nécessite de composer soi-même axes/échelles/formes | Faible à moyenne — API déclarative mais plus de concepts (thèmes, animations propres à la lib) |

### Recommandation

**Recharts**, avec un habillage explicite pour effacer son style par défaut et le faire correspondre aux tokens Makarim (`--primary`, `--success`, etc. injectés via `stroke`/`fill` plutôt que les couleurs par défaut de la lib).

Justification :
- Les besoins réels du PMS (barres d'occupation, éventuellement une courbe de tendance, une jauge simple) sont exactement le cas d'usage central de Recharts — pas besoin de la flexibilité bas-niveau de Visx (qui demanderait un investissement de développement plus long pour un résultat équivalent), ni de la richesse "analytics dashboard" complète de Nivo (dont une grande partie ne servirait jamais dans ce PMS).
- Bundle raisonnable si on n'importe que les composants réellement utilisés (`BarChart`, `Line`, `ResponsiveContainer` — pas la totalité de la librairie).
- Le plus simple à maintenir pour une équipe qui n'a pas de spécialiste dataviz dédié — API déclarative, proche des habitudes React déjà en place dans ce projet.
- `ResponsiveContainer` répond directement à l'exigence responsive de la mission sans travail supplémentaire.

**Non retenu, mais à garder en tête** : si un futur besoin de dataviz réellement sur-mesure émergeait (ex. calendrier de chaleur d'occupation très personnalisé, visualisation propre au Revenue Manager), Visx resterait le bon choix à ce moment précis — sa flexibilité totale se justifie seulement quand le besoin dépasse ce qu'un graphique "standard" permet.

**Aucune dépendance n'est ajoutée dans cette mission** — décision à valider explicitement avant toute installation, conformément à la consigne.

---

## 7. Motion / interactions

Base existante à conserver : `--duration-fast: 120ms`, `--duration-base: 220ms`, `--duration-slow: 300ms`, `--ease-out-brand: cubic-bezier(0.2, 0, 0.4, 0.8)` (déjà définis dans `index.css`, sous-utilisés aujourd'hui — plusieurs composants ont des durées en dur qui divergent légèrement, ex. `duration-100`/`duration-150`). **Première tâche d'implémentation motion : faire converger tout le monde vers ces tokens nommés, ne pas en inventer de nouveaux.**

| Interaction | Durée | Détail |
|---|---|---|
| Hover (bouton, carte cliquable) | `--duration-fast` (120ms) | Changement de fond/bordure + légère élévation d'ombre (`--shadow-card` → `--shadow-card-hover`) |
| Apparition menu/dropdown | `--duration-fast` (120ms) | Fade + léger scale depuis le point d'ancrage (déjà le comportement natif de `@base-ui/react`) |
| Ouverture dialog | `--duration-base` (220ms) | Fade + zoom-in-95 (déjà en place dans `dialog.tsx`, à recaler sur le token nommé au lieu de `duration-100` en dur) |
| Ouverture drawer | `--duration-base` (220ms) | Glissement depuis le bord (droite desktop, bas mobile) + fade de l'overlay |
| Changement d'onglet (Tabs) | `--duration-fast` (120ms) | Transition de couleur/fond du trigger actif (déjà géré par `@base-ui/react/tabs`) ; le contenu du panel ne "glisse" pas — changement net, pas d'animation de contenu superflue |
| Skeleton → contenu réel | `--duration-slow` (300ms) fade croisé | Le skeleton disparaît en fondu pendant que le contenu réel apparaît, jamais un cut instantané |
| Sélection d'une carte (`EntityStatusCard`, etc.) | `--duration-fast` (120ms) | Bordure + fond légèrement teinté au clic, retour à l'état normal à la fermeture du dialog associé |
| Feedback d'action réussie | Toast (durée gérée nativement par `@base-ui/react/toast`) | Pattern déjà en place et correct (`notifyCheckinDone`) — à généraliser à toute action de mutation qui ne rouvre pas immédiatement un autre écran |
| Chargement (bouton) | Pas de durée fixe — dépend de la requête | Texte remplacé par un état "en cours" honnête (ex. "Check-in…"), jamais un spinner ralenti artificiellement pour paraître "premium" |

**Interdictions explicites (rappel mission, déjà posées en DESIGN-001A, reconduites ici)** :
- **Aucune animation de montant financier** (pas de "count-up" numérique sur un KPI d'encaissement, un solde dû, un prix calculé) — un montant qui s'anime peut se lire comme une valeur non stabilisée dans un contexte financier.
- **Aucune animation décorative en boucle** hors état de chargement explicite et borné dans le temps.
- **Aucun ralentissement artificiel** du feedback d'une action réelle (check-in, check-out, validation housekeeping).
- Respect de `prefers-reduced-motion` : toutes les transitions ci-dessus sont désactivables globalement pour les utilisateurs qui le demandent au niveau système.

---

## 8. Accessibilité et lisibilité

| Point de contrôle | Règle Makarim 2026 |
|---|---|
| **Contraste** | Voir §1.2 — `--text`/`--text-secondary` toujours ≥7:1 sur `--surface`/`--background`. `--text-tertiary` (contraste réduit, ~2.9:1) strictement réservé au non-informationnel (placeholder, caption décorative) — jamais un label de champ, un montant, un statut à lire. |
| **Taille minimale des textes** (**corrigé DESIGN-001C**) | 10–11px réservé aux micro-labels/eyebrows KPI courts uniquement (§1.4) — **jamais** le standard des labels de formulaire. Labels de formulaire : 12–13px minimum. Corps de texte : 14px minimum. Information sensible/opérationnelle : taille égale ou supérieure au corps, jamais réduite. Jamais de texte informationnel en dessous de 10px. |
| **Focus clavier** | Ring visible systématique (`focus-visible:ring-3`, déjà en place sur `Button`/`Input`/`Select` — à vérifier/étendre sur tous les nouveaux composants `À CRÉER` de §2/§3). Jamais de `outline: none` sans remplacement visible. Navigation tabulaire complète sur les formulaires multi-étapes (§5) — le `StepIndicator` doit être atteignable et actionnable au clavier. |
| **Zones tactiles** | Minimum 44×44px pour toute cible tactile mobile (boutons de la barre d'action fixe, icônes de navigation, cases à cocher) — actuellement variable selon les écrans, à systématiser lors de la migration. |
| **États ne reposant pas uniquement sur la couleur** | Chaque `StatusBadge`/`RoomStatus` porte toujours un **libellé texte**, jamais uniquement une pastille colorée (déjà la pratique actuelle du projet — à préserver, pas à réinventer). Les alertes (`OperationalAlert`) portent systématiquement une icône (ex. `AlertTriangle`) en plus de la couleur. |
| **Lisibilité des montants** | `MoneyDisplay` (§3) : `font-mono tabular-nums` systématique — alignement vertical des chiffres dans toute liste/tableau de montants, cohérent avec les usages déjà partiels dans le code actuel. |
| **Labels** | Tout champ de formulaire garde un `<label>` associé (déjà la pratique via `components/ui/label.tsx` et `FormField`) — pas de placeholder utilisé comme seul label. |
| **Navigation clavier** | Tabs, Select, Dialog, Drawer, Menu — tous construits sur `@base-ui/react`, qui fournit déjà la navigation clavier standard (flèches pour les onglets, Échap pour fermer un dialog/drawer, etc.) — aucun composant `À CRÉER` de ce document ne doit s'écarter de ce socle en réinventant sa propre gestion clavier. |

---

## 9. Mapping ancien → nouveau (synthèse)

Cette section consolide les tags donnés dans tout le document, pour une lecture rapide par l'équipe d'implémentation.

### EXISTANT — conserver (aucune modification visuelle nécessaire au-delà du suivi automatique des tokens)
`Select`, `Search` (via `Input`), `Tabs`, `Dialog` (dimensionnement S/M/L/XL déjà validé), `EmptyState`, `ErrorState`, `IconButton` (via `Button` variant `icon-*`), navigation clavier `@base-ui/react` sous-jacente.

### EXISTANT — adapter visuellement (structure conservée, palette/densité/detail mis à jour)
`Button` (+ retour tactile `active` renforcé, état `loading`), `Input`, `Badge`, `Table` (+ prop densité), `Toast` (correction token couleur succès), `Skeleton` (couverture d'usage étendue, pas de changement structurel).

### À CRÉER (aucun n'ajoute de nouvelle dépendance npm — tous construits sur `@base-ui/react` déjà présent, ou extraction d'un motif déjà dupliqué dans le code)
`Checkbox`, `StatusBadge`, `Card`, `KpiCard` (formalisation), `Alert`, `Drawer`, `Tooltip`, `Menu`/Dropdown contextuel, `EntityStatusCard`, `OperationalAlert`, `StayCard`, `ReservationCard`, `RoomStatus`, `MoneyDisplay`, `StepIndicator`, `SectionHeader`, composants de graphiques (Recharts, §6).

### À SUPPRIMER progressivement
- Token `--gold`/`--gold-foreground` (`index.css`) — remplacé par `--canal-walkin` (canal) et une variation de `--primary` (item de nav actif).
- Les mappings statut→couleur dupliqués dans `HousekeepingPage.tsx`, `StayDetailsDialog.tsx`, `BillingTabContent.tsx` — remplacés par `StatusBadge`/`RoomStatus` centralisés.
- Le code de navigation par étapes dupliqué à l'identique entre `WalkinCheckinDialog.tsx` et `ReservationCheckinDialog.tsx` — remplacé par `StepIndicator` partagé.
- Les couleurs Tailwind brutes constatées (`bg-gray-50` dans `BillingTabContent.tsx`, `border-l-emerald-500` dans `toast.tsx`, `text-emerald-700` dans `InvoicePrintModal.tsx`) — remplacées par les tokens correspondants.
- Le caractère Unicode « ⚠ » brut utilisé ponctuellement (déjà corrigé sur `StayDetailsDialog` en UX-003B, à vérifier qu'aucune autre occurrence ne subsiste ailleurs au moment de la migration).

**Ce mapping ne crée jamais une deuxième bibliothèque UI parallèle** — chaque ligne « À CRÉER » est soit une extraction d'un motif déjà répété dans le code réel, soit une construction sur les primitives `@base-ui/react` déjà en dépendance.

---

## 10. Roadmap d'implémentation

**Regroupement corrigé DESIGN-001C** : les anciens lots 0/1/2/3 (Fondations / Primitives / Shell / Dashboard) sont désormais **fusionnés en un seul chantier cohérent, DESIGN-002**, pour éviter un retour au pattern de micro-PR déjà écarté par le pivot stratégique. Les lots suivants (écran par écran) restent séparés — ce sont des chantiers déjà naturellement isolables, contrairement aux fondations qui n'ont de sens qu'ensemble (des tokens sans primitives, ou des primitives sans shell, ne sont pas livrables de façon autonome et visible).

| # | Lot | Contenu |
|---|---|---|
| **DESIGN-002** | **Fondations visuelles + Shell + Dashboard Modern Operations** *(prochain chantier, périmètre volontairement large — non découpé en micro-PR)* | Nouveaux tokens `index.css` (§1, incl. chrome clair §1.1bis, `--text-tertiary` rehaussé §1.2, typographie labels §1.4), suppression `--gold` ; primitives nécessaires (`Card`, `Alert`, `Checkbox`, `Drawer`, `Tooltip`, `Menu`, `StatusBadge`, `MoneyDisplay`, `SectionHeader`, `StepIndicator` selon besoin réel du Dashboard, pas nécessairement toutes) ; `AppSidebar`/`AppTopbar` (chrome clair, sans changement de logique de repli/permissions) ; `KpiCard` formalisé ; installation de la bibliothèque de charting (Recharts, §6) **uniquement après vérification finale explicite**, pas par défaut ; Dashboard complet sur données API réelles (`/dashboard/resume`, `/reporting/*`, aucun KPI inventé) ; responsive desktop/tablette/mobile (§4) ; skeleton/loading/empty/error cohérents ; micro-interactions (§7) ; tests adaptés selon la règle de l'Annexe (invariants protégés, sélecteurs mis à jour si la structure/ARIA change légitimement). |
| 2 | **Check-in & séjours** | `EntityStatusCard`/`StayCard` déployés (remplacent les 3 blocs dupliqués de `CheckinPage.tsx`), formulaires en étapes (`WalkinCheckinDialog`, `ReservationCheckinDialog`), restructuration `StayDetailsDialog` (Drawer mobile, §4). |
| 3 | **Réservations** | `ReservationCard`, formulaire de création en étapes, vue liste mobile alternative au calendrier. |
| 4 | **Housekeeping** | `RoomStatus` centralisé, `Card`/`Alert` déployés — cet écran sert de patron de référence responsive table→cartes pour les lots suivants (déjà la meilleure implémentation existante de ce motif). |
| 5 | **Maintenance** | Réutilise directement les patrons validés sur Housekeeping (écran fonctionnellement voisin). |
| 6 | **Restaurant** | Migration palette/composants, structure à examiner en détail à ce moment. |
| 7 | **Clients / Entreprises** | `EntityStatusCard` sur les fiches, badges de catégorie déjà pensés pour ce module (variant `brand`). |
| 8 | **Finance / Facturation** | `MoneyDisplay` généralisé, cohérence avec `StayDetailsDialog` une fois son nouveau layout en production. |
| 9 | **Paramètres / RH / Stock / Audit** | Écrans d'administration occasionnelle — traités en dernier, réutilisation pure des composants déjà stabilisés. |

Chaque lot reste **livrable et protégé par les invariants métier/RBAC existants** (voir règle sur les tests, Annexe) — aucune règle métier, aucun contrat API, aucun calcul n'est modifié à aucune étape de cette roadmap ; seule la couche présentation évolue, module par module, jamais en big-bang au-delà du regroupement DESIGN-002 explicitement acté ci-dessus.

---

## Annexe — rappel des contraintes non négociables

- Aucune modification de : backend, contrats API, calculs financiers, règles métier, RBAC, workflows validés, modèles Prisma. **Les invariants métier et la couverture fonctionnelle qu'ils garantissent restent protégés à chaque lot** — voir règle sur les tests ci-dessous (précision, ne pas lire comme « aucune modification des tests »).
- Aucune nouvelle dépendance npm installée par ce document (Recharts recommandé §6, à valider et installer séparément).
- Aucune deuxième bibliothèque UI parallèle à celle de Makarim — tout composant « À CRÉER » s'appuie sur `@base-ui/react` déjà présent ou factorise un motif déjà dupliqué dans le code réel.
- `docs/RBAC_MATRIX.md` reste la source de vérité de la visibilité des actions par rôle — ce document ne change à aucun endroit quelle action est visible pour quel rôle, uniquement sa présentation.

### Règle sur les tests (précision DESIGN-001C — remplace toute lecture antérieure en « aucune modification des tests »)

Les tests unitaires/e2e ne sont **pas gelés au même titre que le backend** — c'est leur **intention métier et leur pouvoir discriminant** qui sont non négociables, pas leur code exact :

- **Les invariants métier et la couverture fonctionnelle doivent rester protégés** à chaque lot de migration — un test qui vérifiait une règle métier (RBAC, blocage de check-out sur solde dû, machine à états, etc.) doit continuer à la vérifier après le lot.
- **Les tests frontend/e2e peuvent être adaptés** lorsqu'une refonte DOM, ARIA ou responsive légitime modifie les sélecteurs ou la structure — précédent déjà posé et exécuté en UX-003B (`getByRole('button', …)` → `getByRole('tab', …)` dans `helpers.ts`/`02-checkin-checkout-paiement.spec.ts` suite à la migration vers de vrais onglets `Tabs`). C'est le mode normal de maintenance d'une suite de tests pendant une refonte visuelle, pas une exception.
- **Aucun test ne doit être supprimé ou rendu moins discriminant uniquement pour faciliter le redesign** — un test qui échoue à cause d'un changement de sélecteur se corrige en ciblant le nouveau sélecteur avec la même exigence sémantique (rôle ARIA correct, contenu affiché correct), jamais en assouplissant l'assertion, en la supprimant, ou en la remplaçant par un test qui ne vérifie plus rien d'équivalent.
- Le pattern sabotage/restore déjà en vigueur dans ce projet (CLAUDE.md, « Tests ») reste la référence pour juger si un test modifié reste discriminant : le test doit encore échouer si on réintroduit délibérément le défaut qu'il est censé détecter.

**Fin du document. Non commité — en attente de validation avant DESIGN-002 (Fondations + Shell + Dashboard Modern Operations).**
