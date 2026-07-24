# Note de cadrage — Session de travail staff (extension d'ADR-007)

*Statut : **brainstorming en pause** — cadrage exploratoire, non arbitré, non implémenté. Mis volontairement de côté le temps de finaliser les chantiers déjà identifiés par l'audit (`docs/governance/`) — à reprendre lors d'une session dédiée. Ne bloque et ne conditionne aucun des chantiers en cours.*

*Élargi depuis par `CADRAGE_PLANNING_ATTENDANCE_STAFF.md` (référentiel personnel, planning prévisionnel des shifts, rapprochement prévu/réel) — ce document reste la référence pour le portail de connexion lui-même (§7 à §9 ci-dessous), repris tel quel dans le document élargi.*

## 0. Constat préalable — ce qui existe déjà

**Avant de concevoir quoi que ce soit de nouveau, il faut acter un fait central : ~70 % de ce qui est demandé existe déjà**, sous la forme d'ADR-007 (« Time Shift & Attendance State Machine », statut *Validé*, 2026-07-19) et de son implémentation dans le module `hr` :

| Déjà en place | Où |
|---|---|
| Machine à états stricte `NON_DEMARRE → ACTIF ⇄ EN_PAUSE → TERMINE` | `StatutTimeShift` (Prisma), `AttendanceService` |
| Horodatage exclusivement serveur (`new Date()`, jamais un payload client) | `AttendanceService.demarrer/mettreEnPause/reprendre/terminer`, BR-RH-003 |
| Isolation par segments (`TRAVAIL`/`PAUSE`) pour un calcul précis du temps travaillé | `TimeShiftSegment` |
| Unicité anti-multi-session (un seul shift `ACTIF`/`EN_PAUSE` par employé) | BR-RH-005, vérifié en transaction |
| Blocage de déconnexion si shift actif, modale de choix | BR-RH-004, `LogoutGuardDialog.tsx`, `App.tsx#handleLogout` |
| Auto-clôture des shifts orphelins après 14h (cron nocturne 04h00) | `AttendanceService.clorerShiftsOrphelins` |
| Ajustement RH rétroactif tracé en `AuditLog` (ancienne/nouvelle valeur, motif ≥ 10 caractères) | `ajusterSegment`, INV-TSH-004 |
| Non-suppression physique (`deletedAt`) | INV-TSH-005 |

**Ce qui manque réellement** par rapport à la demande, et qui constitue donc le véritable périmètre de ce chantier :

1. **Pas de portail obligatoire avant le dashboard.** Aujourd'hui, le pointage est un *widget permanent optionnel* dans la barre de navigation (`AttendanceWidget.tsx`) — l'utilisateur peut l'ignorer et naviguer dans tout le PMS sans jamais démarrer son service. Le blocage n'existe qu'à la **sortie** (déconnexion), jamais à l'**entrée**.
2. **Motif de fin/pause pauvre et non tracé sur l'entité elle-même.** `LogoutGuardDialog` n'offre que 2 choix (« Clôturer » / « Mettre en pause »), sans motif détaillé, et rien n'est écrit sur `TimeShiftSegment` — seul un ajustement RH manuel écrit un motif, jamais l'action spontanée de l'employé.
3. **Pas de notion de « poste » (matin/soir/nuit).** `TimeShift` est indifférencié : aucun champ ne permet de savoir sur quelle rotation un shift a été ouvert.
4. **Pas de parcours explicite de retour après une absence** (extinction de poste, reconnexion différée) — le widget réaffiche simplement l'état courant sans proposer une action contextualisée « reprendre / clôturer / régulariser ».
5. **Aucune donnée de présence dans le module `reporting`.** Le module `reporting` (INV-REP-001, lecture seule) ne lit jamais `TimeShift`/`TimeShiftSegment`.
6. **« Changement de poste » n'existe dans aucun référentiel actuel** — ni comme motif, ni comme concept (relève-t-il d'un même employé qui change de rôle, ou d'une passation entre deux employés ?). Voir arbitrage §11.

