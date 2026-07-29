import PDFDocument from 'pdfkit';

// Entrée volontairement à plat — même discipline que
// police/utils/police-record.pdf.ts et reservations/utils/pricing.ts : un
// utilitaire pur, sans dépendance au client Prisma, testable isolément.
export interface InvoicePdfLigne {
  libelle: string;
  montant: string;
  annulee: boolean;
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
    for (const ligne of lignes) {
      if (ligne.annulee) continue;
      doc.text(
        `${ligne.libelle} .......................... ${Number(ligne.montant).toFixed(2)} MAD (HT)`,
      );
    }

    doc.moveDown(1);
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(`Total TTC : ${Number(invoice.montantTotal).toFixed(2)} MAD`, {
        align: 'right',
      });

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
