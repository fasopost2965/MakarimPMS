# ROADMAP.md — Plan de Lancement & Jalons de Développement

Ce document définit la feuille de route stratégique du Property Management System (PMS) de l'Hôtel Makarim. Il segmente le développement et le déploiement des 13 modules fonctionnels en trois phases successives et incrémentales : le produit minimum viable (MVP), la version d'exploitation consolidée (v1.1 Enterprise) et la vision stratégique future (v2.0 Connected PMS).

---

## 📋 Table des Jalons (Gantt Simplifié)

```mermaid
gantt
    title Feuille de Route de Développement - PMS Makarim
    dateFormat  YYYY-MM
    section MVP Core
    Sprint 1 à 4 : Auth, Chambres, Réservations, Séjours : active, jalon1, 2026-07, 2026-09
    Sprint 5 à 8 : Billing, Paiements, Housekeeping, Maintenance : active, jalon2, 2026-09, 2026-11
    section v1.1 Enterprise
    Sprint 9 à 11 : Reporting, RH, Stocks, Comptabilité : jalon3, 2026-11, 2027-01
    section v2.0 Connected
    Sprint 12+ : Channel Manager, API POS, Portail Client : jalon4, 2027-01, 2027-04
```

---

## 1. Jalon 1 : Le Produit Minimum Viable (MVP Core)

Le MVP se concentre sur les fonctionnalités vitales de l'établissement hôtelier de 24 chambres pour permettre l'ouverture et l'exploitation quotidienne de la réception et des équipes d'étages.

### 1.1. Sprint 1 à 4 : Pôle Accueil & Séjours
*   **Module `auth` & `audit` :** Authentification sécurisée par jeton JWT et validation RBAC. Enregistrement asynchrone et immuable de chaque action sensible dans `AuditLog` (`ADR-005`, `ADR-006`).
*   **Module `rooms` :** Inventaire des 24 chambres physiques, gestion de leur catégorie de prix (`RoomType`) et journal d'évolution physique de leur statut (`RoomStatusLog`) pour l'auditabilité (`ADR-003`).
*   **Module `reservations` :** Moteur de planification des nuitées d'hébergement s'appuyant sur l'index d'unicité physique de la table pivot `RoomNight` pour écarter définitivement les risques de surréservation (`BR-RES-001`).
*   **Module `stay` :** Prise en charge de la machine à états de séjour (`Stay`). Processus d'accueil d'arrivée effective (Check-In) et gestion des clients spontanés (Walk-In).

### 1.2. Sprint 5 à 8 : Pôle Logistique & Encaissements
*   **Module `billing` :** Modèle financier multi-folio rattaché de manière étanche au séjour du client (`ADR-002`). Division de notes et imputation de charges (Hébergement, Extras).
*   **Module `payments` :** Registre d'encaissement de règlements (carte, espèces, virement) intégrant un verrou d'idempotence stricte (`Idempotency-Key`) pour contrecarrer les double-paiements (`ADR-004`).
*   **Module `housekeeping` :** Console de ménage journalière pour l'équipier de ménage, validation de propreté exclusive par le rôle Gouvernante pour basculer la chambre à l'état disponible à la vente commerciale.
*   **Module `maintenance` :** Déclaration de tickets d'incident technique par les réceptionnistes avec option de blocage commercial physique de la chambre en cas de sinistre technique.

---

## 2. Jalon 2 : Version 1.1 (L'Édition Enterprise & Financière)

La version 1.1 consolide l'exploitation de l'Hôtel Makarim en fournissant les outils de pilotage administratif, réglementaire, fiscal et de ressources humaines.

### 2.1. Sprint 9 à 11 : Intégration Administrative & Analytique
*   **Module `reporting` :** Tableaux de bord de performance (taux d'occupation, CA par canal). Génération et extraction quotidienne du **Rapport de Police Réglementaire** requis par la législation marocaine, compilant l'exhaustivité des pièces d'identité des résidents physiques.
*   **Module `hr` :** Planning de shifts de travail, calcul mensuel automatisé des bulletins de paie et charges patronales en stricte conformité avec le référentiel CNSS/AMO marocain (`BR-RH-001`). Système de pointage inviolable basé sur l'horloge système du serveur (`BR-RH-003`).
*   **Module `stock` :** Suivi d'inventaire des consommables et kits d'accueil avec déstockage automatique asynchrone déclenché par la fin d'entretien de nettoyage d'une chambre (`BR-STK-001`). Alertes automatiques de seuil critique de sécurité.
*   **Module `accounting` :** Consolidation fiscale du CA (TVA hébergement 10%, TVA extras 20%) et journal des charges de fonctionnement pour la comptabilité générale. Exports de fin d'exercice au format Excel, PDF et CSV.

---

## 3. Jalon 3 : Version 2.0 (Le Connected PMS - Vision Future)

La version 2.0 positionne l'Hôtel Makarim sur le marché numérique international en automatisant sa distribution et en améliorant l'expérience client connectée.

### 3.1. Évolution Technologique & Partenariats
*   **Intégration d'un Channel Manager (Moteur de Distribution) :**
    *   Connexion bidirectionnelle temps réel avec les agences de voyage en ligne (Booking.com, Expedia, Airbnb) via une API unifiée. Synchronisation instantanée des prix saisonniers et des disponibilités des chambres sur l'ensemble des canaux numériques.
*   **API POS Restaurant / Spa (Point of Sale) :**
    *   Développement d'une API de point de vente ouverte permettant au restaurant partenaire ou au service SPA d'imputer directement et en temps réel une consommation d'extra sur le folio de chambre du séjour en cours du client.
*   **Portail Client en Ligne (Self Check-In) :**
    *   Espace web client sécurisé permettant aux résidents de pré-enregistrer leur pièce d'identité en amont de leur arrivée pour accélérer la réception, de consulter le solde de leur folio d'extras en direct, et de régler leur note finale en ligne lors de leur départ.
*   **Support Multi-Propriétés :**
    *   Évolution de l'architecture du PMS pour permettre à la direction d'administrer plusieurs établissements physiques de l'Hôtel Makarim depuis une interface de gestion consolidée unique.