**Conséquence pour le cadrage qui suit** : ce document ne propose pas un nouveau module, mais une **extension ciblée d'ADR-007** — nouveau champ `motif` sur `TimeShiftSegment`, nouveau portail frontend obligatoire post-login, nouvelle route de lecture agrégée pour `reporting`. Le state machine, les entités `TimeShift`/`TimeShiftSegment`, `AttendanceService` et la quasi-totalité du backend restent **inchangés et réutilisés tels quels**.

---

## 1. Reformulation métier

Aujourd'hui, la présence dans le PMS (« je suis connecté ») et la présence physique au travail (« je suis en service ») sont deux notions distinctes en base (JWT vs `TimeShift`) mais **pas distinctes dans le parcours utilisateur** : se connecter au PMS donne un accès immédiat et inconditionnel au dashboard, que l'employé ait ou non déclaré le début de son service.

Le besoin réel est de faire de la **session de travail** une porte d'entrée explicite et obligatoire, distincte de la **session applicative** (l'authentification JWT), tout en la reliant à elle : on ne peut pas utiliser le PMS pour le travail opérationnel (check-in, ménage, maintenance, etc.) sans avoir un service de pointage dans un état cohérent (`ACTIF` ou explicitement en pause assumée), et le système doit détecter et régulariser proactivement toute incohérence laissée par une session précédente (coupure, oubli, extinction).

## 2. Cas d'usage réels

| # | Cas d'usage | Acteur | Déclencheur |
|---|---|---|---|
| U1 | Prise de poste normale en début de journée | Réception (matin) | Connexion PMS, aucun shift ouvert |
| U2 | Reprise après une pause déjeuner | Réception | Connexion (ou déjà connecté), shift `EN_PAUSE` |
| U3 | Redémarrage de l'appareil en cours de service (coupure réseau, PC redémarré) | Gouvernante | Reconnexion, shift encore `ACTIF` en base |
| U4 | Retour après une pause prolongée non refermée (oubli, urgence) | Tout staff | Reconnexion, shift `EN_PAUSE` depuis plusieurs heures |
| U5 | Fin de service normale | Tout staff | Déconnexion volontaire, motif `FIN_SERVICE` |
| U6 | Pause déclarée puis déconnexion (l'employé quitte son poste sans se déconnecter formellement de la journée) | Réception | Déconnexion, motif `PAUSE` |
| U7 | Passation de poste (fin du shift matin, début du shift soir sur le même bureau) | Réception matin → Réception soir | Déconnexion motif `CHANGEMENT_POSTE`, connexion suivante d'un autre utilisateur |
| U8 | Incident technique forçant une coupure (panne électrique, PC bloqué) | Tout staff | Reconnexion ultérieure avec shift resté `ACTIF`/`EN_PAUSE`, motif `INCIDENT_TECHNIQUE` déclaré a posteriori |
| U9 | Shift de nuit à cheval sur minuit | Veilleur de nuit | Le shift reste ouvert d'un jour calendaire sur l'autre (déjà géré par ADR-007 §6.2, inchangé) |
| U10 | Oubli total (l'employé ne revient jamais clore son service) | Tout staff | Cron d'auto-clôture à 14h (déjà géré, inchangé) — supervision RH via `AuditLog` |
| U11 | Consultation managériale des heures de présence et anomalies | RH / Administrateur | Écran de supervision, filtré par période/employé/anomalie |
| U12 | Régularisation d'un shift resté ouvert de façon suspecte à la reconnexion | Tout staff, avec validation RH a posteriori | Portail post-login détecte l'anomalie, propose de signaler pour régularisation |

## 3. Place exacte dans l'architecture actuelle

- **Module propriétaire inchangé : `hr`.** Aucune nouvelle brique — `AttendanceService`/`AttendanceController` restent le point d'écriture unique du pointage (cohérent avec la règle CLAUDE.md « un seul chemin d'écriture par champ sensible »).
- **Nouveau point d'interception frontend, avant le rendu du dashboard**, symétrique au `LogoutGuardDialog` existant mais côté entrée : un composant `ShiftGate` monté juste après `isAuthenticated=true` dans `App.tsx`, avant le `return` qui rend `AppSidebar`/`AppTopbar`/les pages. Techniquement, `App.tsx` appelle déjà `statutCourant()` de façon détournée dans `handleLogout()` — le même appel doit désormais se faire **à la connexion**, pas seulement à la déconnexion.
- **`auth` reste inchangé.** Le portail de shift ne fait partie ni du JWT ni du flux `/auth/login` — il s'exécute **après** une authentification déjà réussie, côté frontend uniquement (aucune route backend n'a besoin de connaître l'état du shift pour autoriser une requête API : la distinction "session applicative vs session de travail" reste un choix produit/UX, pas une barrière RBAC serveur — voir arbitrage §11 sur un éventuel durcissement serveur).
- **`audit` reste le seul mécanisme de traçabilité**, déjà utilisé par `ajusterSegment`. Les nouveaux motifs de fin de segment s'écrivent sur `TimeShiftSegment` lui-même (donnée métier), pas seulement dans `AuditLog` (qui reste réservé aux actions correctives/administratives, cohérent avec l'usage actuel).
- **`reporting` gagne une nouvelle façade de lecture seule** vers `hr` (même convention que `HousekeepingService` consommant `ReservationsService`/`StayService` en façade lecture seule) — jamais de Prisma direct sur `TimeShift` depuis `reporting`.

