# Sprint 001 — Plan d'implémentation

## 1. Identification

- Mission : `MISSION-0003`
- Périmètre : Dashboard, Clients, Réservations, Check-in
- Nature : audit technique et planification ; aucune décision fonctionnelle ou architecturale
- Référence UX : `docs/audit/01_FRONTEND_UX_AUDIT.md`, sections 4.2, 4.4, 4.6 et 4.8
- Référence du code analysé : branche `analysis/sprint-001-plan`, issue de `main` au commit `b6a9e58e827f24673db65a1239f573ceb0c2e13f`

## 2. Synthèse d'architecture

Le périmètre s'inscrit dans l'architecture existante : frontend React/Vite/TypeScript organisé par fonctionnalités, backend NestJS modulaire, accès MySQL par Prisma, API REST protégée par JWT, cookies HttpOnly, CSRF et permissions RBAC.

Les quatre modules ne forment pas quatre chantiers indépendants. Le flux métier est orienté dans le sens suivant :

`Clients → Réservations → Check-in/Séjour → Facturation/Paiements/Police → Check-out/Housekeeping`

Le Dashboard agrège plusieurs de ces domaines en lecture. Il ne doit donc pas devenir propriétaire de leurs règles métier.

### Composants frontend réutilisables

- socle UI : `Button`, `Input`, `Label`, `Badge`, `Dialog`, `Select`, `SelectSearch`, `Tabs`, `Toast`, `ErrorState`, `EmptyState`, `Skeleton` et `Table` ;
- sélection client : `GuestPicker` et `useDuplicateWarning`, déjà partagés entre Réservations et Check-in walk-in ;
- facturation et police : `BillingTabContent` et `PoliceRecordForm`, intégrés à `StayDetailsDialog` ;
- primitives Réservations : fonctions de dates, estimation tarifaire, types Chambre/Réservation et appels de liste des chambres ;
- widgets Dashboard : `RoomsToCleanWidget` et `OpenMaintenanceWidget`.

### Dépendances transverses et invariants

- `RoomNight` et sa contrainte unique `(roomId, date)` protègent les flux Réservations et Check-in contre la double occupation ;
- le statut BLACKLIST du `Guest` est contrôlé à la réservation et au walk-in ;
- le check-in depuis réservation reprend le prix final et la formule d'hébergement, crée le folio principal et impute les acomptes ;
- le check-out dépend du solde de tous les folios, des paiements, des notes Restaurant et de la permission dynamique `checkin:force-checkout` ;
- le check-out déclenche l'événement consommé par Housekeeping pour rendre la chambre à nettoyer ;
- les écritures sensibles passent par les services propriétaires et la journalisation existante ; aucune écriture directe ne doit contourner ces frontières.

## 3. Dashboard

### État actuel

Le frontend repose sur `DashboardPage`, `RoomsToCleanWidget` et `OpenMaintenanceWidget`. Il affiche le taux d'occupation, les arrivées et départs du jour, les chambres à nettoyer, l'encaissé du jour et des accès rapides vers les modules opérationnels.

Le backend expose un service d'agrégation en lecture. Il interroge directement Prisma sur `Room`, `Reservation`, `Stay` et `Payment` et calcule les indicateurs en parallèle. Le module n'exporte pas de service métier et ne modifie aucune donnée.

### Services et endpoints

| Méthode | Endpoint | Permission | Usage actuel |
|---|---|---|---|
| GET | `/dashboard/resume` | `dashboard:read` | KPI d'exploitation et encaissé du jour |
| GET | `/rooms` | permission Chambres existante | widget chambres à nettoyer |
| GET | endpoint Maintenance existant | permission Maintenance existante | widget interventions ouvertes |

### Modèles Prisma concernés

- principaux : `Room`, `Reservation`, `Stay`, `Payment` ;
- indirects : `MaintenanceTicket` via son module propriétaire.

### Écarts avec l'audit UX

Déjà couverts ou partiellement couverts : arrivées, départs, chambres à nettoyer, interventions ouvertes, taux d'occupation et montant encaissé quotidien. L'encaissé n'est pas équivalent au chiffre d'affaires journalier demandé par l'audit.

Écarts restant visibles : absence de personnalisation par rôle, absence d'indicateur explicite de chambres bloquées, pas de distinction claire des interventions urgentes, pas d'ADR, de RevPAR ni de widgets configurables. Les recommandations P3 de personnalisation complète et de glisser-déposer ne relèvent pas d'un premier incrément sans validation fonctionnelle.

