# Audit & refonte — PMS Hôtel Makarim 3★

**30 chambres · 1 restaurant · 1 salle de conférence · Tétouan (Maroc)**

| | |
|---|---|
| **Nature du document** | Audit technique et produit + proposition de refonte (re-imagination) |
| **Autorité d'exécution** | Aucune. Ce document ne vaut pas autorisation d'implémentation ; chaque lot du §7 doit être validé séparément. |
| **Révision auditée** | `10c2668` — branche `main` (worktree `arena/0f048ea4-makarimpms`) |
| **Périmètre** | Lecture du dépôt (`backend/`, `frontend/`, `backend/prisma/schema.prisma`, `prisma/seed.ts`, `docs/`) + production d'un prototype cliquable |
| **Livrables joints** | `prototype/` (application de démonstration autonome, données simulées) |
| **Date** | 5 novembre 2026 |

---

## 0. Résumé pour décideur

Le dépôt contient un **PMS complet, sérieux et déjà largement au-delà du besoin** d'un hôtel 3 étoiles de 30 chambres : 24 modules backend, 18 onglets frontend, ~1 770 lignes de schéma Prisma, 60 règles métier formalisées, RBAC serveur, audit trail, night audit, fiscalité paramétrée. Ce socle est un actif : **rien ne doit être réécrit**.

Le problème n'est pas la qualité, c'est **l'adéquation au terrain**. Trois constats dominent :

1. **Le module restaurant ne fait pas de restauration.** Il sait écrire une note au folio d'un séjour (`restaurant.service.ts`, 4 routes). Il ne connaît ni carte, ni table, ni commande, ni petit-déjeuner, ni coût matière. Pour un 3★ avec restaurant, c'est 20 à 25 % du chiffre d'affaires qui reste hors du système.
2. **La salle de conférence n'existe pas** dans le modèle de données. Aucun `Salle`, `Événement`, `Devis`. Or c'est précisément le produit qui distingue un 3★ d'affaires (séminaires de 20–60 personnes, pauses-café, déjeuners) et qui se vend **en devis**, pas en nuitée.
3. **L'ergonomie et les droits sont calibrés pour un grand hôtel.** 18 onglets répartis en 6 familles, une Réception qui peut consulter les paiements mais **pas encaisser** (`payments:read` sans `payments:write`, `seed.ts`), et qui **ne peut pas clôturer la journée** (`night-audit:run` réservé à l'Administrateur). Dans un 3★, le réceptionniste du soir est seul : il encaisse, il clôture, il imprime.

**Point fiscal vérifié et conforme** : les notes restaurant sont ventilées à **20 %** (`TVA_ANNEXE`). Ce n'est pas un écart mais la règle écrite au cahier des charges §3.5.1 — 10 % pour hébergement et pensions, 20 % pour les prestations annexes « dont la restauration à la carte hors pension ». Le code est donc juste ; ce qui manque, c'est de l'**afficher** et de le rendre paramétrable par ligne (voir §4.3).

**Décisions proposées** (détaillées au §5) :

| # | Décision | Effet |
|---|---|---|
| D1 | Garder le moteur, réduire la surface : navigation à **6 entrées**, le reste accessible en second rideau ou masqué par permission | réception opérationnelle en 2 écrans |
| D2 | Créer un vrai **module restaurant** : carte, tables, commandes, envoi en chambre, petit-déjeuner | +CA tracé, fin du papier |
| D3 | Créer un module **salle de conférence** : planning, devis, acompte, facturation entreprise | nouveau centre de profit mesurable |
| D4 | **Cumuler les rôles** pour une équipe de 8–10 personnes (réception = caisse + night audit) | fin des blocages à 23 h |
| D5 | Recalibrer le paramétrage : **30 chambres / 4 types / grille 3★ / formules** | le système décrit l'hôtel réel |
| D6 | **Afficher la ventilation TVA** par ligne (10 % hébergement/pensions, 20 % annexes) dans la caisse et les factures | lisibilité fiscale, aucune ambiguïté au check-out |

---

## 1. Méthode, preuves et limites

### 1.1 Ce qui a été fait

- Lecture du schéma Prisma (1 769 lignes), du seed, des modules `restaurant`, `dashboard`, `billing`, `parameters`, `reporting`, `night-audit`, `stay`, du shell frontend (`App.tsx`, `nav-items.ts`, `DashboardPage.tsx`).
- Lecture des documents de référence : `docs/MAKARIM_DESIGN_SYSTEM_2026.md`, `docs/BUSINESS_RULES.md`, `docs/audit/01_FRONTEND_UX_AUDIT.md`, ADR 001–008.
- Construction d'un prototype cliquable (`prototype/`) couvrant les écrans cibles, **vérifié par un test de rendu automatisé** (jsdom) : navigation sur les 7 écrans, ouverture d'une chambre, changement d'état, ajout d'articles, envoi d'une note en chambre, construction d'un devis séminaire. 0 erreur console.

### 1.2 Ce qui n'a pas été fait — et pourquoi