## 4. Modules impactés

| Module | Impact | Nature |
|---|---|---|
| `hr` | Nouveau champ `motif`/`commentaire` sur `TimeShiftSegment` ; nouveau champ `poste` optionnel sur `TimeShift` ; nouvelle route de signalement « anomalie à régulariser » | Backend, extension |
| `auth` | Aucun changement de contrat API. Le frontend consulte simplement `GET /rh/attendance/statut-courant` (déjà existant) à un nouveau moment du cycle de vie | Frontend uniquement |
| `frontend` (transverse `App.tsx`) | Nouveau composant bloquant `ShiftGate`, remplace/englobe `AttendanceWidget` (qui reste utile en persistant, en lecture d'état, dans la barre de navigation) et enrichit `LogoutGuardDialog` avec le motif détaillé | Nouveau composant + refonte d'un composant existant |
| `reporting` | Nouvel endpoint agrégé (temps travaillé/pause par employé/période, anomalies) | Backend, nouveau, lecture seule |
| `audit` | Aucun nouveau type d'action nécessaire si le motif est porté directement par `TimeShiftSegment` (voir §5) — sinon, un nouveau `AuditAction` si l'on décide de tout dupliquer en audit (déconseillé, redondant) | Inchangé (recommandé) |
| `dashboard` | Optionnel : une tuile « anomalies de pointage » pour RH/Administrateur, réutilisant l'endpoint reporting ci-dessus | Frontend, cosmétique |

## 5. Proposition de modèle de données

**Principe : étendre, ne pas dupliquer.** Deux ajouts de colonnes, zéro nouvelle table pour le cœur du mécanisme.

```prisma
enum MotifFinSegment {
  FIN_SERVICE
  PAUSE
  CHANGEMENT_POSTE
  INCIDENT_TECHNIQUE
  AUTRE
  CLOTURE_AUTOMATIQUE   // posé par le cron d'auto-clôture (ADR-007 §6.3), jamais choisi par l'utilisateur
  AJUSTEMENT_RH         // posé quand ajusterSegment() modifie une fin déjà existante
}

enum Poste {
  MATIN
  SOIR
  NUIT
  AUTRE
}

model TimeShift {
  // ... champs existants inchangés ...
  poste            Poste?    // auto-déclaré par l'employé au démarrage — jamais un planning imposé (voir arbitrage §11)
}

model TimeShiftSegment {
  // ... champs existants inchangés ...
  motifFin         MotifFinSegment?   // posé au moment où `fin` est renseigné, jamais avant
  commentaireFin   String?            // libre, utile pour INCIDENT_TECHNIQUE / AUTRE
}
```

- `motifFin` reste `null` tant que le segment est ouvert (`fin: null`) — impossible de le renseigner à l'avance (cohérent avec INV-TSH-001, l'intention ne précède jamais l'horodatage serveur).
- Pas de nouvelle table de « déclaration d'anomalie » en v1 : une régularisation signalée par l'employé est un `motifFin` `INCIDENT_TECHNIQUE`/`AUTRE` + `commentaireFin`, visible par RH via l'écran de supervision existant/étendu (§9) — évite de créer un second système de tickets parallèle à `AuditLog`.
- Migration Prisma pure (colonnes nullables) — même workaround déjà établi ce projet pour les migrations en environnement non interactif (`prisma migrate diff --script` + dossier manuel).

## 6. États possibles d'un shift

**Inchangés** — la machine à états d'ADR-007 (`NON_DEMARRE`, `ACTIF`, `EN_PAUSE`, `TERMINE`) reste strictement la même. Aucun nouvel état de premier niveau n'est proposé : introduire un état `A_REGULARISER` obligerait à réviser chaque garde/vérification existante (`ETATS_OUVERTS`, le cron, `PermissionsGuard`-like checks) pour un bénéfice marginal — la régularisation est un **contexte d'affichage côté frontend** (basé sur l'ancienneté du shift ouvert), pas un état persisté distinct (voir §7 et §9).

