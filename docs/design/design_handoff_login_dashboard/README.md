# Handoff : Connexion + Tableau de bord — Hôtel Makarim PMS

## Overview
Redesign des écrans **Connexion** et **Tableau de bord** du PMS Makarim, dans l'identité visuelle "Marine & Or" déjà en place dans le repo (`frontend/src/index.css`). Objectif : plus de hiérarchie visuelle, de scannabilité (KPIs, icônes) et de finition (accessibilité clavier, cibles tactiles), sans changer la structure de données ni les permissions.

## About the Design Files
Les fichiers `.dc.html` de ce dossier sont des **références de design faites en HTML** (prototypes montrant l'intention visuelle et le comportement), pas du code à copier tel quel. La tâche consiste à **recréer** ces designs dans l'environnement existant du projet — React + Vite + Tailwind + shadcn/ui, composants `@/components/ui` — en réutilisant les patterns déjà en place (voir fichiers réels listés en bas), pas à coller le HTML/CSS inline dans les composants React.

## Fidelity
**Haute-fidélité (hifi)** : couleurs, typographie, espacements et layout finaux. À recréer pixel-près avec les composants et tokens existants du projet.

---

## Écran 1 — Connexion (`Login.dc.html`)

**Purpose** : authentification email + mot de passe ; les rôles affichés sont informatifs (`GET /auth/roles-actifs`), l'auth reste déterminée côté serveur.

**Layout**
- Page centrée verticalement/horizontalement, fond `oklch(0.96 0.006 272)` (`--muted`-like, un ton plus soutenu que `--background`).
- Carte blanche unique, `max-width: 420px`, `border-radius: 16px`, `box-shadow: 0 8px 24px oklch(0.22 0.05 272 / 0.18)`.
- Fine barre de 6px en tête de carte : `linear-gradient(90deg, oklch(0.355 0.119 272.1) 0%, oklch(0.728 0.138 89.7) 100%)` (marine → or).
- Bloc marque : badge 34×34px arrondi 9px, fond `--primary`, lettre "M" en `--gold` 15px/700 (remplacer par `logoUrl` du branding si défini) + nom de l'établissement 15px/600.
- Formulaire : padding `20px 36px 36px`, titre "Connexion" 21px/600, sous-titre 13px `--muted-foreground`.
- Pastilles de rôles actifs (`GET /auth/roles-actifs`) : fond `oklch(0.94 0.015 272)`, texte `--primary`, `border-radius: 6px`, `padding: 4px 10px`, 12px/500 — n'afficher que si `roles.length > 0`.
- Champs Email / Mot de passe : label 13px/500 `--foreground`, input `height: 40px`, `border: 1px solid --border`, `border-radius: 8px`, fond `oklch(0.98 0.005 272)`.
- Bouton principal pleine largeur, `height: 42px`, fond `--primary`, texte blanc 14px/600, `border-radius: 8px`.
- Lien "Mot de passe oublié ?" centré sous le bouton, 13px, couleur `--primary`.

**Components (mapping vers le code réel)**
- Remplacer les `<input>` stylés par `@/components/ui/input` + `Label` (déjà utilisés dans `LoginPage.tsx`) — ne conserver que les valeurs visuelles ci-dessus (hauteur, radius, fond).
- Bouton principal → `@/components/ui/button` (variant par défaut).
- Pastilles de rôles → `@/components/ui/badge`, mais recolorées : fond `oklch(0.94 0.015 272)` / texte `--primary` plutôt que `variant="outline"` actuel (contraste plus fort, plus "produit").
- Ajouter la fine barre gradient (nouvel élément, pas de composant existant) et le badge logo "M" en fallback quand `logoUrl` est absent.

**Content / copy** (texte exact) : "Connexion", "Entrez vos identifiants pour continuer", "Email", "Mot de passe", "Se connecter", "Mot de passe oublié ?". Rôles affichés à titre d'exemple dans le prototype : Réception, Gouvernante, Maintenance, Direction — remplacer par les rôles réels retournés par l'API.

**States**
- `submitting` : bouton désactivé, libellé "Connexion…" (logique déjà dans `LoginPage.tsx`, inchangée).
- `error` : message rouge (`--destructive`) sous les champs.
- Logo : fallback texte "M" si `logoUrl` absent (déjà géré).

**Design Tokens utilisés** (tous déjà définis dans `frontend/src/index.css`, aucun nouveau token) :
`--primary: oklch(0.355 0.119 272.1)`, `--gold: oklch(0.728 0.138 89.7)`, `--border: oklch(0.9 0.012 272)`, `--muted-foreground: oklch(0.48 0.02 272)`, `--radius: 0.5rem` (8px) / `--radius-lg` pour la carte (16px = `--radius-xl`).

---

## Écran 2 — Tableau de bord (`Dashboard.dc.html`)

**Purpose** : vue d'ensemble du jour (occupation, arrivées/départs, ménage, encaissements) + accès rapide aux 4 actions les plus fréquentes + 2 widgets temps réel (ménage, maintenance). Lecture seule (`GET /dashboard/resume`), pas d'écriture depuis cet écran.

**Layout général (app shell — commun à tous les écrans, pas propre au dashboard)**
- `display:flex; height:100vh`. Sidebar fixe 240px (`md:w-16` replié) + zone principale flex-1.
- Sidebar : fond `--sidebar` (`oklch(0.288 0.091 271.8)`), texte `--sidebar-foreground`. En-tête 56px (logo + nom + sous-titre "PMS Hôtel · Tétouan"). Nav scrollable groupée en 6 catégories repliables (voir `nav-items.ts` pour le mapping exact tab → catégorie → permission — ne pas réinventer cette liste).
- Item de nav actif : fond `--sidebar-accent`, `box-shadow: inset 2px 0 0 var(--sidebar-primary)` (liseré or à gauche). Hauteur mini **40px** (cible tactile).
- Topbar 56px, fond blanc, bordure basse `--border` : titre de l'onglet à gauche, statut de pointage + bouton déconnexion à droite.
- Contenu : `padding: 24px`, fond `--background`, `display:flex;flex-direction:column;gap:20px`.

**Section 1 — Actions rapides**
4 boutons secondaires en ligne (wrap), fond `oklch(0.94 0.015 272)`, `height: 44px` (cible tactile), icône + libellé 13px/500, `border-radius: 8px` : "Nouvelle réservation", "Check-in walk-in", "Chambres à nettoyer", "Signaler une panne" → navigation directe vers l'onglet concerné (`onNavigate`), pas d'ouverture de formulaire.

**Section 2 — Grille de 5 KPI cards** (`grid-template-columns: repeat(3,1fr)`, `gap:12px`)
Chaque carte : fond blanc, `border: 1px solid --border`, `border-radius: 10px`, `padding:16px`, hover → `box-shadow` + `translateY(-1px)` + bordure teintée `--primary`.
1. **Taux d'occupation** (mise en avant : fond `--primary`/6%, bordure `--primary`/25%, valeur et libellé en `--primary`) — inclut une mini barre de progression (`height:5px`, remplissage = `tauxOccupation`%) + sous-texte "X / Y chambres occupées". Clic → onglet Housekeeping.
2. **Arrivées aujourd'hui** — clic → Check-in.
3. **Départs aujourd'hui** — clic → Check-in.
4. **Chambres à nettoyer** — clic → Housekeeping.
5. **Encaissé aujourd'hui** (`{montant} MAD`) — pas de clic (aucun écran de destination évident).
Chaque carte a une icône SVG (trait 2px, 15×15) illustrant la métrique — jamais de couleur seule comme indicateur.

**Section 3 — 2 widgets** (`grid-template-columns:1fr 1fr;gap:12px`)
- **Chambres à nettoyer** : pastilles par chambre (numéro + statut "À nettoyer"/"En nettoyage"), fond `--warning`/18%, texte `--warning-foreground`-like teinté. Lien "Voir le ménage →" en `--primary`. Vide → texte "Aucune chambre à nettoyer pour le moment." Rôles sans `housekeeping:read` : widget non affiché (403 silencieux).
- **Tickets de maintenance ouverts** : liste (chambre + type de panne), badge de priorité coloré + texte (URGENTE=`--destructive`, HAUTE=`--warning`, MOYENNE=`--info`, BASSE=outline), max 5 lignes + "+ N autre(s)". Lien "Voir la maintenance →". Rôles sans `maintenance:read` : widget non affiché.

**Interactions & Behavior**
- Chargement : `getDashboardResume()` au montage ; état `loading` → texte "Chargement…" ; `error` → message rouge.
- Chaque widget fetch indépendamment et échoue silencieusement (403) sans casser le reste du dashboard.
- Clics KPI/widgets = navigation d'onglet uniquement, aucune mutation de données depuis cet écran (`dashboard:read` seul, aucune permission write n'existe).
- Focus clavier visible partout (`outline: 2px solid --gold`, offset 2px) sur nav, actions rapides, KPI cards.