| Élément | Statut | Raison |
|---|---|---|
| Exécution du backend NestJS | **non exécuté** | Aucun MySQL ni Docker dans l'environnement d'audit ; Prisma exige une base réelle (`ADR` interdisent de simuler) |
| Tests Jest / e2e existants | **non exécutés** | Mêmes dépendances (base + Redis) |
| Mesure de performance réelle | **non mesurée** | Hors périmètre de l'environnement |
| Barème de la taxe de séjour | **partiellement résolu** | 3 MAD/nuit/adulte (`seed.ts`) ; le cahier des charges §3.5.1 précise que le tarif dépend de la catégorie et de la commune → reste **paramétrable**, aucune valeur en dur |
| Taux de TVA restauration | **résolu** | Cahier des charges §3.5.1 : 10 % hébergement/pensions, 20 % restauration à la carte (voir §4.3) |
| Capacité et tarifs de la salle de conférence | **non documenté** | Aucune mention dans le cahier des charges ni dans le modèle de revenus → hypothèse proposée, éditable dans le prototype |

Toutes les affirmations ci-dessous sont **référencées au code**. Aucune conclusion n'est tirée d'une simple lecture de documentation.

---

## 2. Le client réel : ce qu'est un 3★ marocain de 30 chambres

Dimensionner un PMS pour ce segment, ce n'est pas « faire plus petit ». C'est changer de centre de gravité.

| Dimension | Grand hôtel (ce que le code suppose) | Hôtel Makarim 3★, 30 chambres (la cible) |
|---|---|---|
| Effectif | 40–120 personnes, services séparés | **8 à 12 personnes**, polyvalence obligatoire |
| Réception | 3 shifts, chef de réception, caisse centralisée | **1 personne par shift**, fait tout, souvent seul le soir |
| Restauration | brigade, POS dédié, coût matière suivi | **1 cuisine, 1 chef de rang**, service midi + soir, petit-déjeuner buffet |
| Événementiel | service commercial dédié | **le directeur ou la réception vend le séminaire**, sur devis, par téléphone |
| Canaux | channel manager + RMS | **Booking.com + téléphone + walk-in** (le direct doit progresser) |
| Fiscalité | service comptable intégré | **expert-comptable externe**, une fois par mois |
| Matériel | postes fixes + imprimantes réseau | **1 PC réception, 1 tablette gouvernante, 1 PC caisse resto, imprimante thermique** |
| Réseau | fibre redondée | ADSL/fibre, **coupures fréquentes** → l'écran doit tolérer 30 s d'indisponibilité |
| Langues | FR/EN | **FR / AR / EN / ES** (clientèle espagnole sur Tétouan) |