## 7. Transitions autorisées

Identiques à ADR-007 §5, avec un seul enrichissement : chaque transition qui ferme un segment (`mettreEnPause`, `terminer`, le cron, `ajusterSegment`) doit désormais fournir un `motifFin`.

| Transition | Motif attendu | Origine |
|---|---|---|
| `ACTIF → EN_PAUSE` | `PAUSE` | Toujours implicite (le type de segment ouvert le dit déjà) |
| `ACTIF/EN_PAUSE → TERMINE` (déconnexion ou action explicite) | Choisi par l'utilisateur parmi `FIN_SERVICE`/`CHANGEMENT_POSTE`/`INCIDENT_TECHNIQUE`/`AUTRE` | Nouvelle modale (§9) |
| Auto-clôture cron (14h) | `CLOTURE_AUTOMATIQUE` | Automatique, jamais choisi |
| `ajusterSegment` (RH) | `AJUSTEMENT_RH` si la fin est modifiée a posteriori | Automatique |

Aucune nouvelle transition n'est ajoutée à la machine à états elle-même — INV-TSH-003 (linéarité) reste garanti tel quel.

## 8. Règles métier (nouvelles, en complément de BR-RH-003/004/005)

- **BR-RH-006 (proposée) — Portail de shift obligatoire avant accès opérationnel.** Après authentification réussie, si l'employé a une fiche `Employee` associée à son compte, le frontend interroge `GET /rh/attendance/statut-courant` avant de rendre le dashboard. Selon la réponse : `NON_DEMARRE` → écran « Démarrer mon service » ; `ACTIF`/`EN_PAUSE` → écran contextualisé (reprendre / clôturer / signaler une anomalie si l'ancienneté dépasse un seuil, voir §11 pour la valeur). Un compte sans fiche `Employee` (ex. certains comptes Administrateur) n'est jamais bloqué — inchangé par rapport à l'existant (`AttendanceWidget` se masque déjà silencieusement dans ce cas).
- **BR-RH-007 (proposée) — Motif de clôture/pause obligatoire.** Toute clôture volontaire de shift (via le portail ou via la modale de déconnexion) exige un `motifFin` parmi la liste fermée ; `AUTRE` exige un `commentaireFin` non vide (≥ 5 caractères, seuil plus léger que les motifs d'audit RH à 10 caractères — ceci reste une déclaration spontanée de l'employé, pas une correction administrative).
- **BR-RH-008 (proposée) — Seuil de régularisation.** Un shift `ACTIF`/`EN_PAUSE` dont `startedAt` (ou le début du segment ouvert) dépasse un seuil configurable (proposition : 8h, à trancher §11) déclenche, à la reconnexion, une option supplémentaire « Signaler une anomalie » en plus de Reprendre/Clôturer — sans jamais bloquer l'accès au PMS au-delà de ce que fait déjà le portail.
- **Inchangées telles quelles** : BR-RH-003 (horodatage serveur), BR-RH-004 (blocage déconnexion — élargi avec motif, jamais retiré), BR-RH-005 (anti multi-session).

