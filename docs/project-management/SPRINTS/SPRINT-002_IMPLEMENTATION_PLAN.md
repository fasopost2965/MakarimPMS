# Sprint 002 — Plan d’implémentation Housekeeping & Maintenance

## 1. Identification

- Mission : `MISSION-0009`
- Type : plan d’implémentation et suivi d’exécution
- Statut : plan de référence validé — en cours d’exécution
- Date de l’analyse initiale : 1er août 2026
- Dernière mise à jour d’exécution : 2 août 2026
- Référence historique du code analysé : `b6a9e58e827f24673db65a1239f573ceb0c2e13f`
- Référence `main` confirmée à cette mise à jour : `1cb146b5fe23ab250f48c74771e15400f4848c96`
- Modules : Housekeeping et Maintenance

Ce document décrit l'état existant et propose un ordre d'évolution incrémental. Il ne constitue ni une décision fonctionnelle, ni une validation d'architecture. Toute évolution impliquant le schéma Prisma, un contrat API, le RBAC ou une règle métier devra faire l'objet d'une mission dédiée et d'une validation préalable.

## 1.1 État d’exécution au 2 août 2026

Le contenu d’analyse des sections 3 à 7 décrit la photographie du dépôt au SHA `b6a9e58e827f24673db65a1239f573ceb0c2e13f`. Les constats formulés au présent sur l’absence de `HousekeepingTask` doivent donc être lus comme historiques. Depuis cette analyse, la fondation de données HK-P1-03A a été fusionnée ; le service runtime, l’API, les intégrations et les interfaces restent à réaliser dans les sous-lots suivants.

| Lot | État confirmé | Référence / suite |
|---|---|---|
| `MNT-P1-01` + `MNT-P1-05` | fusionnés | filtres et résilience Maintenance, PR #53 |
| Historique Housekeeping par chambre | fusionné | MISSION-0013, PR #56 |
| `HK-P1-01` | fusionné | filtres Housekeeping, PR #57 |
| `HK-P1-02` | fusionné | actualisation manuelle Housekeeping, PR #58 |
| Architecture `HK-P1-03` v1.1 | validée et fusionnée | document d’architecture, PR #59 |
| `HK-P1-03A` | fusionné | schéma, migration, seed et reprise, PR #60 ; nouveau `main` `1cb146b5fe23ab250f48c74771e15400f4848c96` |
| `MNT-P1-02` | réalisé, PR ouverte | PR #55 à actualiser, retester et revoir avant toute fusion |
| `HK-P1-03B` | prochaine mission | service, machine à états, verrous et audit |
| `HK-P1-03C` | en attente de B | API, checkout et réconciliation |
| `HK-P1-03D` | en attente de C | interfaces desktop et mobile |
| `HK-P1-03E` | en attente de B–D | validation intégrée, concurrence et E2E |
| `HK-P1-04` | différé | à engager seulement après validation complète de A–E |

### Découpage exécutable de HK-P1-03

| Sous-lot | Responsabilité | Dépendance de démarrage |
|---|---|---|
| A — Fondation | schéma, migration, seed et backfill | terminée |
| B — Domaine | service, transitions, concurrence, audit | A |
| C — Intégrations | API, checkout, réconciliation | B |
| D — Interfaces | desktop et mobile | C |
| E — Validation | scénarios intégrés, concurrence, E2E | B à D terminés |

Chaque sous-lot est une mission dédiée, sur une branche et une Pull Request distinctes. Aucune fusion ni opération sur le VPS n’est implicite.

### Critères de clôture du Sprint 002

Le Sprint 002 pourra être déclaré terminé lorsque :

- HK-P1-03 A à E seront fusionnés après revue avec CI verte ;
- les incréments P1 ouverts seront fusionnés ou explicitement différés par décision produit ;
- la migration et le backfill auront été répétés sur une copie ou un environnement de préproduction avant le VPS ;
- les transitions de chambre resteront centralisées et aucun nouveau flux ne contournera les règles métier ;
- la documentation d’exploitation et de déploiement reflétera l’état réellement livré.

## 2. Synthèse exécutive

Les deux modules reposent aujourd'hui sur le statut de la chambre comme pivot opérationnel. Housekeeping fournit déjà une vue desktop, une application mobile, un historique des transitions et une machine à états centralisée. Maintenance fournit la création, la consultation et la résolution de tickets, avec blocage et remise en nettoyage automatiques de la chambre lorsque la transition est permise.

