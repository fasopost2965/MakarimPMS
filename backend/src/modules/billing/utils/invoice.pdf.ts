import PDFDocument from 'pdfkit';

// Entrée volontairement à plat — même discipline que
// police/utils/police-record.pdf.ts et reservations/utils/pricing.ts : un
// utilitaire pur, sans dépendance au client Prisma, testable isolément.
export interface InvoicePdfLigne {
  libelle: string;
  montant: string;
  annulee: boolean;
  // UX-001E — type de la ligne (ex. 'PAIEMENT'), utilisé uniquement pour
  // exclure les règlements du tableau "Détail" (ce ne sont pas des
  // prestations) et calculer "Déjà réglé"/"Reste à payer" ci-dessous. Reste
  // un `string` (pas le type Prisma `TypeLigneFolio`) pour préserver la
  // discipline d'utilitaire pur sans dépendance Prisma déjà documentée ici.
  type: string;
}

export interface InvoicePdfData {
  hotel: {
    raisonSociale: string;
    adresse: string;
    ice: string;
    identifiantFiscal: string;
    rc: string;
    categorieEtoiles: number;
    // Design Marine & Or — data URI base64 (HotelConfig.logoUrl), même
    // convention que MaintenanceTicket.photoUrl (CH-055). Décodé en Buffer
    // ici même, jamais persisté sur disque.
    logoUrl?: string | null;
  };
  guest: {
    nom: string;
    prenom: string;
    email: string | null;
  };
  stay: {
    id: number;
    roomNumero: string;
    roomTypeNom: string;
  };
  invoice: {
    numero: string;
    createdAt: Date;
    montantTotal: string;
    statut: string;
  };
  lignes: InvoicePdfLigne[];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Composition PDF d'une facture. Reprend exactement la même convention que
// InvoicePrintModal.tsx (CH-042, frontend) : Invoice.montantTotal est déjà
// le total TTC figé à l'émission (ADR-004, immuable) — jamais recalculé ici,
// affiché tel quel comme unique "Total TTC". Chaque ligne affiche son
// montant HT stocké (FolioLine.montant), jamais une TVA redérivée
// côté document — même règle que le frontend, pour ne jamais afficher deux
// totaux qui pourraient diverger d'une future évolution du taux de TVA.
export function buildInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { hotel, guest, stay, invoice, lignes } = data;

    // Logo — décodé depuis le data URI (jamais un chemin disque, jamais
    // une URL externe). Une erreur de décodage (fichier corrompu en base,
    // improbable vu la validation DTO en amont) ne doit jamais empêcher la
    // génération de la facture — dégradation silencieuse vers l'en-tête
    // texte seul.
    if (hotel.logoUrl) {
      const match = /^data:image\/(?:jpeg|png|webp);base64,(.+)$/.exec(
        hotel.logoUrl,
      );
      if (match) {
        try {
          const logoBuffer = Buffer.from(match[1], 'base64');
          const logoWidth = 60;
          doc.image(logoBuffer, (doc.page.width - logoWidth) / 2, doc.y, {
            width: logoWidth,
          });
          doc.moveDown(4);
        } catch {
          // Dégradation silencieuse — voir commentaire ci-dessus.
        }
      }
    }