## 9. Écrans / modales / parcours UX

Distinction terminologique explicite demandée :

| Terme | Ce que c'est concrètement dans le PMS |
|---|---|
| Connexion au PMS | `POST /auth/login` — authentification JWT, inchangée |
| Ouverture de shift | `POST /rh/attendance/demarrer` — création `TimeShift` + segment `TRAVAIL` |
| Pause | `POST /rh/attendance/pause` |
| Reprise | `POST /rh/attendance/reprendre` |
| Déconnexion | Suppression locale du JWT (`clearTokens()`), potentiellement précédée d'une clôture/pause de shift si un shift est ouvert |
| Clôture de shift | `POST /rh/attendance/terminer` |
| Audit des actions du shift | `AuditLog` (ajustements RH) + les `TimeShiftSegment.motifFin`/`commentaireFin` eux-mêmes, consultables via l'historique (`GET /rh/attendance/employees/:id`) |

**Nouveaux écrans/composants proposés :**

1. **`ShiftGatePage`** (nouveau, plein écran, bloquant) — s'affiche entre l'authentification réussie et le rendu du dashboard, si l'employé a une fiche RH. Trois variantes selon `statutCourant()` :
   - `NON_DEMARRE` → « Bonjour {prénom}. Prêt à démarrer votre service ? » + sélecteur `poste` optionnel (matin/soir/nuit/autre) + bouton Démarrer.
   - `ACTIF`/`EN_PAUSE` récent (< seuil) → « Vous avez un service en cours depuis {durée} » + boutons Reprendre (si en pause) / Continuer vers le PMS (si actif) / Clôturer.
   - `ACTIF`/`EN_PAUSE` ancien (≥ seuil, BR-RH-008) → même écran + bandeau d'alerte + option supplémentaire « Signaler une anomalie et régulariser plus tard » (poste le `motifFin` en attente de revue RH, ferme le shift).
2. **`ShiftCloseDialog`** (remplace `LogoutGuardDialog`, même déclencheur BR-RH-004) — au lieu de 2 boutons, un sélecteur des 5 motifs + champ commentaire conditionnel pour `AUTRE`/`INCIDENT_TECHNIQUE`, avant de clôturer/mettre en pause puis déconnecter.
3. **`AttendanceWidget`** — conservé tel quel dans la topbar (utile pour une pause/reprise en cours de session sans repasser par le portail), mais n'est plus le seul point d'accès.
4. **Écran de supervision RH** (extension de `HrPage.tsx` ou nouvel onglet `reporting`) — liste des shifts avec motif de clôture, filtrable par anomalie (`INCIDENT_TECHNIQUE`, `AUTRE`, `CLOTURE_AUTOMATIQUE`), export cohérent avec les autres écrans `reporting` (CSV, même convention que `PoliceRegister`/`FinancialReporting`).

## 10. Impacts sur les rapports et les logs

