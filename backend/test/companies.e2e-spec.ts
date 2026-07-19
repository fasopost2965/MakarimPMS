import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

interface CompanyResponse {
  id: number;
  raisonSociale: string;
  ice: string | null;
  conditionsPaiement: string | null;
  plafondCredit: string | null;
  contacts: ContactResponse[];
}

interface ContactResponse {
  id: number;
  companyId: number;
  nom: string;
}

// Comptes entreprise / City Ledger (cahier des charges §5.7, "Comptes
// entreprise"). Annuaire autonome pour cette itération — pas de règle
// métier non-négociable introduite (pas de blocage, pas de calcul de
// solde), donc uniquement du CRUD + permissions, pas de preuve de rigueur
// "sabotage" ici (à la différence de BLACKLIST, déjà couvert par
// guests.e2e-spec.ts). Vrais appels HTTP contre une vraie base MySQL.
describe('Comptes entreprise / City Ledger (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let comptableClient: ReturnType<typeof authedRequest>;
  let receptionClient: ReturnType<typeof authedRequest>;

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
    const comptableToken = await loginAs(app.getHttpServer(), 'comptable');
    comptableClient = authedRequest(app.getHttpServer(), comptableToken);
    const receptionToken = await loginAs(app.getHttpServer(), 'reception');
    receptionClient = authedRequest(app.getHttpServer(), receptionToken);
  });

  afterAll(async () => {
    await prisma.companyContact.deleteMany({
      where: { company: { raisonSociale: { startsWith: 'TEST-COMPANY-' } } },
    });
    await prisma.company.deleteMany({
      where: { raisonSociale: { startsWith: 'TEST-COMPANY-' } },
    });
    await app.close();
  });

  it('POST /companies crée une entreprise (Comptable, write)', async () => {
    const res = await comptableClient.post('/api/companies').send({
      raisonSociale: 'TEST-COMPANY-Atlas Voyages',
      ice: '001122334455667',
      conditionsPaiement: '30 jours',
      plafondCredit: 50000,
    });
    expect(res.status).toBe(201);
    const company = res.body as CompanyResponse;
    expect(company.raisonSociale).toBe('TEST-COMPANY-Atlas Voyages');
    expect(company.plafondCredit).toBe('50000');
  });

  it('GET /companies?q= retrouve une entreprise par raisonSociale ou ice', async () => {
    const created = await comptableClient.post('/api/companies').send({
      raisonSociale: 'TEST-COMPANY-Sahara Tours',
      ice: '009988776655443',
    });
    const id = (created.body as CompanyResponse).id;

    const byNom = await comptableClient.get('/api/companies?q=Sahara Tours');
    expect(byNom.status).toBe(200);
    expect((byNom.body as CompanyResponse[]).some((c) => c.id === id)).toBe(
      true,
    );

    const byIce = await comptableClient.get('/api/companies?q=009988776655443');
    expect((byIce.body as CompanyResponse[]).some((c) => c.id === id)).toBe(
      true,
    );
  });

  it('PATCH /companies/:id met à jour plafondCredit et conditionsPaiement', async () => {
    const created = await comptableClient.post('/api/companies').send({
      raisonSociale: 'TEST-COMPANY-Medina Trading',
    });
    const id = (created.body as CompanyResponse).id;

    const updated = await comptableClient.patch(`/api/companies/${id}`).send({
      plafondCredit: 75000,
      conditionsPaiement: '60 jours',
    });
    expect(updated.status).toBe(200);
    const body = updated.body as CompanyResponse;
    expect(body.plafondCredit).toBe('75000');
    expect(body.conditionsPaiement).toBe('60 jours');
  });

  it('POST /companies/:id/contacts ajoute un contact, retourné par GET /companies/:id', async () => {
    const created = await comptableClient.post('/api/companies').send({
      raisonSociale: 'TEST-COMPANY-Ocean Import',
    });
    const id = (created.body as CompanyResponse).id;

    const contact = await comptableClient
      .post(`/api/companies/${id}/contacts`)
      .send({ nom: 'Hicham Berrada', role: 'Directeur achats' });
    expect(contact.status).toBe(201);

    const fetched = await comptableClient.get(`/api/companies/${id}`);
    expect(fetched.status).toBe(200);
    expect(
      (fetched.body as CompanyResponse).contacts.some(
        (c) => c.nom === 'Hicham Berrada',
      ),
    ).toBe(true);
  });

  it('DELETE /companies/:id/contacts/:contactId supprime le contact', async () => {
    const created = await comptableClient.post('/api/companies').send({
      raisonSociale: 'TEST-COMPANY-Nord Logistique',
    });
    const id = (created.body as CompanyResponse).id;

    const contact = await comptableClient
      .post(`/api/companies/${id}/contacts`)
      .send({ nom: 'À supprimer' });
    const contactId = (contact.body as ContactResponse).id;

    const removed = await comptableClient.delete(
      `/api/companies/${id}/contacts/${contactId}`,
    );
    expect(removed.status).toBe(204);

    const fetched = await comptableClient.get(`/api/companies/${id}`);
    expect(
      (fetched.body as CompanyResponse).contacts.some(
        (c) => c.id === contactId,
      ),
    ).toBe(false);
  });

  it("Réception n'a pas accès (403), Comptable oui (200/201)", async () => {
    const listAsReception = await receptionClient.get('/api/companies');
    expect(listAsReception.status).toBe(403);

    const createAsReception = await receptionClient
      .post('/api/companies')
      .send({ raisonSociale: 'TEST-COMPANY-Refusée' });
    expect(createAsReception.status).toBe(403);

    const listAsComptable = await comptableClient.get('/api/companies');
    expect(listAsComptable.status).toBe(200);
  });
});
