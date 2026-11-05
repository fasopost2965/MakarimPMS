# BUSINESS_RULES.md — Référentiel des Règles Métier du PMS Hôtel Makarim

Ce document constitue le référentiel unique et officiel des règles métier (Business Rules - BR) régissant le développement du **Property Management System (PMS) de l'Hôtel Makarim** (Tétouan, Maroc). Il sert de guide fonctionnel et d'invariant technique absolu pour l'implémentation de la logique applicative par l'équipe de développement.

**Version : 1.1 — révisée le 2026-11-06** dans le cadre de la revue de cohérence
`docs/audits/REVUE_COHERENCE_REGLES_2026-11.md` (confrontation des règles au code,
aux ADR et au chantier de refonte 3★).

| Changement | Règles | Nature |
|---|---|---|
| Typologie des charges alignée sur l'ADR-008 §4.7 (+ `nature` analytique) | BR-FAC-002 | Correction |
| Modes de paiement : `ACOMPTE` retiré (c'est un dépôt), `CHEQUE` ajouté | BR-PAI-002 | Correction |
| Plafond espèces tranché : alerte bloquante + dérogation motivée | BR-PAI-003 | Décision |
| CA sur charges postées TTC, ventilation par type, TPT | BR-COM-002 | Correction |
| ADR, RevPAR et mix par canal dans le tableau de bord | BR-REP-002 | Correction |
| `RESERVEE` explicitement autorisée au check-in | BR-CHA-003 | Correction |
| Refus de contrôle (`CONTROLEE → A_REFAIRE`) et état de la chambre à `TERMINEE` | BR-HK-002 | Correction |
| Dérogation de pré-facturation identifiée, étapes de clôture, cut-off | BR-TR-005, BR-TR-006 | Précision |
| No-show, départ anticipé, prolongation, taxe de séjour, TPT, recouche | BR-RES-007, BR-SEJ-006, BR-SEJ-007, BR-FAC-007, BR-FAC-008, BR-HK-006 | Ajout |
| Restaurant et salle de conférence : aucun référentiel auparavant | BR-RST-001 → 005, BR-EVT-001 → 006 | Ajout |

---

## 📋 Table des Matières
1. [Règles Transverses Non Négociables (Fondations)](#1-règles-transverses-non-négociables-fondations)
2. [Réservations](#2-réservations)
3. [Séjours (Stays)](#3-séjours-stays)
4. [Clients (Guests & CRM)](#4-clients-guests--crm)
5. [Chambres (Rooms)](#5-chambres-rooms)
6. [Housekeeping (Ménage)](#6-housekeeping-ménage)
7. [Facturation (Billing & Invoicing)](#7-facturation-billing--invoicing)
8. [Paiements (Payments)](#8-paiements-payments)
9. [Comptabilité & Dépenses](#9-comptabilité--dépenses)
10. [Ressources Humaines (RH, Plannings & Paie)](#10-ressources-humaines-rh-plannings--paie)
11. [Gestion des Stocks (Suppliers & Stock)](#11-gestion-des-stocks-suppliers--stock)
12. [Maintenance (Maintenance Tickets)](#12-maintenance-maintenance-tickets)
13. [Reporting (Rapports)](#13-reporting-rapports)
14. [Audit, Sécurité & Logs](#14-audit-sécurité--logs)
15. [Restauration (Restaurant, Room service, Petit-déjeuner)](#15-restauration-restaurant-room-service-petit-déjeuner)
16. [Salle de conférence & événementiel](#16-salle-de-conférence--événementiel)

---

## 1. Règles Transverses Non Négociables (Fondations)

### BR-TR-001 : Pivot Architectural
* **Module concerné :** Tout le système (Réservations, Séjours, Facturation, Clients)
* **Description :** L'objet central du système est le **Séjour (Stay)**, et non la Réservation. Toute la vie opérationnelle (consommation, folios, check-out) est rattachée au Séjour.
* **Source :** Plan d'exécution
* **Impact sur les autres modules :** Réservations, Facturation, Housekeeping.
* **Niveau de criticité :** Critique.

### BR-TR-002 : Immutabilité Fiscale
* **Module concerné :** Facturation, Comptabilité
* **Description :** Une facture émise est strictement **immuable**. Aucune modification directe (PATCH/UPDATE) ou suppression (DELETE) n'est autorisée. Toute modification, correction ou annulation doit faire l'objet d'un **Avoir (Credit Note)**.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Comptabilité, Paiements.
* **Niveau de criticité :** Critique.

### BR-TR-003 : Interdiction du Codage en Dur (Taux & Paramètres)
* **Module concerné :** Facturation, RH, Comptabilité
* **Description :** Aucun taux (TVA, Taxe de séjour, cotisations CNSS, plafonds salariaux) ne doit être codé en dur (hardcoded). Tout calcul doit dynamiquement requérir les valeurs actives stockées dans les tables de configuration en base de données (`TaxRateConfig`, `CnssRateConfig`, `HotelConfig`).
* **Source :** Décision technique
* **Impact sur les autres modules :** Tout module calculant des montants ou de la paie.
* **Niveau de criticité :** Critique.

### BR-TR-004 : Sécurité RBAC Serveur
* **Module concerné :** Sécurité, Tout le backend
* **Description :** Le contrôle d'accès basé sur les rôles (RBAC) doit être impérativement vérifié **côté serveur** sur chaque endpoint de l'API. L'adaptation dynamique de l'interface utilisateur (UI) est un confort ergonomique et ne constitue en aucun cas une barrière de sécurité suffisante.
* **Source :** Décision technique
* **Impact sur les autres modules :** Tout le système.
* **Niveau de criticité :** Critique.

### BR-TR-005 : Clôture Journalière et Date d'Exploitation (Night Audit)
* **Module concerné :** Réservations, Séjours, Facturation, Comptabilité, Reporting (transverse)
* **Description :** Le système doit distinguer la **date d'exploitation hôtelière** (`operationalDate`) de l'horloge système. La bascule vers le jour suivant ne doit intervenir qu'à l'issue d'une routine de clôture journalière (Night Audit) validant : le traitement des no-show, l'imputation automatique de la nuitée du jour sur les folios des séjours en cours, et la réconciliation des départs non enregistrés. Ce périmètre est structurant et actuellement absent du système ; il nécessite une Design Review dédiée avant toute implémentation.
* **Source :** Bureau d'études externe — retenu 2026-07-22
* **Impact sur les autres modules :** Réservations, Séjours, Facturation, Comptabilité, Reporting.
* **Niveau de criticité :** Critique.

### BR-TR-005-bis : Imputation de la nuitée
* **Module concerné :** Séjours, Facturation, Reporting
* **Description :** La cible est **une ligne de folio `HEBERGEMENT` datée par nuit**, postée au moment de la clôture journalière, accompagnée de la taxe de séjour de la nuit. La pré-facturation de l'intégralité du séjour au check-in, encore en vigueur dans `stay.service.ts`, est une **dérogation documentée** ; elle doit être résorbée lors du lot L0 afin de produire un chiffre d'affaires journalier exact, de rendre le no-show facturable (BR-RES-007) et de simplifier le départ anticipé (BR-SEJ-006).
* **Source :** Revue de cohérence 2026-11 (décision D1)
* **Impact sur les autres modules :** Facturation, Comptabilité, Reporting, Dashboard.
* **Niveau de criticité :** Critique.

### BR-TR-006 : Cut-off de la journée d'exploitation
* **Module concerné :** Tout le système
* **Description :** La bascule de date d'exploitation intervient à une **heure de cut-off paramétrée** (`HotelConfig.heureCutOff`, valeur par défaut 05:00), jamais à minuit par effet de l'horloge système. Toute opération postée après le cut-off appartient à la journée suivante. Le cut-off est affiché sur le tableau de bord et dans le rapport de clôture.
* **Source :** Décision technique (revue de cohérence 2026-11)
* **Impact sur les autres modules :** Réservations, Séjours, Facturation, Reporting.
* **Niveau de criticité :** Haute.

---

## 2. Réservations

### BR-RES-001 : Prévention du Double-Booking (Surréservation)
* **Module concerné :** Réservations, Chambres
* **Description :** Il est impossible d'enregistrer deux réservations confirmées ou séjours simultanés se chevauchant sur la même chambre. Une validation stricte d'évitement des conflits de dates doit être exécutée au niveau applicatif et sécurisée par des transactions ou contraintes de base de données.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Séjours, Chambres.
* **Niveau de criticité :** Critique.

### BR-RES-002 : Cycle de Vie de la Réservation
* **Module concerné :** Réservations
* **Description :** Une réservation possède un état contrôlé. Ses transitions autorisées sont :
  `CONFIRMEE` ➔ `ANNULEE`
  `CONFIRMEE` ➔ `NO_SHOW` (Non-présentation)
  `CONFIRMEE` ➔ `TRANSFORMEE_EN_SEJOUR` (Check-in effectué)
* **Source :** Plan d'exécution
* **Impact sur les autres modules :** Séjours, Housekeeping, Dashboard.
* **Niveau de criticité :** Haute.

### BR-RES-003 : Origine de Réservation Obligatoire
* **Module concerné :** Réservations, Reporting
* **Description :** Chaque réservation doit être liée à un canal de distribution valide (`CanalReservation`). La liste est **paramétrable** ; elle contient à ce jour `WALK_IN` (client spontané), `DIRECT` (site web, téléphone), `BOOKING_COM`, `EXPEDIA` et `AIRBNB` (OTA). Le cahier des charges ne fixe pas la liste fermée mais un **mix cible** : walk-in ~70 %, direct ~20 %, Booking ~10 % (§1.1) ; ce mix est un indicateur de pilotage, jamais une contrainte de saisie.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Reporting (Revenus par canal).
* **Niveau de criticité :** Haute.

### BR-RES-004 : Limitation des API Publiques (Widget de Réservation)
* **Module concerné :** Réservations, Sécurité
* **Description :** Le widget de réservation directe externe (Phase 5) doit communiquer via un ensemble d'endpoints découplés et soumis à un **Rate Limiting** strict pour prévenir le scraping ou les attaques par déni de service (DDoS).
* **Source :** Décision technique
* **Impact sur les autres modules :** Aucun.
* **Niveau de criticité :** Moyenne.

### BR-RES-005 : Statut "Option" et Expiration Automatique
* **Module concerné :** Réservations
* **Description :** Une réservation non garantie par acompte ou empreinte bancaire peut être créée au statut `OPTION` plutôt que `CONFIRMEE`. Si elle n'est ni garantie ni confirmée avant une échéance paramétrable (ex. 48h), le système doit automatiquement la faire basculer vers `ANNULEE` et libérer l'inventaire correspondant.
* **Source :** Bureau d'études externe — retenu 2026-07-22
* **Impact sur les autres modules :** Chambres (disponibilité), Reporting.
* **Niveau de criticité :** Moyenne.

### BR-RES-006 : Politique d'Annulation et Barème de Pénalités
* **Module concerné :** Réservations, Facturation
* **Description :** Chaque réservation doit être rattachée à une politique d'annulation (`PolitiqueAnnulation` : flexible, modérée, non-remboursable) définissant un barème de pénalité selon le délai entre la date d'annulation et la date d'arrivée prévue. Une annulation hors délai franc doit générer une ligne de folio de pénalité conforme à la politique applicable.
* **Source :** Bureau d'études externe — retenu 2026-07-22
* **Impact sur les autres modules :** Facturation.
* **Niveau de criticité :** Moyenne.

### BR-RES-007 : No-Show (Non-présentation)
* **Module concerné :** Réservations, Séjours, Facturation, Chambres
* **Description :** À la clôture de la journée d'exploitation, toute réservation `CONFIRMEE` dont la date d'arrivée est la journée clôturée et qui n'a pas été transformée en séjour passe automatiquement au statut `NO_SHOW`. Cette transition :
  1. libère l'inventaire de la chambre pour les nuits suivantes ;
  2. facture **la première nuit** selon la politique d'annulation applicable (BR-RES-006), avec la taxe de séjour due ;
  3. écrit une entrée d'audit avec l'identifiant de la réservation et le motif.
  Un no-show ne peut être annulé que par un rôle disposant de la permission `reservations:write` et d'un motif écrit ; l'annulation d'un no-show facturé génère un avoir.
* **Source :** Revue de cohérence 2026-11 (manque constaté : 70 % de walk-in, aucune règle de non-présentation)
* **Impact sur les autres modules :** Facturation, Chambres, Reporting.
* **Niveau de criticité :** Haute.

---

## 3. Séjours (Stays)

### BR-SEJ-001 : Liaison Unique avec la Réservation
* **Module concerné :** Séjours, Réservations
* **Description :** Un séjour (`Stay`) peut être facultativement lié à une réservation (`Reservation`). Dans ce cas, la relation is unique (relation 1-à-1). Une réservation ne peut générer qu'un seul séjour.
* **Source :** Plan d'exécution
* **Impact sur les autres modules :** Réservations.
* **Niveau de criticité :** Haute.

### BR-SEJ-002 : Initialisation du Séjour (Check-in)
* **Module concerné :** Séjours, Facturation, Chambres
* **Description :** Le processus de check-in transforme une réservation en séjour. Cette action doit :
  1. Générer l'entité `Stay`.
  2. Créer automatiquement le **Folio principal** associé au séjour pour l'hébergement.
  3. Muter le statut de la chambre associée en `OCCUPEE`.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Chambres, Facturation.
* **Niveau de criticité :** Haute.

### BR-SEJ-003 : Check-in Direct (Walk-In)
* **Module concerné :** Séjours, Facturation, Chambres, Clients
* **Description :** L'enregistrement direct d'un client sans réservation préalable (Walk-In) doit automatiquement créer une fiche client (si inexistante), initialiser le séjour (`Stay`), créer le Folio principal et affecter la chambre au statut `OCCUPEE`.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Tout le flux métier.
* **Niveau de criticité :** Haute.

### BR-SEJ-004 : Invariant de Solde de Check-out
* **Module concerné :** Séjours, Facturation, Paiements
* **Description :** Le Check-out d'un séjour ne peut être finalisé que si le solde de l'ensemble des folios associés est égal à **0.00 MAD** (ou entièrement facturé et transféré sur le compte courant d'une entreprise partenaire validée - City Ledger).
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Facturation, Chambres.
* **Niveau de criticité :** Critique.

### BR-SEJ-005 : Libération de la Chambre au Check-out
* **Module concerné :** Séjours, Chambres, Housekeeping
* **Description :** La finalisation du check-out d'un séjour doit immédiatement libérer la chambre et faire passer son statut de `OCCUPEE` ou `DEPART_PREVU` à `A_NETTOYER`.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Chambres, Housekeeping.
* **Niveau de criticité :** Haute.

### BR-SEJ-006 : Départ Anticipé
* **Module concerné :** Séjours, Facturation, Housekeeping
* **Description :** Lorsqu'un client quitte l'hôtel avant sa date de départ prévue, le séjour est clôturé à la date réelle. Les conséquences sont calculées automatiquement :
  1. les nuits non consommées sont annulées (annulation logique, jamais de suppression) ;
  2. la taxe de séjour est due **au nombre de nuits réellement occupées** ;
  3. si le séjour a été pré-payé, la différence donne lieu à un avoir ou à un remboursement tracé ;
  4. la chambre passe en `A_NETTOYER` et une tâche de ménage est créée (BR-HK-001).
  La règle de facturation des nuits réservées restant dues est celle de la politique d'annulation du séjour, jamais une décision implicite du réceptionniste.
* **Source :** Revue de cohérence 2026-11 (le code gère déjà un réajustement ; la règle manquait)
* **Impact sur les autres modules :** Facturation, Chambres, Housekeeping.
* **Niveau de criticité :** Haute.

### BR-SEJ-007 : Prolongation de Séjour
* **Module concerné :** Séjours, Chambres, Facturation
* **Description :** Une prolongation n'est possible que si la chambre est **disponible** sur les nuits ajoutées (contrôle de chevauchement identique à BR-RES-001) et si le séjour n'est pas clôturé. Elle crée un avenant tarifaire daté, applique le tarif du jour (saison en cours) et n'écrase jamais le tarif initial déjà posté.
* **Source :** Revue de cohérence 2026-11
* **Impact sur les autres modules :** Chambres, Facturation.
* **Niveau de criticité :** Moyenne.

---

## 4. Clients (Guests & CRM)

### BR-CLI-001 : Typologie des Fiches Clients
* **Module concerné :** Clients, Réservations, Séjours
* **Description :** Chaque fiche client (`Guest`) doit être assignée à une catégorie de CRM unique : `STANDARD`, `VIP`, `ENTREPRISE`, `AGENCE`, ou `BLACKLIST`.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Réservations, Séjours, Facturation.
* **Niveau de criticité :** Haute.

### BR-CLI-002 : Restriction pour Clients sur Liste Noire (Blacklist)
* **Module concerné :** Clients, Réservations, Séjours
* **Description :** Un client catégorisé comme `BLACKLIST` ne peut pas réserver de chambre ou effectuer un check-in. Le système doit bloquer automatiquement l'opération et nécessiter un mot de passe d'administrateur ou une validation manuelle d'un responsable pour outrepasser la restriction.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Réservations, Séjours.
* **Niveau de criticité :** Haute.

### BR-CLI-003 : Enregistrement Obligatoire des Pièces d'Identité
* **Module concerné :** Clients, Séjours
* **Description :** Conformément à la réglementation marocaine sur l'hôtellerie, l'enregistrement d'une pièce d'identité valide (CNIE pour les Marocains, Passeport pour les étrangers) est un champ obligatoire lors de la création de la fiche client pour tout check-in réel.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Reporting hôtelier (Fiche de police).
* **Niveau de criticité :** Haute.

### BR-CLI-004 : Plafond de Crédit Entreprise (City Ledger)
* **Module concerné :** Clients (Sociétés), Facturation
* **Description :** Lorsqu'un folio est facturé à une société partenaire (`Company`), le montant cumulé des lignes de folio ouvertes (non encore payées) imputées à cette entreprise ne doit pas dépasser son plafond de crédit (`plafondCredit`). Au-delà, l'imputation de frais extras est bloquée sauf validation managériale.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Facturation.
* **Niveau de criticité :** Haute.

### BR-CLI-005 : Validité de la Pièce d'Identité au Check-in
* **Module concerné :** Clients, Séjours
* **Description :** Lorsqu'une date d'expiration est renseignée sur la pièce d'identité (CNIE ou Passeport) d'un client, le check-in doit être bloqué si cette date est antérieure ou égale à la date d'exploitation du jour. Le blocage peut être outrepassé par un rôle habilité (Directeur), avec motif obligatoire consigné en audit.
* **Source :** Bureau d'études externe — retenu 2026-07-22
* **Impact sur les autres modules :** Séjours, Audit.
* **Niveau de criticité :** Moyenne.

### BR-CLI-006 : Mentions Légales Obligatoires pour Facturation Entreprise
* **Module concerné :** Clients (Sociétés), Facturation
* **Description :** Toute facture émise au nom d'une société partenaire (`Company`) doit obligatoirement afficher ses identifiants légaux marocains : ICE, Registre de Commerce (RC), Identifiant Fiscal (IF), et le cas échéant la Patente. La création ou modification d'une fiche `Company` destinée à la facturation doit exiger ces champs.
* **Source :** Bureau d'études externe — retenu 2026-07-22
* **Impact sur les autres modules :** Facturation.
* **Niveau de criticité :** Haute.

### BR-CLI-007 : Anonymisation après Péremption Légale
* **Module concerné :** Clients, Audit
* **Description :** Conformément à la loi marocaine 09-08 relative à la protection des données à caractère personnel, une fiche client (`Guest`) sans activité (aucun séjour, réservation ni facture) depuis une durée réglementaire (référence indicative : 3 ans, à confirmer juridiquement) doit faire l'objet d'une anonymisation programmée des données nominatives (nom, pièce d'identité, coordonnées), en conservant uniquement les agrégats nécessaires à la comptabilité déjà clôturée.
* **Source :** Bureau d'études externe — retenu 2026-07-22 (durée à confirmer)
* **Impact sur les autres modules :** Audit, Comptabilité.
* **Niveau de criticité :** Haute.

---

## 5. Chambres (Rooms)

### BR-CHA-001 : Unicité des Numéros de Chambre
* **Module concerné :** Chambres
* **Description :** Chaque chambre physique doit posséder un numéro d'identification unique (`numero`). Deux chambres distinctes ne peuvent pas partager le même numéro.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Réservations, Séjours, Housekeeping.
* **Niveau de criticité :** Critique.

### BR-CHA-002 : Invariant des États de Chambre
* **Module concerné :** Chambres, Réservations, Séjours, Housekeeping
* **Description :** Une chambre est rigoureusement assignée à un et un seul statut parmi les valeurs suivantes :
  - `LIBRE_PROPRE` : Vendable et disponible au check-in immédiat.
  - `RESERVEE` : Bloquée pour une arrivée du jour.
  - `OCCUPEE` : Occupée par un séjour actif.
  - `DEPART_PREVU` : Occupée, mais le check-out doit avoir lieu le jour même.
  - `A_NETTOYER` : Libérée ou à entretenir, non vendable.
  - `EN_NETTOYAGE` : En cours d'entretien par un équipier.
  - `EN_MAINTENANCE` : Bloquée techniquement pour réparations.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Réservations, Séjours, Housekeeping, Maintenance.
* **Niveau de criticité :** Critique.

### BR-CHA-003 : Vente Interdite hors Disponible Propre
* **Module concerné :** Chambres, Réservations, Séjours
* **Description :** Seules les chambres au statut `LIBRE_PROPRE` — ou `RESERVEE` lorsqu'il s'agit de l'arrivée nominative prévue sur cette chambre — peuvent être attribuées pour un check-in. Toute attribution de chambre aux statuts `A_NETTOYER`, `EN_NETTOYAGE`, `EN_MAINTENANCE`, `OCCUPEE` ou `DEPART_PREVU` est techniquement impossible (INV-CHA-001).
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Réservations, Séjours.
* **Niveau de criticité :** Critique.

### BR-CHA-004 : Historique Obligatoire des Changements d'État
* **Module concerné :** Chambres, Audit
* **Description :** Tout changement de statut d'une chambre (qu'il soit automatique ou manuel) doit obligatoirement écrire un enregistrement dans l'historique `RoomStatusLog` précisant l'ancien statut, le nouveau statut, l'auteur (utilisateur ID) et le motif du changement.
* **Source :** Plan d'exécution
* **Impact sur les autres modules :** Audit.
* **Niveau de criticité :** Haute.

### BR-CHA-005 : Distinction Statistique Hors-Service (OOO) vs Hors-Stock (OOS)
* **Module concerné :** Chambres, Maintenance, Reporting
* **Description :** Le statut `EN_MAINTENANCE` doit être qualifié par une sous-catégorie distinguant une indisponibilité mineure et temporaire (Out-of-Order, incluse dans le dénominateur du taux d'occupation) d'une indisponibilité lourde et prolongée (Out-of-Service, exclue du dénominateur). Cette distinction conditionne l'exactitude des indicateurs de taux d'occupation et de RevPAR (BR-REP-002).
* **Source :** Bureau d'études externe — retenu 2026-07-22
* **Impact sur les autres modules :** Reporting.
* **Niveau de criticité :** Moyenne.

---

## 6. Housekeeping (Ménage)

### BR-HK-001 : Déclenchement Automatique par Checkout
* **Module concerné :** Housekeeping, Séjours
* **Description :** L'événement de finalisation du check-out d'un séjour doit automatiquement muter le statut de la chambre en `A_NETTOYER` et initier une tâche de ménage (`HousekeepingTask`) au statut `A_FAIRE`.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Séjours, Chambres.
* **Niveau de criticité :** Haute.

### BR-HK-002 : Transitions Contrôlées de Tâches de Ménage
* **Module concerné :** Housekeeping
* **Description :** Les tâches de ménage suivent une machine à états stricte :
  `A_FAIRE` ➔ `EN_COURS` (Prise en charge par un équipier)
  `EN_COURS` ➔ `TERMINEE` (Ménage fini — la chambre reste `A_NETTOYER`, non vendable)
  `TERMINEE` ➔ `CONTROLEE` (Validée par la Gouvernante — la chambre passe à `LIBRE_PROPRE`)
  `TERMINEE` ➔ `A_REFAIRE` (Contrôle négatif par la Gouvernante, avec motif obligatoire)
  Le passage à `TERMINEE` ne rend donc **jamais** la chambre vendable (BR-HK-003).
* **Source :** Plan d'exécution
* **Impact sur les autres modules :** Chambres.
* **Niveau de criticité :** Haute.

### BR-HK-003 : Rétablissement du Statut Chambre Propre
* **Module concerné :** Housekeeping, Chambres
* **Description :** Une chambre ne repasse au statut vendable `LIBRE_PROPRE` qu'au moment où la tâche de ménage associée passe au statut final `CONTROLEE` par la Gouvernante. Le statut `TERMINEE` par un équipier de ménage ne suffit pas à rendre la chambre vendable.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Chambres.
* **Niveau de criticité :** Haute.

### BR-HK-004 : Ségrégation d'Accès de l'Écran Gouvernante
* **Module concerné :** Housekeeping, Sécurité
* **Description :** L'interface de l'équipier de ménage doit être simplifiée, responsive (mobile/tablette) et afficher uniquement la liste des chambres affectées avec la possibilité exclusive de lancer (`EN_COURS`) ou déclarer fini (`TERMINEE`) le nettoyage. Aucun accès aux données de facturation, clients, réservations ou finances n'est toléré pour ce rôle.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Sécurité.
* **Niveau de criticité :** Haute.

### BR-HK-005 : Détection d'Écart Chambre (Room Discrepancy)
* **Module concerné :** Housekeeping, Séjours
* **Description :** Le système doit permettre à un équipier ou à la Gouvernante de signaler un écart entre le statut théorique d'une chambre (tel qu'enregistré par la réception) et son constat physique (ex. chambre déclarée `LIBRE_PROPRE` mais trouvée occupée, ou l'inverse). Ce signalement doit générer une alerte immédiate et une entrée d'audit, sans modifier automatiquement le statut officiel de la chambre.
* **Source :** Bureau d'études externe — retenu 2026-07-22
* **Impact sur les autres modules :** Séjours, Audit.
* **Niveau de criticité :** Haute.

### BR-HK-006 : Recouche (Stayover) et Priorité de Service
* **Module concerné :** Housekeeping, Chambres
* **Description :** Le housekeeping quotidien distingue deux natures de tâches : la **recouche** (chambre occupée, entretien léger) et le **grand ménage** (après départ). La priorité d'exécution est : (1) chambres libérées avec arrivée le jour même, (2) départs du jour, (3) recouches, (4) chambres hors service. Une chambre occupée reste au statut `OCCUPEE` durant la recouche : elle n'est jamais repassée par `A_NETTOYER` tant que le séjour est actif.
* **Source :** Revue de cohérence 2026-11
* **Impact sur les autres modules :** Chambres, Séjours.
* **Niveau de criticité :** Moyenne.

---

## 7. Facturation (Billing & Invoicing)

### BR-FAC-001 : Capacité Multi-Folios
* **Module concerné :** Facturation, Séjours
* **Description :** Un séjour peut posséder plusieurs folios actifs simultanément (ex. Folio Principal pour l'hébergement de l'agent, Folio Extras pour les consommations personnelles facturées directement à l'agent ou au client).
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Séjours.
* **Niveau de criticité :** Critique.

### BR-FAC-002 : Typologie des Charges de Folio
* **Module concerné :** Facturation
* **Description :** Chaque ligne de folio (`FolioLine`) doit être rattachée à un **type comptable** parmi (ADR-008 §4.7) :
  - `HEBERGEMENT` : Nuitée et formule d'hébergement (TVA 10 %).
  - `EXTRA` : Prestation annexe non restauration (room service, spa, minibar, blanchisserie — TVA 20 %).
  - `RESTAURANT` : Consommation de restauration à la carte (TVA 20 %, CDC §3.5.1).
  - `TAXE_SEJOUR` : Taxe touristique légale, hors TVA, reversée.
  - `PAIEMENT` : Ligne d'encaissement créditrice (jamais une charge).
  - `AJUSTEMENT_HAUSSE` : Impact tarifaire positif d'un changement de chambre en cours de séjour.
  - `AJUSTEMENT_BAISSE` : Impact tarifaire négatif du même événement, traité comme un crédit (même convention que `PAIEMENT` : le montant stocké reste positif, le sens est porté par le type).
  Cette liste est celle de l'énumération `TypeLigneFolio` en base (7 valeurs) ; toute nouvelle valeur exige une migration et une mise à jour du présent article.
  Le type conditionne **seul** les calculs fiscaux (taux, ventilation). Il est complété par un axe analytique `nature` (liste validée côté DTO, ex. `RESTAURANT`, `PETIT_DEJEUNER`, `SALLE_REUNION`, `SPA`) qui ne sert qu'aux libellés et au reporting par activité.
* **Source :** Plan d'exécution
* **Impact sur les autres modules :** Comptabilité.
* **Niveau de criticité :** Haute.

### BR-FAC-003 : Interdiction de Suppression Physique de Lignes de Folio
* **Module concerné :** Facturation, Audit
* **Description :** Une charge de folio enregistrée ne peut jamais être effacée de la base de données. Pour l'annuler, le champ `annulee` doit passer à `true`, et un motif d'annulation doit être spécifié. Cette action doit écrire une ligne d'audit obligatoire.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Audit, Comptabilité.
* **Niveau de criticité :** Critique.

### BR-FAC-004 : Transferabilité des Charges
* **Module concerné :** Facturation, Séjours
* **Description :** Le système doit permettre le transfert d'une ligne de folio non facturée vers un autre folio (du même séjour ou d'un séjour différent). Cette opération sensible exige une traçabilité complète dans les tables d'audit.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Audit.
* **Niveau de criticité :** Haute.

### BR-FAC-005 : Acomptes et Registre de Dépôts (Deposit Ledger)
* **Module concerné :** Facturation, Paiements
* **Description :** Un acompte encaissé avant l'arrivée d'un client doit être enregistré dans un registre de dépôts (`Deposit`) distinct du folio de séjour, qui n'existe pas encore à ce stade. Au check-in, le dépôt doit être automatiquement transféré et imputé comme ligne créditrice (`PAIEMENT`) sur le Folio principal nouvellement créé.
* **Source :** Bureau d'études externe — retenu 2026-07-22
* **Impact sur les autres modules :** Paiements, Séjours.
* **Niveau de criticité :** Moyenne.

### BR-FAC-006 : Caution Physique de Séjour
* **Module concerné :** Facturation, Séjours
* **Description :** Une caution (espèces ou chèque) perçue à l'arrivée peut être enregistrée sur le séjour indépendamment du folio d'hébergement. Sa restitution doit être conditionnée à l'absence de dégradation constatée, et sa retenue partielle ou totale doit générer une ligne de folio `EXTRA` motivée avant le check-out.
* **Source :** Bureau d'études externe — retenu 2026-07-22
* **Impact sur les autres modules :** Paiements, Housekeeping.
* **Niveau de criticité :** Moyenne.

### BR-FAC-007 : Taxe de Séjour — Assiette et Exonérations
* **Module concerné :** Facturation, Paramétrage
* **Description :** La taxe de séjour est due **par personne majeure et par nuit** effectivement occupée. Son montant est lu dans la table de paramétrage (`TaxRateConfig`, type `TAXE_SEJOUR`), jamais codé en dur. Les exonérations (mineurs sous un âge paramétrable, personnel en mission, groupes conventionnés) sont configurables et **jamais implicites** : une ligne exonérée doit être traçable. La taxe est hors TVA (taux 0 %) et figure sur des lignes dédiées du folio principal.
* **Source :** Revue de cohérence 2026-11 (décision D3) — cahier des charges §3.5.1, ADR-002
* **Impact sur les autres modules :** Comptabilité, Reporting.
* **Niveau de criticité :** Haute.

### BR-FAC-008 : Taxe de Promotion Touristique (TPT)
* **Module concerné :** Facturation, Paramétrage
* **Description :** Lorsque la TPT est applicable, elle constitue une **composante fiscale distincte** de la taxe de séjour et de la TVA : elle possède son propre type dans `TaxRateConfig`, sa propre ligne de folio et sa propre rubrique dans la ventilation fiscale et les exports comptables. Le montant de référence du cahier des charges (1,00 MAD par personne et par nuit, ADR-008) est un paramètre modifiable, jamais une constante.
* **Source :** ADR-008 §4.4 / revue de cohérence 2026-11
* **Impact sur les autres modules :** Comptabilité, Reporting.
* **Niveau de criticité :** Moyenne.

---

## 8. Paiements (Payments)

### BR-PAI-001 : Protection contre les Doubles Paiements (Idempotence)
* **Module concerné :** Paiements
* **Description :** Chaque requête d'enregistrement de paiement (`POST /payments`) doit obligatoirement inclure un en-tête HTTP `Idempotency-Key` unique généré par le client. Le serveur doit rejeter tout doublon de clé pour prévenir les transactions redondantes.
* **Source :** Décision technique
* **Impact sur les autres modules :** Facturation.
* **Niveau de criticité :** Critique.

### BR-PAI-002 : Modes de Paiement Autorisés
* **Module concerné :** Paiements
* **Description :** Les modes de paiement acceptés sont limités aux types énumérés : `ESPECES`, `CARTE` (carte bancaire), `VIREMENT` (virement bancaire), `CHEQUE` (chèque, notamment pour la caution de séjour — BR-FAC-006) et `A_COMPTER` (prise en charge entreprise). L'acompte n'est **pas** un mode de paiement : c'est un dépôt enregistré dans le registre dédié (BR-FAC-005) puis imputé au folio au check-in.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Comptabilité.
* **Niveau de criticité :** Haute.

### BR-PAI-003 : Plafonnement des Paiements en Espèces (Maroc)
* **Module concerné :** Paiements, Comptabilité
* **Description :** Tout règlement en espèces supérieur à **10 000 MAD par jour et par client** déclenche un **blocage** de l'encaissement. Le dépassement n'est possible que par un rôle habilité (Direction, Comptable), avec un **motif obligatoire** consigné en audit ; le montant est plafonné à la limite légale par opération. Le seuil est un paramètre (`HotelConfig.plafondEspeces`), jamais une constante.
* **Source :** Décision à confirmer
* **Impact sur les autres modules :** Aucun.
* **Niveau de criticité :** Moyenne.

### BR-PAI-004 : Traçabilité de la Source du Règlement
* **Module concerné :** Paiements, Comptabilité
* **Description :** Tout encaissement non espèces doit conserver sa référence externe : numéro d'autorisation pour une carte, référence d'opération pour un virement, numéro de chèque et banque émettrice pour un chèque. Ces données sont obligatoires au-delà d'un montant paramétrable, ne sont jamais modifiables après validation, et figurent sur le reçu et dans l'export comptable — condition d'un rapprochement bancaire fiable.
* **Source :** Revue de cohérence 2026-11 (règle citée par `docs/modules/payments.md` mais absente du référentiel)
* **Impact sur les autres modules :** Comptabilité, Reporting.
* **Niveau de criticité :** Moyenne.

---

## 9. Comptabilité & Dépenses

### BR-COM-001 : Consolidation des Dépenses par Catégorie
* **Module concerné :** Comptabilité, Dépenses
* **Description :** Toutes les charges de fonctionnement enregistrées (`Expense`) doivent obligatoirement être affectées à une catégorie comptable prédéfinie : `fournisseurs`, `salaires`, `énergie`, `maintenance`, ou `abonnements`.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Reporting.
* **Niveau de criticité :** Moyenne.

### BR-COM-002 : Imputation Fiscale du Chiffre d'Affaires
* **Module concerné :** Comptabilité, Facturation
* **Description :** Le chiffre d'affaires est constaté sur les **charges réellement postées** (et non sur l'émission des factures), les montants étant saisis **TTC** puis ventilés (ADR-008) : base HT, TVA hébergement et pensions (10 %), TVA prestations annexes et restauration à la carte (20 %), taxe de séjour et TPT (hors TVA, collectées pour reversement). La somme de la ventilation reconstitue toujours exactement le TTC facturé ; l'émission d'une facture ou d'un avoir ne crée ni n'annule de chiffre d'affaires.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Reporting.
* **Niveau de criticité :** Haute.

---

## 10. Ressources Humaines (RH, Plannings & Paie)

### BR-RH-001 : Calcul de la Paie Directement lié au Référentiel CNSS
* **Module concerné :** RH (Paie)
* **Description :** Le calcul du bulletin de paie mensuel (`Payslip`) doit s'appuyer exclusivement sur la table `CnssRateConfig`. Le système doit ventiler automatiquement les cotisations salariales, patronales et appliquer les plafonds mensuels réglementaires de la CNSS marocaine (ex. AMO, allocations familiales, prestations sociales).
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Comptabilité (Dépenses salaires).
* **Niveau de criticité :** Haute.

### BR-RH-002 : Validation des Échanges de Shifts (Planning)
* **Module concerné :** RH (Plannings)
* **Description :** Une demande d'échange de shift initiée par un employé (`echangeDemande = true`) reste suspendue et inactive. Elle doit impérativement faire l'objet d'une acceptation numérique par un responsable doté d'un rôle d'écriture (`valideParId` enregistré) avant de modifier le planning officiel.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Aucun.
* **Niveau de criticité :** Moyenne.

### BR-RH-003 : Horodatage Serveur Inviolable pour les Présences (Time Shift)
* **Module concerné :** RH (Pointage)
* **Description :** Les événements de pointage (Début, Pause, Reprise, Fin d'activité) doivent être enregistrés avec des marqueurs temporels (`startedAt`, `endedAt`) générés **strictement par l'horloge du serveur**. Aucun timestamp envoyé par le client (navigateur/appareil mobile) n'est autorisé pour éviter les fraudes d'horaires.
* **Source :** Décision technique
* **Impact sur les autres modules :** Audit.
* **Niveau de criticité :** Haute.

### BR-RH-004 : Blocage de Déconnexion sur Shift Actif
* **Module concerné :** RH (Pointage), Authentification
* **Description :** Un utilisateur disposant d'un shift de pointage actif (`ACTIF` ou `EN_PAUSE`) qui tente de se déconnecter du PMS doit être intercepté par une alerte d'interface, lui imposant de mettre en pause ou de clore son shift de travail, afin d'éviter les oublis de fin de service.
* **Source :** Décision Product Owner
* **Impact sur les autres modules :** Core (Auth).
* **Niveau de criticité :** Moyenne.

### BR-RH-005 : Pointage Multi-Session Interdit
* **Module concerné :** RH (Pointage)
* **Description :** Un même employé ne peut pas démarrer un shift de travail s'il possède déjà un shift en cours (`ACTIF` ou `EN_PAUSE`) dans le système, y compris sur un autre terminal ou navigateur. Le système doit valider l'unicité du pointage actif par e-mail/ID utilisateur.
* **Source :** Décision Product Owner
* **Impact sur les autres modules :** Aucun.
* **Niveau de criticité :** Haute.

---

## 11. Gestion des Stocks (Suppliers & Stock)

### BR-STK-001 : Sortie de Stock Automatique basée sur l'Activité
* **Module concerné :** Stocks, Housekeeping
* **Description :** Le système doit décrémenter automatiquement les quantités en stock pour les produits d'accueil et linges jetables consommés lors de la validation d'une tâche de nettoyage de chambre (`CONTROLEE`). La formule de décrémentation s'appuie sur la capacité théorique de la chambre nettoyée.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Housekeeping.
* **Niveau de criticité :** Moyenne.

### BR-STK-002 : Alerte de Seuil Critique
* **Module concerné :** Stocks, Reporting
* **Description :** Dès que la quantité physique d'un article de stock (`StockItem`) devient inférieure ou égale au seuil de sécurité (`seuilAlerte`), le système doit générer une notification visuelle et inscrire l'article dans la liste d'alertes d'approvisionnement.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Aucun.
* **Niveau de criticité :** Haute.

---

## 12. Maintenance (Maintenance Tickets)

### BR-MNT-001 : Blocage Automatique de Chambre par Ticket
* **Module concerné :** Maintenance, Chambres
* **Description :** La création d'un ticket de maintenance (`MaintenanceTicket`) comportant un identifiant de chambre (`roomId`) doit automatiquement basculer le statut de cette chambre physique en `EN_MAINTENANCE` pour la bloquer immédiatement de la vente.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Chambres, Réservations.
* **Niveau de criticité :** Critique.

### BR-MNT-002 : Libération de Chambre après Résolution
* **Module concerné :** Maintenance, Chambres, Housekeeping
* **Description :** La clôture / résolution d'un ticket de maintenance (`resoluAt` enregistré) doit automatiquement basculer le statut de la chambre de `EN_MAINTENANCE` vers **`A_NETTOYER`** afin de garantir qu'une chambre réparée est nettoyée et contrôlée avant d'être vendue à nouveau.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Chambres, Housekeeping.
* **Niveau de criticité :** Critique.

### BR-MNT-003 : Tolérance pour Chambres Occupées
* **Module concerné :** Maintenance, Séjours, Chambres
* **Description :** Si un ticket de maintenance est ouvert pour une chambre actuellement au statut `OCCUPEE` (ex. signalement d'une panne mineure pendant le séjour d'un client), le statut de la chambre **ne doit pas** basculer en `EN_MAINTENANCE`. Le séjour en cours prévaut fonctionnellement, et la chambre reste au statut `OCCUPEE` pour respecter l'invariant de vente active.
* **Source :** Plan d'exécution
* **Impact sur les autres modules :** Séjours, Chambres.
* **Niveau de criticité :** Haute.

### BR-MNT-004 : Règle du Ticket Bloquant Majoritaire
* **Module concerné :** Maintenance, Chambres
* **Description :** Si plusieurs tickets de maintenance actifs sont ouverts sur une même chambre, la résolution de l'un des tickets ne doit pas débloquer la chambre. Celle-ci doit rester au statut `EN_MAINTENANCE`. La chambre ne basculera au statut `A_NETTOYER` que lors de la résolution du **dernier ticket de maintenance actif restant**.
* **Source :** Plan d'exécution
* **Impact sur les autres modules :** Chambres.
* **Niveau de criticité :** Haute.

---

## 13. Reporting (Rapports)

### BR-REP-001 : Diversité des Formats d'Exportation
* **Module concerné :** Reporting
* **Description :** Les outils d'extraction et de reporting du PMS (financier, d'exploitation, de présence RH) doivent obligatoirement proposer trois formats de sortie : **PDF** (mise en page formelle), **Excel / XLSX** (analyse approfondie), et **CSV** (intégration externe).
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Comptabilité, RH.
* **Niveau de criticité :** Haute.

### BR-REP-002 : Métriques Clés du Dashboard d'Exploitation
* **Module concerné :** Reporting, Dashboard
* **Description :** Le tableau de bord d'exploitation doit afficher en temps réel des indicateurs consolidés non falsifiables :
  - Taux d'occupation quotidien (%), calculé hors chambres `EN_MAINTENANCE` de catégorie OOS (BR-CHA-005).
  - **ADR** (prix moyen de la chambre vendue) et **RevPAR** (revenu par chambre disponible), attendus au cahier des charges §5.15.
  - Volume d'arrivées et départs programmés.
  - Ventilation du chiffre d'affaires **par activité** (hébergement, restauration, événementiel) et **par canal de vente** (`CanalReservation`), avec comparaison au mix cible 70 % walk-in / 20 % direct / 10 % Booking.
  - Prévision d'occupation à 14 jours issue des réservations fermes.
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Dashboard.
* **Niveau de criticité :** Haute.

---

## 14. Audit, Sécurité & Logs

### BR-AUD-001 : Interdiction de Suppression Physique (Soft Delete)
* **Module concerné :** Sécurité, Tout le système
* **Description :** Toute entité sensible contenant des données financières, des fiches clients ou des historiques opérationnels (Réservations, Séjours, Clients, Rôles, Utilisateurs) ne doit jamais faire l'objet d'un `DELETE` SQL physique en production. Une stratégie de **Soft Delete** (`deletedAt` à une valeur de timestamp) doit être systématiquement mise en place pour conserver l'intégrité référentielle des données financières et d'audit.
* **Source :** Décision technique
* **Impact sur les autres modules :** Tout le système.
* **Niveau de criticité :** Critique.

### BR-AUD-002 : Journalisation des Opérations Sensibles (Audit Logs)
* **Module concerné :** Sécurité, Audit
* **Description :** Les opérations identifiées comme sensibles d'un point de vue financier, légal ou opérationnel doivent obligatoirement consigner une trace immuable dans l'entité `AuditLog` (qui stocke l'ID utilisateur, l'action, l'entité visée, l'ID d'entité et un motif textuel) :
  - Annulation d'une charge ou d'une ligne de folio.
  - Transfert d'une charge entre folios.
  - Réouverture d'un dossier client ou séjour clôturé.
  - Annulation d'un séjour ou d'une réservation.
  - Override manuel de tarification de chambre.
  - Ajout d'un client en liste noire (`BLACKLIST`).
* **Source :** Cahier des charges
* **Impact sur les autres modules :** Tout le système.
* **Niveau de criticité :** Critique.

### BR-AUD-003 : Durée de Vie Limitée des Liens d'Authentification
* **Module concerné :** Sécurité (Auth)
* **Description :** Les jetons et liens de réinitialisation de mot de passe envoyés par e-mail (`forgot-password`) doivent expirer de manière stricte après une durée de **30 minutes**. Passé ce délai, le jeton est invalidé en base et la procédure doit être réitérée.
* **Source :** Décision technique
* **Impact sur les autres modules :** Aucun.
* **Niveau de criticité :** Haute.

---

## 15. Restauration (Restaurant, Room service, Petit-déjeuner)

> Section créée en v1.1. Aucune règle ne couvrait la restauration, alors que le
> module est planifié au lot L3 et que la TVA applicable (20 % à la carte) est un
> point fiscal sensible du cahier des charges (§3.5.1).

### BR-RST-001 : Note par Table et par Service
* **Module concerné :** Restaurant, Facturation
* **Description :** Une table ne peut porter qu'**une seule note ouverte** par service. La note contient la table, le nombre de couverts, l'heure d'ouverture, les lignes de commande et l'utilisateur qui l'a ouverte. Elle est clôturée soit par un encaissement direct (BR-RST-005), soit par un envoi en chambre (BR-RST-002). Une table dont la note est clôturée est immédiatement disponible.
* **Source :** Cahier des charges §3.5 / prototype de refonte
* **Impact sur les autres modules :** Facturation.
* **Niveau de criticité :** Haute.

### BR-RST-002 : Envoi en Chambre et Imputation au Folio
* **Module concerné :** Restaurant, Séjours, Facturation
* **Description :** L'envoi d'une note en chambre crée sur le folio du séjour actif les lignes de type `RESTAURANT` (TVA 20 %) correspondant aux articles commandés, avec `nature = RESTAURANT`. L'opération est refusée si la chambre n'a pas de séjour en cours, si le folio est clôturé ou facturé, et si le séjour a été soldé. Chaque envoi est journalisé (utilisateur, table, chambre, montant) et le client signe la note papier conservée au service.
* **Source :** Cahier des charges §3.5.1 / ADR-008 §4.6
* **Impact sur les autres modules :** Facturation, Audit.
* **Niveau de criticité :** Critique.

### BR-RST-003 : Petit-déjeuner Inclus — Aucune Double Facturation
* **Module concerné :** Restaurant, Séjours, Facturation
* **Description :** Le petit-déjeuner compris dans la formule réservée (`BB`, `DP`, `PC`) est **déjà couvert par le tarif d'hébergement TTC** : il ne crée aucune charge additive (ADR-008 §4.5) et apparaît uniquement à titre informatif sur la facture. Un petit-déjeuner servi hors formule (client `RO`, accompagnant supplémentaire) est une prestation indépendante, facturée à la carte (TVA 20 %) ou envoyée en chambre. Les couverts du service sont pointés pour le coût matière et le rapport du jour, indépendamment de la facturation.
* **Source :** ADR-008 §4.5
* **Impact sur les autres modules :** Facturation, Reporting.
* **Niveau de criticité :** Haute.

### BR-RST-004 : Rupture de Carte
* **Module concerné :** Restaurant
* **Description :** Un article peut être déclaré en rupture par le restaurant ; il devient immédiatement **non commandable** depuis le point de vente comme depuis un envoi en chambre. La rupture est réversible et chaque changement d'état est journalisé (auteur, horodatage). Un article en rupture ne peut pas figurer dans une nouvelle commande, même si une note ouverte le contenait déjà.
* **Source :** Prototype de refonte / exploitation 3★
* **Impact sur les autres modules :** Aucun.
* **Niveau de criticité :** Moyenne.

### BR-RST-005 : Encaissement Direct, Annulation et TVA
* **Module concerné :** Restaurant, Paiements, Comptabilité
* **Description :** L'encaissement direct d'une note (espèces, carte, virement) suit BR-PAI-001 (idempotence) et BR-PAI-003 (plafond espèces). Il produit un ticket non fiscal et alimente le chiffre d'affaires restauration avec une TVA de **20 %**. Une ligne de commande ne peut jamais être supprimée : elle est annulée logiquement (`annulee = true`) avec un motif et une entrée d'audit (BR-AUD-002). Les tickets annulés apparaissent dans le rapport du jour avec leur motif.
* **Source :** Cahier des charges §3.5.1 / BR-AUD-002
* **Impact sur les autres modules :** Comptabilité, Audit.
* **Niveau de criticité :** Haute.

---

## 16. Salle de conférence & événementiel

> Section créée en v1.1. La salle de conférence est une **extension assumée** du
> périmètre (absente du cahier des charges) : les valeurs de référence
> (capacité, tarifs, prestations) sont paramétrables et doivent être confirmées
> par la direction avant facturation réelle.

### BR-EVT-001 : Disponibilité et Exclusivité de la Salle
* **Module concerné :** Événementiel, Paramétrage
* **Description :** Deux événements ne peuvent jamais se chevaucher sur la même salle pour un même créneau (journée, demi-journée, soirée). Une demande non confirmée bloque l'inventaire au statut `OPTION` pour une durée paramétrable (48 h par défaut) ; à expiration, l'option tombe automatiquement. Le contrôle est identique à celui de BR-RES-001 (transactionnel, non contournable).
* **Source :** Extension assumée (audit de refonte)
* **Impact sur les autres modules :** Facturation.
* **Niveau de criticité :** Critique.

### BR-EVT-002 : Devis — Construction, Validité et TVA
* **Module concerné :** Événementiel, Facturation
* **Description :** Un devis comprend : participants (≤ capacité maximale de la salle), format, prestations (location, pause-café, déjeuner, dîner, technique) et un total ventilé **HT / TVA 20 % / TTC**. Les prix sont saisis TTC (ADR-008). Le devis est valable une durée paramétrable (15 jours par défaut) ; au-delà, il doit être régénéré avec les tarifs en vigueur.
* **Source :** Extension assumée / ADR-008
* **Impact sur les autres modules :** Facturation, Comptabilité.
* **Niveau de criticité :** Haute.

### BR-EVT-003 : Acompte et Solde d'un Événement
* **Module concerné :** Événementiel, Facturation, Paiements
* **Description :** La confirmation d'un devis exige un **acompte de 30 %** du TTC, encaissé et enregistré dans le registre de dépôts (BR-FAC-005), matérialisé par une facture d'acompte. Le solde est dû **au plus tard le jour de l'événement**. Un événement dont l'acompte n'est pas encaissé reste au statut `OPTION` et n'est pas planifié définitivement.
* **Source :** Extension assumée (prototype de refonte)
* **Impact sur les autres modules :** Paiements, Comptabilité.
* **Niveau de criticité :** Haute.

### BR-EVT-004 : Annulation d'un Événement
* **Module concerné :** Événementiel, Facturation
* **Description :** L'annulation suit un barème paramétrable : plus de 15 jours avant l'événement, l'acompte est remboursé ; entre 7 et 15 jours, 50 % de l'acompte est retenu ; moins de 7 jours, l'acompte est acquis. Toute annulation est motivée, journalisée, et donne lieu à un avoir si une facture a été émise (BR-TR-002).
* **Source :** Extension assumée
* **Impact sur les autres modules :** Facturation, Comptabilité, Audit.
* **Niveau de criticité :** Moyenne.

### BR-EVT-005 : Facturation à une Entreprise
* **Module concerné :** Événementiel, Clients, Facturation
* **Description :** Un événement peut être facturé à une société partenaire (`Company`) : les identifiants légaux (ICE, RC, IF) sont obligatoires (BR-CLI-006), le plafond de crédit s'applique (BR-CLI-004) et la créance suit le circuit city ledger. Le taux de TVA reste celui de chaque prestation (20 % pour la location et les prestations annexes).
* **Source :** Cahier des charges §3.5.1 / BR-CLI-004, BR-CLI-006
* **Impact sur les autres modules :** Comptabilité.
* **Niveau de criticité :** Haute.

### BR-EVT-006 : Capacité, Effectif et Sécurité
* **Module concerné :** Événementiel
* **Description :** Le nombre de participants déclaré ne peut jamais dépasser la capacité de sécurité de la salle (paramètre `capaciteMax`). Un dépassement est refusé côté serveur, y compris en modification. L'effectif retenu sert à la fois au devis (nombre de couverts, pauses) et à la feuille de service remise à l'équipe.
* **Source :** Extension assumée
* **Impact sur les autres modules :** Reporting.
* **Niveau de criticité :** Haute.