**Design Tokens** : mêmes variables `index.css` que le login, plus `--sidebar*`, `--warning`, `--destructive`, `--info`, `--success` pour les badges/statuts. Rayons : cartes = `--radius-lg` (10px arrondi utilisé ≈ entre radius-md/lg, aligner sur le token le plus proche existant), items nav/boutons = `--radius-md`/`--radius` (6-8px).

**Assets** : aucune image — logo = `branding.logoUrl` (fallback lettre "M"), icônes = SVG traits 2px inline (à remplacer par la librairie d'icônes déjà utilisée dans le projet, `lucide-react`, avec les mêmes pictogrammes que `nav-items.ts`/`DashboardPage.tsx`).

---

## State Management (rappel — déjà implémenté dans le code réel, ne pas redévelopper)
- `DashboardPage.tsx` : `resume`, `loading`, `error` (via `getDashboardResume()`).
- `RoomsToCleanWidget.tsx` / `OpenMaintenanceWidget.tsx` : fetch indépendant, `rooms`/`tickets` = `null` tant que non chargé ou en erreur (widget non rendu).
- `App.tsx` : `isAuthenticated`, `authScreen`, `permissions`, `branding` — non modifiés par ce redesign.

## Files
- `Login.dc.html` — référence visuelle de l'écran de connexion.
- `Dashboard.dc.html` — référence visuelle du tableau de bord + app shell (sidebar/topbar communs).
- Fichiers réels du projet à modifier :
  - `frontend/src/features/auth/pages/LoginPage.tsx`
  - `frontend/src/features/dashboard/pages/DashboardPage.tsx`
  - `frontend/src/components/layout/AppSidebar.tsx`, `AppTopbar.tsx`, `nav-items.ts` (structure/permissions inchangées, uniquement le rendu visuel à aligner)
  - `frontend/src/index.css` (tokens déjà présents, aucune nouvelle couleur à ajouter)