    // Pas de glyphe ★ (voir police-record.pdf.ts — Helvetica/WinAnsiEncoding
    // ne le supporte pas, remplacé silencieusement par un caractère erroné).
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(hotel.raisonSociale, { align: 'center' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Catégorie ${hotel.categorieEtoiles} étoiles`, {
        align: 'center',
      })
      .text(hotel.adresse, { align: 'center' })
      .text(
        `ICE : ${hotel.ice}    RC : ${hotel.rc}    IF : ${hotel.identifiantFiscal}`,
        { align: 'center' },
      );

    doc.moveDown(1.5);
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(`FACTURE ${invoice.numero}`, { align: 'center' });
    if (invoice.statut === 'ANNULEE_PAR_AVOIR') {
      doc
        .fontSize(10)
        .fillColor('#b91c1c')
        .font('Helvetica-Bold')
        .text('ANNULÉE PAR AVOIR', { align: 'center' })
        .fillColor('#000000');
    }

    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica');

    const section = (title: string) => {
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fontSize(11).text(title);
      doc
        .moveTo(doc.x, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor('#999999')
        .stroke();
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(10);
    };

    const row = (label: string, value: string) => {
      doc.text(`${label} : ${value || '—'}`);
    };

    section('Facturé à');
    row('Client', `${guest.prenom} ${guest.nom}`);
    if (guest.email) row('Email', guest.email);
    row('Chambre', `${stay.roomNumero} (${stay.roomTypeNom})`);
    row('Référence séjour', `#${stay.id}`);
    row('Date de facture', formatDate(invoice.createdAt));

    section('Détail');
    // UX-001E — un règlement (ligne PAIEMENT) n'est pas une prestation :
    // l'afficher dans ce tableau avec les mêmes libellé/style que les
    // charges (sans signe ni distinction) avait déjà induit un incident réel
    // en production (le total additionnable par le client ne correspondait
    // plus au "Total TTC" imprimé, qui reste — lui — la somme des seules
    // charges). Les lignes PAIEMENT sont désormais résumées séparément dans
    // le bloc "Déjà réglé"/"Reste à payer" ci-dessous.
    const lignesPrestations = lignes.filter(
      (l) => !l.annulee && l.type !== 'PAIEMENT',
    );
    for (const ligne of lignesPrestations) {
      // FIN-102 — correction de libellé uniquement (bug de présentation
      // confirmé) : chaque ligne est déjà TTC (ADR-008/FIN-101B, jamais de
      // TVA ajoutée à part), afficher "(HT)" était donc trompeur.
      doc.text(
        `${ligne.libelle} .......................... ${Number(ligne.montant).toFixed(2)} MAD (TTC)`,
      );
    }

    // UX-001E — "Déjà réglé"/"Reste à payer" : pure agrégation de
    // présentation sur les lignes PAIEMENT déjà chargées (jamais
    // Invoice.payments, quasi toujours vide en pratique — voir CreatePaymentDto
    // §invoiceId optionnel) ni computeSoldeDu (solde de folio VIVANT,
    // potentiellement multi-factures — sans rapport avec l'agrégat immuable
    // propre à CETTE facture déjà émise). Invoice.montantTotal n'est jamais
    // recalculé ici, uniquement réaffiché tel quel (ADR-004).
    const dejaRegle = lignes
      .filter((l) => !l.annulee && l.type === 'PAIEMENT')
      .reduce((acc, l) => acc + Number(l.montant), 0);
    const totalTTC = Number(invoice.montantTotal);
    const resteAPayer = Math.max(0, totalTTC - dejaRegle);
    // UX-001E (correction complémentaire) — un trop-perçu (GL-003B avance de
    // prolongation encaissée avant que le supplément ne soit matérialisé,
    // ou tout acompte dépassant les charges déjà facturées) ne doit jamais
    // disparaître silencieusement derrière un `Reste à payer : 0.00` : le
    // client a réellement un crédit, distinct d'un solde simplement nul.
    const creditClient = Math.max(0, dejaRegle - totalTTC);

    doc.moveDown(1);
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(`Total TTC : ${totalTTC.toFixed(2)} MAD`, {
        align: 'right',
      });
    // Volontairement moins proéminent que le Total TTC ci-dessus (police
    // normale, pas de gras) : ce sont des informations de suivi du
    // règlement, pas le montant contractuel de la facture. "Déjà réglé"
    // n'est affiché que si un règlement existe réellement, pour ne pas
    // polluer une facture jamais payée d'une ligne à 0.00 MAD sans intérêt.
    if (dejaRegle > 0) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(`Déjà réglé : ${dejaRegle.toFixed(2)} MAD`, { align: 'right' })
        .text(`Reste à payer : ${resteAPayer.toFixed(2)} MAD`, {
          align: 'right',
        });
      if (creditClient > 0) {
        doc.text(
          `Crédit client / Trop-perçu : ${creditClient.toFixed(2)} MAD`,
          { align: 'right' },
        );
      }
    }

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text(
        `Document généré le ${formatDate(new Date())} — facture émise le ${formatDate(invoice.createdAt)}.`,
        50,
        doc.page.height - 60,
        { align: 'center', width: doc.page.width - 100 },
      );

    doc.end();
  });
}
