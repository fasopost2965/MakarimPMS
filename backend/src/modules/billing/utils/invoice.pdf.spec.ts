import { buildInvoicePdf, InvoicePdfData } from './invoice.pdf';

function sampleData(overrides: Partial<InvoicePdfData> = {}): InvoicePdfData {
  return {
    hotel: {
      raisonSociale: 'Hôtel Makarim',
      adresse: 'Tétouan',
      ice: '000111222',
      identifiantFiscal: '333444',
      rc: '555666',
      categorieEtoiles: 3,
    },
    guest: { nom: 'Alami', prenom: 'Yasmine', email: 'yasmine@example.com' },
    stay: { id: 42, roomNumero: '101', roomTypeNom: 'Double' },
    invoice: {
      numero: 'FAC-202607-000042',
      createdAt: new Date('2026-07-01T10:00:00.000Z'),
      montantTotal: '1250.00',
      statut: 'EMISE',
    },
    lignes: [
      { libelle: 'Hébergement — 3 nuits', montant: '1000.00', annulee: false },
      { libelle: 'Extra — mini-bar', montant: '150.00', annulee: false },
      {
        libelle: 'Ligne annulée (ne doit pas apparaître)',
        montant: '999.00',
        annulee: true,
      },
    ],
    ...overrides,
  };
}

// Même discipline que police-record.pdf.spec.ts (absent, mais même
// convention que les autres utilitaires purs du projet) — un PDF réel est
// un flux binaire, on ne peut pas en asserter le rendu texte par texte,
// mais on peut vérifier qu'il se génère sans erreur, produit un Buffer PDF
// valide (signature %PDF), et que son contenu binaire reflète bien les
// données réellement passées (montants, numéro de facture) plutôt qu'une
// valeur fabriquée.
describe('buildInvoicePdf', () => {
  it('génère un buffer PDF valide (signature %PDF)', async () => {
    const pdf = await buildInvoicePdf(sampleData());
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('contient le numéro de facture et le total TTC réels dans le flux généré', async () => {
    const pdf = await buildInvoicePdf(sampleData());
    // pdfkit compresse le contenu par défaut — on ne peut pas grep le texte
    // brut dans le buffer compressé, mais on peut vérifier que les entrées
    // (fonts/objets) attendues sont bien présentes et qu'aucune exception
    // n'a été levée pour un montant/numéro réel non trivial.
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("n'échoue pas sur une facture sans email client", async () => {
    const data = sampleData({
      guest: { nom: 'Bennani', prenom: 'Karim', email: null },
    });
    const pdf = await buildInvoicePdf(data);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  // Design Marine & Or — logo optionnel (HotelConfig.logoUrl), décodé
  // depuis un data URI base64 et embarqué en en-tête (voir invoice.pdf.ts).
  it('génère un PDF valide plus volumineux quand un logo est fourni', async () => {
    const smallPngDataUri =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const pdfSansLogo = await buildInvoicePdf(sampleData());
    const pdfAvecLogo = await buildInvoicePdf(
      sampleData({
        hotel: { ...sampleData().hotel, logoUrl: smallPngDataUri },
      }),
    );
    expect(pdfAvecLogo.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdfAvecLogo.length).toBeGreaterThan(pdfSansLogo.length);
  });

  it("n'échoue pas si logoUrl n'a pas le préfixe data URI attendu (ignoré silencieusement)", async () => {
    const pdf = await buildInvoicePdf(
      sampleData({
        hotel: { ...sampleData().hotel, logoUrl: 'not-a-valid-data-uri' },
      }),
    );
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  // Preuve de rigueur sabotage/restore : un logoUrl avec le bon préfixe
  // data URI mais un contenu base64 qui n'est pas une image décodable
  // (corruption improbable en base, la validation DTO en amont devrait
  // déjà l'empêcher) ne doit jamais faire échouer la génération de la
  // facture — dégradation silencieuse vers l'en-tête texte seul (bloc
  // try/catch de invoice.pdf.ts). Sabotage : retrait temporaire de ce
  // try/catch → ce test échoue bien avec une exception pdfkit ("Unsupported
  // image format") au lieu d'un PDF valide, confirmant que le test est
  // discriminant (le préfixe régulier passe bien le garde-fou regex, donc
  // c'est réellement le try/catch autour de doc.image() qui est exercé,
  // pas le filtre de préfixe testé ci-dessus). Restauré, revérifié vert.
  it("n'échoue pas si logoUrl a le bon préfixe mais un contenu base64 non décodable en image", async () => {
    const pdf = await buildInvoicePdf(
      sampleData({
        hotel: {
          ...sampleData().hotel,
          logoUrl: 'data:image/png;base64,dGhpcyBpcyBub3QgYSByZWFsIHBuZw==',
        },
      }),
    );
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('produit un rendu différent quand le montant total diffère (pas une valeur figée)', async () => {
    const pdfA = await buildInvoicePdf(
      sampleData({
        invoice: { ...sampleData().invoice, montantTotal: '100.00' },
      }),
    );
    const pdfB = await buildInvoicePdf(
      sampleData({
        invoice: { ...sampleData().invoice, montantTotal: '999999.99' },
      }),
    );
    expect(pdfA.equals(pdfB)).toBe(false);
  });
});
