/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AuditAction, AuditEntity, StatutBonCommande } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

// Lot 8 (Handoff final) — bons de commande fournisseur (économat).
// purchase-orders:read/write : Administrateur + Gouvernante (Économat).
// purchase-orders:valider : Administrateur uniquement (action dédiée non
// exprimable par @RequirePermission, vérifiée dynamiquement dans le
// service — même pattern que checkin:force-checkout).
describe('Purchase orders (Lot 8, économat)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminClient: ReturnType<typeof authedRequest>;
  let gouvernanteClient: ReturnType<typeof authedRequest>;
  let comptableClient: ReturnType<typeof authedRequest>;
  let maintenanceClient: ReturnType<typeof authedRequest>;

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
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    adminClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'admin'),
    );
    gouvernanteClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'gouvernante'),
    );
    comptableClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'comptable'),
    );
    maintenanceClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'maintenance'),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  async function createTestSupplier() {
    const res = await adminClient.post('/api/purchase-orders/suppliers').send({
      nom: `TEST-FOURNISSEUR-${Date.now()}`,
      email: 'fournisseur@test.local',
    });
    expect(res.status).toBe(201);
    return res.body.id as number;
  }

  describe('Fournisseurs', () => {
    it('la Maintenance (sans purchase-orders:read) ne peut pas lister les fournisseurs (403)', async () => {
      const res = await maintenanceClient.get('/api/purchase-orders/suppliers');
      expect(res.status).toBe(403);
    });

    it("l'Administrateur peut créer un fournisseur", async () => {
      const supplierId = await createTestSupplier();
      expect(supplierId).toBeGreaterThan(0);
      await prisma.supplier.delete({ where: { id: supplierId } });
    });

    it('le Comptable (purchase-orders:read seul) ne peut pas créer de fournisseur (403)', async () => {
      const res = await comptableClient
        .post('/api/purchase-orders/suppliers')
        .send({ nom: 'TEST-RBAC-COMPTABLE' });
      expect(res.status).toBe(403);
    });
  });

  describe('Cycle de vie du bon de commande', () => {
    it('la Gouvernante crée un bon en BROUILLON, le soumet, puis un non-Administrateur ne peut pas le valider (403)', async () => {
      const supplierId = await createTestSupplier();

      const createRes = await gouvernanteClient
        .post('/api/purchase-orders')
        .send({
          supplierId,
          demandeur: 'Test e2e Économat',
          lignes: [
            {
              designation: 'Draps housse test',
              quantite: 10,
              prixUnitaire: 85,
            },
            { designation: 'Serviettes test', quantite: 20, prixUnitaire: 42 },
          ],
        });
      expect(createRes.status).toBe(201);
      const id = createRes.body.id;
      expect(createRes.body.statut).toBe(StatutBonCommande.BROUILLON);
      expect(createRes.body.numero).toMatch(/^BC-\d{6}-\d{6}$/);
      // 10*85 + 20*42 = 850 + 840 = 1690
      const lignes = createRes.body.lignes as { montant: string }[];
      const total = lignes.reduce(
        (acc: number, l: { montant: string }) => acc + Number(l.montant),
        0,
      );
      expect(total).toBe(1690);

      const submitRes = await gouvernanteClient.patch(
        `/api/purchase-orders/${id}/soumettre`,
      );
      expect(submitRes.status).toBe(200);
      expect(submitRes.body.statut).toBe(
        StatutBonCommande.EN_ATTENTE_VALIDATION,
      );

      // La Gouvernante a purchase-orders:write (garde-fou du décorateur)
      // mais pas purchase-orders:valider (vérification dynamique interne).
      const forbiddenValidate = await gouvernanteClient
        .patch(`/api/purchase-orders/${id}/valider`)
        .send({ motif: 'Tentative de validation non autorisée test e2e' });
      expect(forbiddenValidate.status).toBe(403);

      const validateRes = await adminClient
        .patch(`/api/purchase-orders/${id}/valider`)
        .send({ motif: 'Validation budget confirmée test e2e' });
      expect(validateRes.status).toBe(200);
      expect(validateRes.body.statut).toBe(StatutBonCommande.VALIDEE);
      expect(validateRes.body.validatedById).not.toBeNull();

      const logs = await prisma.auditLog.findMany({
        where: { targetEntity: AuditEntity.PurchaseOrder, targetId: id },
      });
      const actions = logs.map((l) => l.action).sort();
      expect(actions).toEqual(
        [
          AuditAction.CREATE_PURCHASE_ORDER,
          AuditAction.SUBMIT_PURCHASE_ORDER,
          AuditAction.VALIDATE_PURCHASE_ORDER,
        ].sort(),
      );

      // Un bon VALIDEE n'est plus modifiable ni annulable.
      const patchAfterValidation = await gouvernanteClient
        .patch(`/api/purchase-orders/${id}`)
        .send({ demandeur: 'Modification refusée' });
      expect(patchAfterValidation.status).toBe(409);
      const cancelAfterValidation = await adminClient
        .patch(`/api/purchase-orders/${id}/annuler`)
        .send({ motif: 'Tentative annulation bon déjà validé test e2e' });
      expect(cancelAfterValidation.status).toBe(409);

      await prisma.purchaseOrderLine.deleteMany({
        where: { purchaseOrderId: id },
      });
      await prisma.purchaseOrder.delete({ where: { id } });
      await prisma.supplier.delete({ where: { id: supplierId } });
    });

    it('un motif < 10 caractères sur la validation est rejeté (400)', async () => {
      const supplierId = await createTestSupplier();
      const createRes = await adminClient.post('/api/purchase-orders').send({
        supplierId,
        demandeur: 'Test e2e motif court',
        lignes: [
          { designation: 'Article test', quantite: 1, prixUnitaire: 10 },
        ],
      });
      const id = createRes.body.id;
      await adminClient.patch(`/api/purchase-orders/${id}/soumettre`);

      const res = await adminClient
        .patch(`/api/purchase-orders/${id}/valider`)
        .send({ motif: 'court' });
      expect(res.status).toBe(400);

      await prisma.purchaseOrderLine.deleteMany({
        where: { purchaseOrderId: id },
      });
      await prisma.purchaseOrder.delete({ where: { id } });
      await prisma.supplier.delete({ where: { id: supplierId } });
    });

    it('annule un bon en BROUILLON (motif obligatoire) — écrit AuditLog', async () => {
      const supplierId = await createTestSupplier();
      const createRes = await gouvernanteClient
        .post('/api/purchase-orders')
        .send({
          supplierId,
          demandeur: 'Test e2e annulation',
          lignes: [
            { designation: 'Article annulé', quantite: 2, prixUnitaire: 30 },
          ],
        });
      const id = createRes.body.id;

      const cancelRes = await gouvernanteClient
        .patch(`/api/purchase-orders/${id}/annuler`)
        .send({ motif: 'Erreur de saisie, annulation test e2e' });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.statut).toBe(StatutBonCommande.ANNULEE);

      const logs = await prisma.auditLog.findMany({
        where: {
          targetEntity: AuditEntity.PurchaseOrder,
          targetId: id,
          action: AuditAction.CANCEL_PURCHASE_ORDER,
        },
      });
      expect(logs).toHaveLength(1);

      await prisma.purchaseOrderLine.deleteMany({
        where: { purchaseOrderId: id },
      });
      await prisma.purchaseOrder.delete({ where: { id } });
      await prisma.supplier.delete({ where: { id: supplierId } });
    });

    it('un stockItemId inexistant sur une ligne renvoie 404', async () => {
      const supplierId = await createTestSupplier();
      const res = await adminClient.post('/api/purchase-orders').send({
        supplierId,
        demandeur: 'Test e2e stockItemId invalide',
        lignes: [
          {
            stockItemId: 999999,
            designation: 'Article lié à un stock inexistant',
            quantite: 1,
            prixUnitaire: 10,
          },
        ],
      });
      expect(res.status).toBe(404);

      await prisma.supplier.delete({ where: { id: supplierId } });
    });

    it('un supplierId inexistant sur la création renvoie 404', async () => {
      const res = await adminClient.post('/api/purchase-orders').send({
        supplierId: 999999,
        demandeur: 'Test e2e supplierId invalide',
        lignes: [{ designation: 'Article', quantite: 1, prixUnitaire: 10 }],
      });
      expect(res.status).toBe(404);
    });
  });
});

// Preuve de rigueur (CLAUDE.md — convention sabotage/restore) : effectuée à
// la vérification de cette PR, pas conservée en code. En commentant
// temporairement la vérification `grant`/ForbiddenException dans
// PurchaseOrdersService.validatePurchaseOrder, le test « ... ne peut pas le
// valider (403) » échoue bien (200 au lieu de 403 attendu) — confirmant
// qu'il est discriminant sur purchase-orders:valider, pas seulement sur
// purchase-orders:write (déjà accordé à la Gouvernante). Rétabli avant
// commit, suite revérifiée verte.
