# Spécification Technique — Module Chambres (rooms.md)

---

## 1. Objectif du module
Le module **Chambres** gère la dimension physique, capacitive et tarifaire de l'hébergement de l'Hôtel Makarim (24 chambres). Il maintient le référentiel des chambres de l'établissement, gère leurs statuts en temps réel, garantit la cohérence du cycle d'occupation hôtelier et assure l'historisation immuable de chaque transition d'état physique.

---

## 2. Responsabilités
Le module est seul responsable de :
* Le maintien du référentiel physique des 24 chambres (numéro, étage, type de chambre, caractéristiques).
* La gestion de la machine à états stricte du statut physique et commercial de chaque chambre (`StatutChambre`).
* L'historisation obligatoire de tout changement de statut de chambre dans l'entité `RoomStatusLog`.
* La publication en temps réel du statut d'occupation et d'entretien pour le desk de réception et les équipes d'étages.
* Le contrôle de cohérence interdisant l'attribution ou la vente d'une chambre non opérationnelle.

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* La création ou l'annulation de réservations de clients (confié au module `reservations`).
* L'enregistrement physique d'un séjour client ou le check-in (confié au module `stay`).
* La réalisation opérationnelle des tâches d'entretien physique (confié au module `housekeeping`).
* La réparation matérielle des incidents techniques (confié au module `maintenance`).

---

## 4. Entités manipulées
Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `Room` (Référentiel physique et état de la chambre)
* `RoomType` (Définition de catégorie et tarification de base)
* `RoomStatusLog` (Trace d'historique de transition de statut physique)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-CHA-001 (Unicité des Numéros de Chambre) :** Interdiction stricte de doublonner un numéro de chambre en base.
* **BR-CHA-002 (Invariant des États de Chambre) :** Maintien d'un et un seul statut parmi la liste prédéfinie.
* **BR-CHA-003 (Vente Interdite hors Disponible Propre) :** Restriction bloquante empêchant l'attribution de chambres sales ou en panne.
* **BR-CHA-004 (Historique Obligatoire des Changements d'État) :** Écriture systématique dans `RoomStatusLog` avec auteur et motif.

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-001 (Stay-Centric Architecture)](/docs/ADR-001-Stay-Centric-Architecture.md) :** Découplage de la chambre physique et de l'historique du séjour client.
* **[ADR-003 (Room State Machine)](/docs/ADR-003-Room-State-Machine.md) :** Modélisation et régulation dynamique de la machine à états de la chambre.
* **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md) :** Traçabilité et historique indélébile des anomalies d'état.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Permissions de forçage manuel de statut.

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `rooms:read` : Autorisé pour tous les rôles actifs de l'hôtel (`ADMINISTRATEUR`, `RECEPTION`, `GOUVERNANTE`, `COMPTABLE`, `MAINTENANCE`, `RH`).
* `rooms:write` (Modification de configuration) : Autorisé exclusivement pour `ADMINISTRATEUR`.
* `rooms:status` (Mutation manuelle d'état d'exploitation) : Autorisé pour `ADMINISTRATEUR`, `RECEPTION`, `GOUVERNANTE`.
* *Note :* Les rôles `MAINTENANCE` modifient le statut de la chambre uniquement de manière indirecte en résolvant un ticket de panne.

---

## 8. Flux entrants
Le module intercepte les événements et requêtes suivants :
* Requête d'attribution lors d'un Check-in (origine module `stay`).
* Notification de libération lors d'un Check-out (origine module `stay`).
* Signalement de fin de ménage d'une chambre contrôlée (origine module `housekeeping`).
* Signalement de panne technique urgente ou de résolution (origine module `maintenance`).

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* `CHAMBRE_MUTE_A_NETTOYER` : Émis lors du check-out (déclenche instantanément la planification de ménage).
* `CHAMBRE_MUTE_LIBRE_PROPRE` : Émis après contrôle de la gouvernante (rend la chambre immédiatement vendable à la réception).
* `CHAMBRE_BLOQUEE_MAINTENANCE` : Émis lors d'un incident bloquant (exclut la chambre des capacités disponibles).

---

## 10. Dépendances autorisées
Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* Aucun module externe. Le module `rooms` est un module socle fondamental de données n'ayant pas besoin de faire appel à d'autres logiques applicatives pour s'exécuter.

---

## 11. Dépendances interdites
Ce module a l'interdiction stricte de dépendre de :
* `stay` / `reservations` : Le module chambres ne doit jamais importer de logique liée aux séjours ou réservations actifs. *Justification : Évite le couplage circulaire avec les conteneurs d'occupation opérationnelle.*
* `billing` / `payments` : Aucun lien financier ou comptable. *Justification : Ségrégation absolue entre l'actif physique de l'hôtel et la facturation.*
* `housekeeping` / `maintenance` : Le module chambres ne doit pas commander ou appeler l'exécution opérationnelle des tâches d'entretien. *Justification : Maintien de la chambre comme ressource passive pilotée par événements.*

---

## 12. Contraintes métier
* **Exactitude d'Inventaire :** Le système de l'Hôtel Makarim est configuré pour un inventaire fixe et immuable de **24 chambres**. L'ajout ou la suppression physique d'une chambre en production est une anomalie et doit être interdit en dehors d'une procédure d'audit d'infrastructure lourde de la direction.
* **Garde-fou d'attribution :** L'affectation d'une chambre à un séjour doit s'accompagner d'une validation de compatibilité avec la catégorie d'hébergement facturée (`RoomType`).

---

## 13. Invariants
* **INV-CHA-001 (Unicité de Chambre) :** Deux chambres ne peuvent jamais posséder le même numéro d'identification en base de données.
* **INV-CHA-002 (Inviolabilité de l'Historique de Statut) :** Toute modification de la colonne `Room.status` doit faire l'objet d'un commit atomique conjoint écrivant une ligne d'historisation détaillée dans la table `RoomStatusLog`.

---

## 14. États manipulés
La machine à états physique de la chambre est régie par `StatutChambre` :
* `LIBRE_PROPRE`
* `RESERVEE`
* `OCCUPEE`
* `DEPART_PREVU`
* `A_NETTOYER`
* `EN_NETTOYAGE`
* `EN_MAINTENANCE`

---

## 15. Points sensibles
* **Désynchronisation physique et système :** Le risque majeur est qu'une chambre soit propre physiquement mais reste sale dans le système (bloquant la réception) ou inversement.
  * *Résolution :* Conception d'une interface mobile d'étage hautement réactive avec synchronisation immédiate par Websocket de l'état du système hôtelier.

---

## 16. Dette technique connue
* *Aucune dette technique identifiée à ce stade.*

---

## 17. Fonctionnalités prévues ultérieurement
* **Phase 2 :** Interface de planification visuelle de type diagramme de Gantt interactif (Drag-and-Drop de réservation entre chambres de même catégorie).

---

## 18. Checklist de Pull Request
Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Tout changement de la valeur `Room.status` s'accompagne de l'écriture obligatoire d'une ligne d'historique dans `RoomStatusLog`.
* [ ] Le numéro de chambre est unique et validé contre toute collision en base.
* [ ] Les validations d'accès RBAC interdisent à un rôle non autorisé (ex: équipier de ménage ou technicien de maintenance) de forcer manuellement le statut d'une chambre vers `LIBRE_PROPRE` en dehors du flux réglementaire de contrôle.
* [ ] Aucune suppression physique d'une chambre (`Room`) n'est autorisée par l'API si cette dernière est rattachée à des séjours passés ou à des nuitées d'occupation.
