# HAIP_BENCHMARK.md — Notes de Recherche : Inspiration tirée de HAIP (Non Normatif)

> [!NOTE]
> **Statut : non normatif.** Ce document n'est PAS une spécification. Contrairement à
> `BUSINESS_RULES.md`, aux `ADR-*.md` ou aux fichiers `modules/*.md`, rien ici n'est
> obligatoire ni contractuel. C'est un **carnet d'inspiration** à consulter au moment
> d'attaquer les Sprints 11 à 13 (HR, Stock, Reporting/Accounting) et lors des passes de
> polish UI, pour éviter de réinventer des solutions à des problèmes déjà bien résolus
> ailleurs. Toute adoption d'une idée ci-dessous doit suivre le processus normal :
> passer par un ADR si elle touche l'architecture, ou une entrée `SPRINT_XX.md` si elle
> touche un module.

**Source analysée** : [HAIP](https://github.com/TelivityAI/haip) (Apache 2.0), un PMS open source
générique (NestJS + Drizzle + PostgreSQL + Keycloak). Analysé le 2026-07-20 dans le cadre
du choix de rester sur MakarimPMS plutôt que de migrer vers HAIP (voir décision en fin de
document). **On ne reprend aucun code ni aucune dépendance de HAIP — seulement des idées de
conception**, réimplémentées nativement dans notre stack (Prisma/MySQL/JWT).

---

## 1. Paiements & Caisse (touche `payments.md`, `ADR-004`)

### 1.1 « Correction matrix » — choix automatique void / refund / adjust

**Constat.** Dans HAIP (`apps/api/src/modules/payment/payment.service.ts`, méthode
`correctPayment`), une seule fonction décide **automatiquement** l'opération légale de
correction d'un paiement à partir de son état :

- `authorized` (autorisation carte non capturée) → **void** (annulation, pas d'appel gateway pour le cash)
- `cash` posé depuis moins de 24h → **void**
- carte `captured`/`settled`/`partially_refunded` → **refund** uniquement (jamais void)
- tout le reste (cash hors fenêtre, règlements "record-only") → **adjust** (écriture négative)

Si un opérateur tente une opération illégale (ex. void sur une carte déjà capturée), l'API
rejette avec un message explicite citant la règle source (`KB 14.1` dans leur convention —
équivalent de nos `BR-XXX`).

**Pourquoi c'est pertinent pour Makarim.** On a déjà `ADR-004` sur l'intégrité financière et
l'idempotence des paiements, mais rien de formalisé sur **quelle correction est légale selon
l'état du paiement**. C'est exactement le genre de règle qui, non centralisée, finit
divergente entre deux endpoints.

**Où l'étudier / l'intégrer.** `docs/modules/payments.md` (Sprint 08, déjà livré — candidat
à une petite évolution) + éventuellement un nouveau `BR-PAY-XXX` dans `BUSINESS_RULES.md`
formalisant la matrice de correction légale par état de paiement.

### 1.2 Registre en « net ledger » (jamais écraser le montant parent)

**Constat.** HAIP ne bascule jamais le statut du paiement parent pour refléter un
remboursement — un remboursement/correction est une **ligne enfant négative distincte**,
liée par `originalPaymentId`, sur le même paiement parent qui reste `captured`. Le calcul de
solde de folio somme parent + enfants. Ça évite un bug classique : si on "flip" le parent en
`refunded`, on perd le montant positif original pendant que l'enfant négatif existe déjà →
double comptage ou perte selon l'ordre des opérations. Utilise `Decimal.js`, jamais de float.

**Pourquoi c'est pertinent.** Directement dans l'esprit d'`ADR-004`. À vérifier : notre
modèle Prisma `Payment` actuel gère-t-il déjà les remboursements partiels de cette façon, ou
risque-t-on ce piège au moment d'implémenter les remboursements ?

**Où l'étudier.** `docs/ADR-004-Payment-Financial-Integrity.md` — évaluer si une clause sur
le modèle "ligne enfant" doit y être ajoutée avant d'implémenter les remboursements
partiels (pas encore vu de mention explicite dans le module `payments` actuel).

---

## 2. Comptabilité & Reporting (Sprint 13 — pas encore démarré)

### 2.1 Détection d'anomalies par z-score (variance de caisse)

**Constat.** `night-audit-anomaly.models.ts` : calcule moyenne + écart-type par type de
charge sur l'historique, signale un outlier si `|z-score| > seuil`, **mais seulement si
`count >= 30`** — garde-fou simple pour éviter les faux positifs sur un historique trop
mince. Sévérité (critique/warning/info) dérivée du type d'anomalie.

**Pourquoi c'est pertinent.** `ROADMAP.md` mentionne le "Rapport de Police Réglementaire" et
la consolidation TVA pour le Sprint 13, mais rien sur la détection d'écarts de caisse. Un
hôtel de 24 chambres avec plusieurs réceptionnistes/shifts est exactement le terrain où une
variance de caisse anormale (vol, erreur de rendu monnaie) mérite d'être signalée
automatiquement plutôt que découverte a posteriori.

**Où l'étudier.** `docs/modules/reporting.md` (Module 13) + `SPRINT_13.md` — candidat de
fonctionnalité à ajouter à la spec du night audit / clôture de caisse, en s'appuyant sur les
sessions de caisse déjà modélisées côté `payments`.

### 2.2 Import CSV générique avec dry-run

**Constat.** `apps/api/src/modules/import/import.service.ts` : un framework d'import
générique — on enregistre un "importer" par entité (`{required, columns, build, create}`),
et toute la mécanique (parsing CSV, mapping colonnes→champs, dry-run sans écriture, rapport
d'erreur **par ligne** sans jamais faire échouer tout le batch) est partagée. Réutilise les
services `create` existants — aucune logique métier dupliquée.

**Pourquoi c'est pertinent.** Le `ROADMAP.md` mentionne des exports Excel/PDF/CSV pour la
compta (Sprint 13) mais rien sur l'**import** initial de données (ex. charger les clients ou
l'historique existant de l'hôtel au démarrage réel, ou la vision multi-propriétés v2.0). Le
pattern "dry-run + erreur par ligne isolée" est un standard simple à reproduire en Prisma.

**Où l'étudier.** Pas encore de module dédié — à noter dans `docs/roadmap/ROADMAP.md`
section v2.0, ou comme brique technique transverse dans `SYSTEM_ARCHITECTURE.md` si on
anticipe une migration de données à l'ouverture de l'hôtel.

### 2.3 Grand livre de dépôts comme passif (deposit ledger)

**Constat.** `apps/api/src/modules/accounting/deposit.service.ts` : les acomptes sont
suivis comme un **passif** (`held`), pas comme du revenu, avec un cycle de reconnaissance
explicite `held → applied` (au check-in/check-out) `→ refunded` ou `→ forfeited`, avec des
gardes d'état empêchant les transitions illégales.

**Pourquoi c'est pertinent.** Comptabilité rigoureuse alignée avec votre culture
"intégrité financière" (`ADR-004`). Si Makarim prend des acomptes à la réservation, cette
distinction passif/revenu est comptablement correcte et évite de gonfler le CA prématurément
— point que la TVA marocaine 10%/20% (Sprint 13) devra probablement traiter différemment
selon que le montant est acompte ou charge effective.

**Où l'étudier.** `docs/modules/accounting.md` (Module 13) au moment de sa rédaction
détaillée — actuellement ce module n'existe qu'au niveau roadmap, pas encore spécifié.

---

## 3. Housekeeping (module déjà livré — Sprint 09)

### 3.1 Checklists par type de tâche + auto-assignation

**Constat.** `checklist-templates.ts` : une checklist par défaut par type de tâche
(`checkout`, `stayover`, `deep_clean`, `turndown`, `inspection`, `maintenance`), chacune
avec 6-13 items concrets. Auto-assignation round-robin par étage/priorité
(`auto-assign.dto.ts`). Cycle `pending → assigned → in_progress → completed → inspected`,
avec re-nettoyage automatique en cas d'échec d'inspection.

**Pourquoi c'est pertinent.** Notre `housekeeping.md` actuel (Sprint 09, livré) décrit une
"validation de propreté exclusive par le rôle Gouvernante" — plus simple que HAIP. Les
checklists structurées et l'auto-assignation sont des évolutions naturelles, pas une
refonte : ça s'ajoute sans toucher à la state machine déjà en place (`ADR-003`).

**Où l'étudier.** `docs/modules/housekeeping.md` — évolution v1.1 possible, à documenter
comme extension plutôt que retouche du Sprint 09 déjà clos (respecter votre gate "pas de
régression sur sprint déjà validé").

---

## 4. RBAC & Permissions (module déjà livré — Sprint 01, `ADR-006`)

**Constat.** HAIP a un catalogue de permissions **défini dans le code** (ex.
`reservations.write`, `housekeeping.manage`), mappé 1:1 aux endpoints ET aux items de nav du
dashboard — un seul point de vérité qui pilote à la fois l'autorisation API et l'affichage
UI. Une UI d'admin "Rôles" présente une matrice permission × rôle éditable pour créer des
rôles custom, avec les rôles système protégés contre l'édition/suppression.

**Pourquoi c'est pertinent.** Vous avez déjà `RBAC_MATRIX.md` et `PermissionsGuard` — la
matrice existe déjà **en documentation**. L'idée à retenir n'est pas le concept (déjà chez
vous) mais l'implémentation : générer la nav du frontend et l'admin UI de rôles **à partir
de la même matrice**, pour que la doc et le code ne divergent jamais.

**Où l'étudier.** `docs/RBAC_MATRIX.md` + `docs/development/DEVELOPER_HANDBOOK.md` — piste
d'outillage (générer un type TypeScript partagé backend/frontend depuis la matrice) plutôt
qu'un nouveau module.

---

## 5. Design & UX (frontend)

Stack HAIP : React 19 + Vite + Tailwind 4. Stack Makarim : React + Base UI + Tailwind +
shadcn — suffisamment proches pour que les patterns visuels se transposent sans changer de
librairie.

| Pattern observé | Détail | Pertinence Makarim |
|---|---|---|
| **KpiCard à coloration sémantique par seuil** (`components/ui/KpiCard.tsx`) | Une carte KPI générique prend `threshold: {warnBelow, goodAbove}` et colore automatiquement la valeur (orange/teal/neutre) — pas de couleur hardcodée par page | Directement réutilisable pour le futur dashboard `reporting.md` (occupation, variance de caisse, seuils stock bas) |
| **Command Palette (Cmd+K)** (`components/search/CommandPalette.tsx`) | Recherche globale au clavier, standard sur les back-office modernes | Confort réception — accès rapide chambre/client/réservation sans quitter le clavier |
| **Set de composants UI minimal et cohérent** | `Skeleton`, `Toast`, `Modal`, `ErrorBoundary`, `StatusBadge` — 5 primitives réutilisées partout, chacune testée individuellement (`*.test.tsx`) | Bonne discipline à documenter dans `DEVELOPER_HANDBOOK.md` si pas déjà le cas : un seul `StatusBadge` pour tous les statuts (chambre, paiement, ticket maintenance...) plutôt qu'un badge par module |
| **Indicateur "Live" WebSocket** | Badge de statut temps réel dans le header (vu en prod aujourd'hui) | Utile pour housekeeping/maintenance mobile (DoD Makarim exige déjà 44px de cible tactile — cohérent avec un usage terrain) |

**Où l'étudier.** `docs/development/DEVELOPER_HANDBOOK.md` (conventions de composants) et
`docs/modules/reporting.md` (dashboard) au moment de leur passe de polish UI.

---

## 6. Sécurité — pattern à garder en tête pour la v2.0 (Portail Client / Self Check-In)

**Constat.** Le moteur de réservation directe de HAIP utilise une clé publique **par
propriété, à faible confiance** (`x-booking-key`), volontairement scopée : elle ne peut que
chercher/réserver/consulter sa propre confirmation, jamais lister les réservations d'un
autre client. Et surtout : **le prix n'est jamais fait confiance côté client** — toujours
recalculé côté serveur avant paiement, même si le prix affiché au client a pu changer entre
temps.

**Pourquoi c'est pertinent.** C'est exactement le futur "Portail Client en Ligne (Self
Check-In)" de votre `ROADMAP.md` v2.0 (2027). Le jour où vous le spécifierez, cette paire de
règles (clé publique scopée + re-calcul serveur systématique du prix) est le minimum de
sécurité non négociable à inscrire dès le premier ADR de ce module.

**Où l'étudier.** À noter dans `docs/roadmap/ROADMAP.md` section v2.0 comme prérequis de
sécurité, pour ne pas l'oublier au moment de la spec détaillée (probablement encore loin).

---

## 7. Ce qu'on ne reprend PAS (et pourquoi)

Pour éviter toute ambiguïté future : les éléments suivants de HAIP sont **délibérément
exclus** de cette liste d'inspiration, pas oubliés par erreur.

- **Keycloak** — auth JWT maison actuelle plus simple à opérer pour un hôtel de 24 chambres ;
  Keycloak est une charge opérationnelle propre (JVM, mode dev vs prod, upgrades) sans
  bénéfice pour un besoin mono-tenant.
- **Drizzle / PostgreSQL** — Prisma/MySQL déjà en place et maîtrisé, migrer la base n'a
  aucune justification fonctionnelle.
- **Multi-tenant** (`property_id` partout) — hors périmètre tant que Makarim reste
  mono-propriété ; à reconsidérer seulement si la vision "multi-établissements" (v2.0) se
  concrétise.
- **Agents IA** — différenciant réel de HAIP mais hors roadmap Makarim actuelle ; à
  réévaluer séparément, pas dans ce document technique.
- **Channel Manager complet** — voir l'analyse de comparaison précédente : non certifié
  contre les vraies OTA dans HAIP, et explicitement en v2.0 (2027) dans votre roadmap. Si/quand
  ce sujet redevient prioritaire, l'architecture des adaptateurs (`ChannelAdapter` interface,
  garde SSRF, retry/timeout) mérite sa propre étude dédiée — pas résumée ici.

---

*Document généré le 2026-07-20 suite à l'analyse comparative HAIP vs MakarimPMS. À réviser
ou supprimer si HAIP évolue significativement, ou une fois les idées retenues absorbées dans
les docs normatifs correspondants.*
