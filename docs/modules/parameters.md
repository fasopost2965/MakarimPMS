# Spécification Technique — Module Paramètres & Configuration (parameters.md)

---

## 1. Objectif du module
Le module **Paramètres & Configuration** centralise l'ensemble des réglages globaux du PMS de l'Hôtel Makarim. Il permet de configurer les données d'identité de l'établissement (raison sociale, ICE, RC, adresse), les taux de taxes légaux appliqués sur les folios (TVA hébergement, TVA annexe, taxe de séjour) et la grille tarifaire saisonnière dynamique (`SeasonRate`) par type de chambre.

---

## 2. Responsabilités
Le module est seul responsable de :
* La lecture et la mise à jour de la configuration de l'établissement (`HotelConfig`).
* La gestion et la mise à jour des taux de TVA et des taxes de séjour (`TaxRateConfig`).
* La gestion des règles de tarification saisonnières (`SeasonRate`) permettant de moduler le prix des nuitées.
* La diffusion des nouveaux taux applicables aux modules financiers (`billing`, `payments`).

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* Le paramétrage des rôles et des autorisations utilisateur (géré par le module `auth`).
* La saisie des heures de shifts et de pointage (géré par le module `hr`).
* L'ajustement ponctuel ou les gestes commerciaux sur les factures (géré par le module `billing`).

---

## 4. Entités manipulées
Ce module manipule et gère directement les entités suivantes :
* `HotelConfig` (Identité légale et fiscale de l'hôtel)
* `TaxRateConfig` (Taux de TVA et taxes de séjour applicables)
* `SeasonRate` (Tarifs saisonniers dynamiques)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-PAR-001 (Modification restreinte à l'Administrateur) :** Seul le rôle `ADMINISTRATEUR` possède les droits d'écriture sur les configurations globales, les taxes et les tarifs saisonniers.
* **BR-PAR-002 (Non-rétroactivité des Taxes) :** Tout changement de taux de TVA ou de taxe n'est applicable qu'aux transactions ou factures générées postérieurement au changement. Les factures clôturées/émises restent immuables (INV-FAC-001).
* **BR-PAR-003 (Cohérence Temporelle des Saisons) :** Deux grilles de tarifs saisonniers (`SeasonRate`) pour un même type de chambre (`RoomType`) ne peuvent pas se chevaucher sur la même période de dates.

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-002 (Folio Billing Model)](/docs/ADR-002-Folio-Billing-Model.md) :** Injection des taxes configurées dans les lignes de débit.
* **[ADR-004 (Payment Financial Integrity)](/docs/ADR-004-Payment-Financial-Integrity.md) :** Application rigoureuse des calculs de taxes.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Protection des routes d'écriture de configuration.

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `parameters:read` : Autorisé pour tous les rôles (`ADMINISTRATEUR`, `RECEPTION`, `GOUVERNANTE`, `COMPTABLE`, `MAINTENANCE`, `RH`).
* `parameters:write` (Modification de la configuration) : Autorisé exclusivement pour le rôle `ADMINISTRATEUR`.

---

## 8. Flux entrants
Le module intercepte les requêtes suivantes :
* Requête d'obtention de la configuration légale par le module `billing` lors de la génération d'une facture.
* Requête de lecture des tarifs saisonniers par le module `reservations` ou `checkin` pour estimer le coût d'un séjour.
* Requête de modification des paramètres généraux ou des taxes par un utilisateur Administrateur.

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* `HOTEL_CONFIG_UPDATED` : Émis lors d'un changement de raison sociale, adresse, etc.
* `TAX_RATE_UPDATED` : Émis lors du changement de taux de taxe (pour information aux systèmes comptables).
* `SEASON_RATE_UPDATED` : Émis lors de l'ajout ou de la mise à jour d'un tarif de saison.

---

## 10. Dépendances autorisées
* Aucune dépendance descendante sur d'autres modules fonctionnels pour éviter tout couplage cyclique.

---

## 11. Dépendances interdites
Ce module a l'interdiction de dépendre de :
* `billing` / `payments` / `reservations` : Les paramètres doivent rester une feuille pure du graphe de dépendance.

---

## 12. Contraintes métier
* **Validation des taux de taxes :** Tout taux de taxe saisi doit être compris entre `0%` et `100%` et validé côté serveur.
* **Intégrité de la fiche unique :** La table `HotelConfig` ne doit posséder qu'un seul et unique enregistrement d'ID `1`. Aucune création de fiche supplémentaire n'est permise.

---

## 13. Invariants
* **INV-PAR-001 (Unicité de l'Hôtel) :** `count(HotelConfig) == 1`.
* **INV-PAR-002 (Pas de chevauchement) :** Pour tout `SeasonRate` A et B associés à un même `RoomType`, si `A.id != B.id`, alors `A.dateDebut > B.dateFin` ou `A.dateFin < B.dateDebut`.

---

## 14. États manipulés
Le module ne possède pas de machine à états dynamique. Les entités ont un cycle de vie standard (Création, Lecture, Modification, Suppression).

---

## 15. Points sensibles
* **Calcul des séjours chevauchant plusieurs saisons :** Lors d'une réservation à cheval sur deux saisons tarifaires distinctes, le PMS doit pouvoir appliquer le tarif correspondant à chaque nuitée individuellement.

---

## 16. Dette technique connue
* *Aucune.*

---

## 17. Fonctionnalités prévues ultérieurement
* Synchronisation automatique des taux de change pour les clients internationaux.
* Intégration de clés API pour passerelles de paiements électroniques.

---

## 18. Checklist de Pull Request
Before validating any Pull Request affecting this module, ensure you verify:
* [ ] All modifications to `HotelConfig`, `TaxRateConfig`, or `SeasonRate` endpoints are gated strictly by `parameters:write` (Administrateur only).
* [ ] Any overlapping seasons for the same room type are blocked with a `400 Bad Request` or appropriate business rule error.
* [ ] Changing any tax rate validates that the rate value is a positive percentage.