Les recommandations les plus structurantes de l'audit UX ne peuvent toutefois pas être obtenues uniquement par des ajustements frontend : l'affectation des chambres, le suivi d'une tâche de nettoyage, le contrôle qualité, les délais d'intervention, la planification des techniciens et les coûts ne sont pas représentés par les modèles actuels. Leur réalisation exige des décisions métier et d'architecture, puis des évolutions Prisma et API séparées.

Les premiers incréments recommandés exploitent donc les contrats existants : filtres, lisibilité de la charge, historique des tickets par chambre, indépendance des erreurs et consolidation des tests. Les fondations de données sont proposées ensuite, sans préjuger de leur validation.

## 3. Architecture générale actuelle

```mermaid
flowchart LR
    UI[Interfaces React desktop] --> API[API NestJS]
    MOBILE[Interfaces React mobiles] --> API
    API --> HK[HousekeepingService]
    API --> MNT[MaintenanceService]
    HK --> ROOMS[RoomsService]
    HK --> RSV[ReservationsService]
    HK --> STAY[StayService]
    MNT --> ROOMS
    ROOMS --> DB[(MySQL via Prisma)]
    HK -. nettoyage.valide .-> STOCK[Stock]
    STAY -. checkout.effectue .-> HK
    API --> RBAC[JWT, guards et permissions]
```

Principes observés :

- frontend React/TypeScript organisé par fonctionnalités, avec pages, composants, API et types locaux ;
- backend NestJS modulaire, contrôleurs fins et services portant les règles métier ;
- Prisma comme accès persistant à MySQL ;
- `RoomsService.transitionRoom` comme point central des transitions de statut de chambre et de leur historique ;
- permissions effectives contrôlées côté backend et utilisées côté frontend ;
- événements internes pour relier le départ, le nettoyage et le stock.

## 4. Module Housekeeping

### 4.1 Architecture actuelle

Le module desktop consulte l'état des chambres et permet certaines transitions manuelles. Le module mobile propose un parcours autonome de connexion, de consultation et de mise à jour. Le backend réconcilie les statuts système avant chaque liste et délègue toute transition à `RoomsService`.

La persistance repose uniquement sur `Room.statut` et `RoomStatusLog`. Il n'existe pas de tâche de housekeeping, d'affectation à un agent, de cycle de contrôle qualité ou de charge par employé dans le schéma actuel.

### 4.2 Flux métier actuels

#### Consultation desktop

1. `HousekeepingPage` appelle `GET /rooms`.
2. `HousekeepingService.findAllRooms` lance la réconciliation quotidienne.
3. Les chambres sont regroupées par étage et filtrées par statut.
4. La sélection d'une chambre ouvre son historique de statuts.

#### Transition manuelle

1. L'utilisateur choisit un statut manuel autorisé.
2. `PATCH /rooms/:id/statut` valide le DTO et la permission.
3. Le service refuse une modification depuis `OCCUPEE` ou `DEPART_PREVU`.
4. `RoomsService.transitionRoom` vérifie la machine à états, met à jour la chambre et crée un `RoomStatusLog`.
5. Une transition de nettoyage vers `LIBRE_PROPRE` émet `nettoyage.valide` pour le stock.

#### Réconciliation automatique

- `LIBRE_PROPRE` et `RESERVEE` sont réconciliés selon les arrivées confirmées du jour.
- `OCCUPEE` et `DEPART_PREVU` sont réconciliés selon le séjour actif et sa date de départ.
- les états de nettoyage et de maintenance ne sont pas modifiés par cette réconciliation.
- le checkout émet `checkout.effectue`, qui fait passer la chambre à `A_NETTOYER`.

#### Parcours mobile

1. connexion dédiée via `POST /mobile/housekeeping/login` ;
2. récupération des chambres accessibles via `GET /mobile/housekeeping/rooms` ;
3. sélection d'une chambre, d'un statut manuel et d'un commentaire facultatif ;
4. mise à jour via `PATCH /mobile/housekeeping/rooms/:id/statut`.

Le commentaire est conservé comme motif de transition, sans constituer une note de tâche structurée.

### 4.3 Composants frontend

