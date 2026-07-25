/**
 * Utility to generate realistic specimen document images (CIN, Passport) on HTML Canvas
 * and return them as File objects for instant testing of the OCR MRZ engine.
 */

export interface SpecimenDoc {
  id: string;
  title: string;
  subtitle: string;
  type: "CIN" | "PASSEPORT";
  lines: string[];
  nom: string;
  prenom: string;
  numero: string;
  nationalite: string;
}

export const SPECIMENS: SpecimenDoc[] = [
  {
    id: "cin-maroc",
    title: "Carte d'Identité Marocaine (CIN TD1)",
    subtitle: "Royaume du Maroc — CIN Biométrique",
    type: "CIN",
    nom: "EL AMRANI",
    prenom: "YOUSSEF",
    numero: "AB123456",
    nationalite: "MAR",
    lines: [
      "I1MAR1234567897<<<<<<<<<<<<<<<",
      "9001155M2812318MAR<<<<<<<<<<<3",
      "EL<AMRANI<<YOUSSEF<<<<<<<<<<<<",
    ],
  },
  {
    id: "passeport-france",
    title: "Passeport Européen (TD3)",
    subtitle: "République Française — Passeport ISO",
    type: "PASSEPORT",
    nom: "BENJELLOUN",
    prenom: "AMINE",
    numero: "123456789",
    nationalite: "FRA",
    lines: [
      "P<FRABENJELLOUN<<AMINE<<<<<<<<<<<<<<<<<<<<<<<",
      "1234567897FRA8505202M2712318<<<<<<<<<<<<<<02",
    ],
  },
  {
    id: "passeport-usa",
    title: "Passeport International (TD3)",
    subtitle: "United States of America — Passport",
    type: "PASSEPORT",
    nom: "SMITH",
    prenom: "JANE MARIE",
    numero: "987654321",
    nationalite: "USA",
    lines: [
      "P<USASMITH<<JANE<MARIE<<<<<<<<<<<<<<<<<<<<<<",
      "9876543210USA9208104F3006159<<<<<<<<<<<<<<08",
    ],
  },
];

export async function generateSpecimenFile(specimen: SpecimenDoc): Promise<File> {
  const canvas = document.createElement("canvas");
  const isPassport = specimen.type === "PASSEPORT";

  // High contrast dimensions for high OCR recognition rate
  canvas.width = 800;
  canvas.height = isPassport ? 550 : 480;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Impossible de créer le contexte Canvas 2D");
  }

  // 1. Background Card Body
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer Border
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  // Top Accent Header Bar
  ctx.fillStyle = isPassport ? "#1E3A8A" : "#065F46";
  ctx.fillRect(10, 10, canvas.width - 20, 60);

  // Header Title Text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(specimen.subtitle.toUpperCase(), 30, 48);

  // Watermark/Specimen Tag
  ctx.fillStyle = "rgba(226, 232, 240, 0.4)";
  ctx.font = "bold 60px sans-serif";
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2 - 30);
  ctx.rotate(-Math.PI / 12);
  ctx.textAlign = "center";
  ctx.fillText("SPECIMEN DEMO", 0, 0);
  ctx.restore();

  // Photo Box Placeholder
  ctx.fillStyle = "#E2E8F0";
  ctx.fillRect(30, 90, 120, 150);
  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 90, 120, 150);

  ctx.fillStyle = "#64748B";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PHOTO", 90, 170);
  ctx.textAlign = "left";

  // Document Human Readable Fields
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(`NOM / SURNAME: ${specimen.nom}`, 170, 115);
  ctx.fillText(`PRENOM / GIVEN NAMES: ${specimen.prenom}`, 170, 145);
  ctx.fillText(`N° DOC / DOC NO: ${specimen.numero}`, 170, 175);
  ctx.fillText(`NATIONALITE / NAT: ${specimen.nationalite}`, 170, 205);

  // 2. MRZ ZONE (Machine Readable Zone)
  // Drawn at bottom in crisp monospace Courier New or OCR-B font on high-contrast white box
  const mrzHeight = isPassport ? 130 : 160;
  const mrzY = canvas.height - mrzHeight - 20;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(20, mrzY, canvas.width - 40, mrzHeight);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, mrzY, canvas.width - 40, mrzHeight);

  // Black Monospace OCR Font
  ctx.fillStyle = "#000000";
  ctx.font = 'bold 24px "Courier New", Courier, monospace';
  ctx.letterSpacing = "2px";

  let lineY = mrzY + 42;
  const lineSpacing = isPassport ? 48 : 38;

  for (const line of specimen.lines) {
    ctx.fillText(line, 35, lineY);
    lineY += lineSpacing;
  }

  // Convert canvas to Blob File
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `specimen_${specimen.id}.png`, {
            type: "image/png",
          });
          resolve(file);
        } else {
          reject(new Error("Échec de la génération du fichier image"));
        }
      },
      "image/png",
      1.0,
    );
  });
}
