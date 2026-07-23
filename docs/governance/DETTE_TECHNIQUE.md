# Dette technique et zones de fragilité — Makarim PMS v1

Ce document isole la dette **structurelle** (comment le code est construit) de la dette **fonctionnelle** (ce qui manque au produit, déjà couverte par `REGISTRE_CHANTIERS.md`). Il répond à la question : « si on ne développe plus aucune fonctionnalité pendant 6 mois, où le code se dégraderait-il le plus vite si on continuait à construire dessus sans y toucher ? »

## Zones de fragilité structurelle identifiées

### 1. ~~Filtrage soft-delete non centralisé~~ (Phase 3 §5.6, Phase 4 §5, Phase 9 §4) — **Résolu (CH-006, session courante)**
**Nature d'origine** : 12 modèles portent `deletedAt`, seuls 8 fichiers de service appliquaient le filtre par convention manuelle inline (la constante `NOT_DELETED` elle-même n'était en réalité jamais importée nulle part). Aucune garantie structurelle (middleware/extension Prisma).
**Résolution** : extension Prisma globale (`$extends`, `backend/src/prisma/soft-delete.extension.ts`), chaînée avec l'extension de chiffrement CH-004 — intercepte `findMany`/`findFirst`/`findFirstOrThrow`/`findUnique`/`findUniqueOrThrow`/`count`/`aggregate`/`groupBy` sur les 12 modèles via `$allModels`. Chaque nouvelle requête top-level sur ces modèles est désormais filtrée par construction, plus par discipline individuelle — l'oubli reste possible pour une lecture imbriquée via `include`/`select` (limite Prisma structurelle, documentée dans le fichier et dans `docs/governance/REGISTRE_DECISIONS.md`, RD-010), mais plus pour un appel direct. Voir `docs/governance/REGISTRE_CHANTIERS.md` (fiche CH-006) pour le détail complet.
**Chantier** : CH-006 (terminé).

### 2. `ReservationsService` en agrégation de responsabilités (Phase 9 §2, §5)
**Nature** : 655 lignes, une seule classe portant CRUD réservation, tarification, restrictions, disponibilité, pénalités, façades multi-modules.
**Pourquoi c'est fragile** : c'est le fichier le plus consulté et le plus modifié du backend (le domaine le plus dense en règles métier) — chaque futur changement dans l'un des sous-domaines (tarification, restrictions, disponibilité) oblige à comprendre l'ensemble du fichier, augmentant le risque de régression croisée.
**Chantier** : CH-016 (secondaire — pas une urgence, mais un point à surveiller si la taille continue de croître).

### 3. Absence de tests unitaires de la couche service (Phase 4 §4, §6, Phase 9)
**Nature** : 6 fichiers `.spec.ts`, tous des fonctions pures d'utilitaire. Zéro test de service avec Prisma mocké. Toute la couverture au-delà des utilitaires repose sur 19 fichiers e2e.
**Pourquoi c'est fragile** : une régression dans une branche d'erreur peu fréquente (mais réelle) d'un service ne sera détectée que si un scénario e2e existant la traverse — sinon, jamais avant la production. C'est un choix assumé et documenté (`CLAUDE.md` : « toujours contre une vraie base MySQL, jamais de mock »), pas un oubli, mais cela reste une dette de vitesse de feedback qui grossit avec chaque nouveau service.
**Chantier** : CH-017 (à traiter comme une pratique continue, pas un chantier ponctuel).

### 4. Collision de nom de fichier `room-transitions.ts` (Phase 9 §2)
**Nature** : deux fichiers de noms identiques dans deux modules différents (`rooms/utils/` et `housekeeping/utils/`), contenus non dupliqués mais ambigus à la première lecture.
**Pourquoi c'est fragile** : risque de confusion pour un nouveau développeur ou une IA qui chercherait « la » matrice de transition et tomberait sur le mauvais fichier.
**Chantier** : CH-019 (quasi gratuit à corriger).

