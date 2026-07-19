# Spécification Technique — Module Maintenance (maintenance.md)

---

## 1. Objectif du module
Le module **Maintenance** assure le signalement, la priorisation, le suivi opérationnel et la résolution des incidents techniques et matériels au sein de l'Hôtel Makarim. Il permet de figer commercialement les chambres en panne pour écarter tout risque de vente d'un hébergement dégradé et de planifier les interventions de l'équipe technique.

---

## 2. Responsabilités
Le module est seul responsable de :
* La création, la priorisation et le suivi du cycle de vie des tickets de maintenance technique (`MaintenanceTicket`).
* L'affectation des tickets aux techniciens de maintenance de l'hôtel.
* Le blocage physique et commercial immédiat de la chambre en base de données (`EN_MAINTENANCE`) lors d'incidents techniques d'urgence.
* La consignation des motifs de pannes et du matériel consommé pour réparation.
* Le déclenchement de la procédure de remise à disposition (libération) de la chambre réparée.

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* La gestion de la propreté courante ou le ménage de la chambre (confié au module `housekeeping`).
* La commercialisation des nuitées ou l'accueil des clients (confiés aux modules `reservations` et `stay`).
* La facturation de dédommagements éventuels au client suite à une panne (confié au module `billing`).

---

## 4. Entités manipulées
Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `MaintenanceTicket` (Suivi de l'incident technique)
* `Room` (Verrouillage et libération physique de la chambre)
* `User` (Déclarateur de la panne et technicien de maintenance affecté)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-MNT-001 (Signalement par tous, Résolution par Maintenance) :** Ouverture ouverte à tous, mais fermeture réservée au rôle technique ou administrateur.
* **BR-CHA-002 (Invariant des États de Chambre) :** Maintien cohérent de la chambre au statut de panne `EN_MAINTENANCE` durant l'incident.
* **BR-CHA-003 (Vente Interdite hors Disponible Propre) :** Protection de la réception contre toute affectation d'une chambre en panne technique.

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-003 (Room State Machine)](/docs/ADR-003-Room-State-Machine.md) :** Gestion du cycle de vie de la chambre et transit obligatoire par le nettoyage après réparation.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Droits d'autorisation de clôture technique de ticket de maintenance.

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `maintenance:read` : Autorisé pour tous les rôles de l'établissement (`ADMINISTRATEUR`, `RECEPTION`, `GOUVERNANTE`, `COMPTABLE`, `MAINTENANCE`, `RH`).
* `maintenance:write` (Ouverture d'un ticket) : Autorisé pour `ADMINISTRATEUR`, `RECEPTION`, `GOUVERNANTE`, `MAINTENANCE`.
* `maintenance:resolve` (Clôture technique de panne) : Autorisé exclusivement pour `ADMINISTRATEUR` et `MAINTENANCE`.
* *Note :* Un membre de la Réception peut signaler une fuite d'eau, mais seul le Technicien ou l'Administrateur peut acter la fin de l'intervention de plomberie.

---

## 8. Flux entrants
Le module intercepte les événements et requêtes suivants :
* Requête de création d'incident par un réceptionniste (réclamation client au desk).
* Requête de signalement d'anomalie par un équipier de ménage durant le nettoyage d'une chambre.
* Requête d'affectation de technicien de maintenance par le responsable technique.

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* `TICKET_MAINTENANCE_URGENT` : Alerte de haute priorité (déclenche immédiatement le blocage commercial de la chambre).
* `PANNE_RESOLUE` : Émis lors de la clôture (libère la chambre de maintenance).
* `REMIS_AU_PROPRE_REQUIS` : Événement émis vers `housekeeping` pour planifier un nettoyage de salissures post-travaux.

---

## 10. Dépendances autorisées
Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `rooms` : Pour verrouiller la chambre en `EN_MAINTENANCE` ou initier sa libération après résolution.

---

## 11. Dépendances interdites
Ce module a l'interdiction stricte de dépendre de :
* `billing` / `payments` : Aucun lien fonctionnel. Les équipes techniques ne gèrent pas la facturation ou les encaissements. *Justification : Découplage complet de l'actif technique et des finances.*
* `guests` / `reservations` : La maintenance n'a pas à connaître l'identité des clients ou l'historique de réservations pour réaliser ses interventions physiques sur les équipements hôteliers. *Justification : Préservation de la confidentialité des données clients.*
* `hr` : Pas d'accès aux fiches de paie ou à l'enregistrement du temps de travail. *Justification : Indépendance RH.*

---

## 12. Contraintes métier
* **Transit par le Ménage (Sanitary Invariant) :** Une chambre libérée de maintenance ne retourne jamais directement au statut commercial `LIBRE_PROPRE`. Elle doit obligatoirement basculer à l'état `A_NETTOYER` pour qu'une tâche de nettoyage de propreté soit exécutée avant de la remettre à disposition des clients (élimination de poussières de travaux, outils oubliés).
* **Veto de présence client :** Le système interdit de lever un ticket urgent ou de bloquer en maintenance une chambre si celle-ci possède un séjour actif au statut `EN_COURS` sans avoir préalablement procédé à un changement de chambre du client (Room Change).

---

## 13. Invariants
* **INV-MNT-001 (Verrou de Panne Urgent) :** L'existence d'un ticket de maintenance ouvert au statut `OUVERT` ou `EN_COURS` ayant une priorité `URGENTE` force et maintient de manière absolue le statut de la chambre ciblée à la valeur `EN_MAINTENANCE`.

---

## 14. États manipulés
La machine à états du ticket de maintenance `MaintenanceTicket` est :
* `OUVERT`
* `EN_COURS`
* `RESOLU`
* `ANNULE`

---

## 15. Points sensibles
* **Pannes répétitives :** Risque de dysfonctionnements chroniques sur des équipements (climatisation d'une chambre spécifique, plomberie d'une suite).
  * *Résolution :* Le module doit historiser l'ensemble des pannes par chambre physique pour permettre d'identifier d'éventuels défauts récurrents de structure matérielle de l'hôtel.

---

## 16. Dette technique connue
* *Aucune dette technique identifiée à ce stade.*

---

## 17. Fonctionnalités prévues ultérieurement
* **Phase 4 :** Maintenance préventive planifiée (planification de rappels pour l'entretien annuel des climatiseurs, le détartrage de la robinetterie et le contrôle de sécurité électrique).

---

## 18. Checklist de Pull Request
Before validating any Pull Request affecting this module, ensure you verify:
* [ ] The resolution of a ticket of high/urgent priority triggers the automatic transition of the room state strictly to `A_NETTOYER` (never straight to `LIBRE_PROPRE`).
* [ ] Access to the ticket resolution endpoint requires the explicit permissions check of `maintenance:resolve` on the server backend.
* [ ] Creation of an urgent maintenance ticket checks whether there is an active guest checked into that room, and raises a conflict warning if so.
* [ ] Room status updates initiated by maintenance actions are logged concurrently to `RoomStatusLog`.