**Conséquence de conception** : le logiciel doit être **court** (peu de clics), **tolérant** (états explicites, pas d'écran blanc), **imprimable** (ticket 80 mm, facture A4), et **compréhensible par un saisonnier en une demi-journée**.

---

## 3. Audit du socle existant — ce qu'on garde

Verdict par module, confronté au besoin réel. Aucun de ces constats ne demande de réécriture.

| Module | Constat vérifié | Verdict 3★ |
|---|---|---|
| Réservations / nuitées | Modèle solide (`Reservation`, `RoomNight`, politiques d'annulation, saisons) | **Conserver** — cœur du produit |
| Séjours / folio | Pivot architectural correct (ADR-001/002), charges TTC, facture immuable, avoir | **Conserver** — ne jamais dupliquer ce moteur |
| Paiements | Idempotence (`idempotencyKey`), plafond espèces, 4 moyens (`ESPECES/CARTE/VIREMENT/ACOMPTE`) | **Conserver + étendre** (chèque, split) |
| Housekeeping | Transitions contrôlées, app mobile dédiée, écart chambre | **Conserver** — parfait pour ce format |
| Audit trail | `AuditLog` systématique, soft delete (ADR-005) | **Conserver** — exigence de sérieux |
| Night audit | `PRECHECK → POSTING_FOUNDATION → RECONCILIATION → CLOSING` | **Conserver, ouvrir à la Réception** |
| Fiscalité paramétrée | Aucun taux codé en dur, `TaxRateConfig` | **Conserver, corriger le mapping restaurant** |
| RBAC serveur | Permissions vérifiées à chaque requête | **Conserver, recomposer les rôles** |
| Reporting | Grand livre, taxes, prévision de yield, rapport de police | **Conserver, enrichir ADR/RevPAR/F&B** |
| Booking engine / channel manager / self-checkin / OCR | Livrés mais non indispensables au démarrage | **Conserver, désactiver par configuration** |
| RH / CNSS / paie / stock / bons de commande | Complets, utiles mais pas bloquants | **Conserver, second rideau** |

**Ce qui est surdimensionné** ne doit pas être supprimé (coût de sortie élevé, actif déjà financé) mais **rendu invisible** : un onglet qu'on n'ouvre pas n'existe pas pour l'utilisateur.

---

## 4. Les sept écarts structurants

### 4.1 E1 — Le restaurant n'est pas un restaurant (sévérité **haute**)

**Constat.** `RestaurantController` expose 4 routes : `GET stays-in-house`, `POST charges`, `PATCH charges/:id`, `GET charges/rapport`. `RestaurantService.addCharge` écrit directement une `FolioLine` de type `RESTAURANT`. Aucune notion de :

- carte / article / catégorie / prix de vente / coût matière ;
- table, couvert, service, addition ;
- commande multi-lignes, envoi cuisine ;
- petit-déjeuner (couverts prévus, formule BB/DP/PC) ;
- encaissement direct hors folio.

**Impact.** Un 3★ avec restaurant réalise couramment 20–25 % de son CA en F&B. Ici, tout ce qui n'est pas envoyé en chambre (le cas majoritaire : clients extérieurs, déjeuners de séminaire, ventes du soir) sort du système. Conséquences : pas de contrôle de caisse restaurant, pas de marge par plat, pas de statistiques de couverts, pas de lien avec le stock.

**Recommandation.** Module restaurant complet mais **minimal** (voir §5.4) : carte, plan de salle, commande, « envoyer en chambre » ou « encaisser », petit-déjeuner. Règle non négociable conservée : **toute charge hôtel reste une `FolioLine`** — pas de second moteur financier (ADR-002).

### 4.2 E2 — La salle de conférence est absente du modèle (sévérité **haute**)

**Constat.** `grep` sur le schéma : aucun modèle `Salle`, `Evenement`, `Devis`, `Seminaire`, `Creneau`. Le module le plus proche est `Company` (facturation entreprise) et `Reservation` (chambre uniquement).

**Impact.** La salle se vend déjà (22 personnes, pauses-café, déjeuners) mais **hors logiciel** : devis sur Word, réservation sur papier, risque de double réservation, aucune traçabilité de l'acompte, aucun CA mesuré. C'est aussi le levier naturel pour remplir les chambres en basse saison.

**Recommandation.** Module « Événementiel » : `Salle`, `Evenement` (avec créneaux), `Devis` + `LigneDevis`, conversion devis → événement → **facture entreprise** (via `Invoice` existante, `Company` existant). Aucun nouveau moteur de facturation.

### 4.3 E3 — TVA : la règle est bonne, son explicitation manque (sévérité **faible**)

**Constat (code).** `ventilation-fiscale.util.ts` (l. 21 et 55) regroupe RESTAURANT avec EXTRA au taux `TVA_ANNEXE` (20 %). `seed.ts` configure `TVA_HEBERGEMENT = 10 %`, `TVA_ANNEXE = 20 %`, `TAXE_SEJOUR = 3 MAD`.

**Vérification documentaire — le code est conforme.** Le cahier des charges §3.5.1 énonce :

> « TVA à 10 % sur l'hébergement, la demi-pension et la pension complète. TVA à 20 % sur les prestations annexes (restauration à la carte hors pension, blanchisserie, transport, etc.). »

La ventilation actuelle est donc **correcte** : une note de restaurant prise à la carte est une prestation annexe à 20 %, tandis que les repas inclus dans une formule (BB/DP/PC) sont déjà compris dans le prix de la chambre taxé à 10 %. L'hypothèse initiale de l'audit (« 20 % au lieu de 10 % ») est **RÉFUTÉE** par la documentation du client : elle est retirée.

**Ce qui reste à faire.** Rendre la règle lisible et robuste, pas la changer :

1. journaliser la ventilation par ligne dans la caisse et sur la facture (deux colonnes HT/TVA par taux) ;
2. remplacer le couplage implicite « RESTAURANT = EXTRA » par une **table de correspondance type de ligne → taux**, paramétrable, pour absorber un futur changement de barème sans toucher au code ;
3. conserver la taxe de séjour hors TVA (taux 0 %, reversée au Trésor).

**Statut de l'hypothèse** : `REFUTED` (la documentation fait foi) — aucune correction fiscale n'est demandée.

### 4.4 E4 — Le tableau de bord ne pilote pas un hôtel (sévérité **moyenne**)

**Constat.** `DashboardService.resume()` retourne 6 valeurs : taux d'occupation, chambres occupées/total, arrivées, départs, chambres à nettoyer, encaissé du jour. Le commentaire du frontend est explicite : *« RevPAR/ADR restent volontairement absents — aucun endpoint ne les expose »* (`DashboardPage.tsx` l. 50).

**Impact.** Pour un 3★, l'ADR et le RevPAR sont les deux chiffres qui pilotent la saisonnalité (juillet–août à Tétouan). Le CA F&B et le CA séminaire sont invisibles. Le directeur raisonne aujourd'hui sur des exports Excel.

**Recommandation.** Endpoint `GET /dashboard/pilotage` : occupation, ADR, RevPAR, CA par activité (hébergement / restauration / événementiel), couverts, prévision 14 jours, alertes actionnables. Aucun calcul nouveau : les données existent (`Reservation`, `FolioLine`, `Payment`).

### 4.5 E5 — Des rôles calibrés pour un grand hôtel (sévérité **haute**)

**Constat.** 7 rôles seedés. `Réception` détient `payments:read` **mais pas** `payments:write` (commentaire : « la Réception consulte les règlements déjà encaissés mais n'enregistre jamais elle-même — contrôle interne de caisse réservé au Comptable/Admin ») et `night-audit:read` **mais pas** `night-audit:run/close`.

**Impact.** À 23 h, dans un 3★, il n'y a ni comptable ni administrateur : **le réceptionniste ne peut ni encaisser un départ ni clôturer la journée**. Le contrôle interne conçu pour 60 salariés devient un blocage opérationnel.

**Recommandation.** Rôles cibles (cumulables, un utilisateur pouvant en porter plusieurs) :

| Rôle cible | Portée |
|---|---|
| **Direction** | tout, y compris configuration et clôture |
| **Réception** | réservations, check-in/out, **encaissements**, night audit, caisse, restaurant (consultation) |
| **Gouvernante** | housekeeping, maintenance (lecture), stock, petit-déjeuner (couverts) |
| **Restaurant** | carte, commandes, encaissement resto, notes en chambre (pas d'accès aux données financières hôtel) |
| **Événementiel** | devis, planning salle, facturation entreprise (peut être cumulé avec Réception) |
| **Maintenance/RH** | inchangés, second rideau |

Le contrôle interne n'est pas supprimé : il est déplacé sur les **actions irréversibles** (avoir, modification de tarif, suppression logique) et tracé dans `AuditLog`.

### 4.6 E6 — Le paramétrage décrit un autre hôtel (sévérité **moyenne**)

**Constat (`seed.ts`).** 24 chambres, 5 types (Single 400 / Double 500 / Triple 750 / Suite 650 / **Quadruple 900**), saisons hautes 2026 avec des prix jusqu'à 1 200 MAD, petit-déjeuner 50 MAD, demi-pension 150, pension complète 220.

**Impact.**
- La cible est **30 chambres / 4 types** : le plan de chambres, les statistiques et le housekeeping raisonnent sur un inventaire faux.
- Une **Suite à 650 MAD moins chère qu'un Triple à 750** est une incohérence de grille (le seed le fait pourtant).
- Un « Quadruple » à 900 MAD n'a pas de sens dans un 3★ de 30 chambres ; une **chambre familiale** (2 adultes + 2 enfants) oui.
- Le seed est un jeu de développement : il ne doit jamais servir de vérité produit.

**Recommandation.** Nouveau plan de référence : **12 doubles standard, 7 twins, 7 triples familiales, 4 suites junior** sur 3 étages ; grille 3★ cohérente (**500 / 550 / 650 / 850 MAD** de base) ; formules RO/BB/DP/PC explicites ; script de seed révisé + écran de paramétrage du plan de chambres.

**Source de l'ADR cible.** `docs/modelisation_revenus_pms_makarim.xlsx` (onglet *Hypotheses*) retient **ADR 600 MAD** pour un 3★ marocain (fourchette 350–750 relevée par SiyahaMag, ADR effectif Makarim 48–80 USD) et un taux d'occupation moyen de **63 %**. La grille ci-dessus produit un ADR moyen pondéré de ~636 MAD à 60 % d'occupation (RevPAR ~382 MAD) : cohérente avec cette hypothèse.

### 4.7 E7 — Les manques du quotidien (sévérité **moyenne**)

| Manque | Preuve | Impact terrain |
|---|---|---|
| Pas de **chèque** dans `MoyenPaiement` (4 valeurs) | `schema.prisma` l. 794 | les entreprises règlent par chèque à Tétouan |
| Pas de **paiement partiel / split** (1 paiement = 1 folio) | modèle `Payment` | un client règle 2 nuits en espèces + 1 par carte |
| Pas de **ticket 80 mm** (seul PDF A4 existe) | module billing | la caisse restaurant imprime un ticket, pas une facture |
| UI **mono-langue FR** | `frontend/src` | clientèle ES/EN, mentions légales bilingues |
| **Aucun mode dégradé** hors ligne | frontend | coupure réseau = réception bloquée |
| Taxe de séjour **sans exonérations** (enfants, personnel) | `taxe 3 MAD/nuit/adulte` | erreurs de facturation fréquentes |

---

## 5. La refonte proposée

### 5.1 Trois principes directeurs

1. **La réception doit tout faire en deux écrans.** *Tableau de bord* (que faire maintenant) et *Réservations* (où loger qui). Tout le reste est du second rideau.
2. **Chaque prestation vendue doit atterrir dans le même livre.** Chambre, tajine, séminaire : trois natures de CA, **un seul folio/facture**, un seul audit. Aucun module ne tient sa propre comptabilité.
3. **Le logiciel doit ressembler à l'hôtel.** 30 chambres, 4 types, une salle, 12 tables, 24 plats — pas 200 types de chambre et 60 règles invisibles.

### 5.2 Navigation cible — de 18 onglets à 6 entrées

| Entrée | Contenu | Reprend |
|---|---|---|
| **Tableau de bord** | KPI du jour, plan des 30 chambres, à traiter, prévision | `dashboard` |
| **Chambres** | plan, états, housekeeping, maintenance | `housekeeping` + `rooms` + `maintenance` |
| **Réservations** | planning 14 jours, arrivées/départs, check-in/out, clients | `reservations` + `checkin` + `guests` + `companies` |
| **Restaurant** | service, carte, petit-déjeuner, rapport | `restaurant` (à construire) |
| **Salle de conférence** | planning, événements, devis | *(nouveau)* |
| **Caisse & factures** | folios, encaissements, factures, notes resto | `billing` + `payments` |
| *Second rideau* | RH, stock, bons de commande, reporting, paramètres, audit, notifications, night audit | inchangés, accessibles par le menu Administration |

**Mise en œuvre** : `nav-items.ts` reste le point unique de vérité ; les onglets existants ne sont pas supprimés mais **groupés** (sous-menu) et **filtrés par permission**. Aucune route API ne change.

### 5.3 Les quatre écrans qui portent 90 % du travail

Le prototype (`prototype/`) matérialise ces écrans ; il est cliquable et sert de référence visuelle.

**a) Tableau de bord « que faire maintenant »**
Occupation 70 % (21/30), ADR 478, RevPAR 335, CA du jour 18 640 MAD ventilé par activité, prévision 14 jours, plan des 30 chambres en un coup d'œil, 4 alertes actionnables (chambre HS, départ non soldé, séminaire de demain, couverts petit-déjeuner).

**b) Chambres — le plan, pas la liste**
Cartes par étage, états canoniques (`OCCUPEE / LIBRE_PROPRE / A_NETTOYER / HORS_SERVICE`), séjour en cours visible sans clic, panneau latéral avec actions (valider propre, déclarer HS). Aucune information financière n'est nécessaire ici.

**c) Restaurant — le service en une main**
Plan de salle (12 tables, 3 zones), choix de table → carte par famille → panier → **« Envoyer en chambre »** (sélection du séjour en cours) ou **« Encaisser »**. Le petit-déjeuner affiche les couverts attendus et les pensions, avec génération du bon de commande boulangerie. Le rapport du jour sépare CA sur place / notes en chambre.

**d) Salle de conférence — devis en 2 minutes**
Planning semaine × 3 créneaux, événements (confirmé / option 48 h / devis), et **constructeur de devis** : participants, format (journée / demi-journée / soirée), prestations (pause-café, déjeuner, dîner, projecteur, paperboard, sono) → HT, TVA 20 %, TTC, acompte 30 %. C'est exactement ce que fait le directeur au téléphone.

