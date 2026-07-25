# Audit technique — Makarim PMS v1
## Phase 9 — Qualité du code

Analyse fondée sur la synthèse des lectures de code des Phases 1 à 8 et sur des vérifications ciblées supplémentaires : recherche exhaustive de blocs `catch` silencieux, inventaire complet des fichiers `utils/` (21 fichiers, 1271 lignes cumulées), lecture intégrale de `reservations.service.ts` (655 lignes, le plus volumineux du backend), et vérification d'une collision de nom de fichier entre modules (`room-transitions.ts` présent à deux endroits). Aucune modification de fichier effectuée.

---

## 1. Cohérence architecturale globale

**Backend** : le patron `module/{module.module,controller,service}.ts` + `dto/` + `utils/` (fonctions pures, sans dépendance NestJS/Prisma) est appliqué avec une régularité rare sur les 21 modules. Les « façades en lecture seule » suivent toutes la même convention.

**Frontend** : patron `features/<domaine>/{api,types,components,pages}` appliqué sans exception sur les 14 dossiers.

**Séparation utils/service assumée et documentée** : chaque fichier `utils/` inspecté contient une fonction pure sans injection Prisma/NestJS — c'est précisément cette catégorie de fichiers qui porte les 6 tests unitaires existants, le reste de la logique métier restant non testé en isolation.

**Écart de nommage documenté et assumé** : le module `stay` conserve volontairement les routes HTTP (`/checkin/*`) et la clé de permission (`checkin:read/write`) sous l'ancien nom `checkin`, alors que les identifiants internes ont été renommés — `CLAUDE.md` le documente explicitement.

---

## 2. Découpage des responsabilités

**Controllers** : 28 fichiers, 1934 lignes, aucun dépassement de 200 lignes — délégation systématique au service, zéro logique métier détectée.

**Services — un service peut porter plusieurs responsabilités liées mais distinctes**, illustré par le plus gros fichier du backend, `reservations.service.ts` (655 lignes) : une seule classe `ReservationsService` porte simultanément CRUD réservation, calcul de prix saisonnier, vérification de restrictions tarifaires, vérification de disponibilité, calcul et écriture de pénalité d'annulation, et façades en lecture seule pour trois autres modules.

**Listeners correctement isolés** : les 4 listeners du backend vivent chacun dans le module consommateur, contiennent une seule méthode `@OnEvent`, et délèguent immédiatement à un service.

**Collision de nom de fichier, sans duplication de logique** : deux fichiers distincts s'appellent `room-transitions.ts` — `rooms/utils/room-transitions.ts` (50 lignes, `ROOM_TRANSITIONS`/`canTransition`, propriété exclusive du module `rooms`) et `housekeeping/utils/room-transitions.ts` (14 lignes, `MANUAL_TARGETS`, cibles atteignables par PATCH manuel). Vérification faite : `MANUAL_TARGETS` est réellement utilisé (deux DTO), ce n'est pas du code mort, et le contenu ne duplique pas la matrice de transition — mais le nom de fichier identique entre deux modules différents est une source de confusion à la lecture.

---

## 3. Duplication et taille des fichiers

**Aucune duplication de logique métier substantielle détectée** entre modules sur l'ensemble des lectures effectuées.

**Distribution des tailles de service** : de 51 lignes (`mailer.service.ts`) à 655 lignes (`reservations.service.ts`), moyenne de 202 lignes sur 28 fichiers.

**Fichiers `utils/`** : tous compacts (11 à 176 lignes, moyenne 60 lignes), aucun ne dépasse 180 lignes hors fichiers de test.

**Frontend** : de 77 à 634 lignes par page/composant, taille globalement proportionnelle à la densité métier du domaine couvert.

---

## 4. Transactions, Prisma et robustesse

**Usage de Prisma** : `PrismaService` reste une classe minimale sans middleware ni extension — toute règle transverse (soft delete notamment) dépend d'une discipline manuelle plutôt que d'une garantie structurelle. C'est la zone de fragilité la plus « cachée derrière une apparente propreté » du projet.

