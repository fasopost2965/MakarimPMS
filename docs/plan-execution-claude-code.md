# Plan d'exécution Claude Code — PMS Hôtel Makarim

**Objectif de ce document** : traduire le [Cahier des charges final — PMS Hôtel Makarim](Cahier-des-charges-final-PMS-Hotel-Makarim.pdf) en plan d'exécution directement utilisable par Claude Code : structure de dépôt, schéma Prisma, modules NestJS, routes API, écrans React, séquencement par phase et déploiement. Ce document est destiné à être versé dans `/docs` du dépôt GitHub et servir de références aux prompts Claude Code.

---

## 0. Principes à respecter à chaque étape

Ces 5 règles (déjà actées dans le cahier des charges, section 2.1) doivent être rappelées à Claude Code dans le `CLAUDE.md` et dans chaque prompt de génération de module :

1. Le **séjour** est l'objet central, pas la réservation.
2. Un séjour peut avoir **plusieurs folios** (jamais « une réservation = une facture »).
3. Chaque charge/paiement est une **ligne rattachée à un folio** ; les factures sont générées depuis un ou plusieurs folios, jamais depuis la réservation.
4. Les opérations sensibles **laissent une trace d'audit** (utilisateur, horodatage, motif).
5. Les modules futurs se branchent sur les **services métier existants** (ex. facturation), jamais en contournement.

---

## 1. Structure du dépôt GitHub

```
pms-makarim/
├── .claude/
│   ├── skills/
│   │   ├── creer-module-brique/SKILL.md
│   │   ├── calcul-cnss-tva/SKILL.md
│   │   ├── deploiement-vps/SKILL.md
│   │   └── revue-migration-prisma/SKILL.md
│   └── settings.json
├── CLAUDE.md
├── docs/
│   ├── Cahier-des-charges-final-PMS-Hotel-Makarim.pdf
│   ├── plan-execution-claude-code.md   ← ce document
│   └── adr/                             (Architecture Decision Records, un fichier par décision)
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/                      (guards, decorators, interceptors, filters)
│   │   ├── config/                      (ConfigModule, validation des .env)
│   │   └── modules/
│   │       ├── core/                    (5.1, 5.2, 5.2.1)
│   │       ├── dashboard/                (5.3)
│   │       ├── reservations/              (5.4)
│   │       ├── checkin/                  (5.5)
│   │       ├── housekeeping/             (5.6)
│   │       ├── guests/                   (5.7)
│   │       ├── maintenance/               (5.8)
│   │       ├── suppliers/                (5.9)
│   │       ├── stock/                    (5.10)
│   │       ├── hr-planning/               (5.11)
│   │       ├── hr-payroll/                (5.12)
│   │       ├── billing/                  (5.13, folios/factures/paiements)
│   │       ├── expenses/                 (5.14)
│   │       ├── reports/                  (5.15)
│   │       ├── security-audit/            (5.16)
│   │       └── time-shift/                (5.17)
│   ├── test/
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/                          (routing, layout, providers)
│   │   ├── pages/                        (voir section 4 — mapping écrans)
│   │   ├── components/ui/                (shadcn/ui)
│   │   ├── features/                     (un dossier par module, aligné sur le backend)
│   │   ├── lib/                          (client API, auth, utils)
│   │   └── styles/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── docker-compose.prod.yml
├── nginx/
│   └── pms.hotelmakarim.ma.conf
└── .github/
    └── workflows/
        ├── ci.yml                        (lint + tests + build, sur PR)
        └── deploy.yml                    (build + push + déploiement SSH, sur main)
```

**Convention de nommage des branches** : `feature/5.4-reservations`, `feature/5.6-housekeeping`, etc. — reprendre systématiquement le numéro de module du cahier des charges pour garder la traçabilité.

---

## 2. Configuration Claude Code

### 2.1 Contenu cible de `CLAUDE.md`

Court, factuel, commandes exactes en premier — à réécrire à la main après le `/init` automatique :

