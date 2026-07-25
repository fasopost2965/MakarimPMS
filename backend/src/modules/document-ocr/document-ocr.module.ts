import { Module } from '@nestjs/common';
import { DocumentOcrController } from './document-ocr.controller';
import { DocumentOcrService } from './document-ocr.service';

// F5 — module feuille sans dépendance (même famille que rooms/parameters) :
// service purement consultatif, ne lit ni n'écrit aucune table Prisma,
// n'appelle aucun autre service métier. Le frontend utilise les champs
// extraits pour préremplir un formulaire ; l'écriture réelle passe toujours
// par GuestsService/PoliceService via leurs endpoints existants.
@Module({
  controllers: [DocumentOcrController],
  providers: [DocumentOcrService],
})
export class DocumentOcrModule {}
