# Spécification Technique — Module Notifications (notifications.md)

*Créé lors de CH-018 (`docs/governance/REGISTRE_CHANTIERS.md`) — spec manquante malgré un module backend complet (F7, étendu SMS/WhatsApp) déjà largement documenté au fil de l'eau dans `CLAUDE.md`.*

---

## 1. Objectif du module

Le module **Notifications** est le point d'entrée unique pour toute communication automatisée envoyée à un client (CRM/marketing), sur trois canaux (email, SMS, WhatsApp), déclenchée par des événements métier ou une tâche planifiée quotidienne.

---

## 2. Responsabilités

Le module est seul responsable de :
* La gestion des modèles de message par événement et par canal (`NotificationTemplate`).
* L'envoi effectif (email via SMTP/`nodemailer`, SMS/WhatsApp via Twilio), avec dégradation gracieuse en simple journal si les identifiants du fournisseur ne sont pas configurés.
* Le respect systématique du consentement client (`Guest.consentementNotifications`) avant tout envoi.
* La journalisation append-only de chaque tentative d'envoi, un canal à la fois (`NotificationLog`).
* Le rappel automatique J-1 avant l'arrivée (tâche planifiée quotidienne).

---

## 3. Hors périmètre

Le module n'intervient jamais dans :
* La détermination des événements métier eux-mêmes (confirmation de réservation, check-out) — ce module est le **consommateur** des événements `reservation.confirmee` (`ReservationsService`) et `checkout.effectue` (`StayService`), jamais leur émetteur.
* L'envoi de l'email de réinitialisation de mot de passe — géré directement par le module `auth` via la façade `MailerService` exportée par ce module, en dehors du pipeline `notify()`/consentement/journalisation habituel (un email de sécurité ne s'adresse pas à un `Guest`, `Guest.consentementNotifications` n'est pas applicable).
* L'envoi du lien de self check-in au-delà de l'appel à `notify()` — la logique de génération du lien reste dans le module `self-checkin`.

---

## 4. Entités manipulées

Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `NotificationTemplate` (un modèle par couple `evenement`/`canal`, `@@unique([evenement, canal])`)
* `NotificationLog` (append-only — jamais d'update/delete exposé, sert à la fois de journal de livraison et de preuve de consentement respecté au moment de l'envoi, destinataire figé plutôt qu'une relecture de `Guest.email` qui peut changer après coup)

`Guest` est lu exclusivement via la façade `GuestsService.findOne()` — jamais de lecture Prisma directe.

---

## 5. BUSINESS_RULES concernées

Aucune règle `BR-XXX` dédiée dans `BUSINESS_RULES.md` (le document prédate F7) — le consentement (`Guest.consentementNotifications`) et l'opt-out simple sont des conventions établies au fil de l'implémentation de ce module, pas une règle numérotée préexistante.

---

## 6. ADR concernées

* **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md)** : `NotificationLog` suit la même discipline append-only que les autres tables de trace de ce référentiel — aucune méthode d'update/delete n'est exposée par `NotificationsService`.

---

## 7. Permissions RBAC

Les habilitations requises pour interagir avec ce module sont :
* `notifications:read` (`GET /notifications/templates`, `GET /notifications/logs`).
* `notifications:write` (`POST /notifications/templates`, `PATCH /notifications/templates/:id`).

Le déclenchement effectif d'un envoi (`notify()`) n'est jamais appelé directement par une route HTTP de ce module — uniquement par les listeners internes et le cron, en réaction à un événement ou à l'horloge.

---

## 8. Flux entrants

