import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Données de départ cohérentes avec l'hôtel réel (24 chambres, cf. CLAUDE.md).
// Uniquement les modèles déjà livrés (RoomType, Room) — pas de données de
// modules non encore implémentés.
async function main() {
  const standard = await prisma.roomType.upsert({
    where: { id: 1 },
    update: {},
    create: { nom: 'Standard', prixBase: 450, capacite: 2 },
  });
  const superieure = await prisma.roomType.upsert({
    where: { id: 2 },
    update: {},
    create: { nom: 'Supérieure', prixBase: 650, capacite: 2 },
  });
  const suite = await prisma.roomType.upsert({
    where: { id: 3 },
    update: {},
    create: { nom: 'Suite', prixBase: 950, capacite: 3 },
  });

  const rooms = [
    ...Array.from({ length: 16 }, (_, i) => ({
      numero: `${100 + i + 1}`,
      roomTypeId: standard.id,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      numero: `${200 + i + 1}`,
      roomTypeId: superieure.id,
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      numero: `${300 + i + 1}`,
      roomTypeId: suite.id,
    })),
  ];

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { numero: room.numero },
      update: {},
      create: room,
    });
  }

  console.log(`Seed OK : 3 types de chambre, ${rooms.length} chambres.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
