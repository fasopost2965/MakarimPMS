import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Données de référence pour le développement local (24 chambres, cf.
// CLAUDE.md), cohérentes avec le cahier des charges §5.1/§5.4 (grille
// tarifaire saisonnière). Ce script réinitialise entièrement les données de
// réservation/tarification à chaque exécution — c'est un seed de dev, pas
// une migration : ne jamais le lancer contre une base de production.
async function main() {
  await prisma.folioLine.deleteMany();
  await prisma.folio.deleteMany();
  await prisma.roomNight.deleteMany();
  await prisma.stay.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.guest.deleteMany();
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

  console.log(
    `Seed OK : ${roomTypesData.length} types de chambre, ${seasonRatesData.length} tarifs saisonniers, ${totalRooms} chambres.`,
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