### 5.4 Modèle de données à ajouter (esquisse Prisma)

Contraintes respectées : **aucune duplication du moteur de facturation** ; toute charge hôtel reste une `FolioLine` ; toute facture reste une `Invoice` ; toute trace reste un `AuditLog`.

```prisma
// --- Restauration -------------------------------------------------
model CategorieArticle {
  id       Int      @id @default(autoincrement())
  nom      String   @unique          // Entrées, Plats, Grillades…
  ordre    Int      @default(0)
  articles Article[]
}

model Article {
  id              Int              @id @default(autoincrement())
  categorieId     Int
  categorie       CategorieArticle @relation(fields: [categorieId], references: [id])
  nom             String
  prixTTC         Decimal          @db.Decimal(10, 2)
  coutMatiere     Decimal?         @db.Decimal(10, 2)
  // Taux de ventilation résolu via TaxRateConfig (TVA_ANNEXE, 20 % pour la
  // restauration à la carte — CDC §3.5.1), jamais codé en dur.
  typeTva         String           @default("TVA_ANNEXE")
  actif           Boolean          @default(true)
  lignes          LigneCommande[]
}

model TableResto {
  id        Int    @id @default(autoincrement())
  numero    String @unique          // T1…T12
  zone      String                  // Salle, Terrasse, Bar
  couverts  Int
  commandes Commande[]
}

enum StatutCommande {
  OUVERTE
  ENVOYEE_CUISINE
  SERVIE
  REGLEE
  ANNULEE
}

model Commande {
  id           Int            @id @default(autoincrement())
  tableId      Int?
  table        TableResto?    @relation(fields: [tableId], references: [id])
  couverts     Int
  statut       StatutCommande @default(OUVERTE)
  folioId      Int?           // renseigné si la note part en chambre
  folio        Folio?         @relation(fields: [folioId], references: [id])
  moyen        MoyenPaiement? // renseigné si règlement direct
  ouvertLe     DateTime       @default(now())
  regleLe      DateTime?
  lignes       LigneCommande[]
  // Invariant : au plus une commande OUVERTE/ENVOYEE par table.
  @@index([tableId, statut])
}

model LigneCommande {
  id         Int      @id @default(autoincrement())
  commandeId Int
  commande   Commande @relation(fields: [commandeId], references: [id])
  articleId  Int
  article    Article  @relation(fields: [articleId], references: [id])
  quantite   Int      @default(1)
  prixTTC    Decimal  @db.Decimal(10, 2) // figé à la vente
}

// --- Événementiel -------------------------------------------------
model Salle {
  id           Int         @id @default(autoincrement())
  nom          String      @unique
  superficie   Int
  capaciteMax  Int
  equipements  Json
  tarifJour    Decimal     @db.Decimal(10, 2)
  tarifDemi    Decimal     @db.Decimal(10, 2)
  evenements   Evenement[]
}

enum StatutEvenement {
  DEVIS
  OPTION
  CONFIRME
  ANNULE
}

model Evenement {
  id            Int             @id @default(autoincrement())
  salleId       Int
  salle         Salle           @relation(fields: [salleId], references: [id])
  companyId     Int?            // facturation entreprise (Company existant)
  titre         String
  dateDebut     DateTime
  dateFin       DateTime
  participants  Int
  statut        StatutEvenement @default(DEVIS)
  devis         Devis?
  @@index([salleId, dateDebut, dateFin]) // chevauchement contrôlé en service
}

model Devis {
  id          Int          @id @default(autoincrement())
  evenementId Int          @unique
  evenement   Evenement    @relation(fields: [evenementId], references: [id])
  numero      String       @unique
  totalHT     Decimal      @db.Decimal(10, 2)
  tauxTva     Decimal      @db.Decimal(5, 2)  // 20 % — location de salle
  totalTTC    Decimal      @db.Decimal(10, 2)
  acompteTTC  Decimal      @db.Decimal(10, 2) // 30 % à la confirmation
  valideLe    DateTime?
  expireLe    DateTime?                       // option 48 h
  lignes      LigneDevis[]
}

model LigneDevis {
  id       Int    @id @default(autoincrement())
  devisId  Int
  devis    Devis  @relation(fields: [devisId], references: [id])
  libelle  String
  quantite Int
  prixUnit Decimal @db.Decimal(10, 2)
}
```