```markdown
# PMS Hôtel Makarim

Projet interne (pas de logique SaaS multi-hôtels). Hôtel 3 étoiles, 24 chambres, Tétouan.

## Stack
- Backend : NestJS + Prisma + MySQL 8 (voir backend/prisma/schema.prisma)
- Frontend : React + Vite + TypeScript + Tailwind + shadcn/ui
- Auth : JWT (access + refresh token)
- Déploiement : VPS Hostinger, Docker Compose, Nginx, Certbot

## Commandes
- Backend dev : `cd backend && npm run start:dev`
- Frontend dev : `cd frontend && npm run dev`
- Migration Prisma : `cd backend && npx prisma migrate dev --name <nom>`
- Tests backend : `cd backend && npm run test`
- Build complet : `docker compose -f docker-compose.yml build`

## Règles non négociables (voir docs/Cahier-des-charges-final-PMS-Hotel-Makarim.pdf §2.1, §7.1)
- Le séjour est l'objet central, pas la réservation.
- Un séjour peut avoir plusieurs folios.
- Facture immuable après émission — toute correction passe par un avoir.
- Toute opération sensible (annulation, transfert, réouverture) écrit dans AuditLog.
- Aucun taux (CNSS, TVA, taxe de séjour) codé en dur — tout est en base, table de config.
- RBAC vérifié côté serveur sur chaque endpoint, jamais seulement côté UI.

## Référence
Le cahier des charges complet (docs/Cahier-des-charges-final-PMS-Hotel-Makarim.pdf) est la
source de vérité fonctionnelle. Toujours citer le numéro de module (ex. 5.6) dans les commits
et PR concernant ce module.
```

### 2.2 Skills projet à créer dans `.claude/skills/`

| Skill | Rôle |
|---|---|
| `creer-module-brique` | Génère le squelette d'un nouveau module NestJS (controller, service, DTO, module Prisma) + le dossier `features/<module>` côté frontend, en respectant la structure des modules 1-17 et les règles de la section 0. |
| `calcul-cnss-tva` | Encapsule les formules de calcul CNSS (branches, plafonds), TVA hôtelière (10 %/20 %) et taxe de séjour, à partir des tables de config — jamais de taux en dur dans le code appelant. |
| `deploiement-vps` | Automatise la séquence de déploiement sur le VPS Hostinger (build, push image, SSH, `docker compose pull && up -d`, vérification de santé post-déploiement). |
| `revue-migration-prisma` | Checklist de revue avant tout `prisma migrate deploy` en production : migration réversible, pas de perte de données, testée sur le clone de staging, sauvegarde prise juste avant. |

### 2.3 GitHub App

Installer l'application GitHub de Claude Code sur le dépôt pour activer `@claude` sur les Issues/PR — permet de déléguer l'implémentation d'un module directement depuis une Issue taguée avec son numéro (ex. « Implémenter 5.10 — Stock »).

---

## 3. Schéma de données Prisma

Schéma de départ couvrant les 17 modules. Claude Code doit l'affiner (index, contraintes) au fil de l'implémentation, mais la structure des relations ci-dessous doit être respectée pour ne pas rompre les règles de la section 0.

