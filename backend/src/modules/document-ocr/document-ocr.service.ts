import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { TypePiece } from '@prisma/client';
import { createWorker, type Worker } from 'tesseract.js';
import * as path from 'path';
import { parseMrzFromText } from './utils/mrz-parser';

// Modèle de langue "eng" fourni en dépendance npm (@tesseract.js-data/eng)
// plutôt que téléchargé au runtime depuis le CDN jsdelivr par défaut de
// tesseract.js : évite toute dépendance réseau sortante au démarrage/à
// chaque premier appel (VPS pouvant restreindre l'egress, cohérent avec le
// déploiement Docker Compose auto-hébergé du projet) et rend le
// comportement reproductible (verrouillé par package-lock.json comme
// n'importe quelle autre dépendance).
const ENG_LANG_PATH = path.join(
  path.dirname(require.resolve('@tesseract.js-data/eng/package.json')),
  '4.0.0',
);

// F5 — Scan CIN/Passeport OCR. Purement consultatif (même famille que F3
// yield-forecast) : extrait des champs indicatifs à partir d'une photo,
// jamais d'écriture directe sur Guest/PoliceRecord — la réception relit et
// valide via les endpoints existants (GuestsService.update(),
// POST /police/:stayId) qui restent les seuls chemins d'écriture.
@Injectable()
export class DocumentOcrService implements OnModuleDestroy {
  private readonly logger = new Logger(DocumentOcrService.name);
  private workerPromise: Promise<Worker> | null = null;

  // Un seul worker Tesseract partagé et réutilisé entre les requêtes
  // (recommandation tesseract.js : créer un worker une fois, jamais un par
  // appel — le chargement du modèle de langue est coûteux). 'eng' suffit :
  // la zone MRZ n'utilise que des caractères latins/chiffres/'<', aucun
  // besoin d'un modèle de langue française pour cette zone précise.
  private getWorker(): Promise<Worker> {
    if (!this.workerPromise) {
      this.workerPromise = createWorker('eng', 1, {
        langPath: ENG_LANG_PATH,
        gzip: true,
        // 'none' : le modèle est déjà fourni localement en dépendance npm
        // (ENG_LANG_PATH ci-dessus), aucune raison d'en écrire une seconde
        // copie décompressée dans le répertoire courant du process (défaut
        // tesseract.js sans cacheMethod explicite — constaté : un fichier
        // eng.traineddata de 22 Mo apparaissait à la racine de backend/).
        cacheMethod: 'none',
      });
    }
    return this.workerPromise;
  }

  async scan(buffer: Buffer, typeDocumentAttendu?: TypePiece) {
    const worker = await this.getWorker();
    const {
      data: { text: texteBrutOcr },
    } = await worker.recognize(buffer);

    const mrz = parseMrzFromText(texteBrutOcr);

    let avertissement: string | undefined;
    if (!mrz.formatDetecte) {
      avertissement =
        "Aucune zone de lecture automatique (MRZ) détectée sur l'image — vérifiez la qualité/le cadrage ou saisissez les champs manuellement.";
    } else if (!mrz.checksumValide) {
      avertissement =
        'Zone MRZ détectée mais chiffres de contrôle invalides (probable erreur de lecture OCR) — vérifiez chaque champ avant de les enregistrer.';
    } else if (
      typeDocumentAttendu &&
      ((typeDocumentAttendu === TypePiece.CIN &&
        mrz.formatDetecte !== 'TD1_CIN') ||
        (typeDocumentAttendu === TypePiece.PASSEPORT &&
          mrz.formatDetecte !== 'TD3_PASSEPORT'))
    ) {
      avertissement = `Type de document indiqué (${typeDocumentAttendu}) ne correspond pas au format détecté (${mrz.formatDetecte}).`;
    }

    return { ...mrz, avertissement, texteBrutOcr };
  }

  // Le worker Tesseract garde un processus WASM actif tant qu'il n'est pas
  // terminé explicitement — évite de laisser un handle ouvert au shutdown
  // de l'application (mêmes précautions que les workers BullMQ existants).
  async onModuleDestroy() {
    if (!this.workerPromise) return;
    try {
      const worker = await this.workerPromise;
      await worker.terminate();
    } catch (error) {
      this.logger.warn(`Échec de terminaison propre du worker OCR : ${error}`);
    }
  }
}
