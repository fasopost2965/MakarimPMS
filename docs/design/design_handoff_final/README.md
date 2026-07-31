# Handoff final — MakarimPMS (design system complet)

## Overview
Package de handoff consolidé pour l'ensemble du redesign MakarimPMS : les 16 écrans historiques (login, dashboard, exploitation hôtel, back-office, RH/stock/reporting/audit/paramètres) **plus** le 4e lot de patterns UX à haute valeur ajoutée (vues mobiles terrain, documents imprimables, états vides/erreur/chargement, drill-down KPI, recherche globale, fiche client 360°). Destiné à une implémentation dans le repo `fasopost2965/MakarimPMS` (backend NestJS, frontend React/Vite/shadcn).

## About the Design Files
Les fichiers `.dc.html` (dans `screens/`) sont des **références de design en HTML** — des prototypes de l'intention visuelle et du comportement, pas du code à copier tel quel. La tâche : recréer ces designs dans l'environnement existant (React + Vite + Tailwind + shadcn/ui, composants `@/components/ui`) en suivant ses conventions établies, pas coller le HTML brut.

## Fidelity
**Haute-fidélité (hifi)** sur toute la couverture : tokens, typographie, copy en français, et micro-interactions sont finalisés. Quelques écrans (Housekeeping Kanban/mobile, Formulaire de réservation riche) anticipent volontairement des capacités backend pas encore implémentées — signalé explicitement à chaque fois, à valider avec le client avant dev.

---

## Structure du package
- `screens/` — les 27 fichiers `.dc.html` (référence visuelle unique, à jour).
- `README.md` (ce fichier) — index général + détail complet du **lot 4** (nouveaux patterns).
- `batch1_login_dashboard.md`, `batch2_exploitation_hotel.md`, `batch3_annexes.md` — détail écran par écran des lots précédents (toujours valides, non dupliqués ici).

## Index des lots

| Lot | Écrans | Détail |
|---|---|---|
| 1 | Login, Login Options, Tableau de bord (shell initial) | `batch1_login_dashboard.md` |
| 2 | Réservations, Check-in & séjours, Housekeeping, Maintenance | `batch2_exploitation_hotel.md` |
| 3 | Clients, Entreprises, RH, Stock, Reporting, Notifications, Audit, Paramètres, Scan pièce d'identité, Mot de passe, Formulaire de réservation | `batch3_annexes.md` |
| **4 (ce lot)** | Housekeeping/Maintenance mobile, Facture client, Bon de commande fournisseur, États UI (vide/erreur/chargement), Détail notification, Micro-interaction check-in, RBAC (Paramètres), Drill-down KPI (Dashboard), Recherche globale, Fiche client 360° (Clients) | ci-dessous |

Note : Paramètres, Tableau de bord et Clients ont été **enrichis** depuis les lots 1/3 — ce README documente uniquement le delta ; le reste de ces écrans (non modifié) reste décrit dans les fichiers de lot correspondants.

---

## Lot 4 — Détail

### Housekeeping mobile (`HousekeepingMobile.dc.html`)
**Purpose** : équipier terrain sur tablette — liste des chambres assignées, écran détail chambre, changement de statut à choix unique. **Cadre back-office existant `frontend/src/features/housekeeping/`** ; comme documenté au lot 2, la notion d'équipier assigné/horodatage n'existe pas encore côté backend — cette vue mobile suppose le modèle `HousekeepingTask` décrit dans `docs/modules/housekeeping.md` (à confirmer avant dev).
**Layout** : bezel tablette portrait, barre de statut app, liste de cartes pleine largeur (chambre, étage, statut pill, horodatage), cible tactile ≥44px sur toute la carte (pas juste le pill). Écran détail : grand pill statut en tête, boutons de changement de statut en pleine largeur empilés (pas un `<select>`), bouton retour explicite.
**Couleurs** : mêmes pills sémantiques que Housekeeping desktop (`success`/`warning`/violet `oklch(0.5 0.14 300)`/`destructive`/`info`).

### Maintenance mobile (`MaintenanceMobile.dc.html`)
**Purpose** : technicien terrain — liste de tickets assignés, détail ticket avec photo, action Résoudre. Source : `frontend/src/features/maintenance/`.
**Layout** : même bezel tablette. Carte ticket = miniature photo + pill priorité + chambre/zone + assigné. Détail ticket : photo pleine largeur, description, pill priorité et statut, bouton "Résoudre" pleine largeur bas d'écran (zone pouce), rappel du transit obligatoire vers "À nettoyer" après résolution.

### Facture client (`FactureClient.dc.html`) — imprimable
**Purpose** : facture PDF pour un séjour clôturé. Source cible : `frontend/src/features/billing/`.
**Layout** : format A4 portrait, en-tête (logo/identité hôtel depuis Paramètres, n° facture, date, client), tableau des lignes (prestation, nuits/qté, prix unitaire, montant), sous-total, TVA, taxe de séjour, total en gras, mentions légales bas de page. Une seule couleur d'accent (navy), pas de pill/badge — sobriété d'un document officiel.
**Notes** : montants alignés à droite, police tabulaire pour les nombres, doit rester lisible en noir et blanc (impression).

