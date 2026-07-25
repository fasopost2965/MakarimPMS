# Spécification Technique — Module Clients (guests.md)

---

## 1. Objectif du module
Le module **Clients** assure la centralisation, la gestion et la qualification des fiches d'identité des clients (CRM) de l'Hôtel Makarim. Il garantit la conformité légale hôtelière marocaine en matière d'enregistrement des pièces d'identité et de fiches de police, tout en protégeant l'hôtel contre les risques d'exploitation (gestion de la liste noire).

---

## 2. Responsabilités
Le module est seul responsable de :
* La création, de la mise à jour et de l'archivage logique (soft-delete) des fiches clients (`Guest`).
* La validation réglementaire des pièces d'identité (format et présence des pièces CNIE ou Passeport).
* La catégorisation et du profilage CRM des clients (Standard, VIP, Entreprise, Blacklist).
* L'application stricte des blocages opérationnels pour les clients figurant sur la liste noire.
* La gestion des fiches d'entreprises et de sociétés partenaires (`Company`) ainsi que de leurs plafonds de crédit associés.

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* Le processus d'attribution physique de chambre ou de check-in (confié au module `stay`).
* La planification des disponibilités futures (confié au module `reservations`).
* L'enregistrement direct des transactions ou règlements comptables (confié au module `payments`).

---

## 4. Entités manipulées
Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `Guest` (Fiche d'identité client principale)
* `Company` (Fiche entreprise partenaire de l'hôtel)
* `Reservation` (Historique des réservations associées)
* `Stay` (Historique des séjours consommés par le client)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-CLI-001 (Typologie des Fiches Clients) :** Assignation obligatoire à une catégorie CRM (`STANDARD`, `VIP`, `ENTREPRISE`, `AGENCE`, `BLACKLIST`).
* **BR-CLI-002 (Restriction Blacklist) :** Interdiction absolue d'accorder une réservation ou un check-in à un client sur liste noire sans override administrateur.
* **BR-CLI-003 (Enregistrement Obligatoire des Pièces d'Identité) :** Exigence légale de saisie de la pièce d'identité pour les check-ins.
* **BR-CLI-004 (Plafond de Crédit Entreprise) :** Blocage des imputations d'extras au-delà du plafond autorisé de la société partenaire.

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-001 (Stay-Centric Architecture)](/docs/ADR-001-Stay-Centric-Architecture.md) :** Liaison historique entre la fiche client et ses séjours successifs.
* **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md) :** Interdiction de suppression physique des fiches clients associées à des transactions financières ou séjours passés.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Restriction d'accès et d'édition des profils sensibles (Blacklist, Entreprises).

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `guests:read` : Autorisé pour `ADMINISTRATEUR`, `RECEPTION`, `COMPTABLE`.
* `guests:write` : Autorisé pour `ADMINISTRATEUR`, `RECEPTION`.
* `guests:blacklist` : Autorisé exclusivement pour `ADMINISTRATEUR`. (Seul l'administrateur peut qualifier ou requalifier un client en `BLACKLIST`).

---

## 8. Flux entrants
Le module intercepte les événements et requêtes suivants :
* Création d'une fiche client lors d'une réservation ou d'un Walk-In.
* Demande de mise à jour des coordonnées d'un client.
* Demande de mise sur liste noire d'un client suite à un incident d'exploitation.
* Demande d'association d'un client à une entreprise partenaire.

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* `CLIENT_CREE` : Diffusé après insertion de la fiche en base.
* `CLIENT_QUALIFIE_VIP` : Permet de notifier la réception pour la préparation d'un accueil personnalisé (accueil VIP en chambre).
* `CLIENT_ALERTE_BLACKLIST` : Émis lors d'une tentative de réservation par un client sur liste noire (déclenche l'alerte d'interdiction).

---

## 10. Dépendances autorisées
Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* Aucun module externe. Le module `guests` est un module feuille auto-suffisant qui stocke et valide les données d'identité fondamentales.

---

## 11. Dépendances interdites
Ce module a l'interdiction stricte de dépendre de :
* `stay` / `reservations` : Le module client ne doit pas avoir connaissance des détails internes de l'occupation d'une chambre ou de la logique de planification future pour éviter les dépendances circulaires. *Justification : Prévention des couplages cycliques critiques.*
* `billing` / `payments` : Aucun lien direct d'écriture ou de lecture des comptes comptables. *Justification : Isolement des données personnelles et de la gestion financière.*
* `housekeeping` / `maintenance` : Aucun point de contact. *Justification : Découplage complet.*

---

## 12. Contraintes métier
* **Validation de Pièce Unique :** Le système doit garantir qu'un numéro de pièce d'identité (`CNIE` ou `Passeport`) associé à un pays d'émission est unique pour éviter les doublons de fiches clients et la fragmentation du CRM.
* **Champs Obligatoires Pays :** Pour des raisons statistiques de taxe de séjour et de déclaration de police, le champ de nationalité (`nationality`) est obligatoire sur la fiche client.

---

## 13. Invariants
* **INV-CLI-001 (Intégrité Blacklist) :** Aucun client qualifié de `BLACKLIST` ne peut voir une réservation passer à l'état `CONFIRMEE` ou un séjour passer à l'état `EN_COURS` sans qu'un log d'audit d'autorisation d'exception signé par un Administrateur ne soit enregistré.

---

## 14. États manipulés
Ce module gère le profilage et la segmentation CRM du client :
* `STANDARD`
* `VIP`
* `ENTREPRISE`
* `AGENCE`
* `BLACKLIST`

---

## 15. Points sensibles
* **RGPD et Confidentialité (Données Sensibles) :** Les fiches clients contiennent des données personnelles hautement confidentielles (coordonnées, pièces d'identité, historique).
  * *Résolution :* Application de filtres RBAC stricts sur l'export brut des bases clients, et hachage/protection d'accès des documents d'identité archivés numériquement.

---

## 16. Dette technique connue
* *Aucune dette technique identifiée à ce stade.*

---

## 17. Fonctionnalités prévues ultérieurement
* **Phase 4 :** Programme de fidélité de l'Hôtel Makarim (gestion de points et surclassements automatiques basés sur l'historique des séjours consommés).

---

## 18. Checklist de Pull Request
Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] La création d'une fiche client valide obligatoirement le format du numéro de pièce d'identité selon la nationalité (CNIE marocaine ou Passeport).
* [ ] Aucun utilisateur autre qu'un `ADMINISTRATEUR` ne peut muter le statut CRM d'un client vers ou depuis `BLACKLIST`.
* [ ] Les opérations de modification d'informations clients sensibles (comme le changement de statut CRM) écrivent un log synchrone dans `AuditLog`.
* [ ] La suppression d'un client est un soft-delete exclusif (`deletedAt`) et est interdite si le client possède des séjours actifs ou des factures non soldées.
