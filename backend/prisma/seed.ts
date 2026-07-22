import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Mot de passe de développement commun à tous les comptes de seed — jamais
// utilisé tel quel en production (ce script refuse par convention de
// tourner contre une base de prod, voir commentaire plus bas). Toujours
// haché avant stockage, même ici.
const DEV_PASSWORD = 'Password123!';

// Données de référence pour le développement local (24 chambres, cf.
// CLAUDE.md), cohérentes avec le cahier des charges §5.1/§5.4 (grille
// tarifaire saisonnière). Ce script réinitialise entièrement les données de
// réservation/tarification à chaque exécution — c'est un seed de dev, pas
// une migration : ne jamais le lancer contre une base de production.
async function main() {
  await prisma.passwordResetToken.deleteMany();
  await prisma.loginLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.hotelConfig.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservationDeposit.deleteMany();
  await prisma.creditNote.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.folioLine.deleteMany();
  await prisma.folio.deleteMany();
  await prisma.roomNight.deleteMany();
  await prisma.policeRecord.deleteMany();
  await prisma.stay.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.guestCategoryLog.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.companyContact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.taxRateConfig.deleteMany();
  await prisma.seasonRate.deleteMany();
  await prisma.roomStatusLog.deleteMany();
  await prisma.maintenanceTicket.deleteMany();
  await prisma.room.deleteMany();
  await prisma.roomType.deleteMany();

  const roomTypesData = [
    { nom: 'Single', prixBase: 400, capacite: 1 },
    { nom: 'Double', prixBase: 500, capacite: 2 },
    { nom: 'Triple', prixBase: 750, capacite: 3 },
    { nom: 'Suite', prixBase: 650, capacite: 2 },
    { nom: 'Quadruple', prixBase: 900, capacite: 4 },
  ];
  const roomTypes: Record<string, { id: number }> = {};
  for (const data of roomTypesData) {
    roomTypes[data.nom] = await prisma.roomType.create({ data });
  }

  // Deux paliers de haute saison, mêmes bornes pour tous les types
  // (uniquement le prixNuit varie), conformément à la demande.
  const seasonRatesData: Array<{
    typeNom: string;
    libelle: string;
    dateDebut: string;
    dateFin: string;
    prixNuit: number;
  }> = [
    {
      typeNom: 'Single',
      libelle: 'Haute saison 1',
      dateDebut: '2026-07-01',
      dateFin: '2026-07-19',
      prixNuit: 600,
    },
    {
      typeNom: 'Double',
      libelle: 'Haute saison 1',
      dateDebut: '2026-07-01',
      dateFin: '2026-07-19',
      prixNuit: 750,
    },
    {
      typeNom: 'Triple',
      libelle: 'Haute saison 1',
      dateDebut: '2026-07-01',
      dateFin: '2026-07-19',
      prixNuit: 900,
    },
    {
      typeNom: 'Suite',
      libelle: 'Haute saison 1',
      dateDebut: '2026-07-01',
      dateFin: '2026-07-19',
      prixNuit: 800,
    },
    {
      typeNom: 'Quadruple',
      libelle: 'Haute saison 1',
      dateDebut: '2026-07-01',
      dateFin: '2026-07-19',
      prixNuit: 1100,
    },
    {
      typeNom: 'Single',
      libelle: 'Haute saison 2',
      dateDebut: '2026-07-20',
      dateFin: '2026-08-31',
      prixNuit: 700,
    },
    {
      typeNom: 'Double',
      libelle: 'Haute saison 2',
      dateDebut: '2026-07-20',
      dateFin: '2026-08-31',
      prixNuit: 850,
    },
    {
      typeNom: 'Triple',
      libelle: 'Haute saison 2',
      dateDebut: '2026-07-20',
      dateFin: '2026-08-31',
      prixNuit: 1000,
    },
    {
      typeNom: 'Suite',
      libelle: 'Haute saison 2',
      dateDebut: '2026-07-20',
      dateFin: '2026-08-31',
      prixNuit: 900,
    },
    {
      typeNom: 'Quadruple',
      libelle: 'Haute saison 2',
      dateDebut: '2026-07-20',
      dateFin: '2026-08-31',
      prixNuit: 1200,
    },
  ];
  for (const {
    typeNom,
    dateDebut,
    dateFin,
    prixNuit,
    libelle,
  } of seasonRatesData) {
    await prisma.seasonRate.create({
      data: {
        libelle,
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateFin),
        prixNuit,
        roomTypeId: roomTypes[typeNom].id,
      },
    });
  }

  // 24 chambres réparties par type (une plage de numéros par étage/type).
  const roomPlan: Array<{ typeNom: string; prefix: number; count: number }> = [
    { typeNom: 'Single', prefix: 100, count: 6 },
    { typeNom: 'Double', prefix: 200, count: 8 },
    { typeNom: 'Triple', prefix: 300, count: 4 },
    { typeNom: 'Suite', prefix: 400, count: 4 },
    { typeNom: 'Quadruple', prefix: 500, count: 2 },
  ];
  let totalRooms = 0;
  for (const { typeNom, prefix, count } of roomPlan) {
    for (let i = 1; i <= count; i++) {
      await prisma.room.create({
        data: { numero: `${prefix + i}`, roomTypeId: roomTypes[typeNom].id },
      });
      totalRooms++;
    }
  }

  // Configuration des taux TVA et taxe de séjour (module billing 5.13).
  // Jamais de taux codé en dur — toujours lus depuis cette table.
  const taxRates = [
    { type: 'TVA_HEBERGEMENT', taux: 10 },
    { type: 'TVA_ANNEXE', taux: 20 },
    { type: 'TAXE_SEJOUR', taux: 2 },
  ];
  for (const rate of taxRates) {
    await prisma.taxRateConfig.create({
      data: {
        type: rate.type,
        taux: new Prisma.Decimal(rate.taux),
      },
    });
  }

  // Barème CNSS/AMO marocain (BR-RH-001, module hr 5.11). Table posée par le
  // module parameters, activée au Sprint 11. Taux salariaux exacts du cahier
  // des charges (SPRINT_11.md §4 : brut 8500 MAD ➔ retenue CNSS 268.80 MAD,
  // retenue AMO 192.10 MAD) ; taux employeur = barème CNSS national publié,
  // exposés en lecture seule dans PayrollService pour le suivi des charges
  // patronales, jamais soustraits du salaire net de l'employé.
  const cnssRates = [
    {
      branche: 'Prestations sociales (CNSS)',
      tauxSalarie: 4.48,
      tauxEmployeur: 8.98,
      plafondMensuel: 6000,
    },
    {
      branche: 'AMO',
      tauxSalarie: 2.26,
      tauxEmployeur: 4.11,
      plafondMensuel: null,
    },
  ];
  for (const rate of cnssRates) {
    await prisma.cnssRateConfig.create({
      data: {
        branche: rate.branche,
        tauxSalarie: new Prisma.Decimal(rate.tauxSalarie),
        tauxEmployeur: new Prisma.Decimal(rate.tauxEmployeur),
        // Barème en vigueur "depuis toujours" du point de vue applicatif —
        // pas la date d'exécution du seed (PayrollService.tauxActif
        // sélectionne le taux applicable via applicableDepuis <= date de
        // référence du bulletin ; un défaut à now() rendrait injustement
        // introuvable tout calcul pour un mois passé).
        applicableDepuis: new Date('2020-01-01'),
        plafondMensuel:
          rate.plafondMensuel != null
            ? new Prisma.Decimal(rate.plafondMensuel)
            : null,
      },
    });
  }

  // Configuration légale/fiscale de l'hôtel (module core 5.1) — singleton,
  // une seule ligne, réutilisée par la facturation (en-tête de facture) et
  // l'UI (devise, format de date).
  await prisma.hotelConfig.create({
    data: {
      raisonSociale: 'Hôtel Makarim SARL',
      ice: '000000000000000',
      identifiantFiscal: '00000000',
      rc: '00000',
      adresse: 'Tétouan, Maroc',
      categorieEtoiles: 3,
    },
  });

  // Rôles, permissions et comptes de développement (module core 5.2/5.2.1).
  // Stock recevra ses permissions quand ce module sera construit (Sprint 12).
  // Les rôles Maintenance (5.8), guests (5.7, Réception en écriture/Comptable
  // en lecture seule) et RH (5.11, Sprint 11) sont désormais actifs.
  // audit:read est réservé à l'Administrateur (ADR-005/audit.md §7 — "aucun
  // rôle d'exploitation n'a d'accès de lecture sur le journal de sécurité
  // central"), obtenu automatiquement via Object.keys(permissions)
  // ci-dessous, jamais accordé explicitement à un autre rôle.
  //
  // Arbitrage d'architecture (2026-07-19, décision explicite validée) :
  // Company reste une responsabilité du module guests (pas de module/clé de
  // permission `companies` séparée — docs/modules/guests.md §2 : "gestion
  // des fiches d'entreprises... ainsi que de leurs plafonds de crédit"),
  // câblé via CompaniesController mais protégé par les mêmes clés
  // guests:read/guests:write. Le changement de catégorie vers/depuis
  // BLACKLIST exige en plus la permission dédiée `guests:blacklist`,
  // réservée à l'Administrateur (docs/modules/guests.md §7) — Réception
  // garde guests:write pour les autres catégories mais ne peut plus
  // blacklister un client.
  const ALL_MODULES = [
    'reservations',
    'checkin',
    'housekeeping',
    'billing',
    'payments',
    'parameters',
    'dashboard',
    'maintenance',
    'guests',
    'audit',
    'rh',
    'stock',
    'reporting',
  ] as const;
  const ALL_ACTIONS = ['read', 'write', 'delete', 'export'] as const;

  const permissions: Record<string, { id: number }> = {};
  for (const module of ALL_MODULES) {
    for (const action of ALL_ACTIONS) {
      const key = `${module}:${action}`;
      permissions[key] = await prisma.permission.create({
        data: { module, action },
      });
    }
  }
  // Action dédiée, hors de la grille read/write/delete/export générique —
  // seul le module guests l'utilise (blacklister/débloquer un client).
  permissions['guests:blacklist'] = await prisma.permission.create({
    data: { module: 'guests', action: 'blacklist' },
  });
  // Idem pour le remboursement d'acompte (Priorité 2, "admin seulement") :
  // payments:write couvre l'encaissement quotidien (Réception/Comptable),
  // payments:refund est une action distincte réservée à l'Administrateur.
  permissions['payments:refund'] = await prisma.permission.create({
    data: { module: 'payments', action: 'refund' },
  });

  const rolesData: Array<{
    nom: string;
    permissionKeys: string[];
  }> = [
    {
      nom: 'Administrateur',
      permissionKeys: Object.keys(permissions),
    },
    {
      nom: 'Réception',
      permissionKeys: [
        'reservations:read',
        'reservations:write',
        'checkin:read',
        'checkin:write',
        'housekeeping:read',
        'housekeeping:write',
        'dashboard:read',
        'guests:read',
        // guests:write couvre la création/mise à jour de fiches client et
        // entreprise et les catégories non sensibles (VIP/ENTREPRISE/
        // AGENCE/STANDARD) — jamais guests:blacklist (Administrateur seul).
        'guests:write',
        // payments:read seul (docs/modules/payments.md §7) — la Réception
        // consulte les règlements déjà encaissés mais n'en enregistre
        // jamais elle-même (contrôle interne de caisse, réservé au
        // Comptable/Admin).
        'payments:read',
        // parameters:read seul (docs/modules/parameters.md §7) — la
        // Réception consulte la grille tarifaire saisonnière pour conseiller
        // un tarif, mais ne modifie jamais un taux/l'identité de l'hôtel
        // (parameters:write réservé à l'Administrateur).
        'parameters:read',
      ],
    },
    {
      nom: 'Gouvernante',
      // maintenance:read en plus de housekeeping : voit les tickets qui
      // bloquent ses chambres (statut EN_MAINTENANCE), sans pouvoir en
      // créer/résoudre (write réservé au rôle Maintenance).
      permissionKeys: [
        'housekeeping:read',
        'housekeeping:write',
        'maintenance:read',
        // stock:read/write (RBAC_MATRIX.md §3, Sprint 12) — seule la
        // Gouvernante gère les consommables ménagers en plus de
        // l'Administrateur ; ni delete ni export (RBAC_MATRIX.md l'exclut
        // explicitement, y compris pour Maintenance malgré une mention
        // contraire dans docs/modules/stock.md — RBAC_MATRIX.md fait foi).
        'stock:read',
        'stock:write',
      ],
    },
    {
      nom: 'Comptable',
      // guests:read uniquement (jamais write) — le Comptable consulte les
      // fiches client/entreprise (factures, plafond de crédit) mais ne les
      // modifie pas ; c'est le rôle Réception qui gère le CRM au quotidien.
      permissionKeys: [
        'billing:read',
        'billing:write',
        'payments:read',
        'payments:write',
        'dashboard:read',
        'guests:read',
        // parameters:read seul (docs/modules/parameters.md §7) — le
        // Comptable consulte les taux de TVA/taxe de séjour pour son travail
        // quotidien, mais ne les modifie pas (parameters:write réservé à
        // l'Administrateur — modifier un taux est un acte de configuration
        // exceptionnel, contrairement à billing:write pour les opérations
        // financières courantes).
        'parameters:read',
        // reporting:read/export (Sprint 13) — RBAC_MATRIX.md n'a pas de
        // ligne dédiée reporting/accounting ; arbitrage aligné sur billing
        // (déjà Comptable-only) et le consensus d'accounting.md/reporting.md
        // malgré leurs divergences par ailleurs (accès strictement réservé
        // Administrateur + Comptable, jamais aux rôles opérationnels —
        // rapport de police et données financières consolidées).
        'reporting:read',
        'reporting:export',
      ],
    },
    {
      nom: 'Maintenance',
      permissionKeys: ['maintenance:read', 'maintenance:write'],
    },
    {
      nom: 'RH',
      // Activé au Sprint 11 (docs/RBAC_MATRIX.md §6) : lecture/écriture des
      // fiches employé, plannings, pointages et bulletins de paie, export des
      // relevés de cotisations CNSS/AMO. Jamais de suppression physique
      // (rh:delete non accordé — RBAC_MATRIX.md "Interdit de supprimer
      // définitivement un dossier de paie ou d'employé").
      permissionKeys: ['rh:read', 'rh:write', 'rh:export'],
    },
  ];

  const roles: Record<string, { id: number }> = {};
  for (const { nom, permissionKeys } of rolesData) {
    const role = await prisma.role.create({ data: { nom } });
    roles[nom] = role;
    for (const key of permissionKeys) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permissions[key].id },
      });
    }
  }

  // Un compte de développement par rôle, mot de passe commun DEV_PASSWORD
  // (haché bcrypt). Emails prévisibles pour les tests e2e et la
  // vérification manuelle en local.
  const motDePasseHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const usersData = [
    { nom: 'Admin Test', email: 'admin@makarim.test', role: 'Administrateur' },
    {
      nom: 'Réception Test',
      email: 'reception@makarim.test',
      role: 'Réception',
    },
    {
      nom: 'Gouvernante Test',
      email: 'gouvernante@makarim.test',
      role: 'Gouvernante',
    },
    {
      nom: 'Comptable Test',
      email: 'comptable@makarim.test',
      role: 'Comptable',
    },
    {
      nom: 'Maintenance Test',
      email: 'maintenance@makarim.test',
      role: 'Maintenance',
    },
    { nom: 'RH Test', email: 'rh@makarim.test', role: 'RH' },
  ];
  for (const { nom, email, role } of usersData) {
    await prisma.user.create({
      data: { nom, email, motDePasseHash, roleId: roles[role].id },
    });
  }

  // Inventaire de départ (module stock 5.12, Sprint 12). kitAccueil=true
  // pour les deux articles décomptés automatiquement à chaque validation de
  // nettoyage (BR-STK-001, docs/events/EVENT_CATALOG.md §3.3 — 1 unité par
  // occupant théorique de la chambre nettoyée). Draps : article de stock
  // ordinaire, réassort manuel uniquement, jamais décompté automatiquement.
  const stockItems = [
    {
      code: 'AMEN-SOAP-01',
      libelle: 'Mini Savon Makarim 15g',
      quantiteDisponible: 200,
      seuilAlerte: 40,
      uniteMesure: 'unité',
      kitAccueil: true,
    },
    {
      code: 'AMEN-SHMP-01',
      libelle: 'Mini Shampoing Makarim 30ml',
      quantiteDisponible: 200,
      seuilAlerte: 40,
      uniteMesure: 'unité',
      kitAccueil: true,
    },
    {
      code: 'LINGE-DRAP-01',
      libelle: 'Drap housse 140x190',
      quantiteDisponible: 80,
      seuilAlerte: 15,
      uniteMesure: 'unité',
      kitAccueil: false,
    },
  ];
  for (const item of stockItems) {
    await prisma.stockItem.create({ data: item });
  }

  console.log(
    `Seed OK : ${roomTypesData.length} types de chambre, ${seasonRatesData.length} tarifs saisonniers, ${totalRooms} chambres, ${taxRates.length} taux de taxe, ${cnssRates.length} barèmes CNSS/AMO, ${stockItems.length} articles de stock, ${rolesData.length} rôles, ${usersData.length} utilisateurs de dev (mot de passe commun : ${DEV_PASSWORD}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