```prisma
// backend/prisma/schema.prisma

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ------------------------------------------------------------------
// 5.1 / 5.2 — Core : configuration hôtel, utilisateurs, rôles
// ------------------------------------------------------------------

model HotelConfig {
  id                Int      @id @default(1)
  raisonSociale     String
  ice               String
  identifiantFiscal String
  rc                String
  adresse           String
  logoUrl           String?
  categorieEtoiles  Int
  devise            String   @default("MAD")
  formatDate        String   @default("DD/MM/YYYY")
  updatedAt         DateTime @updatedAt
}

model TaxRateConfig {
  id          Int      @id @default(autoincrement())
  type        String   // "TVA_HEBERGEMENT" | "TVA_ANNEXE" | "TAXE_SEJOUR"
  taux        Decimal  @db.Decimal(5, 2)
  applicableA String?  // catégorie hôtel / commune si pertinent
  actifDepuis DateTime @default(now())
}

model RoomType {
  id            Int      @id @default(autoincrement())
  nom           String
  prixBase      Decimal  @db.Decimal(10, 2)
  capacite      Int
  rooms         Room[]
}

model Role {
  id          Int              @id @default(autoincrement())
  nom         String           @unique // Administrateur, Réception, Gouvernante, Comptable, Maintenance, RH
  permissions RolePermission[]
  users       User[]
}

model Permission {
  id     Int              @id @default(autoincrement())
  module String           // ex. "reservations", "billing"
  action String           // "read" | "write" | "delete" | "export"
  roles  RolePermission[]
}

model RolePermission {
  roleId       Int
  permissionId Int
  role         Role       @relation(fields: [roleId], references: [id])
  permission   Permission @relation(fields: [permissionId], references: [id])

  @@id([roleId, permissionId])
}

model User {
  id            Int        @id @default(autoincrement())
  nom           String
  email         String     @unique
  motDePasseHash String
  roleId        Int
  role          Role       @relation(fields: [roleId], references: [id])
  actif         Boolean    @default(true)
  employee      Employee?
  createdAt     DateTime   @default(now())
  loginLogs     LoginLog[]
  timeShifts    TimeShift[]
}

model LoginLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  succes    Boolean
  ip        String?
  createdAt DateTime @default(now())
}

// ------------------------------------------------------------------
// 5.4 / 5.5 — Réservations, Check-in/Check-out, Séjours
// ------------------------------------------------------------------

enum CanalReservation {
  WALK_IN
  DIRECT
  BOOKING_COM
}

enum StatutReservation {
  CONFIRMEE
  ANNULEE
  NO_SHOW
  TRANSFORMEE_EN_SEJOUR
}

model Reservation {
  id            Int               @id @default(autoincrement())
  canal         CanalReservation
  guestId       Int
  guest         Guest             @relation(fields: [guestId], references: [id])
  companyId     Int?
  company       Company?          @relation(fields: [companyId], references: [id])
  roomTypeId    Int
  roomType      RoomType          @relation(fields: [roomTypeId], references: [id])
  dateArrivee   DateTime
  dateDepart    DateTime
  statut        StatutReservation @default(CONFIRMEE)
  sourceBrute   String?           // référence OTA si applicable
  stay          Stay?
  createdAt     DateTime          @default(now())
}

enum StatutChambre {
  LIBRE_PROPRE
  RESERVEE
  OCCUPEE
  DEPART_PREVU
  A_NETTOYER
  EN_NETTOYAGE
  EN_MAINTENANCE
}

model Room {
  id           Int             @id @default(autoincrement())
  numero       String          @unique
  roomTypeId   Int
  roomType     RoomType        @relation(fields: [roomTypeId], references: [id])
  statut       StatutChambre   @default(LIBRE_PROPRE)
  statusLogs   RoomStatusLog[]
  stays        Stay[]
  housekeepingTasks HousekeepingTask[]
  maintenanceTickets MaintenanceTicket[]
}

model RoomStatusLog {
  id         Int           @id @default(autoincrement())
  roomId     Int
  room       Room          @relation(fields: [roomId], references: [id])
  ancienStatut StatutChambre
  nouveauStatut StatutChambre
  motif      String?
  userId     Int?
  createdAt  DateTime      @default(now())
}

enum StatutSejour {
  EN_COURS
  CHECKOUT
  ANNULE
}

model Stay {
  id             Int          @id @default(autoincrement())
  reservationId  Int?         @unique
  reservation    Reservation? @relation(fields: [reservationId], references: [id])
  roomId         Int
  room           Room         @relation(fields: [roomId], references: [id])
  guestId        Int
  guest          Guest        @relation(fields: [guestId], references: [id])
  companyId      Int?
  company        Company?     @relation(fields: [companyId], references: [id])
  dateCheckin    DateTime
  dateCheckoutPrevue DateTime
  dateCheckoutReelle DateTime?
  statut         StatutSejour @default(EN_COURS)
  folios         Folio[]
  createdAt      DateTime     @default(now())
}

// ------------------------------------------------------------------
// 5.7 — Fiches clients / CRM
// ------------------------------------------------------------------

enum CategorieClient {
  STANDARD
  VIP
  ENTREPRISE
  AGENCE
  BLACKLIST
}

model Guest {
  id           Int              @id @default(autoincrement())
  nom          String
  prenom       String
  pieceIdentite String
  nationalite  String
  telephone    String?
  email        String?
  categorie    CategorieClient  @default(STANDARD)
  preferences  String?
  reservations Reservation[]
  stays        Stay[]
  createdAt    DateTime         @default(now())
}

model Company {
  id                Int           @id @default(autoincrement())
  raisonSociale     String
  ice               String?
  conditionsPaiement String?      // ex. "30 jours"
  plafondCredit     Decimal?      @db.Decimal(10, 2)
  contacts          CompanyContact[]
  reservations      Reservation[]
  stays             Stay[]
  invoices          Invoice[]
}

model CompanyContact {
  id        Int     @id @default(autoincrement())
  companyId Int
  company   Company @relation(fields: [companyId], references: [id])
  nom       String
  role      String?
  telephone String?
  email     String?
}

// ------------------------------------------------------------------
// 5.13 — Facturation, folios, paiements (règles 2 et 3, section 0)
// ------------------------------------------------------------------

enum TypeLigneFolio {
  HEBERGEMENT
  EXTRA
  TAXE_SEJOUR
  PAIEMENT
}

model Folio {
  id        Int          @id @default(autoincrement())
  stayId    Int
  stay      Stay         @relation(fields: [stayId], references: [id])
  companyId Int?         // si le folio est facturé à une société plutôt qu'au client
  company   Company?     @relation(fields: [companyId], references: [id])
  libelle   String       // ex. "Folio principal", "Folio extras"
  lignes    FolioLine[]
  invoices  Invoice[]
  createdAt DateTime     @default(now())
}

model FolioLine {
  id          Int             @id @default(autoincrement())
  folioId     Int
  folio       Folio           @relation(fields: [folioId], references: [id])
  type        TypeLigneFolio
  libelle     String
  montant     Decimal         @db.Decimal(10, 2)
  tauxTva     Decimal         @db.Decimal(5, 2)
  annulee     Boolean         @default(false)
  motifAnnulation String?
  createdAt   DateTime        @default(now())
}

enum StatutFacture {
  EMISE
  ANNULEE_PAR_AVOIR
}

model Invoice {
  id           Int           @id @default(autoincrement())
  numero       String        @unique // séquence immuable
  folioId      Int
  folio        Folio         @relation(fields: [folioId], references: [id])
  companyId    Int?
  company      Company?      @relation(fields: [companyId], references: [id])
  montantTotal Decimal       @db.Decimal(10, 2)
  statut       StatutFacture @default(EMISE)
  pdfUrl       String?
  creditNotes  CreditNote[]
  payments     Payment[]
  createdAt    DateTime      @default(now())
}

model CreditNote {
  id        Int      @id @default(autoincrement())
  invoiceId Int
  invoice   Invoice  @relation(fields: [invoiceId], references: [id])
  motif     String
  montant   Decimal  @db.Decimal(10, 2)
  createdAt DateTime @default(now())
}

enum MoyenPaiement {
  ESPECES
  CARTE
  VIREMENT
  ACOMPTE
}

model Payment {
  id                Int           @id @default(autoincrement())
  invoiceId         Int?
  invoice           Invoice?      @relation(fields: [invoiceId], references: [id])
  moyen             MoyenPaiement
  montant           Decimal       @db.Decimal(10, 2)
  idempotencyKey    String        @unique // anti double-encaissement
  createdAt         DateTime      @default(now())
}

// ------------------------------------------------------------------
// 5.6 / 5.8 — Housekeeping & Maintenance
// ------------------------------------------------------------------

enum StatutTacheMenage {
  A_FAIRE
  EN_COURS
  TERMINEE
  CONTROLEE
}

model HousekeepingTask {
  id           Int               @id @default(autoincrement())
  roomId       Int
  room         Room              @relation(fields: [roomId], references: [id])
  assigneA     Int?              // Employee.id
  statut       StatutTacheMenage @default(A_FAIRE)
  createdAt    DateTime          @default(now())
  termineeAt   DateTime?
}

enum PrioriteTicket {
  BASSE
  MOYENNE
  HAUTE
  URGENTE
}

model MaintenanceTicket {
  id          Int            @id @default(autoincrement())
  roomId      Int?
  room        Room?          @relation(fields: [roomId], references: [id])
  typePanne   String
  priorite    PrioriteTicket @default(MOYENNE)
  photoUrl    String?
  assigneA    String?        // technicien ou prestataire
  resoluAt    DateTime?
  createdAt   DateTime       @default(now())
}

// ------------------------------------------------------------------
// 5.9 / 5.10 — Fournisseurs & Stock
// ------------------------------------------------------------------

model Supplier {
  id                  Int             @id @default(autoincrement())
  nom                 String
  categorieProduits   String
  conditionsPaiement  String?
  stockItems          StockItem[]
  expenses            Expense[]
}

model StockItem {
  id          Int             @id @default(autoincrement())
  nom         String
  categorie   String          // linge, produits d'accueil, entretien, restauration
  supplierId  Int?
  supplier    Supplier?       @relation(fields: [supplierId], references: [id])
  seuilAlerte Int
  quantite    Int             @default(0)
  movements   StockMovement[]
}

enum TypeMouvementStock {
  ENTREE
  SORTIE
  AJUSTEMENT_INVENTAIRE
}

model StockMovement {
  id          Int                @id @default(autoincrement())
  stockItemId Int
  stockItem   StockItem          @relation(fields: [stockItemId], references: [id])
  type        TypeMouvementStock
  quantite    Int
  createdAt   DateTime           @default(now())
}

// ------------------------------------------------------------------
// 5.11 / 5.12 / 5.17 — RH, contrats, paie, Time Shift
// ------------------------------------------------------------------

model Employee {
  id            Int        @id @default(autoincrement())
  userId        Int?       @unique
  user          User?      @relation(fields: [userId], references: [id])
  nom           String
  prenom        String
  dateEmbauche  DateTime
  contracts     Contract[]
  shifts        PlanningShift[]
}

model Contract {
  id           Int      @id @default(autoincrement())
  employeeId   Int
  employee     Employee @relation(fields: [employeeId], references: [id])
  typeContrat  String
  salaireBase  Decimal  @db.Decimal(10, 2)
  dateDebut    DateTime
  dateFin      DateTime?
  payslips     Payslip[]
}

model CnssRateConfig {
  id            Int      @id @default(autoincrement())
  branche       String   // "Allocations familiales", "Court terme", etc.
  tauxEmployeur Decimal  @db.Decimal(5, 2)
  tauxSalarie   Decimal  @db.Decimal(5, 2)
  plafondMensuel Decimal? @db.Decimal(10, 2) // null = sans plafond
  applicableDepuis DateTime @default(now())
}

model Payslip {
  id          Int      @id @default(autoincrement())
  contractId  Int
  contract    Contract @relation(fields: [contractId], references: [id])
  periode     DateTime // 1er jour du mois concerné
  brut        Decimal  @db.Decimal(10, 2)
  cotisationsSalarie Decimal @db.Decimal(10, 2)
  cotisationsEmployeur Decimal @db.Decimal(10, 2)
  net         Decimal  @db.Decimal(10, 2)
  pdfUrl      String?
  createdAt   DateTime @default(now())
}

model PlanningShift {
  id         Int      @id @default(autoincrement())
  employeeId Int
  employee   Employee @relation(fields: [employeeId], references: [id])
  debut      DateTime
  fin        DateTime
  echangeDemande Boolean @default(false)
  valideParId Int?
}

enum StatutTimeShift {
  NON_DEMARRE
  ACTIF
  EN_PAUSE
  TERMINE
}

model TimeShift {
  id         Int                @id @default(autoincrement())
  userId     Int
  user       User               @relation(fields: [userId], references: [id])
  startedAt  DateTime
  endedAt    DateTime?
  statut     StatutTimeShift    @default(NON_DEMARRE)
  segments   TimeShiftSegment[]
}

enum TypeSegment {
  TRAVAIL
  PAUSE
}

model TimeShiftSegment {
  id        Int         @id @default(autoincrement())
  shiftId   Int
  shift     TimeShift   @relation(fields: [shiftId], references: [id])
  type      TypeSegment
  startedAt DateTime
  endedAt   DateTime?
}

// ------------------------------------------------------------------
// 5.14 — Dépenses & charges
// ------------------------------------------------------------------

model Expense {
  id          Int      @id @default(autoincrement())
  categorie   String   // fournisseurs, salaires, énergie, maintenance, abonnements
  supplierId  Int?
  supplier    Supplier? @relation(fields: [supplierId], references: [id])
  montant     Decimal  @db.Decimal(10, 2)
  justificatifUrl String?
  createdAt   DateTime @default(now())
}

// ------------------------------------------------------------------
// 5.16 — Sécurité, audit, journalisation (transverse, non retirable)
// ------------------------------------------------------------------

model AuditLog {
  id         Int      @id @default(autoincrement())
  userId     Int?
  action     String   // "annulation_charge" | "transfert_folio" | "reouverture_dossier" | ...
  entite     String   // nom du modèle concerné
  entiteId   Int
  motif      String?
  createdAt  DateTime @default(now())
}
```

