import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DocumentOcrService } from './document-ocr.service';
import { ScanDocumentDto } from './dto/scan-document.dto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@ApiTags('document-ocr')
@ApiBearerAuth()
@Controller('document-ocr')
export class DocumentOcrController {
  constructor(private readonly documentOcrService: DocumentOcrService) {}

  // memoryStorage : le fichier n'est jamais écrit sur disque ni persisté en
  // base — traité en mémoire par l'OCR puis rejeté à la fin de la requête
  // (aucune trace de la photo de pièce d'identité, seuls les champs
  // extraits que la réception choisit d'enregistrer via GuestsService/
  // PoliceService existants sont conservés). Réutilise guests:write
  // (même convention que police/companies réutilisant les clés d'un autre
  // module apparenté — CLAUDE.md) : ce scan sert avant tout à préremplir
  // la fiche client au check-in.
  @RequirePermission('guests', 'write')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      "Extrait par OCR les champs d'identité (zone MRZ) d'une photo de CIN ou passeport — purement indicatif, aucune écriture, aucune persistance de l'image",
  })
  @UseInterceptors(
    FileInterceptor('fichier', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        callback(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
      },
    }),
  )
  @Post('scan')
  async scan(
    @UploadedFile() fichier: Express.Multer.File | undefined,
    @Body() dto: ScanDocumentDto,
  ) {
    if (!fichier) {
      throw new BadRequestException(
        "Fichier image requis (champ 'fichier', JPEG/PNG/WebP, 8 Mo max).",
      );
    }
    return this.documentOcrService.scan(fichier.buffer, dto.typeDocument);
  }
}