Le module intercepte les événements et requêtes suivants :
* `GET /notifications/templates`, `POST /notifications/templates`, `PATCH /notifications/templates/:id` — gestion des modèles (motif ≥ 10 caractères exigé sur la modification, même si `evenement`/`canal` restent immuables une fois le modèle créé, identité figée par la contrainte unique).
* `GET /notifications/logs` (filtrable par `guestId`, `reservationId`) — consultation du journal d'envoi.
* `@OnEvent('reservation.confirmee')` — déclenche `notify(RESERVATION_CONFIRMEE, ...)`.
* `@OnEvent('checkout.effectue')` — déclenche `notify(POST_SEJOUR, ...)`. Listener distinct de `housekeeping/listeners/checkout-effectue.listener.ts` (même événement, deux modules qui réagissent indépendamment — le ménage repasse la chambre à nettoyer, celui-ci déclenche l'email post-séjour).
* `@Cron('0 9 * * *')` — rappel quotidien `RAPPEL_J_MOINS_1` pour toute réservation arrivant le lendemain (réutilise `ScheduleModule.forRoot()` déjà enregistré globalement par `HrModule`, pas besoin de le réimporter).

---

## 9. Flux sortants

`NotificationsService.notify()` n'émet jamais d'événement — il enfile des jobs BullMQ (`NOTIFICATIONS_QUEUE`, types `SEND_EMAIL`/`SEND_SMS`/`SEND_WHATSAPP`) via `NotificationsQueue`, traités par `NotificationsProcessor` (retry 3 tentatives). C'est le point d'entrée unique de tout envoi — jamais d'envoi direct ailleurs dans le code.

---

## 10. Dépendances autorisées

Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants, en façade :
* `guests` : résolution du destinataire et de son consentement.
* `reservations`, `stay` : résolution du contexte métier de l'événement (dates, chambre).
* `audit` : traçabilité des modifications de modèle.

Ces trois derniers modules **n'importent jamais `NotificationsModule` en retour** — les listeners vivent dans ce module (le consommateur), pas dans le module qui émet l'événement (même convention que `housekeeping/listeners/checkout-effectue.listener.ts`).

---

## 11. Dépendances interdites

Ce module a l'interdiction stricte de dépendre de :
* Aucune interdiction explicite documentée au-delà de la règle générale de sens de dépendance (ce module est un consommateur d'événements, jamais un module que `reservations`/`stay` importeraient).

---

## 12. Contraintes métier

* **Point d'entrée unique** : `NotificationsService.notify()` est le seul chemin d'envoi — garantit que consentement et journalisation sont systématiquement respectés, jamais contournables par un appel direct à `MailerService`/`TwilioService` ailleurs dans le code (à l'exception documentée du module `auth`, §3).
* **Aucun canal codé en dur** : `notify()` itère sur `NotificationTemplate.findMany({ where: { evenement } })` — le nombre de canaux réellement tentés dépend uniquement des modèles configurés en base.
* **Dégradation gracieuse** : `MailerService`/`TwilioService` se dégradent en simple `Logger.log` si `SMTP_HOST`/les identifiants Twilio ne sont pas configurés — jamais d'exception pour une configuration manquante (seule une panne réelle du fournisseur fait échouer le job, retry BullMQ).
* **Journalisation même en cas d'ignorance** : aucun cas silencieux — si aucun modèle n'existe pour l'événement (tous canaux confondus), un unique log `IGNORE` dégénéré est créé ; si un canal individuel est ignoré (modèle inactif, pas de destinataire, opt-out), il est journalisé `IGNORE` également.

---

## 13. Invariants

* **INV-NOT-001 (Append-only)** : `NotificationLog` ne fait jamais l'objet d'un update ou d'un delete exposé par ce module.
* **INV-NOT-002 (Consentement systématique)** : `Guest.consentementNotifications = false` bloque les 3 canaux simultanément — pas de granularité par canal (opt-out simple, cohérent avec le choix produit documenté).
* **INV-NOT-003 (Destinataire figé au moment de l'envoi)** : `NotificationLog` fige le destinataire réellement utilisé, jamais une relecture différée de `Guest.email`/`telephone`.

---

## 14. États manipulés

Ce module ne porte pas de machine à états métier — chaque tentative d'envoi produit un `NotificationLog` avec un statut terminal parmi `ENVOYE`/`IGNORE`/`ECHEC` (voir `DATA_DICTIONARY.md` pour l'énumération complète), jamais de statut intermédiaire persisté au-delà du traitement de la queue.

---

## 15. Points sensibles

* **Rappel J-1 non rattrapable** : un déclenchement manqué (redémarrage du serveur pendant la fenêtre du cron) n'est jamais rattrapé — ce n'est pas un état « relatif à aujourd'hui » recalculé à la lecture comme le fait `housekeeping` (`reconcileDailyStatuses`), c'est un envoi ponctuel qui ne se reproduit pas.
* **Pas de résilience de fournisseur au-delà du retry BullMQ** : une panne SMTP/Twilio prolongée fait échouer les 3 tentatives puis abandonne silencieusement le job (aucune alerte dédiée).

---

## 16. Dette technique connue

Aucune dette technique identifiée à ce stade au-delà du point sensible « rappel J-1 non rattrapable » (§15), qui est un choix assumé cohérent avec l'absence générale de cron de rattrapage dans ce projet.

---

## 17. Fonctionnalités prévues ultérieurement

Aucune extension prévue formellement pour cette version — les 3 canaux (email/SMS/WhatsApp) et les 3 événements déclencheurs couvrent le périmètre demandé.

---

## 18. Checklist de Pull Request

Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Tout nouvel envoi passe exclusivement par `NotificationsService.notify()`, jamais un appel direct à `MailerService`/`TwilioService` (sauf le cas documenté du module `auth`).
* [ ] `Guest.consentementNotifications = false` bloque bien les 3 canaux, pas seulement celui en cours d'ajout.
* [ ] Tout nouveau listener d'événement vit dans ce module (le consommateur), jamais dans le module émetteur.
* [ ] Aucune méthode d'update/delete n'est ajoutée sur `NotificationLog` (append-only, ADR-005).