- **Nouveau `GET /reporting/attendance-summary?dateDebut=&dateFin=&employeeId=`** (`reporting:read`) — temps travaillé net, temps de pause, nombre de clôtures par motif, anomalies (`CLOTURE_AUTOMATIQUE`/`INCIDENT_TECHNIQUE`/`AUTRE`) sur la période. Lecture Prisma directe sur `TimeShift`/`TimeShiftSegment` depuis `reporting` (même convention documentée que `FinancialReportingService` sur `FolioLine` — pas de service métier importé pour ce type de lecture cross-domaine agrégée).
- **`AuditLog` reste inchangé dans son usage** : seules les actions correctives (RH `ajusterSegment`, déjà existant) y écrivent. Les motifs spontanés de l'employé vivent sur `TimeShiftSegment` — les dupliquer dans `AuditLog` serait redondant et alourdirait chaque clôture normale d'une écriture d'audit qui n'a de sens que pour une correction, pas pour un flux nominal (cohérent avec CLAUDE.md règle 5 : l'audit obligatoire cible les opérations sensibles/correctives, pas chaque écriture métier).
- **Dashboard** : tuile optionnelle « Présence aujourd'hui » (nombre d'employés `ACTIF`/`EN_PAUSE`, anomalies ouvertes) pour Administrateur/RH — cosmétique, non bloquante pour la v1.

## 11. Risques / ambiguïtés métier à arbitrer

Ce sont les points qui **doivent** être tranchés avant tout code — pas des détails d'implémentation.

1. **« Changement de poste » — un même employé ou une passation entre deux employés ?**
   Option A (retenue par défaut dans ce cadrage) : un simple motif de clôture (`CHANGEMENT_POSTE`), sans lien technique entre l'ancien et le nouveau shift — le plus simple, cohérent avec « ne pas surconstruire ».
   Option B : modéliser une vraie passation (`TimeShift.handoverVersId` optionnel) pour tracer qui a pris la relève de qui — utile pour la supervision fine, mais complexité et arbitrage produit supplémentaires (est-ce vraiment utile pour un hôtel de 24 chambres avec une petite équipe ?).
   *→ Question à trancher : Option A suffit-elle, ou la traçabilité de passation (Option B) est-elle une exigence réelle ?*

2. **Portail obligatoire : bloque-t-il vraiment TOUT accès, ou seulement le dashboard opérationnel ?**
   Un Administrateur consultant uniquement les paramètres système a-t-il besoin de « démarrer un service » ? Le cadrage actuel (§3, §8) exempte les comptes sans fiche `Employee` — mais un Administrateur qui *a* une fiche RH (cas réel : le seed du projet en a un) serait bloqué comme n'importe quel autre employé.
   *→ Question à trancher : exempter certains rôles (Administrateur) du portail, ou l'appliquer uniformément à quiconque a une fiche RH ?*