**Transactions** : usage cohérent et large — 16 fichiers de service sur 28 utilisent `$transaction`, systématiquement pour englober l'écriture métier et son `AuditService.writeLog()` associé. `tx` est un paramètre explicite et souvent obligatoire sur les méthodes de façade critiques.

**Gestion des erreurs** : cohérente à l'échelle du backend — recherche exhaustive de blocs `catch` silencieux : **un seul résultat**, dans `auth.service.ts` (`refresh()`), une traduction contrôlée et volontaire, pas une erreur avalée silencieusement.

**Écart entre intention métier et implémentation, repéré à plusieurs reprises et confirmé structurel plutôt qu'isolé** : `CreditNote`/`ANNULEE_PAR_AVOIR` référencés dans le code lui-même comme solution censée exister mais jamais implémentés (Phase 6) ; `forgotPassword()` documenté comme comportement « intérimaire » jamais raccordé (Phase 5) ; `StatutSejour.ANNULE` modélisé mais jamais écrit (Phase 3) ; `RoomStatusLog` écrit systématiquement mais jamais lu (Phase 7). Le point commun : le code contient une trace explicite de l'intention d'origine, ce qui rend chaque écart traçable a posteriori plutôt que silencieusement invisible — mais le nombre de cas cumulés indique un motif récurrent plutôt que des incidents isolés.

---

## 5. Évaluation globale

**Constats** : le code du projet applique avec une régularité inhabituelle un petit nombre de conventions explicites, vérifiables sur l'ensemble des 21 modules backend et 14 features frontend. La dette technique identifiée se concentre presque entièrement autour d'un même motif — des mécanismes commencés puis jamais complétés jusqu'à leur point d'usage réel — plutôt qu'autour d'un manque général de rigueur d'écriture. La qualité du code lui-même est constamment plus haute que la complétude fonctionnelle de ce qu'il sert.

**Points forts** :
- Convention architecturale appliquée sans exception détectée sur 21 modules backend et 14 features frontend.
- `utils/` systématiquement purs, courts, et seuls porteurs des tests unitaires existants.
- Un seul bloc `catch` sur tout le backend qui pourrait ressembler à une exception silencieuse, et il s'agit d'une traduction contrôlée.
- Discipline transactionnelle cohérente (16/28 services), avec `tx` explicite et souvent non-optionnel sur les façades critiques.
- Les écarts entre intention et implémentation laissent systématiquement une trace explicite dans le code.
- Aucune duplication de logique métier substantielle détectée entre modules.

**Points faibles** :
- Un service (`ReservationsService`, 655 lignes) agrège un nombre de responsabilités métier sensiblement supérieur aux autres.
- Absence de garantie structurelle (middleware/extension Prisma) pour des règles transverses répétées manuellement (soft delete).
- Collision de nom de fichier entre deux modules (`room-transitions.ts` × 2).
- Plusieurs mécanismes explicitement commencés restent inachevés jusqu'à leur point d'usage final — un motif récurrent.

**Risques** :
- La concentration de responsabilités dans `ReservationsService` rend ce fichier le point de friction le plus probable pour toute future modification touchant la tarification, les restrictions ou les pénalités.
- Le motif récurrent « intention tracée mais jamais complétée » suggère qu'un nouvel élément similaire pourrait déjà exister ailleurs dans le code sans avoir été détecté par les huit phases précédentes.
- L'absence de garantie structurelle sur le soft delete reste, à l'échelle du projet, le seul point où la qualité perçue du code diverge le plus de la garantie réelle offerte au runtime.

**Questions ouvertes** :
- Un découpage de `ReservationsService` en sous-domaines est-il envisagé ?
- Existe-t-il un inventaire interne des mécanismes « commencés mais non complétés » au-delà des quatre identifiés dans cet audit ?
- La collision de nom `room-transitions.ts` a-t-elle déjà causé une confusion réelle en pratique ?

### Note globale — Qualité du code : **7,5/10**