### Ordre recommandé des développements

1. Faire valider par le Product Owner les indicateurs P1 exacts et leur visibilité par rôle ; ne pas déduire les profils à partir des seules permissions.
2. Réutiliser d'abord les données et widgets existants pour améliorer les états de chargement, d'erreur et la lisibilité des priorités.
3. Si les données manquent, étendre de façon additive le contrat `/dashboard/resume`, en conservant le Dashboard comme agrégateur en lecture.
4. Ajouter les tests du contrat et des widgets concernés avant d'envisager les indicateurs financiers P2.

### Risques techniques

- divergence sémantique entre encaissé, chiffre d'affaires, ADR et RevPAR ;
- requêtes agrégées supplémentaires coûteuses si elles ne sont pas bornées dans le temps ;
- duplication de règles appartenant à Maintenance, Chambres ou Reporting ;
- affichage d'un widget sans permission sur son module source.

### Dépendances

Chambres, Réservations, Séjours, Paiements, Maintenance, Reporting et RBAC.

### Complexité

**M** pour l'incrément P1 après validation de la définition des indicateurs. Les indicateurs financiers et la personnalisation configurable constitueraient un lot distinct de complexité **L**.

## 4. Clients

### État actuel

Le module frontend `guests` fournit liste, recherche temporisée, création, consultation, modification des préférences et changement de catégorie. La fiche affiche déjà l'historique des séjours, les factures et l'ancienneté du client. `GuestPicker` permet de sélectionner un client existant ou d'en préparer un nouveau dans les flux Réservations et Check-in.

Le backend `GuestsModule` regroupe clients et entreprises, importe Audit et Billing, et exporte `GuestsService`. La recherche est limitée à 20 résultats ; sans critère, elle retourne les plus récents. La détection email/téléphone avertit sans bloquer, tandis que l'unicité de la pièce d'identité est protégée par un index aveugle. Les changements de catégorie sont transactionnels et audités.

### Services et endpoints

| Méthode | Endpoint | Permission | Usage actuel |
|---|---|---|---|
| GET | `/guests?q=` | `guests:read` | liste et recherche partagée |
| POST | `/guests` | `guests:write` | création |
| GET | `/guests/check-duplicate` | `guests:read` | avertissement email/téléphone |
| GET | `/guests/:id` | `guests:read` | détail |
| PATCH | `/guests/:id` | `guests:write` | modification |
| PATCH | `/guests/:id/categorie` | `guests:write`, et `guests:blacklist` selon transition | catégorie et blacklist |
| GET | `/guests/:id/historique` | `guests:read` | historique des séjours |
| GET | `/guests/:id/factures` | `guests:read` | factures liées aux folios |

### Modèles Prisma concernés

- principaux : `Guest`, `GuestCategoryLog` ;
- liés : `Reservation`, `Stay`, `PoliceRecord`, `Folio`, `Invoice` et `NotificationLog` ;
- voisin mais non rattaché aux séjours : `Company` et `CompanyContact`.

### Écarts avec l'audit UX

L'audit sous-estime certains acquis : historique des séjours, factures, préférences, identité et catégories sont déjà visibles ou disponibles. L'historique n'est toutefois pas une chronologie unifiée : réservations annulées, dépenses, changements de catégorie et événements ne sont pas consolidés.

La recherche reste limitée à 20 résultats sans pagination, tri ni filtres avancés. Les préférences sont du texte libre. Les langues, anniversaires, habitudes structurées, documents joints, alertes internes, fidélité et scoring ne sont pas modélisés. Leur ajout ne peut pas être considéré comme une simple correction UX : il nécessite des décisions métier, de sécurité et de conservation des données.

### Ordre recommandé des développements

1. Corriger en premier les lacunes d'expérience qui réutilisent les contrats actuels : responsive, états erreur/vide/chargement et lisibilité de la fiche.
2. Consolider l'affichage des données existantes sans inventer de nouveaux champs métier.
3. Faire valider le contenu exact de l'« historique chronologique complet » et les règles de visibilité avant toute extension API.
4. Traiter recherche paginée, préférences structurées, documents et fidélité dans des lots séparés avec analyse Prisma, RBAC, audit et protection des données.

### Risques techniques

