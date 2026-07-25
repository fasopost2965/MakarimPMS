# Note de cadrage — Personnel, Planning des shifts & Pointage (Planning & Attendance)

*Statut : **cadrage validé en principe, non implémenté** — chantier de suivi [`CH-027`](/docs/governance/REGISTRE_CHANTIERS.md) (`REGISTRE_CHANTIERS.md`). L'utilisateur a tranché la majorité des arbitrages de la section 11 (voir §13 « Arbitrages tranchés » ci-dessous et [`RD-017`](/docs/governance/REGISTRE_DECISIONS.md)) ; quelques points ponctuels restent ouverts (§13, deuxième tableau) sans remettre en cause le principe général. Élargit et remplace le périmètre de `CADRAGE_SESSION_TRAVAIL_STAFF.md` (conservé pour référence, notamment §7/§9 de ce document qui en reprennent directement le contenu déjà validé côté conception). **Le code n'a volontairement pas démarré** : le timing d'insertion dans la file de développement reste à discuter avec l'utilisateur (dépend des chantiers déjà ouverts/planifiés — voir `docs/governance/BACKLOG_PRIORISE.md`, section « Chantiers cadrés en attente de priorisation »). Ne bloque et ne conditionne aucun des chantiers en cours.*

## 0. Constat préalable — existant / à étendre / à créer

Trois découvertes structurantes, faites en lisant le code et les documents de référence avant d'écrire une seule ligne de ce cadrage :

1. **Le référentiel du personnel existe, mais incomplet à un point bloquant.** `Employee` (module `hr`) référence un `User` déjà créé — mais **aucune route, aucun écran, ne permet de créer un `User`** nulle part dans l'application. Les 6 comptes de dev n'existent que via `prisma/seed.ts`. Aujourd'hui, ajouter un 4ᵉ réceptionniste réel nécessite un accès direct à la base de données. C'est le vrai chaînon manquant de « référentiel du personnel », pas un détail.
2. **Le planning prévisionnel a déjà été spécifié — dans le cahier des charges d'origine — mais jamais construit.** `BUSINESS_RULES.md` documente `BR-RH-001` (paie) et surtout **`BR-RH-002` : « Validation des Échanges de Shifts (Planning) »**, qui mentionne déjà un champ `echangeDemande` et une validation `valideParId`. `DATA_DICTIONARY.md` l'admet explicitement : *« Aucun de ces modèles ou tables n'existe physiquement dans le schéma Prisma actuel. »* Ce que demande cet élargissement de cadrage n'est donc pas une improvisation — c'est la réalisation d'une brique déjà actée dans la spec d'origine, restée en jachère.
3. **Ce qui a été construit depuis (ADR-007, `TimeShift`/`TimeShiftSegment`) est le pointage RÉEL, pas le planning PRÉVU.** Les deux notions ont été nommées de façon proche (« shift ») dans deux documents différents, à des moments différents, sans jamais être reliées. Ce cadrage doit lever cette ambiguïté terminologique dès le départ (§2).

| Dimension | Existe déjà | À étendre | À créer |
|---|---|---|---|
| Référentiel personnel | `Employee`, `User`, `Role` (RBAC) | `Employee` (champs optionnels : poste/téléphone, arbitrage §11) | Flux de provisioning composite (`User` + `Employee` en un geste) |
| Planning des shifts | *(rien)* | — | `ShiftPlan` (nouvelle entité), écran agenda |
| Pointage réel | `TimeShift`/`TimeShiftSegment`, `AttendanceService`, portail de connexion (cadrage précédent, non encore implémenté) | Motif de clôture, `poste` déclaré (déjà proposé, cadrage précédent) | *(rien de plus)* |
| Supervision/reporting | `AttendanceHistorySection` (liste brute par employé) | — | Comparaison prévu/réel, dashboard manager, `reporting:attendance-summary` |

## 1. Reformulation métier consolidée

L'hôtel a besoin d'un cycle RH complet à trois temps, aujourd'hui seul le temps 3 est partiellement outillé :

1. **Constituer l'équipe** : savoir qui travaille à l'hôtel, avec quel accès PMS, quel rôle, quelles informations de contact — *référentiel*.
2. **Planifier à l'avance** : décider qui doit être présent quand, par poste (matin/soir/nuit), pour couvrir l'activité de l'hôtel — *planning*.
3. **Constater ce qui s'est réellement passé** : qui a réellement pointé, quand, avec quelle fidélité au planning — *exécution*, déjà couvert par ADR-007.

