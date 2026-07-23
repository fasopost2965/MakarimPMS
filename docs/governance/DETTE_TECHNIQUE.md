# Dette technique et zones de fragilité — Makarim PMS v1

Ce document isole la dette **structurelle** (comment le code est construit) de la dette **fonctionnelle** (ce qui manque au produit, déjà couverte par `REGISTRE_CHANTIERS.md`). Il répond à la question : « si on ne développe plus aucune fonctionnalité pendant 6 mois, où le code se dégraderait-il le plus vite si on continuait à construire dessus sans y toucher ? »

## Zones de fragilité structurelle identifiées

### 1. Filtrage soft-delete non centralisé (Phase 3 §5.6, Phase 4 §5, Phase 9 §4)
**Nature** : 12 modèles portent `deletedAt`, seuls 9 fichiers de service appliquent le filtre par convention manuelle (`NOT_DELETED`). Aucune garantie structurelle (middleware/extension Prisma).
**Pourquoi c'est fragile** : chaque nouvelle requête `findMany`/`findFirst` sur un de ces 12 modèles est un point où l'oubli est possible et invisible (pas d'erreur de compilation, pas de test qui échoue par défaut). La dette **grossit avec chaque nouveau développeur/chantier** tant que le mécanisme n'est pas centralisé.
**Chantier** : CH-006.

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

### 5. `PrismaService` minimal sans point d'extension (Phase 4 §1)
**Nature** : classe `extends PrismaClient` sans `$use()`/`$extends()`.
**Pourquoi c'est fragile** : toute règle transverse future (pas seulement le soft-delete) devra être ajoutée service par service plutôt que centralement — le problème du §1 ci-dessus se reproduira pour toute nouvelle préoccupation transverse (ex. un futur audit automatique, une future limite de débit applicative).
**Chantier** : lié à CH-006, mais la portée est plus large que le seul soft-delete — à garder en tête lors de l'implémentation de CH-006 (choisir un mécanisme extensible, pas un correctif ponctuel).

## Zones explicitement vérifiées comme SANS dette structurelle significative

Pour éviter de laisser croire que tout le projet est fragile — ces points ont été activement vérifiés et confirmés sains :

- **Duplication de logique métier entre modules** : aucune détectée sur l'ensemble de l'audit (Phase 9 §3).
- **Discipline transactionnelle** : cohérente sur 16/28 services, `tx` explicite et souvent non-optionnel sur les façades critiques (Phase 9 §4).
- **Gestion des exceptions** : un seul bloc `catch` potentiellement silencieux dans tout le backend, et il s'agit d'une traduction contrôlée, pas d'un avalement d'erreur (Phase 9 §4).
- **Taille des controllers** : aucun des 28 controllers ne dépasse 200 lignes (Phase 4 §3).
- **Taille des fichiers `utils/`** : tous compacts (11 à 176 lignes), aucun « utilitaire surchargé » (Phase 9 §3).

## Dette hors périmètre de ce document

Les fonctionnalités manquantes (CreditNote, UI police, etc.) ne sont **pas** de la dette technique au sens de ce document — ce sont des chantiers fonctionnels, listés dans `REGISTRE_CHANTIERS.md` et `FONCTIONNALITES_INCOMPLETES.md`. La distinction compte : la dette technique dégrade la vitesse de développement futur ; les fonctionnalités manquantes limitent l'usage actuel du produit. Les deux méritent un traitement, mais pas la même urgence de méthode.
