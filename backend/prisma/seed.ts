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
  await prisma.creditNote.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.folioLine.deleteMany();
  await prisma.folio.deleteMany();
  await prisma.roomNight.deleteMany();
  await prisma.stay.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.taxRateConfig.deleteMany();
  await prisma.seasonRate.deleteMany();
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
  // Modules métier existants seulement — maintenance/guests/stock/RH
  // recevront leurs permissions quand ces modules seront construits en
  // Phase 2 (voir CLAUDE.md règle 5 : les rôles Maintenance/RH existent déjà
  // en base pour ne pas devoir migrer le schéma à ce moment-là, mais restent
  // sans permission active — donc invisibles sur la landing page tant
  // qu'aucune permission ne leur est accordée, cf. AuthService.rolesActifs).
  const ALL_MODULES = [
    'reservations',
    'checkin',
    'housekeeping',
    'billing',
    'dashboard',
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
      ],
    },
    {
      nom: 'Gouvernante',
      permissionKeys: ['housekeeping:read', 'housekeeping:write'],
    },
    {
      nom: 'Comptable',
      permissionKeys: ['billing:read', 'billing:write', 'dashboard:read'],
    },
    { nom: 'Maintenance', permissionKeys: [] },
    { nom: 'RH', permissionKeys: [] },
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

  console.log(
    `Seed OK : ${roomTypesData.length} types de chambre, ${seasonRatesData.length} tarifs saisonniers, ${totalRooms} chambres, ${taxRates.length} taux de taxe, ${rolesData.length} rôles, ${usersData.length} utilisateurs de dev (mot de passe commun : ${DEV_PASSWORD}).`,
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
