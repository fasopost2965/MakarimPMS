import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

interface RoomResponse {
  id: number;
  numero: string;
}

// CH-006 (docs/governance/REGISTRE_CHANTIERS.md) : avant ce chantier, aucun
// mécanisme ne garantissait qu'une ligne soft-deleted (`deletedAt` non nul)
// disparaisse des listes — seuls 8 fichiers de service filtraient
// manuellement, et `Room` n'était filtré nulle part (RoomsService.
// findAllWithType n'a jamais eu de `where: { deletedAt: null }`). Ce test
// vérifie le mécanisme global (extension Prisma `$extends`, pas la
// discipline d'un service en particulier) via `GET /rooms`, qui n'a jamais
// filtré `deletedAt` explicitement — si ce test passe, c'est uniquement
// grâce au filtrage centralisé.
describe('CH-006 — Filtrage soft-delete centralisé (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roomTypeId: number;
  let client: ReturnType<typeof authedRequest>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    const token = await loginAs(app.getHttpServer(), 'gouvernante');
    client = authedRequest(app.getHttpServer(), token);

    const roomType = await prisma.roomType.create({
      data: { nom: 'TEST-SOFTDELETE-TYPE', prixBase: 300, capacite: 1 },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    await prisma.roomStatusLog.deleteMany({ where: { room: { roomTypeId } } });
    // $executeRawUnsafe : DELETE physique volontaire, réservé au nettoyage
    // de fixture de test — jamais un chemin d'écriture applicatif (ADR-005
    // interdit toujours la suppression physique en dehors des tests).
    await prisma.$executeRawUnsafe(
      `DELETE FROM Room WHERE roomTypeId = ${roomTypeId}`,
    );
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  // Preuve sabotage/restore (CLAUDE.md, garde non négociable-adjacente —
  // ADR-005 §3.1, "un Guest blacklisté puis soft-deleted ne devrait jamais
  // réapparaître") : `soft-delete.extension.ts` a été temporairement
  // modifié pour neutraliser le filtre
  // (`if (false && SOFT_DELETE_MODELS.has(model))`), ce test relancé seul
  // (`npx jest --config ./test/jest-e2e.json soft-delete.e2e-spec.ts`) —
  // l'assertion `expect(numerosAfter).not.toContain(...)` a bien échoué (la
  // chambre soft-deleted réapparaissait dans la liste), confirmant que le
  // test est discriminant. Le fichier a ensuite été restauré et le test
  // revérifié vert.
  it("une chambre soft-deleted (deletedAt non nul) disparaît de GET /rooms, sans qu'aucun code applicatif n'écrive jamais deletedAt lui-même", async () => {
    const room = await prisma.room.create({
      data: { numero: `TEST-SOFTDEL-${Date.now()}`, roomTypeId },
    });

    const before = await client.get('/api/rooms');
    expect(before.status).toBe(200);
    const numerosBefore = (before.body as RoomResponse[]).map((r) => r.numero);
    expect(numerosBefore).toContain(room.numero);

    // Aucune route API ne soft-delete quoi que ce soit aujourd'hui (aucun
    // code du projet n'écrit `deletedAt`, voir docs/governance/
    // DETTE_TECHNIQUE.md §6) — on simule directement en base le jour où un
    // futur chantier commencera à le faire.
    await prisma.$executeRawUnsafe(
      `UPDATE Room SET deletedAt = NOW() WHERE id = ${room.id}`,
    );

    const after = await client.get('/api/rooms');
    expect(after.status).toBe(200);
    const numerosAfter = (after.body as RoomResponse[]).map((r) => r.numero);
    expect(numerosAfter).not.toContain(room.numero);

    // findUnique (via une lecture directe) reste également filtré —
    // extendedWhereUnique (Prisma 5+), pas seulement findMany.
    const direct = await prisma.room.findUnique({ where: { id: room.id } });
    expect(direct).toBeNull();
  });
});
