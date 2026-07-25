# Spécification Technique — Module Séjours (stay.md)

---

## 1. Objectif du module
Le module **Séjours** est le cœur opérationnel de la vie hôtelière de l'Hôtel Makarim. Il gère l'accueil physique du client, l'enregistrement en temps réel de sa présence dans les murs (Check-in), l'occupation des chambres physiques, les modifications de conditions d'hébergement en cours de séjour (changement de chambre, prolongation, raccourcissement) et le départ du client (Check-out).

---

## 2. Responsabilités
Le module est seul responsable de :
* Le processus d'enregistrement initial des arrivées prévues (Check-in) ou spontanées (Walk-In).
* L'activation opérationnelle de l'entité `Stay`.
* L'affectation de la chambre physique et le basculement de son statut en `OCCUPEE` ou `DEPART_PREVU`.
* La génération de la fiche de police réglementaire pour les autorités locales.
* La gestion des transferts de chambre physiques (Room Change) avec traçabilité historique.
* Le déclenchement de la procédure de départ (Check-out) après libération et confirmation de solde financier à 0.00 MAD.

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* Le calcul de disponibilité prospective des nuitées futures (confié au module `reservations`).
* L'imputation d'extras de consommation (confié au module `billing`).
* La perception et l'enregistrement de règlements bancaires (confié au module `payments`).
* La réalisation concrète des opérations de nettoyage des chambres (confié au module `housekeeping`).

---

## 4. Entités manipulées
Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `Stay` (Conteneur opérationnel du séjour client)
* `Room` (Affectation physique et mise à jour de statut)
* `Guest` (Identification obligatoire des résidents)
* `Reservation` (Source d'origine de l'arrivée)
* `Folio` (Vérification et liaison au conteneur financier)
* `RoomStatusLog` (Tracement obligatoire de l'occupation)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-SEJ-002 (Initialisation du Séjour) :** Check-in créant le séjour, le Folio principal et mutant la chambre en `OCCUPEE`.
* **BR-SEJ-003 (Check-in Direct / Walk-In) :** Enregistrement spontané créant à la volée le client, le séjour et le Folio.
* **BR-SEJ-004 (Invariant de Solde de Check-out) :** Interdiction stricte de clôturer le séjour si la balance financière cumulée n'est pas égale à 0.00 MAD.
* **BR-SEJ-005 (Libération de la Chambre au Check-out) :** Basculement de la chambre à l'état `A_NETTOYER` dès le départ client.
* **BR-CLI-003 (Enregistrement Obligatoire des Pièces d'Identité) :** Exigence légale marocaine de pièce d'identité valide pour séjourner à l'hôtel.
* **BR-CHA-003 (Vente Interdite hors Disponible Propre) :** Interdiction absolue de check-in dans une chambre sale ou en panne.

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-001 (Stay-Centric Architecture)](/docs/ADR-001-Stay-Centric-Architecture.md) :** Autonomie opérationnelle totale de l'entité `Stay` par rapport aux réservations.
* **[ADR-002 (Folio & Billing Model)](/docs/ADR-002-Folio-Billing-Model.md) :** Couplage de facturation par Folios rattachés au séjour.
* **[ADR-003 (Room State Machine)](/docs/ADR-003-Room-State-Machine.md) :** Transition d'états de chambres déclenchées par les événements de séjour.
* **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md) :** Archivage et audit obligatoire de tout changement de chambre ou de séjour écourté.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Droits d'enregistrement réservés.

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `stay:read` : Autorisé pour `ADMINISTRATEUR`, `RECEPTION`, `COMPTABLE`.
* `stay:write` : Autorisé pour `ADMINISTRATEUR`, `RECEPTION`.
* *Note :* Les rôles `GOUVERNANTE` et `MAINTENANCE` consultent l'état de présence de manière indirecte via l'état des chambres.

---

