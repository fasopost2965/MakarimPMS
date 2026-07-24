# Spécification Technique — Module Moteur de Réservation Public (booking-engine.md)

*Créé lors de CH-018 (`docs/governance/REGISTRE_CHANTIERS.md`) — spec manquante malgré un module backend complet (F4) déjà largement documenté au fil de l'eau dans `CLAUDE.md`.*

---

## 1. Objectif du module

Le module **Moteur de réservation public** expose une surface publique non authentifiée (widget de réservation directe externe) permettant à un visiteur de consulter la disponibilité et de créer une réservation, sans jamais dupliquer la logique métier du module `reservations`.

---

## 2. Responsabilités

Le module est seul responsable de :
* L'adaptation de surface publique de `ReservationsService.checkAvailability()`/`estimatePrixTotal()`/`create()` — groupement par type de chambre, ajout d'un prix indicatif.
* La protection anti-scraping/anti-DDoS de cette surface (throttling dédié, plus strict que le défaut global).
* La prévention d'IDOR (Insecure Direct Object Reference) sur la création de réservation publique.

---

## 3. Hors périmètre

Le module n'intervient jamais dans :
* Le calcul de disponibilité, de prix ou la création de réservation elle-même — entièrement délégués à `ReservationsService`, aucune logique dupliquée.
* La confirmation par email — `ReservationsService.create()` émet déjà `reservation.confirmee` quel que soit l'appelant ; ce module n'a rien à câbler pour cela.
* L'authentification — ce module n'a pas de notion d'utilisateur PMS, toutes ses routes sont publiques par construction.

---

## 4. Entités manipulées

Ce module ne possède **aucune table Prisma propre** — façade publique pure de `reservations`. Toute lecture/écriture est déléguée à `ReservationsService`.

---

## 5. BUSINESS_RULES concernées

* **BR-RES-004** : « Le widget de réservation directe externe (Phase 5) doit communiquer via un ensemble d'endpoints découplés et soumis à un Rate Limiting strict pour prévenir le scraping ou les attaques par déni de service (DDoS). » — appliquée via `@Throttle` dédié (§12), plus strict que le défaut global de l'application.

---

## 6. ADR concernées

Aucune ADR dédiée — ce module applique intégralement les invariants déjà actés pour `reservations` (ADR-001, primauté du séjour ; contrainte unique `RoomNight`) sans en introduire de nouveaux.

---

## 7. Permissions RBAC

Aucune — les deux routes sont `@Public()` par construction (aucun compte PMS n'existe côté visiteur public).

---

## 8. Flux entrants

Le module intercepte les événements et requêtes suivants :
* `GET /booking/availability` (`@Public`, throttlé 30/min) — disponibilité groupée par type de chambre, avec prix indicatif.
* `POST /booking/reservations` (`@Public`, throttlé 10/min, plus strict que la lecture — scraping/spam de création) — force `canal: DIRECT` et délègue intégralement à `ReservationsService.create()`.

---

## 9. Flux sortants

Aucun événement propre — `ReservationsService.create()` émet `reservation.confirmee` de façon transparente pour tout appelant, y compris celui-ci.

---

## 10. Dépendances autorisées

Pour fonctionner, ce module est autorisé à appeler exclusivement le module suivant :
* `reservations` : façade complète (`checkAvailability()`, `estimatePrixTotal()` — wrapper public de la méthode privée `calculatePrixTotal`, `create()`).

Aucune dépendance directe à `rooms`/`guests`/`parameters` — déjà couvertes en interne par `ReservationsService`.

---

## 11. Dépendances interdites

Ce module a l'interdiction stricte de dépendre de :
* Toute lecture/écriture Prisma directe — ce module n'a pas de `PrismaService` injecté dans son service, uniquement `ReservationsService`.

---

## 12. Contraintes métier

* **Anti-IDOR** : `CreatePublicReservationDto` n'a délibérément **aucun champ `guestId`** — seulement un objet `guest` pour créer un nouveau client. Combiné à `ValidationPipe({ forbidNonWhitelisted: true })` global, toute tentative d'injecter un `guestId` est rejetée en 400. *Justification (commentaire code) : accepter un id client arbitraire depuis une surface publique non authentifiée permettrait à quiconque de rattacher une réservation au profil d'un tiers.*
* **`email` obligatoire côté public** : `PublicGuestInputDto.email` est `@IsNotEmpty()` contrairement au `GuestInputDto` interne (optionnel) — un visiteur public sans compte doit pouvoir être recontacté.
* **Throttling différencié** : 30/min sur la disponibilité (lecture, moins sensible), 10/min sur la création (plus sensible, scraping/spam de réservations).
* **Carve-out CORS dédié** (`main.ts`, `CorsOptionsDelegate`) : origine réfléchie, `credentials: false` — ce préfixe public (`/api/booking`) ne requiert ni cookie ni Bearer, contrairement au reste de l'API strictement restreint à `FRONTEND_URL`.

---

## 13. Invariants

* **INV-BKG-001 (Aucun `guestId` accepté)** : `CreatePublicReservationDto` ne porte jamais de champ permettant de cibler un client existant par identifiant.
* **INV-BKG-002 (Aucune table propre)** : ce module ne persiste jamais de données lui-même — toute écriture transite par `ReservationsService.create()`.

---

## 14. États manipulés

Ce module ne porte pas de machine à états propre — il délègue entièrement au cycle de vie de `Reservation` géré par le module `reservations`.

---

## 15. Points sensibles

* **Course résiduelle acceptée** : entre la vérification de disponibilité et l'écriture, un conflit est rattrapé par la contrainte unique `RoomNight(roomId, date)` déjà éprouvée (`reservations-concurrency.e2e-spec.ts`) — pas de verrou applicatif dédié à ce module ; le client public reçoit un 409 et retente, même logique que le flux interne.

---

## 16. Dette technique connue

Aucune dette technique identifiée à ce stade — le module reste volontairement minimal (deux routes, aucune table propre).

---

## 17. Fonctionnalités prévues ultérieurement

Aucune extension prévue formellement pour cette version.

---

## 18. Checklist de Pull Request

Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Aucun champ `guestId` (ou équivalent permettant de cibler un client existant) n'est ajouté à `CreatePublicReservationDto`.
* [ ] Aucune logique de calcul de disponibilité/prix/réservation n'est dupliquée ici — tout doit transiter par `ReservationsService`.
* [ ] Les throttles dédiés (30/min lecture, 10/min écriture) restent plus stricts que le défaut global de l'application.
* [ ] Le carve-out CORS pour `/api/booking` reste cohérent avec celui documenté pour `/api/self-checkin` (`main.ts`).
