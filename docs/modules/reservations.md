# Spécification Technique — Module Réservations (reservations.md)

---

## 1. Objectif du module
Le module **Réservations** assure la planification prospective des nuitées de l'Hôtel Makarim. Il permet d'enregistrer les intentions de séjour des clients, d'attribuer des chambres prévisionnelles, de calculer la disponibilité de l'établissement à une date donnée et de garantir l'absence de surréservation physique (double-booking).

---

## 2. Responsabilités
Le module est seul responsable de :
* La création, mise à jour, annulation et gestion du cycle de vie des réservations prévisionnelles.
* Le calcul de la disponibilité en temps réel par catégorie de chambre (`RoomType`) et par nuitée.
* La planification et le verrouillage physique des nuitées d'hébergement via l'entité pivot d'occupation (`RoomNight`).
* La collecte et l'enregistrement de l'acompte de réservation obligatoire.
* Le traitement des non-présentations du jour (`NO_SHOW`) à l'heure limite fixée.

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* Le processus physique d'accueil ou de check-in du client à son arrivée (confié au module `stay`).
* La création de folios de facturation d'exploitation ou la perception de consommations d'extras (confié au module `billing`).
* Le suivi de l'état d'entretien des chambres ou la planification du ménage (confié au module `housekeeping`).

---

## 4. Entités manipulées
Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `Reservation` (Cycle de vie prospectif)
* `RoomNight` (Table pivot d'allocation unique d'une chambre par nuitée)
* `Guest` (Relation de propriété de la réservation)
* `RoomType` (Vérification des capacités par catégorie de chambre)
* `Room` (Attribution physique facultative lors de la réservation prévisionnelle)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-RES-001 (Unicité de nuitée) :** Une chambre ne peut jamais être vendue ou occupée deux fois pour la même nuitée.
* **BR-RES-002 (Politique d'acompte) :** Exigence d'un acompte pour garantir les réservations provenant de certains canaux ou lors de périodes de haute saison.
* **BR-CLI-002 (Restriction Blacklist) :** Blocage automatique de la réservation si le client associé est sur liste noire.
* **BR-CHA-003 (Vente Interdite hors Disponible Propre) :** Pour l'attribution prévisionnelle d'une chambre physique lors de la réservation.

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-001 (Stay-Centric Architecture)](/docs/ADR-001-Stay-Centric-Architecture.md) :** Découplage strict entre la réservation (planification) et le séjour (opérationnel).
* **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md) :** Obligation de conserver les réservations annulées via `deletedAt` et d'auditer les modifications de tarifs négociés.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Restrictions d'accès selon le profil de l'utilisateur.

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `reservations:read` : Autorisé pour `ADMINISTRATEUR`, `RECEPTION`, `COMPTABLE`.
* `reservations:write` : Autorisé pour `ADMINISTRATEUR`, `RECEPTION`.
* *Note :* Les rôles `GOUVERNANTE`, `MAINTENANCE` et `RH` n'ont aucun droit d'accès sur ce module.

---

## 8. Flux entrants
Le module intercepte les événements et requêtes suivants :
* Demande de création de réservation (provenant du desk ou d'un canal de distribution).
* Demande de modification d'une réservation (dates, catégorie de chambre, détails client).
* Demande d'annulation formelle d'une réservation par l'opérateur.
* Événement de notification d'arrivée du jour (déclencheur pour l'attribution).

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* `RESERVATION_CONFIRMEE` : Émis lors du commit de création en base (permet de notifier le client ou d'allouer l'acompte).
* `RESERVATION_ANNULEE` : Émis lors du soft delete (permet de libérer les nuitées dans `RoomNight`).
* `RESERVATION_TRANSFORMEE` : Émis lors du check-in (signifie au module `stay` qu'il doit prendre le relais).

---

## 10. Dépendances autorisées
Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `guests` : Pour récupérer ou initialiser la fiche d'identité du client principal rattaché.
* `rooms` : Pour vérifier les capacités matérielles et l'existence physique des types de chambres.

---

## 11. Dépendances interdites
Ce module a l'interdiction stricte de dépendre de :
* `billing` : Le module de réservation ne doit pas manipuler de folios ou de factures d'exploitation actives. L'acompte initial est un enregistrement de dépôt de garantie indépendant. *Justification : Risque de couplage fort et de pollution des écritures comptables d'exploitation par des réservations non matérialisées.*
* `housekeeping` / `maintenance` : Le ménage ou la technique n'interviennent pas sur les réservations. *Justification : Ségrégation stricte des opérations physiques et de la planification.*
* `hr` : Aucun lien métier. *Justification : Indépendance RH.*

---

## 12. Contraintes métier
* **Gestion des acomptes :** Une réservation garantie par acompte doit impérativement enregistrer la référence de transaction financière avant de passer au statut `CONFIRMEE`.
* **Heure limite d'arrivée (Release Time) :** Sauf indication contraire ou garantie de paiement, une réservation non matérialisée à 18h00 le jour de l'arrivée prévue est automatiquement basculée au statut `NO_SHOW` pour libérer la chambre pour des ventes directes (Walk-In).

---

## 13. Invariants
* **INV-RES-001 (Pas de surréservation de nuitée) :** L'existence d'une ligne d'occupation dans `RoomNight` bloquant une chambre $C$ pour la nuitée $N$ interdit l'écriture d'une seconde ligne associant $C$ et $N$.
* **INV-RES-002 (Validation Client requis) :** Il est impossible d'enregistrer une réservation sans lui associer un identifiant de client valide et existant dans le système.

---

## 14. États manipulés
Le cycle de vie d'une réservation est régi par la machine à états `StatutReservation` :
* `CONFIRMEE`
* `ANNULEE`
* `NO_SHOW`
* `TRANSFORMEE_EN_SEJOUR`

---

## 15. Points sensibles
* **Concurrence d'accès (Race Conditions) :** Lors de périodes de forte affluence, deux réceptionnistes pourraient tenter d'allouer la même chambre physique sur la même nuitée.
  * *Résolution :* Recours obligatoire à une transaction Prisma (`$transaction`) et un verrouillage par index unique SQL composite (`roomId`, `date`) sur la table `RoomNight`.

---

## 16. Dette technique connue
* *Aucune dette technique identifiée à ce stade.*

---

## 17. Fonctionnalités prévues ultérieurement
* **Phase 3 :** Intégration bidirectionnelle avec un Channel Manager externe (gérant la synchronisation automatique des stocks de nuitées sur Booking.com et Expedia).

---

## 18. Checklist de Pull Request
Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Aucune requête d'insertion de réservation ne peut être commise sans vérifier la non-surréservation dans `RoomNight` au sein d'une transaction atomique.
* [ ] Le client associé à la réservation n'est pas catégorisé `BLACKLIST`.
* [ ] Les dates de réservation sont cohérentes (la date d'arrivée précède strictement la date de départ).
* [ ] Toute modification d'un tarif négocié ou annulation de réservation est loggée de manière synchrone dans `AuditLog`.