### Bon de commande fournisseur (`BonCommandeFournisseur.dc.html`) — imprimable
**Purpose** : bon de commande pour réapprovisionnement Stock. Cible probable : nouveau module `purchasing` (n'existe pas encore dans `frontend/src/features/` — à créer, ou rattacher à `stock/`).
**Layout** : même gabarit A4 que la facture (cohérence des documents imprimés) — en-tête hôtel + fournisseur, tableau articles (référence, désignation, quantité, prix unitaire, montant), total, zone signature/validation.
**⚠️ Écart à valider** : aucun endpoint "bon de commande" n'existe dans le repo actuel — écran anticipatoire pour guider l'intégration backend, pas un écran à brancher immédiatement.

### États UI — vide / erreur / chargement (`EtatsUI.dc.html`)
**Purpose** : catalogue de référence des 3 états transverses à appliquer à **toutes** les tables/listes de l'app (Clients, Stock, Réservations, etc.), pas un écran de prod isolé.
- **Vide** : icône simple + message contextuel ("Aucun résultat pour ce filtre" / "Aucune chambre à nettoyer aujourd'hui") + action principale si pertinente (ex. "Effacer les filtres").
- **Erreur** : bandeau `destructive`/12% + message + bouton "Réessayer".
- **Chargement (skeleton)** : blocs gris pulsés respectant la géométrie exacte du contenu réel (lignes de table, hauteur de carte) — jamais un spinner plein écran pour du contenu partiel.
**Implémentation** : composants `EmptyState`/`ErrorState`/`Skeleton` réutilisables à créer une fois dans `@/components/ui`, puis appliqués à chaque écran existant.

### Détail notification (`NotificationDetail.dc.html`)
**Purpose** : flyout (panneau latéral droit, pas une modale plein écran) ouvert depuis la cloche de la topbar — détail d'une notification (objet lié : séjour, ticket maintenance, etc.) avec lien "Voir" vers l'écran source. Source : `frontend/src/features/notifications/`.
**Layout** : largeur fixe ~400px, glisse depuis la droite, overlay semi-transparent sur le reste de l'app (contexte non perdu — l'app derrière reste visible et floutée légèrement).

### Micro-interaction check-in (`MicroInteractionCheckin.dc.html`)
**Purpose** : retour visuel de confirmation au clic sur "Check-in" (transition chambre → occupée) — animation courte (checkmark + pulse de couleur sur la ligne, ~400-600ms ease-out) avant disparition de la ligne de la liste "Arrivées du jour". Référence pour `CheckinPage.tsx`.

### RBAC — matrice de permissions (`Parametres.dc.html`, ajout au lot 3)
**Purpose** : nouveau 5e sous-module dans Paramètres — tableau croisé rôle × permission (lecture/écriture par module : Réservations, Stock, RH, Reporting, Audit, etc.), édition réservée Administrateur. Complète les 4 sous-modules déjà documentés en lot 3 (Identité, Taux & taxes, Grille tarifaire, Canaux OTA).
**Layout** : table dense, cases à cocher/pills Lecture/Écriture/Aucun par cellule, ligne de rôle figée en en-tête sticky au scroll horizontal.

### Drill-down KPI (`Dashboard.dc.html`, ajout au lot 1)
**Purpose** : chaque chiffre KPI du tableau de bord (ex. "12 chambres à nettoyer") devient cliquable → navigue vers l'écran de détail correspondant, pré-filtré (ex. Housekeeping filtré sur statut "À nettoyer"). Pas de nouvel écran : un comportement de navigation à ajouter aux KPI existants + support d'un paramètre de filtre initial sur les écrans cibles (Housekeeping, Maintenance, Stock, RH).

### Recherche globale ⌘K (`RechercheGlobale.dc.html`)
**Purpose** : palette de commande transverse (raccourci ⌘K / Ctrl+K depuis la topbar), recherche cross-écrans (clients, chambres, réservations, tickets) sans perdre le contexte de la page courante. Nouveau module transverse — pas de dossier `features/search` existant dans le repo, à créer avec un endpoint de recherche fédérée côté backend (à cadrer avec l'équipe backend : recherche unique multi-entités vs. appels parallèles).
**Layout** : modale centrée overlay sombre, champ de recherche en tête avec icône, résultats groupés par type d'entité (icône + libellé de groupe), navigation clavier (flèches + Entrée), Échap pour fermer.

### Fiche client 360° (`Clients.dc.html`, enrichissement lot 3)
**Purpose** : remplace la fiche client simple par une vue enrichie : historique de séjours, historique de factures, préférences (déjà en partie couvert au lot 3) — ce lot ajoute un onglet **Préférences** dédié (type de chambre, étage, allergies/régime, notes libres) en plus des onglets Séjours/Factures existants.

---

## Design Tokens (rappel, `frontend/src/index.css`)
`--primary: oklch(0.355 0.119 272.1)` (navy), `--gold: oklch(0.728 0.138 89.7)`, `--warning`, `--destructive`, `--info`, `--success`, `--border`, `--muted-foreground`, `--sidebar*`. Pills = `border-radius:999px`, fond teinté 12-18% + texte plein contraste. Violet Kanban Housekeeping `oklch(0.5 0.14 300)` reste un ajout hors palette à valider.

## Assets
Aucun asset image propriétaire — icônes en style ligne simple (cohérentes avec le reste de l'app), logo hôtel = placeholder (`image-slot`) sur les documents imprimables, à remplacer par l'identité réelle du client au moment de l'implémentation.

## À concevoir ensuite (hors périmètre de ce handoff)
- Mode sombre (réception 24h)
- Export/impression en masse depuis les tables (multi-sélection → PDF/Excel)
- Assistant d'onboarding / configuration initiale
- Journal d'audit par personne (vue actuelle = par action, à ajouter : vue par utilisateur)

## Files
27 fichiers `.dc.html` dans `screens/`. Fichiers réels cibles : voir tableaux de correspondance dans `batch1_login_dashboard.md`, `batch2_exploitation_hotel.md`, `batch3_annexes.md`, et les notes de chemin par écran ci-dessus pour le lot 4. Modules sans dossier `features/` existant (bons de commande, recherche globale) sont signalés explicitement — nécessitent un cadrage backend avant implémentation.