### 5. ~~`PrismaService` minimal sans point d'extension~~ (Phase 4 §1) — **Résolu (CH-004 + CH-006)**
**Nature d'origine** : à l'origine, une classe `extends PrismaClient` sans `$use()`/`$extends()`.
**Résolution** : `PrismaModule` fournit le token `PrismaService` via un `useFactory` qui chaîne désormais **deux** extensions (`.$extends(guestEncryptionExtension(...)).$extends(softDeleteExtension())`) — chiffrement `Guest.pieceIdentite` (CH-004) et filtrage soft-delete centralisé (CH-006). Composition vérifiée en live avant d'écrire le code définitif (script jetable, supprimé après usage) : un `Guest` créé/lu via le client composé continue de déchiffrer correctement `pieceIdentite` *et* respecte le filtrage `deletedAt`, dans le même appel — les deux extensions ne se marchent pas dessus. Toute future règle transverse (futur audit automatique, future limite de débit applicative) composera de la même façon.
**Chantier** : CH-004 (terminé) + CH-006 (terminé).

### 6. `prisma/seed.ts` — ordre de nettoyage incomplet pour plusieurs tables (découvert en session, non lié à un audit formel)
**Nature** : la séquence de `deleteMany()` en tête de `main()` ne couvre pas `SelfCheckinToken`, `ChannelReservationImport`, `StockMovement`/`StockItem` — trois tables ajoutées par des chantiers postérieurs à l'écriture initiale de cette séquence (F6, F10, module stock) sans que la liste de nettoyage n'ait été mise à jour en conséquence.
**Pourquoi c'est fragile** : `npx prisma db seed` échoue de façon opaque (violation de contrainte FK sur `Reservation.deleteMany()` à cause de `SelfCheckinToken`/`ChannelReservationImport` orphelins, ou violation de contrainte unique `StockItem_code_key` sur la ré-insertion) dès qu'un développeur a exercé ces fonctionnalités localement avant de reseeder — sans lien évident entre le message d'erreur et la cause réelle (ordre de nettoyage, pas une régression du chantier en cours). Rencontré concrètement pendant CH-005/CH-011 (session courante), contourné par des suppressions SQL manuelles ciblées, jamais corrigé dans `seed.ts` lui-même (hors périmètre strict de ces deux chantiers).
**Chantier** : aucun dédié — correctif mineur et autonome (ajouter les trois `deleteMany()` manquants, dans le bon ordre de dépendance FK), à faire dès qu'un développeur touche `seed.ts` pour une autre raison, ou en tâche isolée si elle recommence à gêner.

## Zones explicitement vérifiées comme SANS dette structurelle significative

Pour éviter de laisser croire que tout le projet est fragile — ces points ont été activement vérifiés et confirmés sains :

- **Duplication de logique métier entre modules** : aucune détectée sur l'ensemble de l'audit (Phase 9 §3).
- **Discipline transactionnelle** : cohérente sur 16/28 services, `tx` explicite et souvent non-optionnel sur les façades critiques (Phase 9 §4).
- **Gestion des exceptions** : un seul bloc `catch` potentiellement silencieux dans tout le backend, et il s'agit d'une traduction contrôlée, pas d'un avalement d'erreur (Phase 9 §4).
- **Taille des controllers** : aucun des 28 controllers ne dépasse 200 lignes (Phase 4 §3).
- **Taille des fichiers `utils/`** : tous compacts (11 à 176 lignes), aucun « utilitaire surchargé » (Phase 9 §3).

## Dette hors périmètre de ce document

Les fonctionnalités manquantes (CreditNote, UI police, etc.) ne sont **pas** de la dette technique au sens de ce document — ce sont des chantiers fonctionnels, listés dans `REGISTRE_CHANTIERS.md` et `FONCTIONNALITES_INCOMPLETES.md`. La distinction compte : la dette technique dégrade la vitesse de développement futur ; les fonctionnalités manquantes limitent l'usage actuel du produit. Les deux méritent un traitement, mais pas la même urgence de méthode.
