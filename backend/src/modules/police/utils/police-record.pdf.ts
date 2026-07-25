import PDFDocument from 'pdfkit';

// Entrée volontairement à plat (pas les types Prisma imbriqués de
// StayService/PoliceService) — même discipline que
// reservations/utils/pricing.ts : un utilitaire pur, sans dépendance au
// client Prisma, facile à tester unitairement.
export interface PoliceRecordPdfData {
  hotel: {
    raisonSociale: string;
    adresse: string;
    ice: string;
    identifiantFiscal: string;
    rc: string;
    categorieEtoiles: number;
  };
  guest: {
    nom: string;
    prenom: string;
    telephone: string | null;
    email: string | null;
  };
  stay: {
    id: number;
    roomNumero: string;
    roomTypeNom: string;
  };
  record: {
    numeroPiece: string;
    typePiece: string;
    nationalite: string;
    dateNaissance: Date;
    paysProvenance: string | null;
    villeProvenance: string | null;
    paysDestination: string | null;
    villeDestination: string | null;
    dateArrivee: Date;
    dateDepart: Date | null;
  };
}

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Composition PDF d'une fiche de police (registre légal DGSN, obligation
// hôtelière Maroc). Reprend le contenu standard exigé — identité, pièce,
// provenance/destination, dates de séjour — sur un layout hôtelier propre ;
// n'a pas la prétention de reproduire un formulaire officiel gazetté au
// pixel près (aucune maquette DGSN exacte fournie), seulement d'en couvrir
// intégralement le contenu réglementaire à partir des champs déjà collectés
// par PoliceService.upsert.
export function buildPoliceRecordPdf(
  data: PoliceRecordPdfData,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { hotel, guest, stay, record } = data;

    // En-tête établissement. Pas de glyphe ★ : les polices standard
    // pdfkit (Helvetica, WinAnsiEncoding) ne le supportent pas et le
    // remplacent silencieusement par un caractère erroné (vérifié sur un
    // vrai PDF généré — c'était "&&&" au lieu de "★★★").
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
      .text('FICHE DE POLICE — REGISTRE DES ÉTRANGERS', { align: 'center' });
    doc
      .fontSize(9)
      .font('Helvetica-Oblique')
      .text('Hotel Registration Form', { align: 'center' });

    doc.moveDown(1.5);
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

    section('Identification du client');
    row('Nom', guest.nom);
    row('Prénom', guest.prenom);
    row('Nationalité', record.nationalite);
    row('Date de naissance', formatDate(record.dateNaissance));
    if (guest.telephone) row('Téléphone', guest.telephone);
    if (guest.email) row('Email', guest.email);

    section("Pièce d'identité");
    row('Type de pièce', record.typePiece);
    row('Numéro', record.numeroPiece);

    section('Provenance / Destination');
    row('Pays de provenance', record.paysProvenance ?? '—');
    row('Ville de provenance', record.villeProvenance ?? '—');
    row('Pays de destination', record.paysDestination ?? '—');
    row('Ville de destination', record.villeDestination ?? '—');

    section('Séjour');
    row('Chambre', `${stay.roomNumero} (${stay.roomTypeNom})`);
    row("Date d'arrivée", formatDate(record.dateArrivee));
    row('Date de départ', formatDate(record.dateDepart));
    row('Référence séjour', `#${stay.id}`);

    doc.moveDown(3);
    const signatureY = doc.y;
    doc.fontSize(9).font('Helvetica');
    doc.text('Signature du client', 50, signatureY);
    doc.text("Cachet de l'établissement", doc.page.width - 250, signatureY);
    doc
      .moveTo(50, signatureY + 40)
      .lineTo(220, signatureY + 40)
      .strokeColor('#999999')
      .stroke();
    doc
      .moveTo(doc.page.width - 250, signatureY + 40)
      .lineTo(doc.page.width - 50, signatureY + 40)
      .strokeColor('#999999')
      .stroke();

    doc
      .fontSize(8)
      .fillColor('#666666')
      .text(
        `Document généré le ${formatDate(new Date())} — usage interne / registre légal DGSN.`,
        50,
        doc.page.height - 60,
        { align: 'center', width: doc.page.width - 100 },
      );

    doc.end();
  });
}
