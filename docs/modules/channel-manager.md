# Spécification Technique — Module Channel Manager / Synchronisation OTA (channel-manager.md)

*Créé lors de CH-018 (`docs/governance/REGISTRE_CHANTIERS.md`) — spec manquante malgré un module backend complet (F10) déjà largement documenté au fil de l'eau dans `CLAUDE.md`.*

---

## 1. Objectif du module

Le module **Channel Manager** synchronise les réservations et annulations en provenance des plateformes de distribution externes (OTA — Booking.com, Expedia, Airbnb) avec le référentiel de réservations interne, via un schéma de webhook canal-agnostique.

---

## 2. Responsabilités

Le module est seul responsable de :
* La réception et le traitement idempotent des webhooks entrants (réservation, annulation) en provenance des OTA.
* La correspondance entre le type de chambre externe de chaque OTA et le `RoomType` interne (`ChannelRoomTypeMapping`).
* La protection des webhooks publics par un secret partagé.
* Le sens sortant (déclaratif/journalisé, aucun compte partenaire réel n'existant dans ce projet) — `fetchAvailability`/`pushAvailability`.

---

## 3. Hors périmètre

Le module n'intervient jamais dans :
* La logique de réservation elle-même (disponibilité, création, annulation) — entièrement déléguée à `ReservationsService`, aucune duplication.
* La définition du format de payload par OTA — les 3 canaux partagent un unique schéma de webhook (`ChannelReservationWebhookDto`/`ChannelCancellationWebhookDto`) plutôt que d'inventer trois formats sans spec réelle (aucun compte partenaire OTA réel n'existe dans ce projet).

---

## 4. Entités manipulées

Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `ChannelRoomTypeMapping` (`@@unique([canal, externalRoomTypeId])`)
* `ChannelReservationImport` (`@@unique([canal, otaReservationId])`, `reservationId @unique` — garde d'idempotence webhook)

`Reservation`/`RoomNight` ne sont jamais touchées directement — uniquement via `ReservationsService.create()/remove()/findOne()/checkAvailability()`.

---

## 5. BUSINESS_RULES concernées

Aucune règle `BR-XXX` dédiée dans `BUSINESS_RULES.md` (le document prédate F10).

---

## 6. ADR concernées

* **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md)** : la résolution d'une course résiduelle entre deux webhooks quasi simultanés (§15) annule explicitement la réservation perdante via `ReservationsService.remove()` — un soft delete, jamais une suppression physique.

---

## 7. Permissions RBAC

* Webhooks entrants (`POST /channel-manager/:canal/reservations`, `POST /channel-manager/:canal/cancellations`) : `@Public()` protégés par `ChannelWebhookGuard` (header `X-Channel-Webhook-Secret` contre `CHANNEL_WEBHOOK_SECRET`) — un OTA n'a pas de compte utilisateur PMS, la RBAC classique ne s'applique pas.
* `parameters:read` (`GET /channel-manager/mappings`, `POST /channel-manager/:canal/sync-availability`) et `parameters:write` (`POST`/`DELETE /channel-manager/mappings`) — permissions réutilisées, même logique que `companies` réutilisant `guests:*` : configuration exceptionnelle, pas une opération métier quotidienne, cohérent avec `SeasonRate`/`TaxRateConfig`.

---

## 8. Flux entrants

Le module intercepte les événements et requêtes suivants :
* `POST /channel-manager/:canal/reservations` (`@Public` + `ChannelWebhookGuard`, `:canal` restreint à `BOOKING_COM`/`EXPEDIA`/`AIRBNB` via `ParseEnumPipe`) — import d'une réservation OTA.
* `POST /channel-manager/:canal/cancellations` (`@Public` + `ChannelWebhookGuard`) — annulation d'une réservation OTA déjà importée.
* `POST /channel-manager/:canal/sync-availability` (`parameters:read`) — synchronisation déclarative de disponibilité (partie simulée/journalisée, voir §15 ; le calcul de disponibilité lui-même est réel).
* `GET`/`POST`/`DELETE /channel-manager/mappings` — CRUD des correspondances type de chambre ↔ canal externe.

---

## 9. Flux sortants

Aucun événement propre émis directement — `ReservationsService.create()` émet `reservation.confirmee` de façon transparente pour tout appelant, y compris ce module.

---

## 10. Dépendances autorisées

Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `reservations` : façade `checkAvailability()`/`create()`/`remove()`/`findOne()`.
* `audit` : traçabilité des mutations de mapping (`AuditService.writeLog()`, motif ≥ 10 caractères).

