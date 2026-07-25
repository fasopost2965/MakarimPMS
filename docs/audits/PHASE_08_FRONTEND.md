# Audit technique — Makarim PMS v1
## Phase 8 — Frontend

Analyse fondée sur lecture directe : structure complète de `frontend/src/features/` (14 dossiers) et `components/`, `App.tsx`, `lib/api-client.ts`, `lib/token-storage.ts`, `components/layout/AppSidebar.tsx`, `AppTopbar.tsx`, `nav-items.ts`, `package.json`, comptage exhaustif des lignes de pages/composants, recherche de données mockées, recherche de chaque module backend (self-checkin, police, notifications, document-ocr, channel-manager, audit) côté frontend, et vérification de l'existence d'un client mobile séparé. Aucune modification de fichier effectuée.

---

## 1. Architecture du frontend

**Structure** : `frontend/src/features/<domaine>/` avec un patron homogène — `api.ts`, `types.ts`, `components/`, `pages/` — confirmé sur les 14 dossiers présents (`auth`, `billing`, `checkin`, `companies`, `dashboard`, `guests`, `housekeeping`, `hr`, `maintenance`, `parameters`, `payments`, `reporting`, `reservations`, `stock`). Aucune déviation structurelle détectée.

**Composants partagés** : `components/ui/` ne contient que **6 primitives** shadcn/ui (`badge`, `button`, `dialog`, `input`, `label`, `select`) — aucun composant `table`, `tabs`, `toast`, `dropdown-menu`, `card`. Chaque page qui affiche des données tabulaires recompose sa propre structure de présentation.

**Dépendances** (`package.json`) : React 19, Vite 8, Tailwind 4, `@base-ui/react`, `lucide-react`. **Aucune bibliothèque de state management**, **aucune bibliothèque de data-fetching**, **aucun routeur** (`react-router` absent, confirmé exhaustivement).

**Données mockées** : recherche exhaustive — **zéro occurrence** dans tout `frontend/src`.

---

## 2. Navigation et pages

**Navigation** : pas de routeur — `App.tsx` maintient un unique `useState<Tab>('dashboard')`, `Tab` étant une union de **11 valeurs**, rendues par un switch conditionnel. `NAV_ITEMS` est la source unique partagée entre `AppSidebar` et `AppTopbar`.

**Deep linking : absent.** L'URL du navigateur ne reflète jamais l'onglet actif — un rafraîchissement ramène systématiquement à `dashboard`. Aucun état de navigation adressable.

**11 onglets pour 14 dossiers `features/`** : `billing` et `payments` n'ont pas d'onglet dédié — leurs composants sont intégrés au flux de détail de séjour (`checkin/components/StayDetailsDialog.tsx`).

**Modules backend sans écran frontend** : recherche exhaustive — **aucune interface frontend** n'existe pour :
- **`self-checkin`** : aucun bouton/écran pour générer/régénérer le lien de self check-in ni consulter les données en attente.
- **`police`** : aucun formulaire de saisie de `PoliceRecord` dans le flux de check-in. Seul l'export CSV existe côté reporting.
- **`notifications`** : aucune interface de gestion des `NotificationTemplate` ni de consultation des `NotificationLog`.
- **`document-ocr`** : aucun composant d'upload/scan de pièce d'identité.
- **`channel-manager`** : aucune interface de configuration des `ChannelRoomTypeMapping`.
- **`audit`** : aucune consultation de `AuditLog`.

**Client mobile** : aucun second client (mobile, PWA dédiée) n'existe dans ce dépôt. L'API `mobile/housekeeping/*` (F9) n'a **aucun consommateur présent dans ce code source**. Recherche de classes responsives Tailwind sur deux pages représentatives : quasi absentes.

---

## 3. Appels API et gestion d'état

**Client API centralisé** (`lib/api-client.ts`) : `apiRequest<T>` — injection automatique du `Bearer`, gestion du 401 avec tentative de refresh mutualisée, retry unique après refresh réussi, redirection vers l'écran de connexion si le refresh échoue aussi. `apiRequestBlob` couvre le téléchargement de fichiers non-JSON.

**État** : purement local à chaque composant (`useState`/`useEffect`/`useCallback`), aucun contexte React global (`AuthContext`, `PermissionsContext`) n'existe pour exposer l'identité ou les droits de l'utilisateur connecté. `App.tsx` ne conserve qu'un booléen `isAuthenticated`, jamais le payload du JWT. Ce constat explique structurellement pourquoi aucun gating client n'existe.

**Gestion des erreurs côté UI** : uniforme et systématique — un `error: string | null` par page, rendu directement dans le flux de la page, jamais de toast/notification globale, jamais de `ErrorBoundary` React détecté.

**RBAC côté interface** : `AppSidebar` affiche les 11 `NAV_ITEMS` sans filtrage par rôle. Aucune vérification de permission n'intervient avant l'affichage d'un bouton d'action.

---

## 4. Cohérence visuelle et fonctionnelle

**Système visuel** : palette « Ardoise & Laiton » pilotée par variables CSS, confirmée non codée en dur. Sidebar repliable, transition CSS explicite. `AppTopbar` héberge en permanence `AttendanceWidget` (pointage RH).

**Cohérence avec les modules backend réels** : sur les 11 onglets exposés, chacun correspond à un domaine backend réellement implémenté. L'écart va dans le sens inverse : six domaines backend fonctionnels n'ont aucune interface.

---

## 5. Évaluation globale

**Constats** : le frontend est structurellement homogène, sans donnée mockée, avec un client API centralisé robuste et un pattern de chargement/erreur répété à l'identique. Sa principale limite est sa couverture : six modules backend livrés et fonctionnels restent inutilisables par le personnel faute d'écran, et l'absence de tout état global d'identité/permission ferme la porte à un gating client.

**Points forts** :
- Structure `features/<domaine>/{api,types,components,pages}` strictement homogène sur les 14 dossiers.
- Aucune donnée mockée détectée nulle part.
- Client API centralisé avec gestion propre du refresh token.
- Pattern de chargement/erreur strictement répété sur l'ensemble des pages.
- Intégration contextuelle réussie de `billing`/`payments` dans le flux de séjour.
- Système de tokens visuels centralisé.
- `NAV_ITEMS` comme source unique de navigation.

**Points faibles** :
- Six modules backend fonctionnels sans aucune interface frontend.
- Aucun état global d'identité/rôle/permission côté frontend.
- Absence totale de routeur : pas de deep linking, pas d'historique de navigation.
- Seulement 6 primitives UI partagées, pas de composant `table` réutilisable.
- Aucun client mobile présent dans ce dépôt pour l'API `mobile/housekeeping/*`.
- Pas de gestion de cache/déduplication de requêtes au-delà de la mutualisation du refresh token.

**Risques** :
- Un membre du personnel avec un rôle restreint voit l'intégralité de la navigation.
- L'obligation légale de registre de police dépend d'un export CSV en lecture seule sans aucun moyen documenté dans le frontend de saisir les données sources.
- L'absence de deep linking complique tout usage multi-fenêtre ou tout partage de contexte.

**Questions ouvertes** :
- Les six modules backend sans interface sont-ils prévus pour un chantier frontend ultérieur ?
- Un contexte global d'identité/permission est-il envisagé pour permettre un futur gating côté client ?
- L'introduction d'un routeur est-elle jugée nécessaire ?
- Le client mobile consommant `mobile/housekeeping/*` existe-t-il dans un dépôt séparé non inclus dans cet audit ?

### Note globale — Qualité du frontend : **6,5/10**