Le besoin métier final n'est pas seulement d'avoir ces trois temps outillés séparément, mais de pouvoir les **rapprocher** : un manager doit voir en un coup d'œil l'écart entre ce qui était prévu et ce qui a eu lieu, sans ressaisie ni reconstitution manuelle.

## 2. Trois notions à ne jamais confondre

| Notion | Entité technique | Répond à la question | Peut exister sans les autres ? |
|---|---|---|---|
| **Membre du personnel** | `Employee` | « Qui travaille ici, contractuellement ? » | Oui — une fiche RH peut exister pour quelqu'un en congé longue durée, sans connexion PMS active un temps donné (`Employee.actif=false`) |
| **Compte utilisateur PMS** | `User` | « Qui peut se connecter, et avec quel rôle RBAC ? » | Non en pratique dans ce projet — `Employee.userId` est obligatoire et unique ; il n'existe pas de personnel « fantôme » sans compte, par choix architectural déjà en place, pas quelque chose que ce cadrage remet en cause |
| **Shift planifié** | `ShiftPlan` *(nouveau)* | « Qui est attendu, sur quel créneau, pour quel poste ? » | Oui — un planning peut être publié avant qu'un pointage n'ait lieu, et un pointage réel (`TimeShift`) peut exister sans aucun planning correspondant (ex. renfort de dernière minute, walk-in RH non planifié) |
| **Shift réel (pointage)** | `TimeShift`/`TimeShiftSegment` | « Qui a réellement travaillé, et combien de temps ? » | Oui — déjà le cas aujourd'hui, c'est tout ce qui existe |

Le rapprochement §8 est un **calcul de lecture**, jamais une fusion des tables : `ShiftPlan` et `TimeShift` restent deux entités indépendantes, reliées seulement par `employeeId` + chevauchement temporel (et optionnellement un lien explicite une fois le rapprochement fait, voir §4).

## 3. Place dans les modules existants

Aucun nouveau module de premier niveau. Le domaine reste `hr` (cohérent avec `docs/modules/hr.md` §1, qui décrit déjà — texte non implémenté jusqu'ici — *« La planification des Shifts d'équipes opérationnelles »* comme faisant partie du périmètre du module). Découpage interne proposé, par souci de lisibilité du code, sans changer les frontières RBAC/module :

- `hr/employees.*` — référentiel personnel (existant, à étendre).
- `hr/attendance.*` — pointage réel (existant, ADR-007, inchangé).
- `hr/shift-plans.*` *(nouveau)* — planning prévisionnel.
- `hr/payroll.*` — paie (existant, inchangé, aucun impact).