- l'enrichissement de la fiche peut provoquer des requêtes multiples et des chargements partiellement échoués ;
- une chronologie transverse peut dupliquer les calculs de Réservations, Billing ou Audit ;
- les documents d'identité exigent chiffrement, contrôle d'accès, traçabilité et politique de conservation ;
- toute modification du statut BLACKLIST a un impact direct sur Réservations et Check-in ;
- l'ajout de champs structurés implique une migration additive et une compatibilité des DTO/API.

### Dépendances

Réservations, Séjours, Billing/Facturation, Police, Notifications, Audit et RBAC. `GuestPicker` est une dépendance frontend directe de Réservations et du walk-in.

### Complexité

**M** pour un incrément UX fondé sur les données existantes. Une chronologie transverse est **L** ; documents, préférences structurées ou fidélité sont **XL** tant que les règles métier ne sont pas validées.

## 5. Réservations

### État actuel

Le frontend propose un calendrier chambres/jours, la création depuis une plage sélectionnée, la modification par glisser-déposer, l'annulation, le détail, l'estimation tarifaire et le self check-in. Le dialogue de création réutilise `GuestPicker`, les types de chambre, les chambres, la formule et l'estimation de prix.

Le backend centralise disponibilité, tarification saisonnière, restrictions de vente, création, modification, annulation et no-show dans `ReservationsService`. Il dépend de Clients, Chambres, Paramètres et Audit. La réservation et ses `RoomNight` sont créées en transaction ; l'unicité en base protège la concurrence. Un événement de confirmation est émis après succès.

Le prix manuel à la création révèle une limite de contrat : le frontend crée d'abord la réservation puis envoie un `PATCH` d'ajustement. Si le second appel échoue, la réservation existe avec le prix calculé. Ce comportement est explicitement signalé à l'utilisateur mais n'est pas atomique.

### Services et endpoints

| Méthode | Endpoint | Permission | Usage actuel |
|---|---|---|---|
| GET | `/reservations/arrivees-du-jour` | `reservations:read` | Check-in et exploitation |
| GET | `/reservations/disponibilites` | `reservations:read` | disponibilité |
| GET | `/reservations/availability` | `reservations:read` | disponibilité d'une chambre |
| GET | `/reservations/estimation-prix` | `reservations:read` | estimation sans écriture |
| POST | `/reservations` | `reservations:write` | création |
| GET | `/reservations` | `reservations:read` | calendrier/liste |
| GET | `/reservations/:id` | `reservations:read` | détail |
| PATCH | `/reservations/:id` | `reservations:write` | dates, chambre et prix final |
| DELETE | `/reservations/:id` | `reservations:delete` | annulation |
| POST | `/reservations/:id/no-show` | `reservations:delete` | no-show |

Les politiques d'annulation disposent en plus de routes dédiées sous `/reservations/cancellation-policies`.

### Modèles Prisma concernés

- principaux : `Reservation`, `RoomNight`, `ReservationDeposit`, `CancellationPolicy` ;
- tarification : `RoomType`, `SeasonRate`, `RateRestriction` ;
- relations : `Guest`, `Room`, `Stay`, `SelfCheckinToken`, `NotificationLog` et `ChannelReservationImport`.

### Écarts avec l'audit UX

Plusieurs recommandations P1 sont partiellement couvertes : calendrier de disponibilité, sélection client partagée, estimation immédiate et résumé de prix total. Les écarts sont l'absence d'un assistant explicite, d'une ventilation détaillée du prix et d'indicateurs de disponibilité avancés.

Les réservations groupe, entreprise et multi-chambres ainsi que l'historique complet des modifications ne sont pas prises en charge. Le modèle `Company` n'a volontairement aucune relation avec `Reservation`, `Stay`, `Folio` ou `Invoice` ; une réservation entreprise ne peut donc pas être ajoutée seulement côté frontend.

### Ordre recommandé des développements

1. Stabiliser les améliorations Clients/`GuestPicker` réutilisées par ce parcours.
2. Transformer progressivement le dialogue existant en parcours guidé sans changer le contrat ni la transaction métier.
3. Clarifier la disponibilité et le résumé financier avec les données existantes.
4. Faire valider la ventilation tarifaire attendue et, si nécessaire, ajouter un contrat de lecture calculé par le backend plutôt que dupliquer les calculs dans React.
5. Décider séparément du traitement atomique de l'ajustement manuel à la création.
6. Réserver groupe, entreprise et multi-chambres à des missions dédiées après validation fonctionnelle et architecturale.