## 8. Flux entrants
Le module intercepte les événements et requêtes suivants :
* Requête de Check-in depuis une réservation existante.
* Requête de Walk-In (Check-in direct).
* Requête de transfert physique de chambre (Room Change).
* Événement de solde apuré à 0.00 MAD (déclencheur pour autoriser le Check-out).

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* `SEJOUR_DEMARRE` : Déclenché lors du check-in (permet d'initialiser les consommations et le planning d'entretien).
* `CHAMBRE_OCCUPEE` : Signale au module `rooms` la mise à jour de statut physique.
* `SEJOUR_TERMINE` : Émis lors du check-out (permet d'archiver le séjour et de libérer définitivement la chambre).
* `DECLENCHEMENT_MENAGE` : Émis au check-out pour notifier instantanément le module `housekeeping`.

---

## 10. Dépendances autorisées
Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `guests` : Pour valider et collecter l'identité des occupants.
* `rooms` : Pour allouer et changer le statut physique des chambres.
* `billing` : Pour interroger le solde des folios associés avant de valider un check-out.

---

## 11. Dépendances interdites
Ce module a l'interdiction stricte de dépendre de :
* `payments` : Le module de séjour n'enregistre jamais de transactions bancaires directement. Il formule uniquement des demandes de vérification de solde auprès du module `billing`. *Justification : Préservation de l'étanchéité financière et comptable.*
* `maintenance` / `housekeeping` : Le module de séjour ne gère pas l'exécution des tâches d'entretien ou de réparation. Il émet uniquement des requêtes d'autorisation de vente et des alertes de libération. *Justification : Découplage opérationnel.*
* `hr` : Aucun lien métier. *Justification : Indépendance RH.*

---

## 12. Contraintes métier
* **Contrainte de Police (Fiche de police) :** Conformément à la législation marocaine, les données obligatoires d'identité (nom, prénom, date de naissance, nationalité, numéro de passeport/CNIE, date d'entrée sur le territoire) de **chaque occupant** majeur d'une chambre doivent être renseignées en base de données avant la finalisation du check-in.
* **Veto de propreté :** Le système doit interdire techniquement le check-in dans une chambre dont l'état physique n'est pas strictement `LIBRE_PROPRE`.

---

## 13. Invariants
* **INV-SEJ-001 (Pas de double check-in) :** Une chambre au statut `OCCUPEE` ne peut pas être réaffectée à un nouveau check-in ou transfert de chambre.
* **INV-SEJ-002 (Solde à zéro au départ) :** Aucun séjour ne peut transiter vers l'état `CHECKOUT` si le solde financier cumulé des folios rattachés est différent de 0.00 MAD.

---

## 14. États manipulés
Le cycle de vie d'un séjour est régi par la machine à états `StatutSejour` :
* `EN_COURS`
* `CHECKOUT`
* `ANNULE`

---

## 15. Points sensibles
* **Forçage administratif du Check-out :** En cas de litige client ou de départ précipité sans paiement immédiat, le système interdit le check-out silencieux ou arbitraire.
  * *Résolution :* Le folio doit être formellement clôturé par le Comptable ou l'Administrateur en le transférant sur un compte entreprise valide (City Ledger) pour ramener le solde à 0.00 MAD avant que la Réception ne puisse valider le check-out physique.

---

## 16. Dette technique connue
* *Aucune dette technique identifiée à ce stade.*

---

## 17. Fonctionnalités prévues ultérieurement
* **Phase 2 :** Génération et exportation automatisée au format réglementaire du fichier de police pour la transmission numérique quotidienne à la préfecture.

---

## 18. Checklist de Pull Request
Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Le check-in valide la pièce d'identité de l'ensemble des occupants majeurs (champs obligatoires CNIE/Passeport).
* [ ] Le check-in bloque le commit si la chambre ciblée n'est pas à l'état `LIBRE_PROPRE` ou `RESERVEE` (pour le client attendu).
* [ ] Le check-out vérifie de manière stricte le solde de tous les folios associés et lève une exception en cas de balance différente de 0.00 MAD.
* [ ] Tout transfert de chambre (Room Change) écrit une ligne d'historique de transition de chambre et une ligne d'audit explicative dans `AuditLog`.
