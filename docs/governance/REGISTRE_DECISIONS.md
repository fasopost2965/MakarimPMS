# Registre des décisions — Makarim PMS v1

Décisions structurantes prises **pendant ou après l'audit** (distinct des ADR existants sous `docs/ADR-00X-*.md`, qui documentent des décisions d'architecture prises pendant la conception initiale). Ce registre couvre les décisions de pilotage post-audit — arbitrages de périmètre, choix de séquencement, décisions sur des questions ouvertes par l'audit.

**Aucune décision de fond n'a encore été prise au moment de la structuration documentaire (session Claude 1)** — cette session a produit des constats et des chantiers, pas des arbitrages produit. Les entrées ci-dessous sont donc pour l'instant limitées aux décisions de méthode/structure documentaire elles-mêmes.

## Décisions déjà prises (structure documentaire)

### RD-001 — Emplacement des rapports d'audit
- **Décision** : les 10 rapports d'audit sont versés dans `docs/audits/`, séparés du reste de `docs/` (qui reste la spécification pré-implémentation).
- **Raison** : `docs/` existant se présente comme la source de vérité normative (« Aucun écart... n'est toléré », `docs/README.md`) mais l'audit a confirmé qu'elle est mesurablement désynchronisée du code réel sur plusieurs points (Phase 1, Phase 4 §1). Mélanger les rapports d'audit (qui documentent l'état réel) avec les specs pré-implémentation (qui documentent l'état visé) aurait perpétué la confusion déjà identifiée comme un point faible.
- **Conséquence** : `docs/README.md` reçoit un bandeau pointant vers `docs/audits/` et `docs/governance/` sans être réécrit en profondeur (ne pas altérer le fond d'un document existant sans mandat explicite pour le faire).

### RD-002 — Format de reconstitution des Phases 1 et 2
- **Décision** : les rapports des Phases 1 et 2, dont le texte intégral verbatim n'était plus disponible dans le contexte de session au moment du versement (compaction survenue avant la demande), sont reconstitués à partir du résumé de session conservé, avec un avertissement explicite en tête de chaque fichier.
- **Raison** : la règle du projet interdit d'inventer des faits non observés. Un résumé de session fidèle mais non verbatim est une source légitime tant qu'elle est signalée comme telle — reconstituer sans avertissement aurait été trompeur ; ne pas produire ces deux phases du tout aurait laissé un trou dans l'index sans justification.
- **Conséquence** : toute formulation fine de ces deux phases doit être vérifiée contre l'historique de session d'origine en cas de doute sérieux (référence conservée dans les fichiers concernés).

### RD-003 — Séparation gouvernance / plan backend / plan frontend
- **Décision** : trois espaces distincts (`docs/governance/`, `docs/backend-plan/`, `docs/frontend-plan/`) plutôt qu'un unique dossier fourre-tout.
- **Raison** : la mission distingue explicitement trois publics/usages successifs (pilotage transversal, exécution backend, exécution frontend) — correspond à la structure « Claude 1 / Claude 2 / Claude 3 » du brief d'origine.

### RD-004 — CH-002 : réutiliser `MailerService`, pas `NotificationsService.notify()`, pour l'email de reset password

- **Décision** : `AuthService.forgotPassword()` envoie l'email de réinitialisation via `MailerService.send()` (exporté par `NotificationsModule`, importé dans `AuthModule`), jamais via `NotificationsService.notify()`.
- **Raison** : `notify()` est structurellement scopé à `Guest` — `guestId` obligatoire en paramètre, `NotificationLog.guestId` référence `Guest` par FK, jamais `User`. Un compte `User` (personnel administratif/opérationnel) n'a pas de place légitime dans ce pipeline CRM/marketing conçu pour les clients de l'hôtel. Découvert en lisant `notifications.service.ts` au moment de l'implémentation (la fiche de chantier initiale, écrite pendant l'audit, n'avait pas vérifié cette contrainte avant de proposer `notify()` comme solution).
- **Alternatives considérées** : (1) étendre `NotificationLog`/`EvenementNotification` pour supporter un `userId` optionnel en plus de `guestId` — rejeté, hors périmètre strict du chantier (« reset password sécurisé »), aurait touché le modèle de données CRM pour un besoin qui n'en fait pas partie ; (2) dupliquer un envoi SMTP minimal directement dans `auth` — rejeté, duplication de logique déjà existante (`MailerService`), contraire à la discipline anti-duplication du projet.
- **Conséquence** : nouvelle dépendance de module `auth → notifications` (façade `MailerService` uniquement, pas `NotificationsService`) — vérifié non circulaire (`NotificationsModule` n'importe jamais `AuthModule`). `EvenementNotification`/`NotificationTemplate` restent strictement scopés aux événements client, sans exception pour les comptes `User`.
- **Date** : session courante (CH-002).
- **Décideur** : Claude (implémentation), dans le cadre du mandat « limite-toi strictement au périmètre du reset password sécurisé » — décision technique d'implémentation, pas un arbitrage produit nécessitant validation humaine préalable.

## Décisions en attente (questions ouvertes de l'audit nécessitant un arbitrage humain)

Voir `ECARTS_ASSUMES.md` §Candidats pour la liste des arbitrages produit encore ouverts (périmètre de l'avoir, chiffrement PII, city ledger, multi-folio vs folio unique, numérotation de facture, matérialisation des pénalités). Ces questions ne sont **pas** tranchées ici — ce registre attend leur décision effective pour les consigner.

## Gabarit pour une nouvelle décision

```
### RD-0XX — <Titre>
- **Décision** :
- **Raison** :
- **Alternatives considérées** :
- **Conséquence** :
- **Date** :
- **Décideur** :
```