### Risques techniques

- double réservation si un futur flux contourne `RoomNight` ou les transactions existantes ;
- divergence de prix si le frontend recalcule la ventilation ;
- état partiel lors de la séquence création puis ajustement manuel ;
- glisser-déposer peu accessible au clavier et sensible aux erreurs opérationnelles ;
- forte extension de schéma et de transaction pour groupe/multi-chambres/entreprise ;
- impacts sur acomptes, notifications, annulations et Check-in.

### Dépendances

Clients, Chambres, Paramètres tarifaires, Audit, Notifications, Channel Manager, Self check-in et Check-in/Séjours.

### Complexité

**L** pour l'incrément P1 complet, principalement à cause du parcours guidé et de la ventilation tarifaire. Groupe, entreprise ou multi-chambres sont **XL** et hors d'un incrément UX isolé.

## 6. Check-in

### État actuel

Le frontend présente arrivées, départs et séjours en cours, une recherche commune, le check-in d'une réservation, le walk-in et le détail d'un séjour. `WalkinCheckinDialog` réutilise `GuestPicker`, la liste des chambres et l'estimation Réservations. `StayDetailsDialog` intègre les onglets Facturation et Police.

Le backend est porté par `StayModule`. Le check-in depuis réservation crée le `Stay`, rattache les nuits, change les statuts, crée le folio principal, ajoute les lignes d'hébergement/formule et impute les acomptes dans une transaction. Le walk-in suit les mêmes invariants sans réservation. Le check-out vérifie le solde et les notes Restaurant, puis émet l'événement Housekeeping.

Le backend supporte le check-out forcé avec permission dynamique et audit. Le client frontend actuel n'envoie pas l'option `force` : cette capacité n'est donc pas exposée dans le parcours standard.

### Services et endpoints

| Méthode | Endpoint | Permission | Usage actuel |
|---|---|---|---|
| POST | `/checkin/walk-in` | `checkin:write` | création d'un séjour direct |
| POST | `/checkin/:reservationId` | `checkin:write` | transformation réservation → séjour |
| GET | `/stays/en-cours` | `checkin:read` | exploitation |
| GET | `/stays/departs-du-jour` | `checkin:read` | départs prévus |
| GET | `/stays/:id` | `checkin:read` | détail séjour |
| POST | `/checkout/:stayId` | `checkin:write`, et `checkin:force-checkout` si forçage | clôture |

Le frontend consomme aussi `/reservations/arrivees-du-jour`, `/rooms`, l'estimation tarifaire, ainsi que les APIs Billing, Paiements et Police via les composants intégrés.

### Modèles Prisma concernés

- principaux : `Stay`, `RoomNight`, `Reservation`, `Guest`, `Room` ;
- exploitation : `PoliceRecord`, `Folio`, `FolioLine`, `Payment`, `ReservationDeposit` ;
- impacts indirects : `RoomStatusLog`, `AuditLog` et données Restaurant portées au folio.

### Écarts avec l'audit UX

Le résumé opérationnel, l'identité client, la réservation, les paiements/factures et la fiche Police sont déjà accessibles, mais dispersés entre page, dialogue et onglets. Le parcours n'est pas encore un assistant réception guidant explicitement les contrôles avant validation.

Les préférences client et alertes métier ne sont pas centralisées. La disponibilité réelle est protégée côté serveur mais le niveau de préparation de la chambre doit rester visible et non déduit d'une simple présence dans une liste. Le scan automatique, la signature électronique et le check-in express ne sont pas intégrés à ce parcours. Le self check-in existe côté Réservations, sans constituer à lui seul le pré-check-in complet visé en P3.

### Ordre recommandé des développements

1. Intervenir après Clients et Réservations, dont les données et composants alimentent ce flux.
2. Définir avec le Product Owner la checklist de réception et les conditions bloquantes versus informatives.
3. Composer un assistant à partir des composants existants, sans déplacer les règles de validation du backend.
4. Rendre visibles, dans cet ordre, identité/blacklist, réservation et chambre, fiche Police, situation financière, puis confirmation.
5. Ajouter des tests de non-régression sur le parcours réservation → séjour et sur le walk-in.
6. Traiter scan, signature, express et pré-check-in dans des lots distincts après décisions sécurité et conformité.

### Risques techniques

