# Handoff 3 — Clients, Partenaires, RH, Stock, Reporting, Notifications, Audit, Paramètres, Scan pièce d'identité, Mot de passe, Formulaire réservation

## Overview
Complète la couverture du PMS Makarim au-delà de l'exploitation hôtel (lots 1 & 2). Même app shell "Marine & Or" (sidebar navy catégorisée, topbar blanche, pills badges token-based) que les lots précédents. Tous les écrans en lecture/écriture affichent une note RBAC (rôle requis) et, pour les mutations sensibles, un champ **motif obligatoire (≥10 caractères)** tracé dans l'audit — conforme à ADR-005.

## About the Design Files
Les `.dc.html` sont des références HTML d'intention visuelle, pas du code à copier. Recréer avec les composants React/shadcn existants (`@/components/ui`).

---

## Clients (`Clients.dc.html`) — `frontend/src/features/guests/pages/GuestsPage.tsx`
Recherche + liste (pills catégorie CRM Standard/VIP/Entreprise/Agence/Liste noire) + fiche client (changement de catégorie avec motif, note "Liste noire réservé Administrateur"), historique séjours, factures, formulaire de création avec avertissement doublon informatif (email/téléphone similaire, jamais bloquant).

## Entreprises (`Entreprises.dc.html`) — `CompaniesPage.tsx`
Liste + fiche (conditions de paiement, limite de crédit, "Compte courant : 0,00 — aucun mouvement" **honnête** — aucun rattachement séjours/factures existant côté backend), contacts (ajout/retrait), création. Layout flex avec min-width par colonne pour éviter l'écrasement sur petits viewports.

## RH (`RH.dc.html`) — `HrPage.tsx` + `AttendanceWidget.tsx`
KPI (employés actifs, masse salariale base, en service, bulletins à valider) + 3 sections en tables denses : Employés (liste + création, suppose un `User` existant — pas de provisioning composite), Historique de pointage (ajustement rétroactif motif ≥10, jamais de modification directe), Paie (calcul CNSS/AMO, validation, bulletins validés).

## Stock (`Stock.dc.html`) — `StockPage.tsx`
KPI (articles suivis, sous seuil, entrées/sorties du jour) + table articles (statut OK/Sous seuil) + formulaires entrée (livraison) et sortie manuelle (motif, chambre optionnelle) + journal des mouvements. Non-négativité du stock rappelée en note.

## Reporting (`Reporting.dc.html`) — `ReportingPage.tsx`
**Lecture stricte** (accès Administrateur/Comptable). Filtre de période global + Résumé financier (CA/TVA/taxe séjour + export grand livre CSV) + Taxes collectées (Trésor/Détail) + Prévision Yield par type de chambre (recommandation Hausse/Baisse/Maintien, seuils fixes documentés comme dette technique) + Registre de police (export CSV).

## Notifications (`Notifications.dc.html`) — `NotificationsPage.tsx`
KPI + table des modèles par événement×canal (événement/canal immuables, sujet/corps/actif modifiables avec motif) + journal d'envoi append-only (Envoyé/Échec/Ignoré — Ignoré couvre opt-out, modèle inactif, destinataire absent).

## Audit (`Audit.dc.html`) — `AuditPage.tsx`
**Accès Administrateur uniquement.** KPI + filtres (entité/action/utilisateur/période) + registre append-only avec panneau détail ancienne/nouvelle valeur JSON. Aucune action d'édition/suppression sur ce registre (INV-AUD-001).

## Paramètres (`Parametres.dc.html`) — `ParametersPage.tsx`
Vrai outil de configuration en 4 sous-modules avec sous-navigation ancrée (liens `#id`, fonctionnels même sans JS) : Identité de l'hôtel (singleton, motif obligatoire), Taux & taxes (type immuable, taux modifiable), Grille tarifaire saisonnière (par type de chambre, refus si chevauchement de périodes), Canaux OTA (mapping type de chambre ↔ Booking.com/Expedia/Airbnb, jamais Walk-in/Direct). Écriture réservée Administrateur.

## Scan pièce d'identité (`ScanIdentite.dc.html`) — `document-ocr` + `police` modules
Écran **purement consultatif** : dropzone CNIE/Passeport → résultat OCR (champs MRZ + badge checksum valide/invalide + lignes MRZ brutes repliables) → bouton "Reporter dans la fiche de police" → formulaire fiche de police pré-rempli (numéro pièce, type, nationalité, naissance, provenance/destination, date arrivée verrouillée sur le séjour) avec export PDF. Le scan n'écrit jamais rien automatiquement — la réception valide.

## Mot de passe oublié / Réinitialisation (`MotDePasse.dc.html`) — `auth` module
Même carte que `Login.dc.html`. Deux états : (1) email → message générique identique que le compte existe ou non (jamais de fuite d'information) ; (2) nouveau mot de passe + confirmation, note lien à usage unique/expirable.

## Formulaire de réservation riche (`ReservationForm.dc.html`) — `CreateReservationInput`/`UpdateReservationInput`
Modale complète pensée pour remplacer un formulaire de réservation simpliste : canal (pills), client (existant via recherche type GuestPicker avec badge catégorie + note blocage Liste noire / nouveau client), chambre & dates (type de chambre → chambre filtrée, arrivée/départ), **formule d'hébergement** (Logement seul/Petit-déj/Demi-pension/Pension complète — champ `formule` existant côté backend mais jamais exposé dans aucun formulaire actuel, à activer), bloc tarification (prix calculé depuis la grille saisonnière × nuits, toggle ajustement manuel qui déverrouille prix final + motif obligatoire). Suggestion de nouveauté produit, pas une simple reprise de l'écran existant — à valider avec le client avant implémentation.

## Files
`.dc.html` listés ci-dessus. Fichiers réels : `frontend/src/features/{guests,companies,hr,stock,reporting,notifications,audit,parameters,document-ocr,police,auth,reservations}/**`.