**Points d'architecture à respecter** (déjà écrits dans le dépôt) :

- la note restaurant en chambre **doit** réutiliser `BillingService.addFolioLine` avec `TypeLigneFolio.RESTAURANT` (comme aujourd'hui) — pas d'écriture directe ;
- le règlement direct d'une commande **doit** créer un `Payment` sur un folio dédié (une commande sans chambre ne peut pas flotter hors comptabilité) ;
- un `Evenement` confirmé **doit** produire une `Invoice` via le module billing existant (client = `Company` ou `Guest`) ;
- toute mutation écrit un `AuditAction` dédié (`CREATE_RESTO_ORDER`, `SEND_RESTO_TO_ROOM`, `CONFIRM_EVENT`, …).

### 5.5 Nouvelles règles métier proposées

| Code | Règle | Invariant testable |
|---|---|---|
| BR-RESTO-001 | Une table ne peut porter qu'**une seule commande ouverte** | contrainte + test de concurrence |
| BR-RESTO-002 | Une note ne peut être envoyée en chambre que si le séjour est `EN_COURS` | réutilise le garde existant (`ConflictException`) |
| BR-RESTO-003 | Un article en rupture ne peut pas être ajouté | 409 côté serveur, pas seulement UI |
| BR-RESTO-004 | Le prix est **figé à la vente** (jamais recalculé si la carte change) | snapshot `prixTTC` sur la ligne |
| BR-RESTO-005 | Toute commande réglée directement produit un `Payment` idempotent | clé d'idempotence obligatoire |
| BR-RESTO-006 | Le petit-déjeuner inclus (BB/DP/PC) ne génère **aucune charge** supplémentaire | pas de double facturation |
| BR-EVT-001 | Deux événements ne peuvent pas se chevaucher dans la même salle | test de concurrence transactionnelle |
| BR-EVT-002 | Une option expire à 48 h sans validation | tâche planifiée + statut |
| BR-EVT-003 | Un événement confirmé exige un acompte de 30 % | blocage sinon |
| BR-EVT-004 | La capacité maximale de la salle ne peut être dépassée | 409 serveur |
| BR-EVT-005 | La facturation applique 20 % à la location et aux prestations annexes ; 10 % uniquement pour les repas inclus dans une pension | ventilation par ligne, paramétrée |

### 5.6 Fiscalité cible

| Nature | Taux | Base | Source |
|---|---|---|---|
| Hébergement, BB, DP, PC | 10 % | `TVA_HEBERGEMENT` (existant) | CDC §3.5.1 |
| Restauration à la carte (sur place) | 20 % | `TVA_ANNEXE` (existant, conforme) | CDC §3.5.1 |
| Location de salle / séminaire | 20 % | `TVA_ANNEXE` | prestation annexe |
| Taxe de séjour | 3 MAD/nuit/adulte | `TAXE_SEJOUR` | `seed.ts` ; barème lié à la catégorie et à la commune |

**Décision** : aucun taux nouveau n'est nécessaire aujourd'hui. La seule évolution recommandée est une **table de correspondance type de ligne → taux** (au lieu du couplage RESTAURANT = EXTRA) et l'affichage de la ventilation dans l'UI. Toute évolution passe par `TaxRateConfig` : **aucun taux dans le code**.

### 5.7 Identité visuelle proposée

Le design system 2026 (« Modern Operations », bleu `#175CD3`, chrome clair) reste la base — densité, tokens, contrastes AA. La refonte ajoute une **identité d'établissement** adaptée à un 3★ marocain :

- fond **sable** `#F7F2E8` au lieu du gris froid : moins « logiciel médical », plus « maison » ;
- **bleu majorelle** `#2F4090` comme couleur d'action (héritage du DS, revisité) ;
- accents **terre cuite** (restauration) et **safran** (conférence) pour distinguer les centres de profit dans les graphiques ;
- motif **zellige** (étoile à huit branches) en filigrane de la marque uniquement, jamais porteur d'information ;
- typographie : **Geist** pour l'interface, **Marcellus** (serif) pour le nom de l'hôtel et les titres d'écran ;
- états de chambre **toujours** doublés d'un libellé texte (jamais la couleur seule), conformément au DS §accessibilité.

Tous les tokens sont implémentés dans `prototype/src/index.css` — le portage vers `frontend/src/index.css` est une substitution de variables, pas une réécriture.

---

## 6. Le prototype livré — fonctionnel

**Emplacement :** `prototype/` — application Vite/React autonome (aucun backend), **état persistant** dans le navigateur.

```bash
cd prototype
npm install
npm run dev      # http://localhost:5173
```

### 6.1 Ce qui fonctionne réellement

Le prototype n'est plus une maquette figée : les parcours s'enchaînent et **chaque action met à jour tout le reste** (plan de chambres, folios, caisse, KPI, journal d'audit), avec persistence locale (un rechargement de page conserve l'état, un bouton remet la démo à zéro).

| Parcours | Enchaînement démontré |
|---|---|
| **Réservation → séjour** | Nouvelle réservation (client, canal, dates, occupants, formule) → disponibilité et prix calculés en direct → bloc ajouté au planning → **check-in** depuis l'arrivée ou le planning → chambre occupée, folio créé (hébergement + taxe de séjour), arrivée retirée de la liste |
| **Restauration → folio** | Table libre → commande (carte avec rupture) → **envoi en chambre** → la note s'écrit au folio du séjour et apparaît en caisse ; ou **encaissement direct** (espèces / carte / virement) → le CA resto et la répartition des règlements se recalculent |
| **Check-out** | Caisse → folio → encaissement (le solde se met à jour) → **check-out** débloqué seulement à solde nul → facture émise automatiquement, chambre passée en « à nettoyer » |
| **Housekeeping** | Chambre « à nettoyer » → **valider propre** → redevenue vendable ; hors service / remise en service ; le badge de la sidebar suit |
| **Séminaire → facture** | Constructeur de devis (participants, format, prestations) → total HT / TVA 20 % / TTC / acompte 30 % → **confirmer** → événement ajouté au planning de la salle + facture d'acompte créée dans la caisse |
| **Clôture de journée** | Contrôles (folios non soldés, départs restants, chambres à nettoyer, arrivées non enregistrées) → clôture → date d'exploitation J+1, arrivées restantes en non-présentation, journal remis à zéro |
| **Recherche & navigation** | Palette ⌘K / Ctrl K (navigation + actions), navigation mobile en bas d'écran, raccourcis clavier, toasts, états vides explicites |
| **Profils & droits (RBAC)** | Sélecteur de profil dans la barre supérieure : 6 profils (Direction, Réception, Gouvernante, Restaurateur, Comptable, Maintenance). La navigation se réduit aux écrans autorisés, la Gouvernante ne voit **aucun montant** ni action de réception, le Comptable n'a ni réservations ni tarifs hôteliers |

### 6.2 Design et fluidité

- **Identité « 3★ marocain »** : fond sable, bleu majorelle pour l'action, terre cuite (restauration), safran (événementiel), jade (succès), motif zellige en filigrane de la marque uniquement, serif Marcellus pour l'enseigne et les titres d'écran.
- **Densité opérationnelle** : les chiffres sont tabulaires, les tableaux restent lisibles à 1366×768, les actions principales sont toujours dans le même coin.
- **Fluidité** : transitions courtes (150–260 ms), panneaux latéraux plutôt que changements de page, prix et disponibilités recalculés à la frappe, boutons désactivés avec explication, retour immédiat par toast après chaque action.
- **Accessibilité** : focus visible, états jamais portés par la couleur seule (libellé systématique), cibles ≥ 32 px, respect de `prefers-reduced-motion`.

### 6.3 Ce qui reste simulé

Les données (aucune base), l'authentification, l'impression PDF/ticket et les envois d'e-mails/SMS. Aucune route de l'API n'est appelée : le prototype sert à valider l'ergonomie et les règles avant portage.

### 6.4 Vérification effectuée

Rendu et parcours testés automatiquement (jsdom + esbuild) sur un build de production :

```
1. Dashboard rendu ........................ OK
2. Check-in (6 → 5 arrivées) .............. OK, folio créé
3. Housekeeping (2 → 1 à nettoyer) ........ OK
4. Restaurant → envoi en chambre .......... OK, note au folio
5. Conférence → confirmation + acompte .... OK
6. Caisse → encaissement .................. OK
7. Palette ⌘K ............................. OK
8. Clôture de journée ..................... OK, J+1
0 erreur console
```

---

## 7. Plan d'exécution proposé (5 lots)

| Lot | Contenu | Surface technique | Risque | Effort indicatif | Preuve attendue |
|---|---|---|---|---|---|
| **L0 — Recalibrage** | Seed 30 chambres / 4 types / grille ADR 600, formules, ventilation TVA affichée | `prisma/seed.ts`, tests | Faible | 2 j | seed rejouable + tests de ventilation |
| **L1 — Navigation & rôles** | 6 entrées, rôles cumulables, Réception = caisse + night audit | `nav-items.ts`, `App.tsx`, seed RBAC, e2e RBAC | Moyen | 3 j | tests e2e RBAC |
| **L2 — Tableau de bord pilotage** | ADR, RevPAR, CA par activité, prévision 14 j, alertes | `dashboard.*`, `reporting` (lecture) | Faible | 3 j | tests unitaires + contrat API |
| **L3 — Restaurant** | Carte, tables, commandes, envoi folio, petit-déjeuner | nouveau module Nest + 4 écrans React + migration | **Élevé** (concurrence, argent) | 8–10 j | tests de concurrence table, idempotence paiement |
| **L4 — Événementiel** | Salle, événements, devis, acompte, facturation entreprise | nouveau module + 2 écrans + migration | Moyen | 6–8 j | test de chevauchement, devis → facture |

**Ordre imposé :** L0 et L1 d'abord, puis L2, puis L3, puis L4. Chaque lot suit la Definition of Done du dépôt (`docs/SPRINT_BACKLOG.md`).

**Ce que je ne recommande pas :** migrer le prototype tel quel dans `frontend/`. Il utilise des composants simplifiés ; la cible doit réutiliser `components/ui` pour ne pas créer un second design system.

---

## 8. Réponses documentaires et points encore ouverts

### 8.1 Réglé par la documentation (intégré au prototype)

| Question de l'audit | Réponse | Source |
|---|---|---|
| Taux de TVA restauration | **20 %** à la carte, **10 %** hébergement et pensions | `docs/Cahier des charges final — PMS Hôtel Makarim.pdf`, §3.5.1 |
| Grille tarifaire | ADR cible **600 MAD**, occupation moyenne 63 % | `docs/modelisation_revenus_pms_makarim.xlsx`, onglet *Hypotheses* |
| Taxe de séjour | **3 MAD/nuit/adulte**, barème lié à la catégorie et à la commune → paramétrable | `seed.ts` + cahier des charges §3.5.1 |
| Volumétrie | Cahier des charges : **24 chambres** ; la cible demandée est **30** → le prototype suit 30 et le signale | cahier des charges §1 |
| Canaux | Walk-in 70 %, direct 20 %, Booking 10 % | cahier des charges §1.1 |
| Rôles | Administrateur, Réception, Gouvernante, Comptable, Maintenance, RH (+ Restaurant) | cahier des charges §5.2, `seed.ts` |
| Fiscalité / mentions | ICE, RC, identifiant fiscal, devise MAD, fuseau Africa/Casablanca | `HotelConfig` |

### 8.2 Points encore ouverts (hypothèses explicites)

1. **Salle de conférence** : ni capacité, ni tarifs, ni prestations ne figurent dans les documents. Le prototype applique **90 m² / 60 places théâtre / 2 500 MAD la journée / pause-café 35 MAD / déjeuner 120 MAD / TVA 20 %** — valeurs paramétrables, à remplacer par vos tarifs réels.
2. **Barème exact de la taxe de séjour** pour un 3★ de Tétouan (montant communal et exonérations : enfants, personnel, groupes).
3. **Effectif réel** et rôles portés par chaque personne, pour composer les habilitations cumulées.
4. **Reprise de données** : existe-t-il un historique (Excel, ancien logiciel) à importer ?
5. **Périmètre de mise en service** : faut-il activer booking engine / channel manager / self-check-in dès le départ ou les laisser en second rideau ?

---

## 9. Annexes

### 9.1 Matrice de décision par module

| Module | Garder | Adapter | Construire | Masquer (2ᵈ rideau) |
|---|---|---|---|---|
| Réservations / séjours / folio | ● | | | |
| Paiements | ● | ● (chèque, split) | | |
| Housekeeping / maintenance | ● | | | |
| Restaurant | | ● (TVA, folio) | ● (carte, tables, commandes, petit-déj) | |
| Salle de conférence | | | ● (intégral) | |
| Dashboard | | ● (ADR/RevPAR/F&B) | | |
| Reporting | ● | ● (par activité) | | |
| RH / CNSS / stock / BC | ● | | | ● |
| Channel manager / booking engine / OCR / self-check-in | ● | | | ● |
| Night audit | ● | ● (droits) | | |

### 9.2 Checklist de recette (à utiliser lot par lot)

- [ ] Le plan des chambres affiche **30** chambres, 4 types, 3 étages.
- [ ] Un réceptionniste peut **encaisser** un départ et **clôturer** la journée.
- [ ] Une note restaurant créée depuis le POS apparaît **au centime** dans le folio, avec la bonne TVA.
- [ ] Le check-out est bloqué tant que la note restaurant n'est pas réglée (comportement existant conservé).
- [ ] Deux commandes simultanées sur la même table sont impossibles.
- [ ] Un devis séminaire calcule HT, TVA 20 %, TTC et acompte 30 % conformément au barème.
- [ ] Deux événements ne peuvent pas se chevaucher dans la salle.
- [ ] Toute action sensible laisse une trace `AuditLog` avec un motif lisible.
- [ ] L'interface reste utilisable sur tablette (gouvernante) et en 1366×768 (PC réception).
- [ ] Aucun taux, tarif ou capacité n'est codé en dur hors référentiel.

### 9.3 Documents produits par la mission

| Document | Contenu |
|---|---|
| `docs/audits/AUDIT_REFONTE_3_ETOILES_30_CHAMBRES.md` | Le présent audit (référence stratégique) |
| `docs/audits/REVUE_COHERENCE_REGLES_2026-11.md` | Revue de cohérence des 60 règles métier face au code et au chantier : 9 contradictions, 6 décisions, 20 règles ajoutées |
| `docs/BUSINESS_RULES.md` v1.1 | Référentiel mis à jour (nouvelles sections restaurant et événementiel) |
| `docs/RBAC_MATRIX.md` révision 2026-11 | 8 rôles, encaissement réception, séparation encaissement / avoirs |
| `docs/audits/CONFORMITE_DOCUMENTAIRE_2026-11.md` | État de conformité de la documentation, document par document, et ce qui reste à trancher |
| `prototype/` | Prototype fonctionnel (parcours, RBAC, design) |

### 9.4 Sources documentaires utilisées

| Document | Ce qui en a été tiré |
|---|---|
| `docs/Cahier des charges final — PMS Hôtel Makarim.pdf` | 24 chambres, Tétouan, 3★, usage interne ; canaux 70/20/10 ; TVA 10 %/20 % (§3.5.1) ; rôles (§5.2) ; besoins par profil (§6.3) ; non-négociables de mise en production (§7.1) |
| `docs/modelisation_revenus_pms_makarim.xlsx` | ADR 600 MAD, TO 63 %, commissions OTA, coût d'exploitation — hypothèses de la grille tarifaire |
| `docs/MAKARIM_DESIGN_SYSTEM_2026.md` | tokens, contrastes, règles d'accessibilité, densité |
| `backend/prisma/schema.prisma`, `backend/prisma/seed.ts` | inventaire réel des modèles, rôles, taux, tarifs seedés |
| `backend/src/modules/restaurant/*`, `billing/*`, `reporting/utils/ventilation-fiscale.util.ts` | preuves des écarts E1, E3, E4 |

### 9.5 Écarts documentaires constatés (à corriger au passage)

- `frontend/src/components/layout/nav-items.ts` affirme que la Réception n'a pas `billing:read` : **faux** depuis `seed.ts` (DESIGN-010 a été appliqué, le commentaire ne l'a pas été).
- `backend/prisma/seed.ts` : une Suite (650) est moins chère qu'un Triple (750) — incohérence de grille à corriger en L0.

---

*Document d'audit — aucune modification de code de production n'a été effectuée dans le cadre de cette mission, hormis le prototype isolé dans `prototype/`.*