`reporting` gagne une nouvelle façade de lecture seule (comme proposé dans le cadrage précédent, étendue ici pour intégrer `ShiftPlan`), toujours sans Prisma direct hors de `hr`/`reporting` lui-même (même convention que `FinancialReportingService`/`YieldManagementService`, lecture cross-domaine directe assumée pour ce type d'agrégat).

## 4. Proposition de modèle de données

```prisma
// Réutilisé tel quel : User, Role, RolePermission, Permission, Employee (étendu ci-dessous)

model Employee {
  // ... champs existants inchangés (userId, matriculeCnss, salaireBase, dateEmbauche, actif) ...
  poste       Poste?    // MATIN/SOIR/NUIT/AUTRE — poste habituel, simple indication par défaut
                         // pour préremplir le planning, jamais une contrainte dure (voir §11.1)
  telephone   String?   // absent aujourd'hui d'Employee ET de User — utile pour joindre
                         // un employé au sujet d'un changement de planning (arbitrage §11.5)
  shiftPlans  ShiftPlan[]
}

// Même enum que proposé dans le cadrage précédent pour TimeShift.poste — partagé entre
// planning et pointage réel, condition nécessaire pour le rapprochement par poste (§8).
enum Poste {
  MATIN
  SOIR
  NUIT
  AUTRE
}

// LE nouvel objet central de ce cadrage — réalise BR-RH-001/002 (jamais construit).
model ShiftPlan {
  id            Int             @id @default(autoincrement())
  employeeId    Int
  employee      Employee        @relation(fields: [employeeId], references: [id])
  // Date+heure complètes (pas une simple date) : un shift peut chevaucher minuit
  // (veilleur de nuit), même logique de "shift à cheval" que TimeShift (ADR-007 §6.2).
  debutPrevu    DateTime
  finPrevue     DateTime
  poste         Poste
  statut        StatutShiftPlan @default(PLANIFIE)
  // Managérial, jamais l'employé lui-même (voir RBAC §11.4) — trace qui a publié/modifié
  // ce créneau, distinct de creePar sur d'autres entités du projet par cohérence de nommage.
  planifieParId Int
  notes         String?
  // Rempli a posteriori par le calcul de rapprochement (§8) — jamais par une saisie
  // manuelle, jamais modifiable directement (write-once, uniquement via le job de
  // rapprochement ou explicitement remis à null si le TimeShift lié est lui-même annulé).
  timeShiftId   Int?
  timeShift     TimeShift?      @relation(fields: [timeShiftId], references: [id])
  createdAt     DateTime        @default(now())
  // Non-suppression physique (ADR-005, même convention que Reservation/TimeShift) —
  // annuler un créneau publié à un employé doit rester traçable, jamais un DELETE muet.
  deletedAt     DateTime?

  @@index([employeeId, debutPrevu])
  @@index([deletedAt])
}

enum StatutShiftPlan {
  PLANIFIE          // publié par un manager, pas encore commencé
  CONFIRME          // accusé de réception employé — optionnel, voir arbitrage §11.2
  ANNULE            // retiré du planning après publication (motif obligatoire → AuditLog)
}

// TimeShift existant : ajout d'un seul champ, pas de nouvelle relation obligatoire
// (le lien se fait depuis ShiftPlan.timeShiftId, jamais l'inverse, pour qu'un TimeShift
// reste valide et complet même sans aucun planning associé — cas du renfort imprévu).
```

**Ce qui n'est délibérément pas proposé** : une table de « comparaison » matérialisée (ex. `AttendanceReview`). Le rapprochement prévu/réel est un calcul, pas un état stocké — cohérent avec `INV-REP-001` (le module `reporting` reste strictement consultatif dans ce projet, déjà appliqué à F3 Yield Management) et évite une source de vérité dupliquée qui se désynchroniserait de `TimeShift`/`ShiftPlan` à la moindre correction RH.

## 5. Proposition d'écran de gestion du personnel

Extension de `EmployeesSection` (`HrPage.tsx`) plutôt qu'un nouvel écran isolé :

1. **Formulaire « Ajouter un membre du personnel »** (remplace le formulaire actuel qui exige un `userId` numérique tapé à la main) : nom, prénom (si le champ `User.nom` est éclaté — actuellement un champ unique, voir arbitrage §11.6), email, mot de passe (généré automatiquement, jamais saisi en clair par le manager — email de bienvenue via `NotificationsService`, réutilisant l'infrastructure déjà en place), rôle RBAC (`Role`), poste habituel, téléphone, date d'embauche, salaire de base. Un seul geste crée `User` + `Employee` dans la même transaction.
2. **Liste enrichie** : nom, rôle, poste habituel, statut actif/inactif, ancienneté — déjà presque tout affiché aujourd'hui, ajoute juste le poste.
3. **Fiche détail par employé** (nouveau, aujourd'hui il n'y a que la liste) : coordonnées, historique de pointage (réutilise `AttendanceHistorySection` existant tel quel), et **planning à venir** (nouveau, lecture de `ShiftPlan` filtrée sur cet employé).

## 6. Proposition d'écran planning / agenda des shifts

Nouvel onglet ou nouvelle section dans `HrPage.tsx` (à trancher selon la charge visuelle de la page actuelle — possiblement un onglet dédié dans `AppSidebar`, cohérent avec la granularité « onglet entier » déjà retenue pour le gating RBAC frontend, RD-009) :

- **Trois vues** : Jour (une colonne par employé, créneaux empilés), Semaine (grille jours × employés, la plus utile au quotidien), Mois (vue compacte, densité de couverture par jour, pas le détail créneau par créneau).
- **Création d'un créneau** : formulaire simple (employé, date, heure début/fin, poste, notes) — v1 volontairement sans glisser-déposer (confort, pas un bloquant, cohérent avec « pas un ERP RH géant »).
- **Filtres** : par rôle/poste/employé — utile dès que l'effectif dépasse une poignée de personnes affichées simultanément.
- **Code couleur par poste** (matin/soir/nuit/autre), cohérent avec les puces de statut déjà utilisées ailleurs dans l'UI (`STATUT_BADGE_VARIANT` en housekeeping, même langage visuel).
- **Superposition optionnelle du réel** (§8) : une fois le rapprochement disponible, chaque créneau planifié affiche un indicateur (conforme / retard / absence / dépassement) sans changer de vue.

## 7. Portail de pointage au login (reprend le cadrage précédent)

Le design complet (`ShiftGatePage`, `ShiftCloseDialog`, motifs de clôture, seuil de régularisation) reste celui déjà produit dans `CADRAGE_SESSION_TRAVAIL_STAFF.md` §9, **inchangé par cet élargissement** — un seul enrichissement direct découle de l'existence de `ShiftPlan` : l'écran « Démarrer mon service » peut désormais afficher *« Vous êtes planifié aujourd'hui de 08h à 15h (poste Matin) »* quand un `ShiftPlan` du jour existe pour l'employé connecté, en lisant simplement le planning du jour à l'ouverture du portail. Aucun blocage nouveau : un employé sans créneau planifié peut toujours démarrer un service (le planning est indicatif pour la couverture d'équipe, jamais une contrainte technique bloquant un pointage réel légitime — un remplacement de dernière minute doit toujours pouvoir pointer).

## 8. Logique de comparaison planning prévu / présence réelle

Calcul de lecture seule (jamais une écriture), exécuté à la demande (à l'ouverture de l'agenda ou du dashboard, pas un job périodique qui matérialiserait un état) :

Pour chaque `ShiftPlan` d'une période donnée :
1. Chercher un `TimeShift` du même `employeeId` dont l'intervalle `[startedAt, endedAt ?? maintenant]` chevauche `[debutPrevu, finPrevue]`.
2. Dériver un statut d'affichage (jamais persisté, recalculé à chaque lecture) :
   - **À venir** : `debutPrevu` dans le futur.
   - **En cours** : chevauchement partiel, `TimeShift` encore `ACTIF`/`EN_PAUSE`.
   - **Conforme** : `TimeShift` trouvé, démarré dans une tolérance de N minutes après `debutPrevu` (proposition : 15 min, à trancher §11.7) et couvrant la majorité du créneau.
   - **Retard** : `TimeShift` trouvé mais démarré après la tolérance.
   - **Absence** : `finPrevue` dépassée, aucun `TimeShift` chevauchant trouvé.
   - **Dépassement** : `TimeShift` significativement plus long que `finPrevue` (utile pour repérer une charge de travail anormale, pas seulement des manquements).
3. Une fois un rapprochement jugé définitif (le `TimeShift` est `TERMINE`), le lien peut être écrit dans `ShiftPlan.timeShiftId` — seule écriture de ce mécanisme, purement pour accélérer les lectures futures (cache), jamais une décision qualifiée « en faute » automatiquement enregistrée sans revue humaine (voir §10).

## 9. Rapports et tableaux de bord utiles au manager

- **`GET /reporting/attendance-summary`** (déjà proposé au cadrage précédent §10) étendu : par employé/période, heures planifiées vs heures réellement travaillées, taux de ponctualité, nombre d'absences/retards/dépassements.
- **Vue agenda en mode « réel »** (§6, superposition) : la même grille que le planning, code couleur d'anomalie plutôt que par poste — vue de supervision rapide sans changer d'écran.
- **Export CSV** (même convention que les autres écrans `reporting` — `PoliceRegister`, `FinancialReporting`).
- Une tuile optionnelle sur le dashboard général (Administrateur/RH) : nombre d'anomalies non revues sur les 7 derniers jours — cosmétique, non bloquant pour la v1.

## 10. Impacts sur l'audit log

- Toute création/modification/annulation d'un `ShiftPlan` déjà publié à un employé : nouvelle entrée `AuditLog` (`CREATE_SHIFT_PLAN`/`UPDATE_SHIFT_PLAN`/`CANCEL_SHIFT_PLAN`), motif obligatoire pour une modification ou annulation a posteriori (cohérent avec la rigueur déjà appliquée à `ajusterSegment`, ADR-007 §6.4/INV-TSH-004) — un planning déjà communiqué à un employé ne doit jamais changer silencieusement.
- **Le calcul de rapprochement lui-même n'écrit jamais d'audit** : c'est une lecture, et une lecture n'est pas un événement métier au sens d'ADR-005. Seule l'écriture ponctuelle du cache `ShiftPlan.timeShiftId` (§8, point 3) n'a pas besoin d'audit non plus — c'est une optimisation technique dérivée, pas une décision.
- **Garde-fou explicite à documenter** : le système affiche des statuts d'anomalie (retard/absence), mais ne qualifie jamais automatiquement un employé de « fautif » de façon persistée et opposable sans revue humaine — un retard affiché reste une donnée descriptive, pas une sanction. Si une conséquence RH doit être tracée (avertissement, ajustement de paie), elle continue de passer par les mécanismes déjà existants (ajustement RH audité, ou hors PMS).

## 11. Arbitrages produit à trancher

Repris et complétés par rapport au cadrage précédent (les 6 arbitrages de `CADRAGE_SESSION_TRAVAIL_STAFF.md` §11 restent valides et non redondants avec ceux-ci — ils portent sur le portail de connexion, pas sur le planning).

1. **« Poste » = rôle RBAC réutilisé, ou notion distincte ?** Ce cadrage propose un enum `Poste` (MATIN/SOIR/NUIT/AUTRE) séparé du `Role` RBAC (Réception/Gouvernante/...) — un même rôle RBAC peut couvrir plusieurs postes (deux réceptionnistes, l'un du matin, l'autre du soir). *À confirmer : cette séparation est-elle utile, ou le rôle RBAC suffit-il comme unique granularité de planification ?*
2. **Confirmation employé du planning ?** `StatutShiftPlan.CONFIRME` suppose un geste employé (accusé de réception, éventuellement depuis le portail de connexion §7). *À trancher : nécessaire dès la v1, ou un planning simplement « publié » sans étape d'acquittement suffit-il pour un effectif de cette taille ?*
3. **Échange de shift (BR-RH-002 d'origine)** : la demande initiale du cahier des charges prévoyait un flux `echangeDemande`/validation manager. *À trancher : ce cadrage v1 se limite-t-il à la création/modification de planning par un manager (option retenue par défaut), ou faut-il aussi un flux self-service où un employé propose un échange à valider ?* (Ce dernier ajoute une charge notable — proposé comme v2 si retenu.)
4. **Granularité RBAC** : aujourd'hui `hr:read`/`hr:write` couvrent indifféremment paie et planning. *À trancher : un responsable Housekeeping doit-il pouvoir planifier son équipe sans avoir accès à la paie de tout l'hôtel (nécessiterait `hr:planning:write` distinct), ou le rôle RH/Administrateur reste-t-il seul à publier tout planning pour cette v1 ?*
5. **Provisioning composite (§5)** : création `User`+`Employee` en un seul geste, avec mot de passe généré envoyé par email. *À confirmer : ce flux est-il prioritaire dès cette itération (débloque le vrai chaînon manquant identifié en §0), ou le contournement actuel (créer le `User` hors PMS) reste-t-il acceptable encore un temps ?*
6. **`User.nom` unique vs `nom`/`prenom` séparés** : le champ actuel est un `String` unique. L'écran enrichi (§5) suppose implicitement nom/prénom distincts pour un formulaire propre. *À trancher : migration de `User.nom` en deux champs (impact sur tous les affichages existants du projet), ou rester sur un champ unique avec une convention de saisie (« Nom Prénom ») ?*
7. **Tolérance de « conformité »** (§8, 15 minutes proposées) — *à confirmer ou ajuster selon la réalité opérationnelle de l'hôtel.*

## 12. Ordre recommandé d'implémentation

1. Trancher les arbitrages ci-dessus (bloquant — #1, #4, #5, #6 changent la portée réelle) et ceux du cadrage précédent si le portail de connexion est mené en parallèle.
2. **A. Modèle de données** — migration `ShiftPlan` + enum `Poste`/`StatutShiftPlan` + extension `Employee` (poste/téléphone selon arbitrage #1/#5).
3. **B. Provisioning composite** (§5, arbitrage #5) — débloque le référentiel personnel réel, indépendant du reste.
4. **C. Backend planning** — CRUD `ShiftPlan` (`POST/GET/PATCH/DELETE /rh/shift-plans`), RBAC selon arbitrage #4, audit selon §10.
5. **D. Frontend référentiel personnel enrichi** (§5) — dépend de B.
6. **E. Frontend agenda planning** (§6) — le morceau le plus volumineux, dépend de C. Commencer par la vue Semaine (la plus utile), Jour/Mois ensuite.
7. **F. Rapprochement prévu/réel** (§8) — dépend de C, purement additif, testable indépendamment de E (peut d'abord exister comme un endpoint sans UI).
8. **G. Portail de connexion enrichi** (§7) — dépend de F pour l'affichage « vous êtes planifié aujourd'hui », sinon indépendant (le cadrage précédent peut être livré avant, sans ce complément).
9. **H. Reporting/dashboard manager** (§9) — dépend de F, peut suivre en dernier sans bloquer le reste.

## Estimation de charge (ordre de grandeur, développement pur)

| Sous-chantier | Estimation |
|---|---|
| A. Modèle de données | 1 j |
| B. Provisioning composite | 1–1,5 j |
| C. Backend planning (CRUD + RBAC + audit) | 1,5–2 j |
| D. Frontend référentiel enrichi | 1 j |
| E. Frontend agenda planning (3 vues) | 2,5–3 j |
| F. Rapprochement prévu/réel | 1–1,5 j |
| G. Portail de connexion enrichi (complément) | +0,5 j *(le socle est déjà chiffré séparément, ~4,5–6 j, cadrage précédent)* |
| H. Reporting/dashboard | 1–1,5 j |
| Tests e2e (vraie base MySQL, scénarios réels) | 1,5 j |
| **Total (hors socle du portail de connexion déjà chiffré séparément)** | **~11–13,5 j développeur** |
| **Total combiné avec le portail de connexion (cadrage précédent inclus)** | **~15,5–19,5 j développeur** |

## Réponse à la question de fond posée

*« Simple prolongement du module `hr` existant, ou sous-module dédié “Planning & Attendance” ? »*

**Recommandation : un sous-domaine interne au module `hr` (`hr/shift-plans/*`), pas un nouveau module de premier niveau.** `ShiftPlan` dépend structurellement d'`Employee` (déjà dans `hr`), le pointage réel avec lequel il se compare est déjà dans `hr` (ADR-007), et la charte de dépendances du projet (`docs/DEPENDENCY_GRAPH.md`) n'a pas de précédent de module scindé pour une simple raison de taille fonctionnelle — `guests`/`companies` et `stay`/`checkin` restent délibérément regroupés dans des cas similaires. Un nouveau module top-level ajouterait une frontière RBAC et une charge de coordination sans bénéfice réel pour un hôtel de cette taille — cohérent avec la contrainte explicite *« pas un ERP RH géant »*.

## 13. Arbitrages tranchés (session courante) et points encore ouverts

Voir `REGISTRE_DECISIONS.md` (RD-017) pour la version consignée formellement de ce qui suit.

### 13.1 Tranchés — le principe du cadrage est validé sur ces points

| # (§11) | Point | Décision |
|---|---|---|
| §11.5 | Provisioning composite | Confirmé prioritaire : un seul geste crée `User` + `Employee` (§5). |
| — | `Employee.userId` obligatoire | Confirmé : pas de personnel « fantôme » sans compte PMS, aucun changement par rapport à l'existant (§2). |
| §11.1 | Enum `Poste` | Introduit tel que proposé (MATIN/SOIR/NUIT/AUTRE) — indication par défaut pour préremplir le planning, **jamais** une contrainte dure empêchant un employé de travailler exceptionnellement sur un autre poste. |
| — | `Employee.telephone` | Confirmé — pour joindre le staff au sujet du planning. |
| — | Séparation `ShiftPlan` (prévu) / `TimeShift` (réel) | Confirmée telle que proposée (§2, §4) — le rapprochement (§8) reste un calcul de lecture, jamais une fusion ou une table matérialisée. |
| §11.4 (partiel) | Module | Confirmé : le domaine reste `hr`, découpage interne `hr/employees`, `hr/attendance`, `hr/shift-plans`, `hr/payroll` (§3) retenu tel quel comme organisation de code. |
| — | Reporting | Confirmé dans le principe (résumé attendance : heures prévues vs réelles, absences/retards/anomalies, lecture seule) — **mais l'implantation proposée en §3/§9 (`GET /reporting/attendance-summary`, sous le module `reporting`) est en conflit avec une règle déjà gelée** (voir §13.2 ci-dessous, point bloquant nouvellement identifié).

### 13.2 Point bloquant nouvellement identifié en relisant la doc gelée (pas un des 7 arbitrages listés en §11 d'origine)

**Conflit de dépendance `reporting` → `hr`.** `docs/modules/reporting.md` §11 (« Dépendances interdites ») est explicite et déjà gelé : *« `hr` : Le module de reporting hôtelier n'accède pas aux fiches de paie ou au pointage des équipiers de ménage. Justification : Ségrégation absolue des données d'exploitation commerciale et de la confidentialité de la paie RH. »* — la RBAC de `reporting` (`reporting:read`, réservé à Administrateur/Comptable, cf. `reporting.md` §7) est en outre disjointe de celle de `hr` (`hr:read`/`hr:write`, réservée à Administrateur/RH). Proposer `GET /reporting/attendance-summary` violerait donc directement cette frontière gelée. Trois options concrètes :

1. **(Recommandée)** Garder la façade côté `hr` — par exemple `GET /hr/attendance-summary` (`hr:read`) plutôt que sous `reporting`. Respecte `reporting.md` §11 sans y toucher, cohérent avec le fait que seuls Administrateur/RH ont légitimement besoin de ce résumé (un Comptable n'a pas de raison métier de voir qui est en retard). Coût : zéro changement sur un document déjà gelé.
2. Amender `docs/modules/reporting.md` §11 pour ajouter une dérogation documentée (même famille que le carve-out déjà accepté pour `housekeeping` → `reservations`/`stay` en lecture seule, `CLAUDE.md` §Architecture backend) — nécessiterait une nouvelle exception explicite au référentiel gelé, avec la justification correspondante, avant tout code.
3. Dupliquer le calcul dans les deux modules (un exposé `hr:read` pour RH/Admin, un second exposé `reporting:read` pour Comptable/Admin, tous deux appelant la même fonction utilitaire pure sans dépendance de module à module) — évite le conflit de dépendance mais ajoute une route et une décision RBAC supplémentaires pour un besoin non exprimé (aucune demande de visibilité côté Comptable dans le brief).

Sans arbitrage explicite de l'utilisateur, l'option 1 est celle retenue par défaut si ce sous-lot (H, §12) est un jour entrepris — elle ne casse aucune règle déjà gelée et couvre le besoin exprimé (visibilité manager/RH).

### 13.3 Encore ouverts (§11 d'origine, non tranchés par l'utilisateur cette session)

Ces points ne bloquent pas le principe général déjà validé, mais bloquent le premier commit de code des sous-lots qu'ils concernent (C, E, F selon le point) :

| # | Point | Options concrètes |
|---|---|---|
| §11.2 | `StatutShiftPlan.CONFIRME` (accusé de réception employé) | (a) Retenir dès la v1 (ajoute un geste employé, cohérent avec §7 portail de pointage) · (b) Différer en v2, planning simplement « publié » sans acquittement (plus simple, suffisant pour un effectif de cette taille) |
| §11.3 | Échange de shift self-service (BR-RH-002 d'origine) | (a) v1 = création/modification par un manager uniquement (option par défaut du cadrage) · (b) v1 inclut un flux `echangeDemande`/validation manager dès le départ (charge notable en plus, cf. estimation §12) |
| §11.4 (RBAC fine) | `hr:planning:write` distinct de `hr:write` (paie) | (a) Rester sur `hr:read`/`hr:write` unique pour cette v1 (RH/Administrateur seuls à publier un planning) · (b) Introduire une permission dédiée `hr:planning:write` pour permettre à un responsable Housekeeping de planifier son équipe sans accès à la paie |
| §11.6 | `User.nom` unique vs `nom`/`prenom` séparés | (a) Conserver `nom` unique, convention de saisie « Nom Prénom » (zéro migration, zéro impact sur l'existant) · (b) Migrer en deux champs (formulaire plus propre, mais impacte tous les affichages existants du projet) |
| §11.7 | Tolérance de « conformité » (§8) | Paramètre opérationnel simple, non structurant — 15 minutes proposé par défaut, ajustable sans redéveloppement (constante de configuration, pas un arbitrage de conception) |

---

*Ce document est un cadrage, pas une ADR validée. S'il est adopté après arbitrage, il devrait être formalisé comme un amendement à ADR-007 (le pointage réel) accompagné d'un nouvel ADR dédié au planning prévisionnel si sa complexité le justifie (à évaluer une fois les arbitrages tranchés) — pas avant le premier commit de code.*
