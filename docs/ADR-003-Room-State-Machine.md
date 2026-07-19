# Architecture Decision Record (ADR-003) : Room State Machine

Ce document formalise la conception, le comportement dynamique, et les contraintes d'intégrité de la **machine à états des chambres** (Room State Machine) du Property Management System (PMS) de l'Hôtel Makarim.

---

## 1. Métadonnées

* **Identifiant :** ADR-003
* **Titre :** Room State Machine (Machine à états des chambres et gestion de la maintenance/ménage)
* **Statut :** Validé
* **Date :** 2026-07-19
* **Auteur :** Architecte Logiciel PMS Makarim
* **Documents de référence :**
  * `BUSINESS_RULES.md` (BR-CHA-002, BR-CHA-003, BR-CHA-004, BR-HK-001, BR-HK-002, BR-HK-003, BR-MNT-001, BR-MNT-002, BR-MNT-003, BR-MNT-004)
  * `DATA_DICTIONARY.md` (Champs de `Room`, tables `RoomStatusLog`, `HousekeepingTask`, `MaintenanceTicket`)
  * `RBAC_MATRIX.md` (Permissions des rôles Maintenance, Gouvernante, Équipier de ménage, Réception)
  * `ADR-001 — Stay-Centric Architecture`
  * Plan d'Exécution Claude Code (`docs/plan-execution-claude-code.md`)
  * Cahier des charges final — PMS Hôtel Makarim.pdf

---

## 2. Contexte