| Élément | Responsabilité actuelle | Limite principale |
|---|---|---|
| `HousekeepingPage.tsx` | tableau par étage, compteurs, filtres, transitions | aucune affectation, charge agent ou actualisation temps réel |
| `RoomHistoryDialog.tsx` | historique chronologique des statuts | historique de chambre uniquement, sans tâche ni contrôle qualité |
| `HousekeepingMobileApp.tsx` | connexion et mise à jour mobile des chambres | pas de tâches affectées, hors-ligne, contrôle ou signalement maintenance |
| `api.ts` | liste, transition et historique | contrats centrés sur la chambre |
| `types.ts` | types de l'historique | aucun type de tâche housekeeping |

Les composants génériques existants (`Badge`, `Select`, dialogues, états de chargement et d'erreur) sont réutilisables pour les incréments d'interface.

### 4.4 Services backend

| Élément | Responsabilité |
|---|---|
| `HousekeepingController` | routes desktop et permissions `housekeeping:read/write` |
| `MobileHousekeepingController` | authentification et routes mobiles dédiées |
| `HousekeepingService` | liste réconciliée, garde des statuts système, historique et événements |
| `RoomsService` | machine à états, écriture atomique du statut et journal de transition |
| `ReservationsService` | existence d'une arrivée confirmée pour la réconciliation |
| `StayService` | séjour actif, départ prévu et événement de checkout |

### 4.5 Endpoints API

| Méthode | Route réelle | Permission/accès | Usage |
|---|---|---|---|
| `GET` | `/rooms` | `housekeeping:read` | liste réconciliée des chambres |
| `GET` | `/rooms/:id/historique-statuts` | `housekeeping:read` | historique des transitions |
| `PATCH` | `/rooms/:id/statut` | `housekeeping:write` | transition manuelle |
| `POST` | `/mobile/housekeeping/login` | public, limité en fréquence | session mobile dédiée |
| `GET` | `/mobile/housekeeping/rooms` | accès mobile lecture | liste mobile filtrée par périmètre |
| `PATCH` | `/mobile/housekeeping/rooms/:id/statut` | accès mobile écriture | transition et commentaire mobile |

Le préfixe global observé est `/api`. Certaines documentations mentionnent `/api/v1` et des routes de tâches housekeeping qui ne sont pas présentes dans le code actuel.

### 4.6 Modèles Prisma concernés

| Modèle/enum | Usage actuel |
|---|---|
| `Room` | chambre, étage et statut opérationnel courant |
| `StatutChambre` | `LIBRE_PROPRE`, `RESERVEE`, `OCCUPEE`, `DEPART_PREVU`, `A_NETTOYER`, `EN_NETTOYAGE`, `EN_MAINTENANCE` |
| `RoomStatusLog` | ancien/nouveau statut, motif, identifiant utilisateur éventuel et date |

Modèle absent mais évoqué dans la documentation métier : `HousekeepingTask`. Son introduction serait une décision d'architecture avec migration, API, RBAC, règles de concurrence et stratégie de reprise des données ; elle n'est pas incluse dans la présente mission.

### 4.7 Écarts avec l'audit UX

| Recommandation de l'audit | État vérifié | Écart restant |
|---|---|---|
| P1 — affectation des chambres | absente | aucun modèle de tâche ni relation agent |
| P1 — progression en temps réel | statuts disponibles après rechargement | aucune tâche, progression d'agent ou actualisation temps réel |
| P1 — filtres enrichis | filtres par statut et regroupement par étage | pas d'agent, zone, retard, priorité ou charge |
| P1 — indicateurs de charge | compteurs par statut | pas de charge par personne ni de capacité planifiée |
| P2 — historique détaillé | historique de statuts disponible | pas d'historique de tâche, durée, affectation ou validation |
| P2 — commentaires | motif mobile facultatif | commentaire non structuré et non rattaché à une tâche |
| P2 — contrôle qualité et validation gouvernante | absent | nécessite un cycle de tâche et des permissions validées |
| P3 — application mobile dédiée | présente | limitée aux statuts ; pas de tâches affectées ni mode hors-ligne |
| P3 — notifications automatiques | événements internes partiels | aucune notification opérationnelle housekeeping vérifiée |
| P3 — optimisation des tournées | absente | nécessite données d'affectation, localisation et règles métier |

L'audit est donc partiellement dépassé sur l'existence de l'historique et de l'application mobile, mais ses attentes de gestion de tâches restent non couvertes.

## 5. Module Maintenance

### 5.1 Architecture actuelle

La page desktop gère une liste de tickets, leur création et leur résolution. L'application mobile utilise l'authentification générale et permet de consulter ou résoudre les tickets. Le backend persiste un ticket simple et synchronise le statut de la chambre lorsque la machine à états l'autorise.

Le ticket ne possède actuellement qu'un état implicite, déterminé par `resoluAt`. L'assignation est un texte libre ; il n'existe ni relation vers un technicien, ni échéance, étape d'intervention, coût, pièce consommée ou maintenance préventive.

### 5.2 Flux métier actuels

#### Création d'un ticket

1. l'utilisateur saisit une chambre facultative, une panne, une priorité, un assigné libre et une photo facultative ;
2. `POST /maintenance-tickets` crée le ticket dans une transaction ;
3. si la chambre peut passer à `EN_MAINTENANCE`, `RoomsService.transitionRoom` effectue la transition ;
4. si la transition est interdite, notamment pour une chambre occupée, le ticket est conservé et la chambre reste inchangée.

Ce dernier comportement est silencieux pour l'appelant. De plus, toute priorité peut bloquer une chambre lorsque la transition est possible.

#### Résolution

1. `PATCH /maintenance-tickets/:id/resoudre` vérifie que le ticket est ouvert ;
2. `resoluAt` est renseigné ;
3. si aucun autre ticket ouvert ne concerne la chambre et que celle-ci est toujours `EN_MAINTENANCE`, elle passe à `A_NETTOYER` ;
4. une seconde résolution retourne actuellement un conflit `409`.

#### Consultation

- la liste backend accepte les filtres `roomId` et `ouvert` et trie du plus récent au plus ancien ;
- la page desktop filtre seulement par priorité ;
- le mobile propose les vues ouvertes, urgentes et résolues ;
- le Dashboard, la recherche globale et les notifications consomment aussi des informations de maintenance.

### 5.3 Composants frontend

| Élément | Responsabilité actuelle | Limite principale |
|---|---|---|
| `MaintenancePage.tsx` | compteurs, filtre priorité, création, liste, photo et résolution | chargement tickets/chambres couplé ; aucun détail d'intervention ou délai |
| `MaintenanceMobileApp.tsx` | consultation et résolution mobile | aucune prise en charge par le technicien ni progression |
| `api.ts` | liste, création, résolution | le filtre backend `roomId` n'est pas pleinement exposé par le type client |
| `types.ts` | représentation du ticket simple | état implicite, assigné libre, aucun coût ou échéance |
| `OpenMaintenanceWidget` | résumé Dashboard | consommateur à préserver lors des évolutions de contrat |
| `GlobalSearch` / `NotificationCenter` | recherche et signalement transverses | consommateurs à inclure dans toute analyse d'impact API |

### 5.4 Services backend

| Élément | Responsabilité |
|---|---|
| `MaintenanceController` | création, liste, détail, résolution et contrôle RBAC |
| `MaintenanceService` | persistance transactionnelle et synchronisation du statut de chambre |
| `RoomsService` | validation et journalisation des transitions de chambre |

### 5.5 Endpoints API

| Méthode | Route réelle | Permission | Usage |
|---|---|---|---|
| `POST` | `/maintenance-tickets` | `maintenance:write` | créer un ticket |
| `GET` | `/maintenance-tickets` | `maintenance:read` | lister, avec `roomId` et `ouvert` facultatifs |
| `GET` | `/maintenance-tickets/:id` | `maintenance:read` | consulter un ticket |
| `PATCH` | `/maintenance-tickets/:id/resoudre` | `maintenance:write` | résoudre un ticket |

Les routes d'affectation et les données de rapport/coût décrites dans certains documents API ne sont pas implémentées. La documentation qualifiant la résolution d'idempotente ne correspond pas au conflit `409` observé dans le service.

### 5.6 Modèles Prisma concernés

| Modèle/enum | Champs structurants actuels |
|---|---|
| `MaintenanceTicket` | chambre facultative, panne, priorité, photo en texte long, assigné libre, date de résolution, date de création |
| `PrioriteTicket` | `BASSE`, `MOYENNE`, `HAUTE`, `URGENTE` |
| `Room` | relation tickets et statut courant |
| `RoomStatusLog` | trace des blocages et remises en nettoyage |

Absences structurantes : statut de workflow explicite, technicien référencé, échéance, début d'intervention, rapport, coûts, pièces, journal propre au ticket, périodicité et calendrier préventif.

### 5.7 Écarts avec l'audit UX

| Recommandation de l'audit | État vérifié | Écart restant |
|---|---|---|
| P1 — fiche d'intervention enrichie | ticket simple, photo et assigné texte | pas de description structurée, étapes, rapport ou horodatages métier |
| P1 — historique complet par chambre | filtrage backend possible et historique des statuts séparé | aucune vue consolidée des tickets et interventions |
| P1 — filtres avancés | priorité côté desktop, ouvert/urgent/résolu côté mobile | chambre, état, assigné, dates et combinaisons absents de l'UI |
| P1 — suivi des délais | absent | aucun champ d'échéance ni règle de retard |
| P2 — planification techniciens | assigné libre | aucun technicien référencé, disponibilité ou planning |
| P2 — coûts d'intervention | absent | nécessite sémantique comptable et stockage validés |
| P2 — pièces consommées | absent | nécessite une intégration Stock et des règles de valorisation |
| P3 — maintenance préventive | absente | aucun plan, périodicité ou génération de ticket |
| P3 — indicateurs de performance | compteurs simples uniquement | aucune donnée fiable sur délais, charge, coûts ou récurrence |
| P3 — calendrier technique | absent | dépend de la planification et du préventif |

## 6. Dépendances et impacts transverses

| Dépendance | Housekeeping | Maintenance | Point d'attention |
|---|---|---|---|
| Chambres | statut et historique | blocage et remise à nettoyer | préserver `RoomsService.transitionRoom` comme autorité |
| Réservations | arrivée confirmée du jour | aucune dépendance directe | réconciliation appelée à chaque liste housekeeping |
| Séjours / Check-out | occupation, départ, événement checkout | occupation limitant certaines transitions | éviter toute duplication des règles de séjour |
| Stock | événement de nettoyage validé | future consommation de pièces éventuelle | définir atomicité et gestion d'échec avant extension |
| Utilisateurs / RH | futur agent affecté | futur technicien référencé | modèle d'identité et permissions à valider |
| Dashboard | compteurs chambres | widget tickets ouverts | conserver la sémantique des KPI existants |
| Recherche / Notifications | impact limité aujourd'hui | tickets consommés transversalement | vérifier tout changement de type ou contrat |
| RBAC | `housekeeping:read/write` et accès mobile | `maintenance:read/write` | ne pas inventer de permission sans décision d'architecture |
| Audit | `RoomStatusLog` pour les transitions | `RoomStatusLog` et dates ticket | préciser les actions métier devant être auditées |

## 7. Améliorations proposées

Les estimations sont relatives : `S` faible, `M` modérée, `L` importante, `XL` structurante. Elles incluent développement, tests et documentation, mais pas les arbitrages fonctionnels préalables.

### 7.1 P1 — Priorité immédiate proposée

| ID | Amélioration | Incrément recommandé | Dépendances / validation | Estimation |
|---|---|---|---|---|
| `HK-P1-01` | filtres et indicateurs enrichis | exploiter étage, statuts et compteurs existants ; états indépendants et responsive | aucun changement de données ; préciser les filtres attendus | `M` |
| `HK-P1-02` | actualisation opérationnelle | rafraîchissement contrôlé et indication de dernière mise à jour, sans prétendre à du temps réel | stratégie de polling et charge API à valider | `M` |
| `HK-P1-03` | fondation tâches et affectations | définir puis implémenter un cycle de tâche, l'agent, les dates et la concurrence | décision PO/Architecte, Prisma, API, RBAC, migration | `XL` |
| `HK-P1-04` | progression et charge par agent | construire les vues sur la fondation `HK-P1-03` | dépend entièrement du modèle de tâche | `L` |
| `MNT-P1-01` | filtres desktop existants | exposer `roomId` et `ouvert`, combiner avec priorité, conserver les erreurs locales | contrat backend déjà disponible | `S` |
| `MNT-P1-02` | historique par chambre | vue chronologique des tickets via le filtre existant, avec lien au statut de chambre | définir ce que signifie « complet » | `M` |
| `MNT-P1-03` | fiche d'intervention enrichie | définir les champs, transitions, responsabilités et historique avant ajout | décision PO/Architecte, Prisma et API probables | `L` |
| `MNT-P1-04` | suivi des délais | échéance, retard et filtres, calculés côté backend selon une règle validée | règles de délai, fuseau, migration et API | `L` |
| `MNT-P1-05` | robustesse de la page desktop | rendre le chargement des chambres indépendant de celui des tickets | tests frontend ciblés | `S` |

### 7.2 P2 — Consolidation métier proposée

| ID | Amélioration | Dépendances / validation | Estimation |
|---|---|---|---|
| `HK-P2-01` | historique détaillé d'une tâche et de ses affectations | `HK-P1-03`, politique d'audit et conservation | `M` |
| `HK-P2-02` | commentaires structurés et pièces jointes éventuelles | `HK-P1-03`, sécurité et rétention | `M` |
| `HK-P2-03` | contrôle qualité et validation gouvernante | `HK-P1-03`, workflow et RBAC validés | `L` |
| `MNT-P2-01` | affectation et planification des techniciens | identité technicien, calendrier et règles de charge | `L` |
| `MNT-P2-02` | rapport et coûts d'intervention | sémantique comptable, devise, audit | `L` |
| `MNT-P2-03` | consommation de pièces | intégration Stock, transactions et valorisation | `XL` |

### 7.3 P3 — Optimisation proposée

| ID | Amélioration | Dépendances / validation | Estimation |
|---|---|---|---|
| `HK-P3-01` | mobile centré sur les tâches affectées et résilient au réseau | fondation tâches, stratégie hors-ligne et conflits | `L` |
| `HK-P3-02` | notifications opérationnelles | événements fiables, préférences et canaux | `M` |
| `HK-P3-03` | optimisation des tournées | tâches, localisation, priorités et règles hôtelières | `XL` |
| `MNT-P3-01` | maintenance préventive | plans, périodicité, génération et responsabilité | `XL` |
| `MNT-P3-02` | indicateurs de performance | historique structuré, délais et coûts fiables | `L` |
| `MNT-P3-03` | calendrier technique | préventif et planification techniciens | `L` |

## 8. Ordre d’exécution actualisé

1. Revoir puis fusionner `HK-P1-03B` : service métier, machine à états, verrous, concurrence et audit.
2. Réaliser `HK-P1-03C` sur la fondation validée : API, création au checkout et réconciliation, sans dupliquer l’autorité de transition des chambres.
3. Réaliser `HK-P1-03D` : interfaces desktop et mobile fondées sur les contrats stabilisés de C.
4. Exécuter `HK-P1-03E` : validation intégrée, RBAC, scénarios de concurrence et E2E des flux Checkout → Housekeeping → Stock.
5. Actualiser et revoir la PR #55 (`MNT-P1-02`) comme mission indépendante, sans la coupler aux sous-lots Housekeeping.
6. N’engager `HK-P1-04` qu’après clôture de A–E et mesure de la stabilité opérationnelle.
7. Concevoir ensuite les évolutions Maintenance structurantes (`MNT-P1-03`, `MNT-P1-04`) dans des migrations additives séparées.
8. Réserver les capacités P2/P3 aux décisions produit ultérieures et aux données devenues suffisamment fiables.

L’ordre est piloté par les dépendances réelles : la couche domaine précède l’API, l’API précède les interfaces, puis la validation intégrée clôt la chaîne. Le travail Maintenance indépendant peut avancer en parallèle sur une branche distincte.

## 9. Risques techniques

| Risque | Niveau | Conséquence | Mesure recommandée |
|---|---|---|---|
| documentation en décalage avec le code | élevé | implémentation de routes ou règles inexistantes | considérer le code et les tests comme état vérifié, corriger la documentation par mission dédiée |
| absence de modèle de tâche housekeeping | élevé | affectation et contrôle impossibles sans dette | valider un modèle minimal avant toute UI correspondante |
| modèle maintenance trop simple | élevé | délais, planning et coûts non traçables | découper les migrations et contrats par capacité |
| réconciliation séquentielle à chaque `GET /rooms` | moyen à élevé | latence croissante et surcharge avec le nombre de chambres | mesurer, tester la concurrence et concevoir une optimisation dédiée |
| événement `nettoyage.valide` non attendu | moyen | échec Stock potentiellement dissocié de la transition | clarifier la garantie métier et l'observabilité |
| blocage maintenance silencieux | élevé | ticket créé sans rendre visible l'indisponibilité attendue | décider du comportement selon statut/priorité avant modification |
| assigné maintenance en texte libre | moyen | doublons, absence d'identité et de charge fiable | valider la source des techniciens avant migration |
| photo encodée en base | moyen | croissance de la base et réponses lourdes | définir stockage, limite et politique de rétention |
| concurrence sur les transitions de chambre | élevé | conflit entre séjour, nettoyage et maintenance | conserver l'autorité centrale et renforcer les tests transactionnels |
| divergence des authentifications mobiles | moyen | expérience et politique de session incohérentes | faire auditer la stratégie sans refonte implicite |
| extensions RBAC | élevé | exposition ou blocage d'actions | réutiliser les permissions existantes ou faire valider toute nouvelle permission |
| accessibilité et mobile peu testés | moyen | régression terrain | ajouter des tests clavier, lecteurs d'écran et viewport ciblés |

## 10. Stratégie de tests recommandée pour les futures missions

- tests unitaires de la machine à états et des nouvelles règles de délai ou d'affectation ;
- tests services transactionnels pour transitions concurrentes et absence d'effets partiels ;
- E2E RBAC pour lecture, écriture, affectation, validation et résolution ;
- E2E des interactions Checkout → Housekeeping → Stock et Maintenance → Chambre → Housekeeping ;
- tests frontend ciblés pour filtres, erreurs indépendantes, responsive et navigation clavier ;
- tests mobiles avec perte de réseau si un mode hors-ligne est validé ;
- mesures de performance de la liste housekeeping avant toute actualisation périodique.

## 11. Questions à valider

1. Une tâche housekeeping doit-elle être créée au checkout uniquement, ou également manuellement et pour les nettoyages planifiés ?
2. Qui peut affecter, démarrer, terminer, contrôler et rouvrir une tâche ?
3. L'agent housekeeping et le technicien sont-ils des utilisateurs RBAC, des employés RH ou des entités distinctes ?
4. Quelle information constitue la progression « temps réel » attendue et quelle fréquence d'actualisation est acceptable ?
5. Le contrôle qualité est-il obligatoire pour toutes les chambres ou conditionné par un risque ou un rôle ?
6. Lorsqu'un ticket concerne une chambre occupée, faut-il seulement alerter, planifier l'intervention ou bloquer une étape ultérieure ?
7. Toutes les priorités de ticket doivent-elles bloquer une chambre libre, ou seulement certaines ?
8. Quels états composent le cycle d'intervention maintenance au-delà d'ouvert/résolu ?
9. Comment sont déterminés les délais : priorité, type de panne, contrat, heure ouvrée ou saisie manuelle ?
10. L'historique « complet » doit-il agréger tickets, interventions, statuts de chambre, pièces et coûts ?
11. Les coûts de maintenance relèvent-ils de Maintenance, Stock, Achats ou Facturation/Comptabilité ?
12. Quelle politique de stockage et de conservation appliquer aux photos et pièces jointes ?

## 12. Sources analysées

- `docs/audit/01_FRONTEND_UX_AUDIT.md`
- `docs/audits/PHASE_07_HOUSEKEEPING_MAINTENANCE.md`
- `docs/design/design_handoff_final/batch2_exploitation_hotel.md`
- documentation métier, API, RBAC et dictionnaire de données disponible dans `docs/`
- frontend Housekeeping, Maintenance, applications mobiles et consommateurs transverses
- backend Housekeeping, Maintenance, Rooms, Reservations, Stay et événements associés
- schéma Prisma et tests frontend/backend des deux modules

## 13. Hors périmètre de ce document

- aucune modification de code applicatif, contrat API, modèle Prisma, migration ou test ;
- aucune nouvelle règle métier ;
- aucune fusion de Pull Request ;
- aucune migration, reprise de données ou opération sur le VPS ;
- aucune implémentation des améliorations proposées.
