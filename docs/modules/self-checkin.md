# Spécification Technique — Module Self Check-in (self-checkin.md)

*Créé lors de CH-018 (`docs/governance/REGISTRE_CHANTIERS.md`) — spec manquante malgré un module backend complet (F6) déjà largement documenté au fil de l'eau dans `CLAUDE.md`.*

---

## 1. Objectif du module

Le module **Self check-in** permet à un client de renseigner par avance, via un lien mobile envoyé avant son arrivée, les informations nécessaires au check-in (coordonnées, pièce d'identité, provenance/destination) — réduisant le temps de saisie au comptoir à l'arrivée.

---

## 2. Responsabilités

Le module est seul responsable de :
* La génération et la régénération d'un lien de self check-in unique par réservation (`SelfCheckinToken`).
* L'exposition d'une surface publique non authentifiée permettant au client de consulter le résumé de sa réservation et de soumettre ses informations.
* La mise en attente des champs collectés qui n'ont pas encore de destination définitive en base (voir §3).
* L'exposition à la réception des informations en attente, pour pré-remplir la saisie du registre de police à l'arrivée réelle.

---

## 3. Hors périmètre

Le module n'intervient jamais dans :
* Le check-in réel (transformation de la réservation en séjour) — reste un geste humain explicite de la réception (`stay`), jamais automatique à la soumission du formulaire self check-in.
* L'écriture directe dans `PoliceRecord` — ce module n'a pas connaissance d'un `stayId` (qui n'existe qu'après le check-in réel), donc les champs collectés (`numeroPiece`, `typePiece`, `dateNaissance`, provenance/destination) restent « en attente » sur `SelfCheckinToken` lui-même, jamais écrits dans `PoliceRecord` directement.
* La mise à jour des champs déjà présents sur `Guest` (`nom`/`prenom`/`telephone`/`email`/`nationalite`/`pieceIdentite`) — ceux-ci sont mis à jour immédiatement via la façade `GuestsService.update()`, pas par une écriture Prisma propre à ce module.

---

## 4. Entités manipulées

Ce module manipule et gère directement l'entité suivante du `DATA_DICTIONARY.md` :
* `SelfCheckinToken` (un seul lien actif par réservation, `reservationId @unique` — régénérer un lien réécrit la même ligne plutôt que d'en créer une seconde)

`Reservation` et `Guest` sont lus/écrits exclusivement via les façades `ReservationsService.findOne()` et `GuestsService.update()` — jamais de lecture/écriture Prisma directe sur ces tables.

---

## 5. BUSINESS_RULES concernées

* **BR-RES-004** (référencée dans le code — throttling strict sur toute surface publique découplée) s'applique ici de la même manière qu'au module `booking-engine` : les deux routes publiques sont throttlées 20/min, contre 100/min par défaut ailleurs.

---

## 6. ADR concernées

Aucune ADR dédiée. Ce module suit la convention transverse déjà actée pour F6 dans `CLAUDE.md` (§Architecture backend, entrée « Self check-in ») et ne recoupe aucune ADR existante directement — il n'écrit jamais dans `PoliceRecord` (ADR non applicable) ni dans une entité soumise à ADR-005 (pas d'`AuditLog` sur l'envoi d'un lien, voir §9).

---

## 7. Permissions RBAC

Les habilitations requises pour interagir avec ce module sont :
* `GET /self-checkin/:token`, `POST /self-checkin/:token` : **`@Public()`** — un client sans compte PMS doit pouvoir y accéder ; throttlées 20/min plutôt que protégées par RBAC (le jeton lui-même, non devinable, est la seule barrière).
* `reservations:write` (`POST /reservations/:id/self-checkin-link`) : génération/régénération du lien.
* `reservations:read` (`GET /reservations/:id/self-checkin-pending`) : consultation des champs en attente par la réception.

---

## 8. Flux entrants

Le module intercepte les événements et requêtes suivants :
* `POST /reservations/:id/self-checkin-link` — génère (ou régénère) le lien, envoyé au client via `NotificationsService.notify()` (réutilise le canal email de F7, aucun nouveau code d'envoi).
* `GET /self-checkin/:token` (`@Public`) — résumé public minimal de la réservation (aucun identifiant interne exposé au-delà du nécessaire, aucune donnée sur un autre client).
* `POST /self-checkin/:token` (`@Public`) — soumission des informations par le client.
* `GET /reservations/:id/self-checkin-pending` — consultation par la réception des champs en attente, pour préremplir `POST /police/:stayId` à l'arrivée.

---

## 9. Flux sortants

Le module n'émet aucun événement inter-module (`@nestjs/event-emitter`) — `generateLink()` appelle directement `NotificationsService.notify(EvenementNotification.SELF_CHECKIN_LIEN, ...)`, qui enfile un job BullMQ (pas un événement). Aucun `AuditLog` n'est écrit sur l'envoi d'un lien (contrairement aux mutations métier sensibles, ADR-005) : envoyer un lien n'est pas une opération financière/légale, `NotificationLog` en trace déjà l'envoi.

---

## 10. Dépendances autorisées

Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `reservations` : façade `ReservationsService.findOne()`.
* `guests` : façade `GuestsService.update()`, pour les champs déjà présents sur `Guest`.
* `notifications` : façade `NotificationsService.notify()`, pour l'envoi du lien.

---

## 11. Dépendances interdites

Ce module a l'interdiction stricte de dépendre de :
* `stay` : aucune dépendance `stay` → `self-checkin` ni l'inverse — `StayService` ne consomme rien de ce module. Le rapprochement entre les champs en attente et la fiche de police réelle reste un geste humain explicite de la réception via `GET /reservations/:id/self-checkin-pending`, jamais automatique, pour ne pas introduire un couplage supplémentaire sur le chemin critique du check-in.

---

## 12. Contraintes métier

* **Un seul lien actif par réservation** : `SelfCheckinToken.reservationId` est unique — régénérer un lien réécrit la même ligne, ne crée jamais un second jeton actif.
* **Expiration à la fin de la journée d'arrivée** : passé ce délai, le self check-in n'a plus de sens opérationnel — la réception prend le relais en personne.
* **Throttling strict** (20/min) sur les deux routes publiques — cohérent avec le carve-out CORS documenté dans `CLAUDE.md` (`main.ts`, origine réfléchie, `credentials: false`).

---

## 13. Invariants

* **INV-SCI-001 (Aucune écriture PoliceRecord)** : ce module n'écrit jamais directement dans `PoliceRecord` — la réception reste seule responsable de cette écriture via `POST /police/:stayId`, après relecture manuelle des champs en attente.
* **INV-SCI-002 (Unicité du jeton actif)** : jamais plus d'un `SelfCheckinToken` non expiré par réservation.

---

## 14. États manipulés

Ce module ne porte pas de machine à états explicite — un `SelfCheckinToken` est simplement valide (non expiré) ou expiré, déterminé par comparaison de date à la lecture, pas par un champ de statut stocké.

---

## 15. Points sensibles

* **Limite CORS connue** : le lien est construit sur `FRONTEND_URL` (même variable que le carve-out CORS général) — une page self-checkin hébergée sur un domaine distinct échouerait aujourd'hui. Non résolu, même carve-out CORS que documenté pour le futur `booking-engine`.
* **Champs en attente non repris automatiquement** : si la réception oublie de consulter `GET /reservations/:id/self-checkin-pending` avant le check-in, les informations pré-saisies par le client restent sur `SelfCheckinToken` sans jamais être exploitées — aucun rattrapage automatique n'existe (choix assumé, voir §11).

---

## 16. Dette technique connue

Aucune dette technique identifiée à ce stade — le module a été livré complet (backend + frontend `SelfCheckinPanel.tsx`, CH-007) et vérifié en navigateur réel.

---

## 17. Fonctionnalités prévues ultérieurement

Aucune extension prévue formellement pour cette version.

---

## 18. Checklist de Pull Request

Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Les deux routes publiques restent `@Public()` et throttlées — aucune permission RBAC ne doit leur être ajoutée (elles s'adressent à un client sans compte PMS).
* [ ] Aucune écriture directe n'est introduite sur `Reservation`/`Guest` en dehors des façades `ReservationsService`/`GuestsService`.
* [ ] Toute nouvelle génération de lien réécrit la ligne `SelfCheckinToken` existante (upsert par `reservationId`), jamais une seconde ligne.
* [ ] Aucune écriture directe n'est introduite sur `PoliceRecord` — reste la responsabilité exclusive de la réception via le module `police`.