Aucune dépendance sortante en Prisma direct vers `rooms`/`guests`/`parameters` (`docs/DEPENDENCY_GRAPH.md` — les modules futurs se branchent sur les services métier existants, jamais en contournement).

---

## 11. Dépendances interdites

Ce module a l'interdiction stricte de dépendre de :
* Toute lecture/écriture Prisma directe sur `Reservation`/`RoomNight`/`Room`/`Guest` — passer systématiquement par `ReservationsService`.

---

## 12. Contraintes métier

* **Comparaison à temps constant du secret webhook** (CH-026(b)) : `ChannelWebhookGuard` utilisait `!==` sur deux chaînes, qui court-circuite au premier caractère différent et fuit la longueur du préfixe correct via un canal auxiliaire temporel — remplacé par `crypto.timingSafeEqual`.
* **Fail closed** : `CHANNEL_WEBHOOK_SECRET` absent fait échouer **toute** requête webhook — jamais de dégradation gracieuse pour une frontière d'authentification, contrairement à SMTP/Twilio qui ne sont que des envois sortants best-effort.
* **Idempotence webhook** : une relecture du même `otaReservationId` renvoie la réservation déjà créée sans en recréer une deuxième (même garantie que `Payment.idempotencyKey`, adaptée en check-then-act puisque `ReservationsService.create()` gère sa propre transaction interne et n'accepte pas de `tx` externe).
* **Mapping absent = rejet explicite** : un import sans mapping configuré est rejeté (404) plutôt que de deviner un type de chambre.

---

## 13. Invariants

* **INV-CHM-001 (Unicité d'import)** : `ChannelReservationImport.@@unique([canal, otaReservationId])` garantit qu'un même événement OTA ne produit jamais deux réservations, même en cas de relecture webhook.
* **INV-CHM-002 (Course résiduelle traitée, pas seulement documentée)** : si deux livraisons webhook quasi simultanées passent toutes deux la vérification d'idempotence avant qu'aucune n'ait committé, les deux réservations peuvent réellement réussir (plusieurs chambres du même type libres) — sur l'échec `P2002` de l'insertion `ChannelReservationImport`, le perdant est explicitement annulé via `ReservationsService.remove()` (soft, ADR-005) avant de renvoyer la réservation gagnante, pour une vraie garantie d'idempotence côté appelant (contrairement à F4/`booking-engine` où la contrainte unique `RoomNight` suffit à rejeter silencieusement le perdant).

---

## 14. États manipulés

Ce module ne porte pas de machine à états propre — il délègue entièrement au cycle de vie de `Reservation` géré par le module `reservations`. `ChannelReservationImport` est un simple registre d'idempotence, pas un statut métier.

---

## 15. Points sensibles

* **`sync-availability` partiellement simulé** : seule la partie journalisation/déclaration vers l'OTA est simulée (aucun compte partenaire réel n'existe dans ce projet, même convention que `MailerService`/`TwilioService` sans configuration) — le calcul de disponibilité sous-jacent, lui, est réel.
* **Course résiduelle réelle sur import concurrent** (voir INV-CHM-002) — traitée, mais reste un chemin de code plus complexe que le cas nominal, à surveiller si le volume de webhooks augmentait significativement.

---

## 16. Dette technique connue

Aucune dette technique identifiée à ce stade — vérifié en live : rejet sans secret/secret invalide (401), rejet sur mapping absent (404), import réel, relecture idempotente (même id de réservation renvoyé), annulation réelle du perdant sur course résiduelle, rejet RBAC non-admin sur la création de mapping (403).

---

## 17. Fonctionnalités prévues ultérieurement

* **Adaptateurs OTA réels** : `fetchAvailability`/`pushAvailability` (une sous-classe par OTA sous `adapters/`) se dégradent aujourd'hui en simple journalisation, faute de compte partenaire réel — deviendraient de vrais appels API le jour où un partenariat OTA effectif est signé.

---

## 18. Checklist de Pull Request

Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] La comparaison du secret webhook reste à temps constant (`crypto.timingSafeEqual`), jamais un `!==` direct.
* [ ] L'absence de `CHANNEL_WEBHOOK_SECRET` continue de faire échouer toute requête webhook (fail closed).
* [ ] Toute nouvelle route d'import OTA reste protégée par `ChannelWebhookGuard`, jamais par `PermissionsGuard` (un OTA n'a pas de compte utilisateur).
* [ ] L'idempotence sur `otaReservationId` reste garantie même en cas de double livraison quasi simultanée (course résiduelle traitée, pas seulement l'absence d'erreur).
* [ ] Aucune lecture/écriture Prisma directe n'est introduite sur `Reservation`/`RoomNight` — tout transite par `ReservationsService`.