- création partielle si un futur parcours contourne la transaction `StayService` ;
- confusion entre avertissement Police et condition réellement bloquante ;
- exposition incorrecte du forçage de check-out sans RBAC et motif d'audit ;
- état de chambre obsolète entre affichage et validation, malgré la protection serveur ;
- régression sur folios, acomptes, Restaurant ou Housekeeping ;
- données personnelles sensibles dans les fonctions de scan et signature.

### Dépendances

Clients, Réservations, Chambres, Séjours, Billing/Facturation, Paiements, Police, Restaurant, Housekeeping, Audit et RBAC.

### Complexité

**L** pour un assistant P1 complet construit sur les APIs existantes. Scan, signature ou pré-check-in étendu sont **XL**.

## 7. Ordre global recommandé pour le Sprint 001

1. **Socle transversal et critères d'acceptation** : confirmer les objectifs P1, les rôles concernés, les données bloquantes et les indicateurs. Complexité **S**.
2. **Clients** : fiabiliser les états UI, le responsive et `GuestPicker` sans ajout de modèle. Complexité **M**.
3. **Réservations** : améliorer le parcours guidé, la disponibilité et le résumé financier sur le contrat stable. Complexité **L**.
4. **Check-in** : composer la checklist réception sur les données stabilisées des deux modules précédents. Complexité **L**.
5. **Dashboard** : enrichir en dernier l'agrégation avec les indicateurs validés et les raccourcis vers les parcours stabilisés. Complexité **M**.

Cet ordre réduit les reprises : Clients fournit la sélection et le contexte, Réservations prépare le séjour, Check-in consomme les deux, puis Dashboard synthétise leur exploitation.

## 8. Stratégie de tests pour l'implémentation future

### Couverture existante identifiée

- Dashboard : E2E du résumé, cohérence occupation, chambres à nettoyer et encaissé ; tests composants des deux widgets ;
- Clients : E2E CRUD, recherche, chiffrement de l'identité, catégorie/blacklist, historique, factures et détection de doublons ;
- Réservations : E2E tarification et concurrence anti-double-réservation ;
- Check-in : E2E cycle complet, tarification walk-in, solde/forçage et concurrence ; tests unitaires du calcul de solde ;
- dépendances frontend : tests existants pour Billing et Police, plus un scénario E2E navigateur du flux check-in/check-out/paiement.

### Lacunes à couvrir par les missions futures

- absence de tests de page dédiés pour `GuestsPage`, `ReservationsCalendarPage` et `CheckinPage` ;
- absence de tests composants dédiés pour `GuestPicker`, `CreateReservationDialog`, `ReservationDetailsDialog`, `WalkinCheckinDialog` et `StayDetailsDialog` ;
- nécessité de conserver les E2E de concurrence dès qu'un contrat d'écriture Réservations/Check-in évolue ;
- nécessité de tests RBAC ciblés pour toute personnalisation du Dashboard ou exposition d'une action sensible.

## 9. Garde-fous de mise en œuvre

- aucune recommandation de l'audit n'est réputée validée par ce plan ; chaque lot nécessite ses critères fonctionnels ;
- aucune refonte, aucun renommage Prisma et aucune modification de migration existante ;
- privilégier les contrats additifs et la composition des composants existants ;
- conserver les calculs, transactions, transitions de chambre et audits dans les services backend propriétaires ;
- analyser les impacts API frontend avant toute évolution de DTO ;
- exécuter les tests ciblés de chaque module et les tests transverses de concurrence/check-in avant proposition de merge ;
- documenter séparément toute nouvelle règle métier validée.

## 10. Questions à faire trancher avant implémentation

1. Quelles recommandations P1 de l'audit constituent effectivement le périmètre fonctionnel du Sprint 001 ?
2. Quels profils doivent voir quels widgets Dashboard, et un widget doit-il disparaître lorsque sa permission source manque ?
3. Quelle définition métier retenir pour « chiffre d'affaires journalier », ADR et RevPAR ?
4. Quels événements composent l'historique chronologique client et quelles données sont visibles selon le rôle ?
5. Quelle ventilation tarifaire doit être présentée pendant la réservation, notamment taxes et suppléments ?
6. L'ajustement manuel du prix doit-il devenir atomique avec la création de réservation ?
7. Quelles étapes du check-in sont bloquantes, avertissantes ou facultatives ?
8. Le check-out forcé doit-il être exposé au frontend dans ce Sprint, avec quel motif obligatoire et pour quels rôles ?
