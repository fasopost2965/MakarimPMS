# DATA_DICTIONARY.md — Dictionnaire de Données Officiel du PMS Hôtel Makarim

Ce document constitue la référence technique absolue de la couche de persistance du **Property Management System (PMS) de l'Hôtel Makarim** (Tétouan, Maroc). Il décrit chaque entité physique du schéma Prisma, ses champs, ses énumérations, ses contraintes d'intégrité, et ses relations, tout en identifiant rigoureusement les dépendances de modules et les incohérences d'implémentation courantes du projet.

---

## 📋 Table des Matières
1. [Principes Généraux de Conception de la Couche de Données](#1-principes-généraux-de-conception-de-la-couche-de-données)
2. [Index des Énumérations (Enums)](#2-index-des-énumérations-enums)
3. [Dictionnaire Détaillé des Entités Métier (Tables)](#3-dictionnaire-détaillé-des-entités-métier-tables)
4. [Graphe des Relations Conceptuelles](#4-graphe-des-relations-conceptuelles)
5. [Dépendances de Données Inter-Modules](#5-dépendances-de-données-inter-modules)
6. [Rapport d'Incohérences et Gaps Métier/Techniques Identifiés](#6-rapport-dincohérences-et-gaps-métiertechniques-identifiés)

---

## 1. Principes Généraux de Conception de la Couche de Données

Le système de base de données du PMS Makarim repose sur les principes d'ingénierie suivants :
* **Unicité temporelle stricte** : Pour éviter le double-booking et la double-occupation, un index unique physique est posé sur la table pivot d'occupation de nuitées (`RoomNight`).
* **Traçabilité totale** : Les modifications sensibles (comme le statut d'une chambre physique) sont archivées dans des tables de log dédiées (`RoomStatusLog`) plutôt que d'être uniquement écrasées, permettant d'alimenter les tableaux de bord de sécurité et d'audit.
* **Immutabilité financière** : Les écritures de folio fermées et facturées ne sont jamais altérées physiquement. Les corrections font l'objet d'avoirs rattachés à l'entité de facture d'origine.
* **Découplage des règles d'accès** : Les autorisations RBAC associent dynamiquement des rôles et des permissions par le biais d'une table d'association polymorphe (`RolePermission`), évitant de coder en dur des privilèges dans les contrôleurs.

---

## 2. Index des Énumérations (Enums)

Ces types personnalisés restreignent les valeurs possibles de certains attributs de données pour garantir l'intégrité structurelle des états.

### 2.1. `CanalReservation`
Définit le canal d'origine d'une réservation pour l'analyse des revenus et le reporting.
* `WALK_IN` : Client se présentant spontanément au comptoir de l'hôtel sans réservation préalable.
* `DIRECT` : Réservation effectuée directement auprès de l'hôtel (site officiel, téléphone, e-mail).
* `BOOKING_COM` : Réservation provenant de l'OTA externe Booking.com.

### 2.2. `StatutReservation`
Représente les états du cycle de vie d'une réservation de chambre.
* `CONFIRMEE` : Réservation valide et active en attente d'arrivée.
* `ANNULEE` : Annulation formulée par le client ou l'hôtel.
* `NO_SHOW` : Client ne s'étant pas présenté le jour prévu sans notification.
* `TRANSFORMEE_EN_SEJOUR` : Check-in effectué, réservation matérialisée par un séjour actif.

### 2.3. `StatutChambre`
Représente l'état physique et commercial d'une chambre à un instant T.
* `LIBRE_PROPRE` : Chambre propre, prête à la vente et au check-in immédiat.
* `RESERVEE` : Chambre attribuée à un client dont l'arrivée est planifiée le jour même.
* `OCCUPEE` : Chambre occupée par un séjour actif de client.
* `DEPART_PREVU` : Chambre occupée dont le départ doit se faire le jour même.
* `A_NETTOYER` : Libérée après un départ ou à entretenir, temporairement invendable.
* `EN_NETTOYAGE` : Ménage en cours par un équipier d'entretien.
* `EN_MAINTENANCE` : Bloquée techniquement pour réparation technique.

### 2.4. `StatutSejour`
Indique l'état courant d'un séjour physique.
* `EN_COURS` : Client actuellement dans les murs de l'hôtel.
* `CHECKOUT` : Séjour officiellement clos avec libération de chambre et facturation.
* `ANNULE` : Séjour interrompu ou annulé avant consommation réelle.

### 2.5. `TypeLigneFolio`
Qualifie la nature comptable d'une transaction financière sur un folio.
* `HEBERGEMENT` : Montant correspondant au coût des nuitées physiques.
* `EXTRA` : Consommation annexe (Room Service, SPA, blanchisserie, minibar).
* `TAXE_SEJOUR` : Taxe légale de séjour collectée par nuitée et par personne.
* `PAIEMENT` : Ligne d'encaissement créditrice matérialisant un règlement reçu.

### 2.6. `StatutFacture`
Spécifie l'état légal d'une facture.
* `EMISE` : Document fiscal définitif édité et immuable.
* `ANNULEE_PAR_AVOIR` : Facture neutralisée réglementairement par l'émission d'un avoir total.

### 2.7. `MoyenPaiement`
Modes de règlement officiellement acceptés par l'établissement.
* `ESPECES` : Paiement en numéraire (soumis aux plafonds légaux marocains).
* `CARTE` : Paiement par carte bancaire.
* `VIREMENT` : Transfert de compte à compte.
* `ACOMPTE` : Imputation d'un paiement préalable déjà enregistré.

### 2.8. `PrioriteTicket`
Niveaux d'urgence pour la résolution des incidents techniques.
* `BASSE` : Confort secondaire ou esthétique.
* `MOYENNE` : Panne mineure n'altérant pas la mise en vente.
* `HAUTE` : Panne majeure compromettant le confort immédiat du client.
* `URGENTE` : Sinistre ou dysfonctionnement critique exigeant un blocage immédiat de la chambre.

---

## 3. Dictionnaire Détaillé des Entités Métier (Tables)

Chaque table du schéma Prisma physique est documentée ci-dessous avec ses attributs et ses contraintes d'intégrité associées.

---

### 3.1. Entité : `RoomType`
* **Description :** Représente les catégories de chambres proposées par l'établissement (Double, Suite, Suite Royale, etc.).
* **Module fonctionnel :** Chambres / Configuration Tarifs
* **Règles métier associées :** BR-CHA-003, BR-RES-001

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant technique unique de la catégorie. |
| `nom` | `String` | — | Non | — | Libellé commercial de la catégorie de chambre (ex. "Suite Deluxe"). |
| `prixBase` | `Decimal` | — | Non | — | Prix de base par défaut en monnaie locale (MAD) appliqué hors saison. |
| `capacite` | `Int` | — | Non | — | Capacité maximale d'accueil théorique (nombre de personnes autorisées). |

#### Relations actives
* **1-to-N (`Room`)** : Une catégorie regroupe plusieurs chambres physiques de ce type.
* **1-to-N (`SeasonRate`)** : Une catégorie possède une ou plusieurs variations tarifaires saisonnières configurées.

---

### 3.2. Entité : `SeasonRate`
* **Description :** Enregistre la grille tarifaire variable selon les périodes et saisons de l'année.
* **Module fonctionnel :** Configuration Tarifs / Réservations
* **Règles métier associées :** BR-TR-003, BR-RES-001

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant technique unique de la grille. |
| `roomTypeId` | `Int` | FK | Non | — | Référence vers la catégorie de chambre concernée. |
| `libelle` | `String` | — | Non | — | Nom descriptif de la saison (ex. "Haute Saison Été"). |
| `dateDebut` | `DateTime` | — | Non | — | Date de début de validité du tarif saisonnier (bornes incluses). |
| `dateFin` | `DateTime` | — | Non | — | Date de fin de validité du tarif saisonnier (bornes incluses). |
| `prixNuit` | `Decimal` | — | Non | — | Prix de la nuitée appliqué dynamiquement durant cette période (MAD). |

#### Relations & Contraintes d'intégrité
* **Relations** : Liaison obligatoire 1-à-Plusieurs vers `RoomType`.
* **Index unique composite** : `@@unique([roomTypeId, libelle])` - Un type de chambre ne peut posséder qu'une seule tarification active par intitulé de saison.

---

### 3.3. Entité : `Room`
* **Description :** Représente les chambres réelles et physiques de l'Hôtel Makarim.
* **Module fonctionnel :** Chambres / Housekeeping / Maintenance
* **Règles métier associées :** BR-CHA-001, BR-CHA-002, BR-CHA-003, BR-CHA-004, BR-HK-001, BR-HK-003, BR-MNT-001, BR-MNT-002, BR-MNT-003, BR-MNT-004

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant unique interne. |
| `numero` | `String` | — | Non | — | Numéro physique de la chambre (ex. "302"). Doit être unique. |
| `roomTypeId` | `Int` | FK | Non | — | Clé étrangère pointant vers `RoomType`. |
| `statut` | `StatutChambre` | — | Non | `LIBRE_PROPRE` | État opérationnel et commercial de la chambre à l'instant présent. |

#### Relations & Contraintes d'intégrité
* **Unicité** : Contrainte d'unicité stricte sur le champ `numero` (BR-CHA-001).
* **Relations** :
  * 1-to-N vers `Reservation`.
  * 1-to-N vers `RoomNight`.
  * 1-to-N vers `Stay`.
  * 1-to-N vers `RoomStatusLog`.
  * 1-to-N vers `MaintenanceTicket`.

---

### 3.4. Entité : `RoomStatusLog`
* **Description :** Journal historique retraçant tous les changements de statuts physiques ou commerciaux des chambres.
* **Module fonctionnel :** Audit / Housekeeping
* **Règles métier associées :** BR-CHA-004, BR-AUD-002

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant de log. |
| `roomId` | `Int` | FK | Non | — | Clé étrangère vers la chambre modifiée. |
| `ancienStatut` | `StatutChambre` | — | Non | — | Statut de la chambre avant la transition. |
| `nouveauStatut`| `StatutChambre` | — | Non | — | Statut de la chambre après la transition. |
| `motif` | `String` | — | Oui | — | Description ou motif du changement d'état (manuel ou automatique). |
| `userId` | `Int` | FK | Oui | — | Identifiant de l'utilisateur à l'origine de l'action. |
| `createdAt` | `DateTime` | — | Non | `now()` | Date et heure de l'enregistrement de la transition d'état. |

---

### 3.5. Entité : `Guest`
* **Description :** Contient les fiches de profil et de coordonnées des clients de l'établissement.
* **Module fonctionnel :** Clients (CRM)
* **Règles métier associées :** BR-CLI-001 (Gap), BR-CLI-002 (Gap), BR-CLI-003, BR-CLI-004 (Gap)

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant client unique. |
| `nom` | `String` | — | Non | — | Nom de famille officiel du client. |
| `prenom` | `String` | — | Non | — | Prénom officiel du client. |
| `pieceIdentite`| `String` | — | Oui | — | Numéro de la pièce officielle d'identité (CNIE ou Passeport). |
| `telephone` | `String` | — | Oui | — | Numéro de téléphone de contact. |
| `email` | `String` | — | Oui | — | Adresse de messagerie électronique. |
| `createdAt` | `DateTime` | — | Non | `now()` | Date de création du profil client. |

#### Relations actives
* **1-to-N (`Reservation`)** : Un client peut être l'auteur de plusieurs réservations.
* **1-to-N (`Stay`)** : Un client peut effectuer plusieurs séjours au sein de l'établissement.

---

### 3.6. Entité : `Reservation`
* **Description :** Fiche d'engagement commercial pré-séjour pour un client donné sur des dates définies.
* **Module fonctionnel :** Réservations
* **Règles métier associées :** BR-RES-001, BR-RES-002, BR-RES-003, BR-RES-004, BR-SEJ-001, BR-SEJ-002

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant de réservation. |
| `canal` | `CanalReservation` | — | Non | `DIRECT` | Canal d'acquisition de la réservation (BR-RES-003). |
| `guestId` | `Int` | FK | Non | — | Clé étrangère pointant vers le client acquéreur. |
| `roomId` | `Int` | FK | Non | — | Clé étrangère pointant vers la chambre allouée. |
| `dateArrivee` | `DateTime` | — | Non | — | Date planifiée d'arrivée à l'hôtel (check-in théorique). |
| `dateDepart` | `DateTime` | — | Non | — | Date planifiée de départ (check-out théorique). |
| `statut` | `StatutReservation` | — | Non | `CONFIRMEE` | État courant du cycle de réservation. |
| `sourceBrute` | `String` | — | Oui | — | Données ou logs de payload d'origine (ex. métadonnées OTA). |
| `prixTotalCalcule`| `Decimal` | — | Non | `0` | Montant brut issu du moteur de calcul tarifaire selon saisons. |
| `prixTotalFinal`| `Decimal` | — | Non | `0` | Prix réel convenu après ajustement commercial. |
| `ajustementManuel`| `Boolean`| — | Non | `false` | Drapeau signalant un override de prix par le réceptionniste. |
| `motifAjustement`| `String` | — | Oui | — | Explication requise de l'ajustement de tarification d'hébergement. |
| `createdAt` | `DateTime` | — | Non | `now()` | Horodatage de création de la réservation. |
| `updatedAt` | `DateTime` | — | Non | *Automatique* | Date de dernière mise à jour de l'entité. |

#### Relations actives
* **1-to-1 (`Stay`)** : Une réservation peut se transformer en un séjour unique.
* **1-to-N (`RoomNight`)** : Verrouille plusieurs nuitées spécifiques de calendrier pour bloquer la chambre.

---

### 3.7. Entité : `RoomNight`
* **Description :** Table d'inventaire de calendrier journalier bloquant l'occupation d'une chambre pour une date donnée.
* **Module fonctionnel :** Réservations / Séjours
* **Règles métier associées :** BR-RES-001 (Verrou anti-double-booking physique)

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant technique de la nuitée bloquée. |
| `roomId` | `Int` | FK | Non | — | Clé étrangère pointant vers la chambre verrouillée. |
| `date` | `DateTime` | — | Non | — | Journée de calendrier spécifique bloquée (minuit à minuit). |
| `reservationId`| `Int` | FK | Oui | — | Référence vers la réservation bloquante (cascade à l'annulation). |
| `stayId` | `Int` | FK | Oui | — | Référence vers le séjour occupant (cascade à la clôture). |

#### Relations & Contraintes d'intégrité
* **Index Unique Inviolable (Anti-Double-Booking)** : `@@unique([roomId, date])`. Cette contrainte au niveau du moteur de stockage (SQLite/InnoDB) interdit rigoureusement la création de deux blocages pour une même chambre sur une même nuit, annulant toute tentative de transaction concurrente frauduleuse.

---

### 3.8. Entité : `Stay`
* **Description :** Entité opérationnelle centrale fédérant l'activité réelle d'occupation, de facturation et de consommation d'un séjour physique.
* **Module fonctionnel :** Séjours (Check-in / Check-out)
* **Règles métier associées :** BR-TR-001 (Pivot central), BR-SEJ-001, BR-SEJ-002, BR-SEJ-003, BR-SEJ-004, BR-SEJ-005, BR-HK-001, BR-FAC-001

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant de séjour. |
| `reservationId`| `Int` | FK | Oui | — | Référence de la réservation d'origine (nullable pour les Walk-Ins). |
| `roomId` | `Int` | FK | Non | — | Clé étrangère vers la chambre occupée. |
| `guestId` | `Int` | FK | Non | — | Clé de référence vers le client hébergé. |
| `dateCheckin` | `DateTime` | — | Non | `now()` | Horodatage réel de début physique d'occupation. |
| `dateCheckoutPrevue`| `DateTime`| — | Non | — | Date planifiée de fin de séjour. |
| `dateCheckoutReelle`| `DateTime`| — | Oui | — | Horodatage réel de départ et libération finale. |
| `statut` | `StatutSejour` | — | Non | `EN_COURS` | État d'avancement opérationnel du séjour. |
| `createdAt` | `DateTime` | — | Non | `now()` | Date de saisie système du séjour. |
| `updatedAt` | `DateTime` | — | Non | *Automatique* | Date de dernière altération. |

#### Relations & Contraintes d'intégrité
* **Relation 1-to-1 unique** : `@unique` sur `reservationId` - Garantit qu'une réservation ne peut générer qu'un seul séjour.
* **Relations** :
  * 1-to-N vers `RoomNight`.
  * 1-to-N vers `Folio` (Capacité multi-folios - BR-FAC-001).

---

### 3.9. Entité : `Folio`
* **Description :** Carnet ou compte d'imputation financière hébergeant des écritures de charges ou de règlements durant un séjour.
* **Module fonctionnel :** Facturation (Billing)
* **Règles métier associées :** BR-TR-001, BR-SEJ-002, BR-SEJ-003, BR-SEJ-004, BR-FAC-001, BR-FAC-002

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant unique de folio. |
| `stayId` | `Int` | FK | Non | — | Clé d'association vers le séjour d'imputation. |
| `libelle` | `String` | — | Non | — | Description ou distinction du folio (ex. "Folio Principal - Hébergement", "Folio Extras"). |
| `createdAt` | `DateTime` | — | Non | `now()` | Date d'initialisation de la feuille de compte. |

#### Relations actives
* **1-to-N (`FolioLine`)** : Regroupe l'ensemble des écritures financières de débits/crédits.
* **1-to-N (`Invoice`)** : Un folio peut faire l'objet d'une ou plusieurs facturations successives (facturations partielles ou complètes).

---

### 3.10. Entité : `FolioLine`
* **Description :** Écriture ou ligne transactionnelle de débit (charge d'hébergement, consommation de service extra, taxe) ou de crédit (enregistrement de versement).
* **Module fonctionnel :** Facturation (Billing)
* **Règles métier associées :** BR-FAC-002, BR-FAC-003 (Soft delete des transactions), BR-FAC-004, BR-AUD-002

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant de ligne comptable. |
| `folioId` | `Int` | FK | Non | — | Clé étrangère pointant vers le folio hôte. |
| `type` | `TypeLigneFolio` | — | Non | — | Catégorisation fiscale de la transaction. |
| `libelle` | `String` | — | Non | — | Désignation explicite de l'achat ou du virement (ex. "Nuitée du 12/07/2026"). |
| `montant` | `Decimal` | — | Non | — | Impact monétaire. Les charges sont positives (+), les encaissements ou annulations sont négatifs (-). |
| `tauxTva` | `Decimal` | — | Non | `0` | Taux fiscal de taxe appliqué (ex. 10.00 pour l'hébergement, 20.00 pour les extras). |
| `annulee` | `Boolean` | — | Non | `false` | Marqueur de suppression logique (Soft Delete obligatoire - BR-FAC-003). |
| `motifAnnulation`| `String` | — | Oui | — | Explication requise pour toute désactivation de ligne financière. |
| `createdAt` | `DateTime` | — | Non | `now()` | Date de comptabilisation de l'opération. |

---

### 3.11. Entité : `TaxRateConfig`
* **Description :** Référentiel des taux fiscaux et taxes applicables au calcul de facturation de l'hôtel.
* **Module fonctionnel :** Facturation / Comptabilité
* **Règles métier associées :** BR-TR-003 (Pas de codage en dur), BR-COM-002

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant. |
| `type` | `String` | — | Non | — | Type de taxe. Valeurs attendues : `TVA_HEBERGEMENT`, `TVA_ANNEXE`, `TAXE_SEJOUR`. |
| `taux` | `Decimal` | — | Non | — | Valeur de taxe (ex. 0.10 pour 10%, ou un forfait comme 20.00 MAD). |
| `applicableA` | `String` | — | Oui | — | Filtre d'applicabilité géographique ou sectorielle si requis. |
| `actifDepuis` | `DateTime` | — | Non | `now()` | Date de début d'entrée en vigueur légale du taux pour calcul temporel. |
| `createdAt` | `DateTime` | — | Non | `now()` | Date de création technique du paramètre. |

---

### 3.12. Entité : `Invoice`
* **Description :** Pièce comptable légale émise après clôture ou décompte d'un folio de séjour.
* **Module fonctionnel :** Facturation / Comptabilité
* **Règles métier associées :** BR-TR-002 (Immutabilité fiscale), BR-COM-002

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant unique de la facture. |
| `numero` | `String` | — | Non | — | Numéro de facture officiel séquentiel unique (ex. "FAC-2026-0034"). |
| `folioId` | `Int` | FK | Non | — | Clé de référence vers le folio facturé. |
| `montantTotal` | `Decimal` | — | Non | — | Total TTC consolidé lors de l'édition. |
| `statut` | `StatutFacture` | — | Non | `EMISE` | État fiscal actuel de la pièce comptable. |
| `pdfUrl` | `String` | — | Oui | — | Lien vers l'emplacement du fichier d'impression stocké. |
| `createdAt` | `DateTime` | — | Non | `now()` | Horodatage de l'émission fiscale (date de facture). |

#### Relations & Contraintes d'intégrité
* **Unicité** : Contrainte d'unicité absolue sur le champ `numero` pour éviter les doublons de numérotation légale.
* **Relations** :
  * 1-to-N vers `CreditNote`.
  * 1-to-N vers `Payment`.

---

### 3.13. Entité : `CreditNote`
* **Description :** Avoir fiscal émis pour annuler ou corriger partiellement/totalement une facture légale déjà émise.
* **Module fonctionnel :** Facturation / Comptabilité
* **Règles métier associées :** BR-TR-002 (Aucune suppression directe de facture)

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant de l'avoir. |
| `invoiceId` | `Int` | FK | Non | — | Référence vers la facture d'origine devant être créditée. |
| `motif` | `String` | — | Non | — | Justification légale obligatoire du remboursement ou de la remise. |
| `montant` | `Decimal` | — | Non | — | Montant de la correction financière TTC (MAD). |
| `createdAt` | `DateTime` | — | Non | `now()` | Date d'émission de l'avoir. |

---

### 3.14. Entité : `Payment`
* **Description :** Enregistrement comptable d'un flux d'encaissement de trésorerie réel.
* **Module fonctionnel :** Paiements / Facturation / Comptabilité
* **Règles métier associées :** BR-PAI-001 (Protection idempotence), BR-PAI-002, BR-PAI-003 (Gap)

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant de transaction bancaire/caisse. |
| `invoiceId` | `Int` | FK | Oui | — | Facture associée au règlement (optionnel si paiement libre ou acompte). |
| `moyen` | `MoyenPaiement` | — | Non | — | Nature du moyen d'encaissement utilisé. |
| `montant` | `Decimal` | — | Non | — | Montant financier crédité (MAD). |
| `idempotencyKey`| `String`| — | Non | — | Jeton d'idempotence unique pour rejeter les doubles transactions d'API. |
| `createdAt` | `DateTime` | — | Non | `now()` | Date et heure de réception des fonds. |

#### Relations & Contraintes d'intégrité
* **Idempotence stricte** : Contrainte d'unicité `@unique` sur `idempotencyKey` pour interdire l'écriture de doublons de transactions concurrentes du réseau (BR-PAI-001).

---

### 3.15. Entité : `HotelConfig`
* **Description :** Configuration légale et globale à instance unique (Singleton) regroupant les données fiscales de l'Hôtel Makarim.
* **Module fonctionnel :** Core / Configuration
* **Règles métier associées :** BR-TR-003, BR-COM-002

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant fixé impérativement à `1` au niveau de l'application (Singleton). |
| `raisonSociale`| `String` | — | Non | — | Nom juridique de la société de gestion hôtelière. |
| `ice` | `String` | — | Non | — | Identifiant Commun de l'Entreprise (obligatoire au Maroc). |
| `identifiantFiscal`| `String`| — | Non | — | Numéro d'Identifiant Fiscal d'exploitation hôtelière. |
| `rc` | `String` | — | Non | — | Numéro du Registre du Commerce d'immatriculation. |
| `adresse` | `String` | — | Non | — | Adresse géographique légale complète. |
| `logoUrl` | `String` | — | Oui | — | URL du logo d'en-tête de facture de l'hôtel. |
| `categorieEtoiles`| `Int` | — | Non | — | Classement officiel de l'hôtel (servant aux plafonds de taxe de séjour). |
| `devise` | `String` | — | Non | `"MAD"` | Symbole de devise comptable standard. |
| `formatDate` | `String` | — | Non | `"DD/MM/YYYY"` | Masque de rendu d'affichage de date. |
| `updatedAt` | `DateTime` | — | Non | *Automatique* | Date de mise à jour des paramètres. |

---

### 3.16. Entités du Module de Sécurité & Contrôle d'Accès (RBAC)

---

#### `Role`
* **Description :** Définit les rôles ou groupes professionnels d'utilisateurs.
* **Module :** Sécurité / Auth
* **Règles :** BR-TR-004
* **Attributs :**
  * `id` (`Int`, PK, Autoincrement)
  * `nom` (`String`, Unique) : Nom du rôle professionnel (ex. `"RECEPTIONIST"`).
* **Relations :** 1-to-N vers `User`, 1-to-N vers `RolePermission`.

---

#### `Permission`
* **Description :** Gère les actions élémentaires de droit applicatif rattachées à un module fonctionnel du PMS.
* **Module :** Sécurité / Auth
* **Règles :** BR-TR-004
* **Attributs :**
  * `id` (`Int`, PK, Autoincrement)
  * `module` (`String`) : Clé du module cible (ex. `"billing"`, `"housekeeping"`).
  * `action` (`String`) : Action autorisée (`"read"`, `"write"`, `"delete"`, `"export"`).
* **Relations & Index :**
  * Index unique composite : `@@unique([module, action])` - Interdit les doublons de déclaration de permissions.
  * 1-to-N vers `RolePermission`.

---

#### `RolePermission`
* **Description :** Table d'association croisant les rôles professionnels et les privilèges d'action.
* **Module :** Sécurité / Auth
* **Règles :** BR-TR-004
* **Attributs & Index :**
  * `roleId` (`Int`, PK/FK) : ID du rôle professionnel cible.
  * `permissionId` (`Int`, PK/FK) : ID de la permission élémentaire associée.
  * Clé primaire composite : `@@id([roleId, permissionId])`.

---

### 3.17. Entité : `User`
* **Description :** Enregistre les comptes utilisateurs nominatifs du personnel habilité à interagir avec le PMS.
* **Module fonctionnel :** Sécurité / Authentification
* **Règles métier associées :** BR-TR-004

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant de compte. |
| `nom` | `String` | — | Non | — | Nom complet ou identité de l'employé. |
| `email` | `String` | — | Non | — | E-mail professionnel unique servant d'identifiant de connexion. |
| `motDePasseHash`| `String` | — | Non | — | Clé de mot de passe chiffrée par algorithme de hachage sécurisé. |
| `roleId` | `Int` | FK | Non | — | Référence vers le rôle professionnel attribué. |
| `actif` | `Boolean` | — | Non | `true` | Drapeau d'activation de compte (permet la suspension immédiate d'accès). |
| `createdAt` | `DateTime` | — | Non | `now()` | Date d'enregistrement du compte. |

#### Relations actives
* **1-to-N (`LoginLog`)** : Historique des tentatives de connexions de l'utilisateur.
* **1-to-N (`PasswordResetToken`)** : Liste des demandes de réinitialisation de mot de passe générées.

---

### 3.18. Entité : `LoginLog`
* **Description :** Historique des tentatives de connexions au système pour le suivi de sécurité.
* **Module fonctionnel :** Audit / Sécurité
* **Règles métier associées :** BR-AUD-002

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant de log. |
| `userId` | `Int` | FK | Non | — | Clé d'association vers l'utilisateur concerné. |
| `succes` | `Boolean` | — | Non | — | Indique si l'authentification a réussi (`true`) ou échoué (`false`). |
| `ip` | `String` | — | Oui | — | Adresse IP d'origine de la tentative de connexion. |
| `createdAt` | `DateTime` | — | Non | `now()` | Horodatage exact de la tentative d'accès. |

---

### 3.19. Entité : `PasswordResetToken`
* **Description :** Jetons à usage unique générés pour valider de manière sécurisée les requêtes de mot de passe oublié.
* **Module fonctionnel :** Sécurité / Authentification
* **Règles métier associées :** BR-AUD-003, BR-AUD-002

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant unique de jeton. |
| `userId` | `Int` | FK | Non | — | Clé d'association vers l'utilisateur demandeur. |
| `token` | `String` | — | Non | — | Chaîne de caractères aléatoires unique stockant le jeton de sécurité. |
| `expiresAt` | `DateTime` | — | Non | — | Date d'expiration limite de validité (BR-AUD-003 - 30 minutes). |
| `utiliseAt` | `DateTime` | — | Oui | — | Marqueur de consommation temporelle pour éviter la réutilisation. |
| `createdAt` | `DateTime` | — | Non | `now()` | Date d'émission de la demande. |

#### Relations & Contraintes d'intégrité
* **Unicité** : Contrainte d'unicité `@unique` sur le champ `token` pour interdire toute collision ou attaque par prédiction de clé.

---

### 3.20. Entité : `MaintenanceTicket`
* **Description :** Ordre de réparation technique ou signalement de panne affectant ou non une chambre spécifique.
* **Module fonctionnel :** Maintenance
* **Règles métier associées :** BR-MNT-001, BR-MNT-002, BR-MNT-003, BR-MNT-004

#### Liste des Champs
| Nom du Champ | Type de Données | Clé | Nullable | Valeur par défaut | Description & Contraintes |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `Int` | PK | Non | *Autoincrement* | Identifiant du ticket technique. |
| `roomId` | `Int` | FK | Oui | — | Chambre affectée par le signalement (nullable si zone commune). |
| `typePanne` | `String` | — | Non | — | Description textuelle abrégée du problème (ex. "Fuite mitigeur douche"). |
| `priorite` | `PrioriteTicket` | — | Non | `MOYENNE` | Degré d'urgence d'intervention. |
| `photoUrl` | `String` | — | Oui | — | Lien vers un cliché justificatif pris sur le terrain pour constat. |
| `assigneA` | `String` | — | Oui | — | Nom ou ID de l'agent technique assigné à la tâche de réparation. |
| `resoluAt` | `DateTime` | — | Oui | — | Horodatage de déclaration de résolution technique (clôture). |
| `createdAt` | `DateTime` | — | Non | `now()` | Horodatage d'ouverture du ticket d'incident. |

---

## 4. Graphe des Relations Conceptuelles

Le schéma relationnel du PMS s'architecture de manière très cohérente autour des cascades suivantes :

```
             [RoomType] 1 ------ N [SeasonRate]
                 1
                 |
                 |
                 N
             [Guest] 1 --------- N [Reservation] 1 --------- 0..1 [Stay]
                 1                     1                         1
                 |                     |                         |
                 |                     |                         N
                 |                     N                     [Folio] 1 ------ N [FolioLine]
                 |               [RoomNight] (Verrou)            1
                 |                     N                         |
                 |                     |                         N
                 +---------------------+---------------------+ [Invoice] 1 ---- N [CreditNote]
                                       |                         1
                                       |                         |
                                       |                         N
                                   [Room] <------------------ [Payment]
                                       1
                                       |
                   +-------------------+-------------------+
                   |                                       |
                   N                                       N
           [RoomStatusLog]                        [MaintenanceTicket]
```

* **Règle de Cascade** : Les suppressions d'entités en base de données de production sont contrôlées. Par exemple, la suppression d'une `Reservation` ou d'un `Stay` entraîne la suppression en cascade des réservations d'inventaire journalier `RoomNight` associées, libérant ainsi mécaniquement les dates dans le calendrier.

---

## 5. Dépendances de Données Inter-Modules

Le croisement des bases de données entraîne des couplages techniques incontournables entre nos différents modules :

1. **Couplage `checkin` ➔ `housekeeping`** : 
   La libération de chambre par l'action de check-out (dans le module de séjour) appelle dynamiquement le service de housekeeping pour faire passer la chambre de l'état `OCCUPEE` ou `DEPART_PREVU` à `A_NETTOYER` et initier une écriture dans la table `RoomStatusLog`.
2. **Couplage `maintenance` ➔ `housekeeping`** : 
   L'ouverture d'un ticket de maintenance sur une chambre modifie son statut en `EN_MAINTENANCE` via la méthode centralisée de transition du housekeeping (`HousekeepingService.transitionRoom`). Réciproquement, la fermeture du ticket de maintenance commute la chambre au statut `A_NETTOYER`.
3. **Couplage `reservations` ➔ `checkin`** : 
   Le moteur d'attribution des chambres vérifie en base que l'entité de destination est au statut `LIBRE_PROPRE`. Toute chambre au statut `A_NETTOYER` ou `EN_MAINTENANCE` bloque l'initialisation du séjour au check-in.
4. **Couplage `billing` ➔ `checkin`** : 
   Une facture (`Invoice`) ne peut être établie que par l'intermédiaire d'un folio de compte (`Folio`) lié à un séjour (`Stay`). L'invariant de check-out nécessite d'exécuter une fonction d'agrégation calculant la somme des lignes de folio (`FolioLine`) pour vérifier que le solde est nul (0.00 MAD).

---

## 6. Rapport d'Incohérences et Gaps Métier/Techniques Identifiés

L'analyse minutieuse des sources architecturales met en lumière plusieurs **écarts, incohérences structurelles et manques** entre la documentation fonctionnelle (`BUSINESS_RULES.md`, `RBAC_MATRIX.md`, le cahier des charges de l'hôtel Makarim), le plan d'exécution cible (`plan-execution-claude-code.md`), et le schéma physique de la base de données actuelle (`schema.prisma`).

Afin d'offrir une visibilité immédiate sur les points requérant une attention ou une action, ces écarts sont classés selon la typologie suivante :

| Symbole | Statut | Signification |
| :---: | :--- | :--- |
| **`❌`** | **Non prévu dans le cahier** | Élément présent ou envisagé techniquement mais absent ou exclu des spécifications fonctionnelles d'origine. |
| **`🟡`** | **Prévu (Phase Future)** | Élément valide et spécifié dans le cahier des charges, mais planifié pour une phase ultérieure de la feuille de route. |
| **`🔴`** | **Devrait déjà exister** | Élément clé d'une phase déjà livrée ou en cours de finalisation (Phase 0 ou 1) mais absent ou incomplet en base. |
| **`🔥`** | **Incohérence réelle** | Contradiction, omission technique critique ou incompatibilité directe entre le modèle de données physique et les exigences du métier. |

### 📊 Tableau de Synthèse des Gaps & Incohérences

| ID | Élément de Gap détecté | Module concerné | Statut | Action Requise |
| :---: | :--- | :--- | :---: | :--- |
| **#1** | Absence du module Ressources Humaines (RH) | Ressources Humaines | **`🟡`** | Planifié pour la Phase 3. Aucune action immédiate. |
| **#2** | Absence de la gestion des Stocks | Stocks & Fournisseurs | **`🟡`** | Planifié pour la Phase 2. Aucune action immédiate. |
| **#3** | Absence de l'entité de tâches `HousekeepingTask` | Housekeeping (Ménage) | **`🟡`** | Planifié pour la Phase 2. Aucune action immédiate. |
| **#4** | Absence des profils de catégorisation CRM et table `Company` | CRM & Clients (Guests) | **`🟡`** | Planifié pour la Phase 2. Aucune action immédiate. |
| **#5** | Absence de la table des dépenses réelles `Expense` | Comptabilité (Dépenses) | **`🟡`** | Planifié pour la Phase 4. Aucune action immédiate. |
| **#6** | Mismatch d'Énumération sur les Modes de Paiement (City Ledger) | Facturation / Paiements | **`🔥`** | **Critique** : Ajuster l'enum `MoyenPaiement` ou le modèle pour gérer les comptes entreprises. |
| **#7** | Absence physique de la table de traçabilité `AuditLog` | Audit & Sécurité | **`🔴`** | **Haute** : Créer le modèle `AuditLog` requis pour tracer les opérations sensibles de la Phase 1. |
| **#8** | Absence des colonnes `deletedAt` pour le Soft Delete transverse | Audit / Intégrité | **`🔥`** | **Haute** : Ajouter le support structurel du Soft Delete sur les tables sensibles (Reservations, Stay...). |

---

### 🔍 Analyse Détaillée des Écarts

#### Gap #1 : Absence Totale du Module Ressources Humaines (RH) en Base de Données
* **Statut :** **`🟡` Prévu mais pas encore développé (phase future)**
* **Description de l'incohérence :** 
  Le document `BUSINESS_RULES.md` (BR-RH-001 à BR-RH-005) et la matrice `RBAC_MATRIX.md` spécifient des règles de validation de planning, d'échange de shifts, d'horodatage inviolable de pointage et d'imputation de salaires selon les grilles de la CNSS marocaine (via les tables attendues `Shift`, `Payslip`, `CnssRateConfig`, `Employee`).
* **Réalité dans `schema.prisma` :** 
  **Aucun** de ces modèles ou tables n'existe physiquement dans le schéma Prisma actuel. Les données d'utilisateurs (`User`) ne sont pas reliées à des entités d'employés, de plannings ou de pointages.
* **Justification du statut :** 
  L'absence est normale à ce stade car le module RH est planifié pour la **Phase 3** du plan d'exécution.
* **Impact :** 
  Aucun sur le MVP (Phase 1). La persistance devra être migrée au lancement de la Phase 3.

---

#### Gap #2 : Absence Physique de la Gestion des Stocks de Consommables
* **Statut :** **`🟡` Prévu mais pas encore développé (phase future)**
* **Description de l'incohérence :** 
  La règle métier `BR-STK-001` impose un calcul automatique de décrémentation des stocks de consommables (produits d'accueil, linges jetables) lors de la validation d'un nettoyage de chambre au statut `CONTROLEE`. La règle `BR-STK-002` spécifie des alertes sur le seuil de sécurité (`seuilAlerte`) pour l'entité `StockItem` liée aux fournisseurs (`Supplier`).
* **Réalité dans `schema.prisma` :** 
  Les modèles `StockItem`, `StockTransaction` (ou `StockMovement`), et `Supplier` sont **totalement absents** de la base de données.
* **Justification du statut :** 
  La gestion des stocks et fournisseurs est planifiée pour la **Phase 2** (Intelligence opérationnelle).
* **Impact :** 
  Aucun sur la phase courante. La base devra être enrichie lors de la Phase 2.

---

#### Gap #3 : Absence de l'Entité `HousekeepingTask` (Tâches de Ménage)
* **Statut :** **`🟡` Prévu mais pas encore développé (phase future)**
* **Description de l'incohérence :** 
  Les règles métier `BR-HK-001` et `BR-HK-002` stipulent que le checkout d'un séjour déclenche la création d'une tâche de ménage (`HousekeepingTask`) régie par une machine à états stricte : `A_FAIRE` ➔ `EN_COURS` ➔ `TERMINEE` ➔ `CONTROLEE`.
* **Réalité dans `schema.prisma` :** 
  **Il n'existe aucune entité `HousekeepingTask`** en base de données. Le module de housekeeping actuel se borne à modifier l'attribut `Room.statut` à l'aide de l'outil `RoomStatusLog`.
* **Justification du statut :** 
  La Phase 1 ne requiert réglementairement qu'un housekeeping simplifié (transition à plat des statuts de chambres pour libérer/bloquer la vente). Les tâches de ménage assignables et structurées font partie de la **Phase 2**.
* **Impact :** 
  Le système ne permet pas encore d'assigner formellement une tâche de nettoyage à un équipier spécifique ni d'historiser son temps de travail, ce qui est conforme au découpage en phases.

---

#### Gap #4 : Manque de structure sur le CRM Client et Profils Corporates
* **Statut :** **`🟡` Prévu mais pas encore développé (phase future)**
* **Description de l'incohérence :** 
  * `BR-CLI-001` requiert de catégoriser les clients dans des profils CRM prédéfinis (`STANDARD`, `VIP`, `ENTREPRISE`, `AGENCE`, `BLACKLIST`).
  * `BR-CLI-002` exige que le système bloque la réservation d'un client au statut `BLACKLIST`.
  * `BR-CLI-004` spécifie un contrôle de plafond de crédit (`plafondCredit`) rattaché à une entreprise partenaire de type `Company`.
* **Réalité dans `schema.prisma` :** 
  La table `Guest` est une fiche plate dénuée de tout champ de catégorisation (pas d'attribut `categorie`, `blacklist` ou assimilé). De plus, l'entité `Company` (société) n'existe pas, empêchant de poser des plafonds de crédit ou de lier un client d'affaires à une personne morale partenaire de type *City Ledger*.
* **Justification du statut :** 
  Le CRM complet et la gestion corporate sont planifiés pour la **Phase 2**. Seul un profil client minimal (`Guest` simple) est requis en Phase 1 pour enregistrer les réservations.
* **Impact :** 
  L'Hôtel ne peut pas encore blacklister de clients ou gérer des fiches entreprises en base pour le moment, ce qui est attendu.

---

#### Gap #5 : Absence de Persistance pour la Comptabilité Opérationnelle (Dépenses)
* **Statut :** **`🟡` Prévu mais pas encore développé (phase future)**
* **Description de l'incohérence :** 
  Le module de comptabilité décrit par `BR-COM-001` repose sur la saisie et l'indexation de dépenses opérationnelles (`Expense`) ventilées par rubriques comptables réglementaires (fournisseurs, salaires, énergie, maintenance, abonnements).
* **Réalité dans `schema.prisma` :** 
  L'entité `Expense` est **inexistante**. Seules les recettes (Folios, Factures, Paiements) sont persistées.
* **Justification du statut :** 
  Le module dépenses et rapports financiers consolidés est planifié pour la **Phase 4** (Pilotage et finitions).
* **Impact :** 
  Impossibilité d'enregistrer des flux de débits (achats de l'hôtel) en base de données pour le moment.

---

#### Gap #6 : Mismatch d'Enumération sur les Modes de Paiement (City Ledger)
* **Statut :** **`🔥` Incohérence réelle**
* **Description de l'incohérence :** 
  La règle `BR-PAI-002` (Modes de paiement autorisés) cite explicitement les types : `ESPECES`, `CARTE`, `VIREMENT`, et `ACOMPTE`. Cependant, pour respecter la centralité du multi-folio et la facturation d'affaires (section 2.1 et 5.13 du cahier des charges), le système doit prendre en charge le paiement par crédit différé d'entreprise (City Ledger). Le fait que l'enum `MoyenPaiement` comporte uniquement ces 4 types bloque l'affectation ou le transfert de solde d'un folio de séjour vers un compte d'affaires corporate sans qu'il ne soit marqué comme payé.
* **Réalité dans `schema.prisma` :** 
  L'énumération physique `MoyenPaiement` n'inclut aucune modalité de facturation différée ou de crédit corporate.
* **Justification du statut :** 
  Il s'agit d'une incohérence de conception entre la structure de paiement (qui traite tout comme un encaissement direct) et les règles de facturation d'entreprise (qui exigent un transfert comptable).
* **Action requise :** 
  Ajuster l'énumération pour introduire un mode de transfert (ex: `CREDIT_SOCIETE` ou `CITY_LEDGER`) ou découpler l'état de règlement du folio de la transaction de paiement physique.

---

#### Gap #7 : Absence Physique de la Table de Traçabilité `AuditLog`
* **Statut :** **`🔴` Devrait déjà exister selon le plan**
* **Description de l'incohérence :** 
  Le plan d'exécution (section 2.1) et les règles métier (BR-AUD-001, BR-AUD-002) stipulent comme règle d'or non négociable : "*Toute opération sensible (annulation, transfert, réouverture) écrit dans AuditLog*". De nombreuses routes d'ajustements de réservations ou d'annulation de charges sont déjà présentes en Phase 1.
* **Réalité dans `schema.prisma` :** 
  Le modèle `AuditLog` (pourtant présent dans la section 3 du plan d'exécution) n'a **pas été créé** dans la base physique.
* **Justification du statut :** 
  Bien que le module "security-audit" complet soit planifié pour la Phase 4, la table `AuditLog` est requise dès la Phase 1 pour stocker les motifs de modification tarifaire (`motifAjustement` de la réservation) et les suppressions logiques financières. Ne pas l'avoir dès maintenant force à stocker ces données de manière éparse ou à reporter l'écriture des logs d'audit.
* **Action requise :** 
  Déclarer le modèle `AuditLog` dans `schema.prisma` et l'intégrer au niveau des services de réservation et de facturation déjà en place.

---

#### Gap #8 : Absence des Colonnes `deletedAt` pour le Soft Delete Transverse
* **Statut :** **`🔥` Incohérence réelle**
* **Description de l'incohérence :** 
  La règle absolue `BR-AUD-001` (Soft Delete) interdit la suppression physique des données sensibles (chambres, séjours, réservations, factures) pour préserver la cohérence financière et l'auditability du PMS. Le plan d'exécution rappelle également en section 8 : "*Soft delete (deletedAt) sur toutes les entités sensibles, jamais de DELETE physique immédiat*".
* **Réalité dans `schema.prisma` :** 
  **Aucun** des modèles physiques clés (`Reservation`, `Stay`, `Invoice`, `Payment`, `Guest`) ne dispose d'un champ `deletedAt` ou `isDeleted`. Seul `FolioLine` possède un flag `annulee`.
* **Justification du statut :** 
  Il s'agit d'une incohérence majeure. Le code des services actuel risque d'effectuer des suppressions physiques (`prisma.reservation.delete`) ou de nécessiter des refactorisations lourdes du schéma lorsque le soft delete sera activé en Phase 4.
* **Action requise :** 
  Ajouter un champ optionnel `deletedAt DateTime?` sur les modèles sensibles et modifier les requêtes Prisma pour filtrer systématiquement les enregistrements actifs.