La gestion de l'état des 24 chambres de l'Hôtel Makarim est un levier opérationnel critique pour coordonner les services de la Réception (ventes), du Ménage (housekeeping) et de la Maintenance (technique) :
1. **Risque de double allocation ou de vente indue :** Une chambre ne doit jamais être vendue ou attribuée à un client si elle est sale (non encore contrôlée) ou en panne (maintenance active). 
2. **Dérive de coordination inter-services :** Sans règles transactionnelles strictes, un technicien pourrait résoudre une panne et déclarer la chambre "libre" de son point de vue, alors qu'elle est couverte de débris de travaux et nécessite un nettoyage approfondi. De même, un réceptionniste pressé pourrait outrepasser l'état "sale" d'une chambre pour accélérer un enregistrement.
3. **Complexité de la maintenance sur chambre occupée :** Une panne (ex. une ampoule grillée) peut être signalée dans une chambre occupée par un client. Il est impératif d'enregistrer la panne et de planifier l'intervention sans pour autant bloquer la chambre (l'occupation par un séjour actif prime sur le blocage technique).
4. **Multiplicité des pannes :** Une chambre peut accumuler plusieurs dysfonctionnements mineurs ou majeurs (ex. climatisation en panne ET fuite d'eau). La résolution d'une seule de ces pannes ne doit pas libérer la chambre si d'autres pannes bloquantes subsistent.

Rendre le statut d'une chambre modifiable arbitrairement via de simples requêtes directes en base de données (sans vérification d'invariants et de dépendances) est source de régressions opérationnelles graves.

---

## 3. Décision

Nous actons l'implémentation d'une **Machine à États Robuste et Centralisée** pour l'entité `Room`. Tous les changements de statut physiques doivent transiter par un module applicatif de validation des transitions et respecter les décisions d'architecture suivantes :

### 3.1. Les États Physiques de la Chambre (StatutChambre)
La colonne `statut` de la table `Room` est régie par une énumération stricte :
* **`LIBRE_PROPRE` :** Chambre nettoyée, inspectée et validée. Vendable immédiatement.
* **`RESERVEE` :** Chambre propre, bloquée temporairement pour une arrivée planifiée le jour même.
* **`OCCUPEE` :** Un client a effectué son check-in ; le séjour rattaché est en cours.
* **`DEPART_PREVU` :** Le client occupe la chambre, mais la date de fin de son séjour est fixée au jour courant (check-out requis avant l'heure limite).
* **`A_NETTOYER` :** La chambre a été libérée (après check-out) ou nécessite son entretien quotidien. Elle est non vendable.
* **`EN_NETTOYAGE` :** Un équipier de ménage est actif au sein de la chambre. Non vendable.
* **`EN_MAINTENANCE` :** Bloquée physiquement et techniquement pour des raisons de réparation ou de sécurité. Non vendable et non réservable.

### 3.2. Règles d'Interaction avec la Maintenance (Tickets de Panne)
1. **Règle d'or de priorité d'occupation (BR-MNT-003) :** L'ouverture d'un ticket de maintenance (`MaintenanceTicket`) sur une chambre au statut `OCCUPEE` ou `DEPART_PREVU` n'altère pas son statut physique immédiat (priorité au séjour). Si la chambre est libre ou devient libre, elle passe immédiatement à `EN_MAINTENANCE`.
2. **Règle du ticket bloquant majoritaire (BR-MNT-004) :** Si plusieurs tickets de maintenance actifs sont ouverts sur une même chambre, celle-ci reste bloquée au statut `EN_MAINTENANCE`.
3. **Règle de libération technique vers nettoyage (BR-MNT-002) :** La clôture du **dernier** ticket de maintenance actif sur une chambre ne la remet jamais au statut `LIBRE_PROPRE`. Le système la bascule obligatoirement vers l'état intermédiaire **`A_NETTOYER`**, forçant le passage d'un équipier et la validation d'une gouvernante.

### 3.3. Règles d'Interaction avec le Ménage (Housekeeping)
1. **Déclenchement automatique par Checkout (BR-HK-001) :** La finalisation comptable et physique du check-out d'un séjour bascule immédiatement la chambre associée au statut `A_NETTOYER` et génère automatiquement une tâche de ménage (`HousekeepingTask`) à l'état `A_FAIRE`.
2. **Rétablissement conditionnel de la propreté (BR-HK-003) :** La chambre ne peut repasser au statut vendable `LIBRE_PROPRE` que si la tâche de ménage associée passe à l'état final **`CONTROLEE`** par une utilisatrice disposant du rôle *Gouvernante*. La déclaration `TERMINEE` par l'équipier de ménage ne fait passer la chambre qu'au statut interne `A_NETTOYER` (en attente d'inspection).

### 3.4. Journalisation Système Obligatoire (Audit)
Toute mutation d'état de chambre (manuelle ou consécutive à une action système) doit faire l'objet d'une insertion atomique dans la table `RoomStatusLog` (BR-CHA-004), contenant l'ancien statut, le nouveau statut, l'ID utilisateur déclencheur et un motif explicatif.

---

## 4. Invariants (Règles architecturales absolues)

* **INV-CHA-001 (Sécurité d'Enregistrement) :** Une chambre ne peut faire l'objet d'un check-in (`Stay` activé) que si son statut physique en base est strictement égal à `LIBRE_PROPRE` ou `RESERVEE` (BR-CHA-003). Toute autre valeur (`A_NETTOYER`, `EN_NETTOYAGE`, `EN_MAINTENANCE`) lève une exception de blocage serveur.
* **INV-CHA-002 (Non-Contournement du Ménage) :** Il est physiquement impossible de faire passer une chambre de l'état `EN_MAINTENANCE` ou `A_NETTOYER` vers l'état `LIBRE_PROPRE` sans passer par la validation d'une tâche de ménage inspectée (`CONTROLEE`).
* **INV-CHA-003 (Persistance du Verrou de Maintenance) :** Une chambre ayant au moins un ticket de maintenance actif (`resoluAt = null` et `isBloquant = true`) ne peut voir son statut être modifié manuellement vers un statut vendable (`LIBRE_PROPRE` ou `RESERVEE`).
* **INV-CHA-004 (Gouvernance des Rôles) :** Seuls les utilisateurs dotés de la permission d'écriture de maintenance (`maintenance:write`) ou d'administration peuvent clore un ticket de maintenance. Seuls les utilisateurs dotés de la permission de contrôle de ménage (`housekeeping:control` - Rôle Gouvernante) peuvent valider le passage de `A_NETTOYER`/`EN_NETTOYAGE` à `LIBRE_PROPRE`.

---

## 5. Cycle de Vie et Matrice des Transitions d'États

Le graphe ci-dessous illustre les transitions nominales et exceptionnelles autorisées par la machine à états de la chambre :

```
             ┌─────────────────────────────────────────────────────────┐
             │                                                         │
             ▼                                                         │
     ┌───────────────┐     Arrivée du jour     ┌───────────────┐       │
     │ LIBRE_PROPRE  ├────────────────────────►│   RESERVEE    │       │
     └───────┬───────┘                         └───────┬───────┘       │
             │                                         │               │
             │                                         │ Check-in      │
             │ Panne bloquante                         │               │
             │ (Chambre vide)                          ▼               │
             │                                 ┌───────────────┐       │
             │                                 │   OCCUPEE     │       │
             │                                 └───────┬───────┘       │
             │                                         │               │
             │                                         │ Nuit du départ│
             │                                         ▼               │
             │                                 ┌───────────────┐       │
             │                                 │ DEPART_PREVU  │       │
             │                                 └───────┬───────┘       │
             │                                         │               │
             │                                         │ Check-out     │
             │                                         ▼               │
             │                                 ┌───────────────┐       │
             │    Dernier ticket résolu        │  A_NETTOYER   │◄──────┤
             │  ┌──────────────────────────────┼───────┬───────┘       │
             │  │                              │       │               │
             ▼  ▼                              │       │ Début ménage  │
     ┌───────────────┐                         │       ▼               │
     │EN_MAINTENANCE │◄────────────────────────┤┌───────────────┐      │
     └───────────────┘  Panne constatée vide   ││ EN_NETTOYAGE  │      │
                                               │└──────┬────────┘      │
                                               │       │               │
                                               │       │ Ménage fini   │
                                               │       ▼               │
                                               │ (Attente contrôle)    │
                                               └───────┴───────────────┘
                                                       │
                                                       │ Tâche CONTROLEE
                                                       │ (Gouvernante)
                                                       ▼
                                               [ LIBRE_PROPRE ]
```

### Matrice de Transition Nominale

| Statut Initial | Statut Cible | Événement Déclencheur | Rôle Requis | Type d'Action |
| :--- | :--- | :--- | :--- | :--- |
| `LIBRE_PROPRE` | `RESERVEE` | Date d'arrivée de réservation atteinte | Système (Planificateur) | Automatique |
| `LIBRE_PROPRE` | `OCCUPEE` | Enregistrement d'un client Walk-In | Réception | Manuel |
| `RESERVEE` | `OCCUPEE` | Enregistrement du client attendu (Check-In) | Réception | Manuel |
| `OCCUPEE` | `DEPART_PREVU` | Début de la journée de départ théorique (00h00) | Système (Batch) | Automatique |
| `DEPART_PREVU`| `A_NETTOYER` | Enregistrement du départ client (Check-Out) | Réception | Manuel (Automatisé) |
| `OCCUPEE` | `A_NETTOYER` | Check-Out anticipé validé financièrement | Réception | Manuel (Automatisé) |
| `A_NETTOYER` | `EN_NETTOYAGE` | Début de l'entretien de la chambre | Équipier de ménage | Manuel |
| `EN_NETTOYAGE`| `A_NETTOYER` | Ménage déclaré fini par l'équipier | Équipier de ménage | Manuel |
| `A_NETTOYER` | `LIBRE_PROPRE` | Inspection et contrôle de propreté validés | Gouvernante | Manuel |
| `LIBRE_PROPRE` | `EN_MAINTENANCE`| Déclaration d'un ticket technique bloquant | Maintenance / Réception | Manuel |
| `A_NETTOYER` | `EN_MAINTENANCE`| Déclaration d'un ticket technique bloquant | Maintenance / Réception | Manuel |
| `EN_MAINTENANCE`| `A_NETTOYER` | Résolution de tous les tickets bloquants actifs | Maintenance | Automatique |

---

## 6. Traitement des Cas Particuliers

### 6.1. Le Check-out et l'Enchaînement vers le Ménage (Housekeeping)
La validation du Check-Out par le réceptionniste exécute une transaction unique de base de données :
* Changement de statut du séjour : `Stay.statut = CHECKOUT`.
* Changement de statut de la chambre : `Room.statut = A_NETTOYER`.
* Création de la tâche de ménage : `HousekeepingTask.statut = A_FAIRE` avec assignation facultative (*Décision métier à confirmer sur l'assignation automatique des équipiers*).
* Écriture de l'historique : Log de changement d'état inséré dans `RoomStatusLog`.

### 6.2. Le Relogement en Cours de Séjour (Room Change)
En cas de relogement d'un client (ex. fuite d'eau détectée dans sa chambre occupée) :
1. Le réceptionniste (avec permission de modification de séjour) réassigne le séjour actif sur une nouvelle chambre (qui doit obligatoirement être `LIBRE_PROPRE`).
2. L'ancienne chambre passe au statut `EN_MAINTENANCE` suite à la création du ticket technique de fuite d'eau.
3. La nouvelle chambre passe instantanément au statut `OCCUPEE`.
4. Les `RoomNight` associées au séjour pour les nuits restantes sont réallouées vers la nouvelle chambre.

### 6.3. Les Pannes Simultanées (Multi-Tickets)
Si une chambre dispose de $k$ tickets de maintenance ouverts (par exemple un problème de serrure ET un dysfonctionnement de climatisation) :
* Lorsque le serrurier résout la serrure et clôt son ticket, le système vérifie par une requête de comptage s'il reste des tickets ouverts bloquants (`isBloquant = true`).
* S'il reste $k-1 = 1$ ticket ouvert (climatisation), la chambre **reste** au statut `EN_MAINTENANCE`.
* Elle ne bascule vers `A_NETTOYER` que lorsque le frigoriste valide la clôture du dernier ticket (le décompte des tickets actifs tombe à 0).

---

## 7. Alternatives rejetées

### Alternative A : Modification directe et libre du statut de la chambre
* **Description :** Permettre aux développeurs d'exécuter un simple `prisma.room.update({ where: { id }, data: { statut: 'LIBRE_PROPRE' } })` depuis n'importe quel service.
* **Pourquoi elle a été rejetée :** Risque critique d'incohérences de données. Il est impossible de garantir que l'historique de traçabilité est écrit, que les tâches de ménage sont closes ou que la présence de pannes bloquantes est vérifiée. Cette approche conduit inévitablement à vendre des chambres défectueuses.

### Alternative B : Repasser directement de la maintenance au statut vendable
* **Description :** Dès qu'un ticket de maintenance est résolu, la chambre redevient immédiatement `LIBRE_PROPRE`.
* **Pourquoi elle a été rejetée :** Risque d'hygiène et de réputation majeur. Les interventions techniques (plomberie, peinture, électricité) salissent la pièce. Envoyer un client directement dans une chambre réparée mais non nettoyée nuit gravement à la qualité de service de l'Hôtel Makarim.

---

## 8. Conséquences de la Décision

* **Réservations :** Le planificateur de réservations ne peut assigner que des chambres qui seront libres à la date d'arrivée. Le moteur de planification filtre et ignore les chambres au statut `EN_MAINTENANCE` pour les calculs de disponibilité globale.
* **Séjours :** Les réceptionnistes disposent d'un contrôle rigoureux. Le système bloque toute tentative accidentelle de check-in dans une chambre défectueuse ou sale.
* **Housekeeping :** Les équipes de ménage et de gouvernance disposent de leur propre interface dédiée. La gouvernante est le seul rôle habilité à valider la réintroduction d'une chambre dans le circuit de vente.
* **Maintenance :** Les techniciens peuvent déclarer des pannes sans se soucier de perturber l'occupation courante (le système gère la priorité de manière transparente).
* **Audit :** L'historique complet de l'état de chaque chambre est préservé, permettant d'identifier d'éventuels goulets d'étranglement (chambres restant trop longtemps sales ou en panne).

---

## 9. Anti-patterns (Pratiques strictement interdites)

* **Anti-Pattern #1 (Statut sans Log) :** Modifier la valeur `Room.statut` sans insérer l'enregistrement correspondant dans la table `RoomStatusLog`.
* **Anti-Pattern #2 (Saut de l'étape Contrôle) :** Établir une route d'API permettant d'outrepasser la validation de la Gouvernante pour forcer le statut `LIBRE_PROPRE` directement depuis un compte d'équipier de ménage ou de réceptionniste.
* **Anti-Pattern #3 (Validation de ménage sur panne active) :** Autoriser le contrôle de ménage à remettre une chambre à l'état `LIBRE_PROPRE` si celle-ci possède des tickets de maintenance actifs non résolus.
* **Anti-Pattern #4 (Supression physique de ticket de panne) :** Supprimer physiquement un enregistrement de la table `MaintenanceTicket` pour forcer le déblocage d'une chambre (tous les tickets doivent être conservés et résolus ou annulés logiquement).

---

## 10. Checklist de conformité pour les Pull Requests (Chambres & Entretien)

Avant de soumettre une Pull Request modifiant les états physiques, l'attribution ou les modules ménage/maintenance, vérifiez scrupuleusement la liste suivante :

* [ ] **Mutation encapsulée :** Tout changement de statut de la chambre passe par une méthode de service centralisée ou un hook Prisma (et non par un `update` brut de champ) pour garantir l'écriture systématique dans `RoomStatusLog`.
* [ ] **Contrôle d'intégrité de la maintenance :** La fonction de clôture d'un ticket technique vérifie s'il existe d'autres tickets ouverts sur la même chambre avant de déclencher la transition vers `A_NETTOYER`.
* [ ] **Veto d'occupation :** L'ouverture d'un ticket de maintenance vérifie l'état d'occupation de la chambre. Si la chambre est occupée (`Stay` actif), elle conserve son statut physique (`OCCUPEE` ou `DEPART_PREVU`) et n'est pas modifiée vers `EN_MAINTENANCE`.
* [ ] **Vérification d'état vendable au check-in :** Le point d'entrée d'enregistrement (`CheckInService.execute`) valide programmatiquement que la chambre cible est bien au statut `LIBRE_PROPRE` ou `RESERVEE` pour ce client, et lève une exception descriptive dans le cas contraire.
* [ ] **Ségrégation stricte des rôles :** La mise à jour des tâches de ménage vers le statut `CONTROLEE` (permettant la mise en vente de la chambre) est protégée par un guard d'autorisation NestJS vérifiant la possession de la permission `housekeeping:control` (Rôle Gouvernante).