3. **Seuil de « régularisation » (BR-RH-008) — quelle durée ?**
   Proposé à titre indicatif : 8h (la moitié du seuil d'auto-clôture à 14h). À valider selon la réalité des rotations (un shift de nuit de 12h dépasserait ce seuil sans être une anomalie).
   *→ Question à trancher : seuil fixe, ou dépendant du `poste` déclaré (nuit = seuil plus large) ?*

4. **Le portail est-il un blocage purement frontend, ou faut-il un durcissement serveur ?**
   Aujourd'hui, rien n'empêche techniquement un appel API direct (hors UI) d'agir sur une réservation même si le shift n'est pas démarré — le portail est une convention UX, pas une barrière RBAC. Un contournement (poste non démarré mais API utilisée directement, ex. Postman) resterait possible.
   *→ Question à trancher : accepter ce niveau de garantie (cohérent avec le reste du projet — CH-011 gating RBAC frontend était déjà volontairement "onglet entier côté UI, jamais une barrière de sécurité", RD-009), ou exiger un middleware serveur bloquant certaines routes tant qu'aucun shift n'est actif (portée bien plus large, à chiffrer séparément si retenu) ?*

5. **`poste` déclaratif ou réel planning ?**
   Le cadrage propose un champ auto-déclaré par l'employé (aucune vérité de planning). Un vrai système de planification des rotations (qui doit être de service quand) est un chantier à part entière, largement hors périmètre de cette demande.
   *→ Question à trancher : confirmer que la déclaration libre suffit pour cette itération (pas de roster imposé) ?*

6. **Régularisation signalée : qui la traite, et sous quel délai ?**
   Le cadrage renvoie vers l'écran RH existant/étendu (§9.4) sans SLA ni notification proactive (pas de système de notification interne pour RH dans ce projet, à la différence de `notifications` qui cible les clients).
   *→ Question à trancher : une notification email RH (réutilisant `NotificationsService`) est-elle nécessaire dès qu'une anomalie est signalée, ou la consultation périodique de l'écran suffit ?*

## 12. Proposition d'intégration réaliste

Découpage en sous-chantiers indépendants, dans l'ordre recommandé (§ « Ordre recommandé »), chacun livrable et testable seul :

- **A. Modèle de données** — migration Prisma (`motifFin`, `commentaireFin`, `poste`), aucune régression sur l'existant (colonnes nullables).
- **B. Backend — motif de clôture** — `terminer()`/`mettreEnPause()` acceptent un `motif`/`commentaire` optionnels (rétrocompatible : un appel sans motif reste valide, juste moins renseigné — évite de casser `AttendanceWidget` existant tant que le frontend n'est pas mis à jour).
- **C. Frontend — `ShiftGatePage`** — nouveau portail post-login, câblé dans `App.tsx` juste après `isAuthenticated`.
- **D. Frontend — `ShiftCloseDialog`** — remplace `LogoutGuardDialog`, motif enrichi.
- **E. Backend + Frontend — reporting** — `GET /reporting/attendance-summary`, écran de supervision RH.
- **F. (optionnel, si arbitrage §11.4 le confirme) Durcissement serveur** — hors périmètre v1 par défaut.

## Estimation de charge (ordre de grandeur, développement pur)

| Sous-chantier | Estimation |
|---|---|
| A. Migration + modèle de données | 0,5 j |
| B. Backend motif/commentaire | 0,5–1 j |
| C. `ShiftGatePage` (portail bloquant) | 1–1,5 j |
| D. `ShiftCloseDialog` enrichi | 0,5 j |
| E. Reporting + écran supervision | 1–1,5 j |
| F. Durcissement serveur (si retenu) | 1–2 j supplémentaires, à confirmer |
| Tests e2e (nouveaux scénarios réels, vraie base MySQL) | 1 j |
| **Total (hors F)** | **~4,5–6 j développeur** |

*Nettement plus contenu qu'un module construit de zéro, précisément parce que le socle ADR-007 est déjà solide et réutilisé intégralement.*

## Ordre recommandé d'implémentation

1. Trancher les 6 arbitrages de la section 11 (bloquant — surtout #2 et #4, qui changent la portée).
2. A → B (modèle de données + backend, testable en e2e indépendamment du frontend).
3. D (enrichir `ShiftCloseDialog` — risque faible, améliore immédiatement l'existant).
4. C (`ShiftGatePage` — le changement de parcours utilisateur le plus visible, à tester en conditions réelles avec au moins un scénario de reconnexion après coupure).
5. E (reporting/supervision — peut suivre indépendamment, aucune dépendance dure sur C/D).
6. F seulement si explicitement demandé après validation de la v1.

---

*Ce document est un cadrage, pas une ADR validée. S'il est adopté après arbitrage, il devrait être formalisé comme un amendement à ADR-007 (pas une nouvelle ADR séparée, puisqu'il étend directement la même machine à états) avant le premier commit de code.*
