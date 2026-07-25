# Spécification Technique — Module Housekeeping (housekeeping.md)

---

## 1. Objectif du module
Le module **Housekeeping** assure la planification, l'affectation, la coordination et le contrôle qualité du nettoyage des 24 chambres de l'Hôtel Makarim. Il permet aux équipiers de ménage de piloter leur activité en temps réel sur tablette mobile et donne à la Gouvernante le pouvoir exclusif d'autoriser la mise en vente de chambres propres auprès de la réception.

---

## 2. Responsabilités
Le module est seul responsable de :
* La génération et la planification des tâches journalières de ménage (`HousekeepingTask`).
* La gestion de la machine à états stricte de chaque tâche d'entretien.
* L'affectation opérationnelle d'un ou plusieurs équipiers à des tâches de ménage spécifiques.
* La saisie en temps réel de l'état d'avancement des tâches (début, fin de ménage) par les équipiers d'entretien.
* La gestion exclusive de la procédure d'inspection de propreté et de conformité par la Gouvernante.
* Le rétablissement du statut d'exploitation de la chambre en `LIBRE_PROPRE` après validation de la Gouvernante.

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* Le processus d'accueil client ou d'enregistrement de séjour (confié au module `stay`).
* La création ou l'ajustement financier des folios d'hébergement ou d'extras (confié au module `billing`).
* Le signalement et la réparation d'incidents techniques matériels ou structurels (confié au module `maintenance`).

---

## 4. Entités manipulées
Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `HousekeepingTask` (Suivi de l'activité d'entretien de la chambre)
* `Room` (Mise à jour et verrouillage du statut physique)
* `User` (Affectation et traçabilité de l'équipier et de la gouvernante)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-HK-001 (Déclenchement Automatique par Checkout) :** Création immédiate d'une tâche de ménage `A_FAIRE` et basculement de la chambre à l'état `A_NETTOYER` lors du check-out.
* **BR-HK-002 (Transitions Contrôlées de Tâches de Ménage) :** Séquençage rigoureux de la machine à états de la tâche d'entretien.
* **BR-HK-003 (Rétablissement du Statut Chambre Propre) :** Seul le contrôle final et validé de la Gouvernante libère la chambre vers l'état `LIBRE_PROPRE`.
* **BR-HK-004 (Ségrégation d'Accès de l'Écran Gouvernante) :** Interface allégée, mobile et isolée des données sensibles pour les équipiers.

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-003 (Room State Machine)](/docs/ADR-003-Room-State-Machine.md) :** Clé de voûte de la synchronisation de l'état physique de la chambre.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Validation d'accès exclusive pour l'action de contrôle de conformité de propreté.

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `housekeeping:read` : Autorisé pour `ADMINISTRATEUR`, `RECEPTION`, `GOUVERNANTE`.
* `housekeeping:write` (Prise en charge de tâche par l'équipier) : Autorisé pour `ADMINISTRATEUR`, `GOUVERNANTE` et les employés de ménage connectés.
* `housekeeping:control` (Validation et libération de la chambre) : Autorisé exclusivement pour `ADMINISTRATEUR` et `GOUVERNANTE`.
* *Note :* La Réception ne peut en aucun cas forcer la complétion ou le contrôle d'une tâche de ménage.

---

## 8. Flux entrants
Le module intercepte les événements et requêtes suivants :
* Événement de notification de Check-out (déclenche la tâche de ménage pour le départ client).
* Événement d'alerte de fin de nuit (génère les tâches de recouche ou ménage quotidien pour les séjours en cours).
* Requête d'attribution manuelle de tâche de nettoyage par la Gouvernante.

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* `MENAGE_TERMINE` : Émis par l'équipier (signale à la Gouvernante que la chambre attend son inspection).
* `CHAMBRE_MUTE_LIBRE_PROPRE` : Émis après le contrôle validé (rend la chambre disponible à la vente et visible en vert sur le planning de la réception).

---

## 10. Dépendances autorisées
Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `rooms` : Pour mettre à jour l'état de propreté de la chambre en base et historiser la transition.

---

## 11. Dépendances interdites
Ce module a l'interdiction stricte de dépendre de :
* `billing` / `payments` : Aucun point de contact. Les équipes d'entretien n'ont aucune relation avec l'argent de l'hôtel. *Justification : Ségrégation totale des tâches opérationnelles et des finances.*
* `guests` / `reservations` : Les équipiers d'entretien ne doivent jamais avoir accès aux données nominatives, coordonnées de contacts ou profils des clients. *Justification : Respect de la vie privée des clients et limitation de l'exposition du CRM.*
* `hr` : Le module n'accède pas aux fiches de paie ou à la gestion du pointage. *Justification : Indépendance RH.*

---

## 12. Contraintes métier
* **Contrôle Indépendant :** Un équipier de ménage ne peut pas s'auto-attribuer l'action de contrôle de propreté ou valider sa propre tâche. La Gouvernante inspectrice doit obligatoirement être un utilisateur distinct de l'équipier ayant réalisé le nettoyage.
* **Garde-fou de maintenance :** Si une chambre est au statut `EN_MAINTENANCE` (bloquée techniquement), le système interdit d'initier ou de finaliser une tâche de ménage de type commercial.

---

## 13. Invariants
* **INV-HK-001 (Veto d'occupation sale) :** Aucune chambre ne peut voir son statut repasser à `LIBRE_PROPRE` si la dernière tâche de ménage d'exploitation générée pour celle-ci n'est pas formellement à l'état `CONTROLEE`.

---

## 14. États manipulés
La machine à états de la tâche d'entretien `HousekeepingTask` est :
* `A_FAIRE`
* `EN_COURS`
* `TERMINEE` (Ménage fini, en attente de contrôle)
* `CONTROLEE` (Inspection validée par la Gouvernante)

---

## 15. Points sensibles
* **Couverture Wi-Fi et Mode Déconnecté :** Les équipiers de ménage naviguent dans les étages de l'Hôtel Makarim où la connexion internet peut fluctuer.
  * *Résolution :* Conception d'une interface locale optimisée pour stocker temporairement l'intention d'action en mémoire cache locale du navigateur (IndexedDB) et l'émettre de manière asynchrone dès le rétablissement de la connexion.

---

## 16. Dette technique connue
* *Aucune dette technique identifiée à ce stade.*

---

## 17. Fonctionnalités prévues ultérieurement
* **Phase 2 :** Analyse statistique des temps moyens d'exécution de ménage par équipier et par typologie de chambre pour optimiser les plannings opérationnels.

---

## 18. Checklist de Pull Request
Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] L'action de contrôle d'une tâche de ménage exige la permission `housekeeping:control` au niveau du contrôleur backend.
* [ ] La complétion d'un contrôle de ménage applique instantanément et de manière synchrone la mise à jour de la chambre en `LIBRE_PROPRE` et l'écriture du log associé.
* [ ] Le code de l'interface d'équipier de ménage ne charge aucune information client (CRM) ou données financières.
* [ ] Les tentatives d'auto-validation de contrôle par un équipier de ménage sur sa propre tâche sont bloquées côté serveur et lèvent une exception `403 Forbidden`.