**Note d'implémentation** : chaque modèle listé ci-dessus doit être livré module par module (voir section 5), pas en une seule migration géante — sinon on retombe dans le piège identifié en section 7.3 (« ne pas transformer l'architecture modulaire en excuse pour retarder le MVP »).

---

## 4. Modules NestJS et routes API

Convention : chaque module expose ses routes sous `/api/<module>`, protégées par un `JwtAuthGuard` + `RolesGuard` (RBAC vérifié côté serveur, section 0). Toutes les routes ci-dessous sont un point de départ — Claude Code doit générer le DTO de validation (`class-validator`) pour chaque endpoint d'écriture.

| Module NestJS | Réf. | Endpoints principaux |
|---|---|---|
| `core` | 5.1, 5.2, 5.2.1 | `GET/PATCH /hotel-config`, `GET /roles`, `POST/PATCH/DELETE /users`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/forgot-password`, `GET /auth/roles-actifs` (pour la landing page par profil) |
| `dashboard` | 5.3 | `GET /dashboard/kpis`, `GET /dashboard/occupation?range=30j`, `GET /dashboard/revenus-par-canal` |
| `reservations` | 5.4 | `GET/POST /reservations`, `GET/PATCH/DELETE /reservations/:id`, `GET /reservations/arrivees-du-jour`, `GET /reservations/disponibilites?dateDebut&dateFin` |
| `checkin` | 5.5 | `POST /checkin/:reservationId`, `POST /checkin/walk-in`, `GET /stays/en-cours`, `POST /checkout/:stayId` |
| `housekeeping` | 5.6 | `GET /housekeeping/tableau`, `GET /rooms`, `PATCH /rooms/:id/statut`, `GET /housekeeping/taches-du-jour`, `PATCH /housekeeping/taches/:id` |
| `guests` | 5.7 | `GET/POST /guests`, `GET/PATCH /guests/:id`, `GET /guests/:id/historique`, `GET /guests/:id/factures` |
| `maintenance` | 5.8 | `GET/POST /maintenance-tickets`, `PATCH /maintenance-tickets/:id`, `GET /maintenance-tickets/historique?roomId=` |
| `suppliers` | 5.9 | `GET/POST /suppliers`, `GET/PATCH /suppliers/:id`, `GET /suppliers/:id/commandes` |
| `stock` | 5.10 | `GET/POST /stock-items`, `POST /stock-items/:id/mouvements`, `GET /stock-items/alertes-seuil` |
| `hr-planning` | 5.11 | `GET/POST /plannings`, `POST /plannings/:id/echange`, `PATCH /plannings/echange/:id/valider` |
| `hr-payroll` | 5.12 | `GET/POST /contracts`, `POST /payslips/generer?employeeId&periode`, `GET /payslips/:id/pdf`, `GET/PATCH /config/cnss-rates` |
| `billing` | 5.13 | `POST /folios`, `POST /folios/:id/lignes`, `POST /folios/:id/lignes/:ligneId/transferer`, `POST /invoices/generer`, `POST /invoices/:id/avoir`, `POST /payments` (idempotent via header `Idempotency-Key`) |
| `expenses` | 5.14 | `GET/POST /expenses`, `GET /expenses/vue-consolidee?periode=` |
| `reports` | 5.15 | `GET /reports/financier?format=pdf\|xlsx\|csv`, `GET /reports/exploitation`, `GET /reports/rh` |
| `security-audit` | 5.16 | `GET /audit-logs?entite=&userId=`, `GET /security/health` (dernière sauvegarde, espace disque) |
| `time-shift` | 5.17 | `POST /time-shifts/demarrer`, `POST /time-shifts/pause`, `POST /time-shifts/reprendre`, `POST /time-shifts/terminer`, `GET /time-shifts/actif-par-email` |

---

## 5. Écrans React par module

Repris à l'identique de la section 6.2 du cahier des charges (déjà validée), mappés en routes frontend. Structure conseillée : `frontend/src/features/<module>/pages/`.

| Module | Route de base | Écrans |
|---|---|---|
| Core (5.1/5.2/5.2.1) | `/login`, `/admin/*` | Connexion (landing par profil), Dashboard Settings, Identité hôtel, Fiscalité, Facturation (config), Pricing policies, Templates documents, Utilisateurs & rôles |
| Réservations (5.4) | `/reservations` | Liste des réservations, Calendrier/planning (Gantt), Formulaire de réservation, Fiche réservation détaillée, Arrivées du jour |
| Check-in/Séjours (5.5) | `/checkin` | Arrivées du jour, Formulaire de check-in, Liste des séjours en cours, Fiche séjour, Départs du jour / check-out |
| CRM Clients (5.7) | `/clients` | Liste des clients, Fiche client, Historique des séjours, Vue factures/paiements client |
| Facturation (5.13) | dans la Fiche séjour | Onglet facturation, Liste des folios, Détail folio, Dialogues « ajouter charge / paiement / transférer », Aperçu facture |
| Comptes entreprise (City Ledger) | `/entreprises` | Liste des sociétés, Fiche entreprise (onglets : contacts, conditions/crédit, séjours agents, factures, compte courant, paiements/avances) |
| Housekeeping (5.6) | `/housekeeping` | Tableau housekeeping, Liste chambres (état réel), Fiche chambre, Tâches du jour, Historique/journal |
| Stock (5.10) | `/stock` | Liste articles, Fiche article, Mouvements de stock, Alertes de seuil, Référentiel fournisseurs |
| Écrans transverses | `/dashboard`, `/rapports`, `/audit` | Dashboard, Chambres, Rapports, Audit/logs |

**Contraintes UI transverses (section 6.3/7.2)** : interface Housekeeping et Check-in doivent être pensées responsive/tablette dès le départ ; l'écran Gouvernante doit être une version allégée (liste + bouton « Terminé », sans accès au reste de l'app) ; prévoir un mode sombre pour les postes de nuit.

---

## 6. Séquencement d'exécution — prompts Claude Code par phase

Reprend le séquencement déjà validé (cahier des charges, section 5), traduit en tâches Claude Code concrètes. Chaque tâche doit être une Issue GitHub distincte taguée avec son numéro de module.

### Phase 0 — Fondations techniques
1. `Prompt : « Initialise le monorepo backend/frontend selon docs/plan-execution-claude-code.md section 1. Configure ESLint, Prettier, Husky. »`
2. `Prompt : « Génère le docker-compose.yml (MySQL 8, backend, frontend, Nginx) et le Dockerfile de chaque service. »`
3. `Prompt : « Implémente le module core (5.1, 5.2, 5.2.1) : schéma Prisma HotelConfig/Role/Permission/User, endpoints auth JWT + refresh, landing page de connexion par profil dynamique, flux mot de passe oublié (lien 30 min). »`
4. `Prompt : « Configure GitHub Actions ci.yml (lint+test+build sur PR) et deploy.yml (build+push+SSH deploy sur main). »`
5. Exercice manuel : premier test de restauration de sauvegarde MySQL — à valider avant de continuer (non délégable à Claude Code, action infra).

### Phase 1 — Cœur métier (MVP)
6. `Prompt : « Implémente le module reservations (5.4) : schéma Reservation, endpoints CRUD + disponibilités + arrivées du jour, écran calendrier Gantt frontend avec glisser-déposer. »`
7. `Prompt : « Implémente le module checkin (5.5) : transformation réservation → Stay + Folio principal, check-in walk-in direct, checkout avec calcul du solde dû. »`
8. `Prompt : « Implémente une version simplifiée du module housekeeping : statut de chambre basique (sans machine à états complète) pour bloquer la vente d'une chambre occupée. »`
9. `Prompt : « Implémente billing version simplifiée (5.13) : génération de facture depuis un folio, calcul TVA/taxe de séjour à partir de TaxRateConfig — jamais de taux en dur. »`
10. `Prompt : « Implémente le dashboard basique (5.3) : occupation du jour, arrivées/départs. »`
11. **Jalon de fin de phase** : le PMS VPS doit remplacer complètement le PMS local pour les opérations quotidiennes de réception.

### Phase 2 — Intelligence opérationnelle
12. `Prompt : « Complète le module housekeeping (5.6) avec la machine à états complète (Libre&propre › Réservée › Occupée › Départ prévu › À nettoyer › En nettoyage › Libre&propre + branche En maintenance), déclenchée par l'événement checkout.effectue. »`
13. `Prompt : « Implémente maintenance (5.8) connecté au blocage automatique des chambres (statut EN_MAINTENANCE). »`
14. `Prompt : « Implémente guests/CRM complet (5.7) avec catégories (VIP, entreprise, agence, blacklist) et règles associées. »`
15. `Prompt : « Implémente suppliers + stock (5.9, 5.10) avec seuils d'alerte et sortie automatique liée au nombre de chambres nettoyées. »`

### Phase 3 — Ressources humaines
16. `Prompt : « Implémente hr-planning (5.11) : plannings hebdo/mensuel par rotation d'équipe, demandes d'échange de shift avec validation responsable. »`
17. `Prompt : « Implémente hr-payroll (5.12) : CnssRateConfig en base (jamais en dur), génération bulletin de paie PDF avec calcul automatique des cotisations. »` — utiliser le skill `calcul-cnss-tva`.
18. `Prompt : « Implémente time-shift (5.17) : machine à états (Non démarré/Actif/En pause/Terminé), détection multi-session par email, blocage à la déconnexion avec modale de choix, horodatage strictement côté serveur. »`

### Phase 4 — Pilotage et finitions
19. `Prompt : « Implémente expenses (5.14) et reports (5.15) avec exports PDF/Excel/CSV filtrables par période. »`
20. `Prompt : « Complète le dashboard (5.3) avec tous les graphiques dynamiques (Recharts). »`
21. `Prompt : « Renforce security-audit (5.16) : 2FA, AuditLog exhaustif sur les actions sensibles, tests de charge basiques. »`
22. Action manuelle : formation du personnel à l'outil (non délégable).

### Phase 5 — Réservation directe (conditionnelle)
23. **Ne déclencher qu'après validation du taux réel de réservations Booking.com recapturables.**
24. `Prompt : « Implémente le widget de réservation directe (0 % commission) connecté au module reservations via API publique dédiée avec rate limiting. »`

---

## 7. Plan de déploiement VPS et CI/CD

### 7.1 Infrastructure (à faire une fois, avant la Phase 0 applicative)
1. Souscrire un plan VPS Hostinger KVM 2, template Ubuntu 24.04 LTS.
2. Accès SSH par clé uniquement ; créer un utilisateur non-root avec sudo ; désactiver le login root.
3. Pare-feu `ufw` limité aux ports 22/80/443 ; installer `fail2ban`.
4. Installer Docker + Docker Compose.
5. DNS : pointer `pms.hotelmakarim.ma` (enregistrement A) vers l'IP du VPS.
6. Nginx (reverse proxy) + Certbot (HTTPS Let's Encrypt, renouvellement automatique) — **avant** tout déploiement applicatif.

### 7.2 Pipeline CI/CD (`.github/workflows/`)
- **`ci.yml`** (sur chaque PR) : install → lint → tests unitaires backend/frontend → build Docker images (sans push).
- **`deploy.yml`** (sur merge vers `main`) : build → push vers un registre (GitHub Container Registry) → connexion SSH au VPS → `docker compose pull && docker compose up -d` → vérification de santé (`GET /api/health`) → rollback automatique si échec.

### 7.3 Sauvegardes
- `mysqldump` quotidien automatisé, stockage externalisé (S3 ou équivalent), hors du VPS.
- Exercice de restauration complète programmé **au minimum trimestriel** (checklist section 7.1 du cahier des charges) — jamais une sauvegarde qui n'a pas été testée en restauration.

### 7.4 Checklists de mise en production
Reprendre intégralement les checklists 7.4 (technique, 9 points) et 7.5 (fonctionnelle, 10 points) du cahier des charges comme critères de sortie (« Definition of Done ») avant toute ouverture au personnel — à cocher dans l'Issue GitHub de fin de Phase 1 et de fin de Phase 4.

---

## 8. Points de vigilance techniques à rappeler à Claude Code

- Verrouillage anti-double-réservation (5.4) : transaction MySQL avec contrainte d'unicité sur (roomId, plage de dates) ou verrou applicatif — deux postes ne doivent jamais vendre la même chambre.
- Idempotence des paiements (5.13) : header `Idempotency-Key` obligatoire sur `POST /payments`, stocké et vérifié en base avant tout traitement.
- Immutabilité des factures (5.13) : aucune route `PATCH/DELETE /invoices/:id` ne doit exister — seule la création d'un `CreditNote` est permise.
- Suppression = corbeille (5.16) : soft delete (`deletedAt`) sur toutes les entités sensibles, jamais de `DELETE` physique immédiat.
- JWT + Time Shift (5.17, section 7.2) : le refresh token doit couvrir la durée réaliste d'un service ; une reconnexion doit retrouver le shift `EN_PAUSE` en cours sans le casser.
- Aucun taux métier en dur : CNSS, TVA, taxe de séjour → toujours lus depuis `CnssRateConfig` / `TaxRateConfig`, jamais une constante dans le code.

---

*Document préparé pour l'Hôtel Makarim (Tétouan) — plan d'exécution Claude Code, à utiliser conjointement avec le [Cahier des charges final — PMS Hôtel Makarim](Cahier-des-charges-final-PMS-Hotel-Makarim.pdf).*
