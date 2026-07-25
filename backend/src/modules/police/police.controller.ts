import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PoliceService } from './police.service';
import { UpsertPoliceRecordDto } from './dto/upsert-police-record.dto';

// Réutilise les permissions checkin:read/checkin:write (RBAC_MATRIX.md n'a
// pas de clé `police` dédiée) : la fiche de police fait partie du même
// geste opérationnel que le check-in, exercé par les mêmes rôles
// (Réception/Administrateur).
@ApiTags('police')
@ApiBearerAuth()
@Controller('police')
export class PoliceController {
  constructor(private readonly policeService: PoliceService) {}

  @RequirePermission('checkin', 'write')
  @ApiOperation({
    summary:
      "Crée ou met à jour la fiche de police (registre légal DGSN) d'un séjour",
  })
  @Post(':stayId')
  upsert(
    @Param('stayId', ParseIntPipe) stayId: number,
    @Body() dto: UpsertPoliceRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.policeService.upsert(stayId, dto, user.sub);
  }

  @RequirePermission('checkin', 'read')
  @ApiOperation({ summary: "Détail de la fiche de police d'un séjour" })
  @Get(':stayId')
  findByStay(@Param('stayId', ParseIntPipe) stayId: number) {
    return this.policeService.findByStay(stayId);
  }

  // F1 — export PDF (registre légal DGSN). Route distincte plutôt qu'un
  // renommage de :stayId : CLAUDE.md interdit de toucher aux routes
  // stay/checkin hors PR dédiée, ceci reste un ajout, pas un renommage.
  @RequirePermission('checkin', 'read')
  @ApiOperation({
    summary: 'Génère la fiche de police au format PDF pour un séjour',
  })
  @Get(':stayId/pdf')
  async generatePdf(
    @Param('stayId', ParseIntPipe) stayId: number,
    @Res() res: Response,
  ) {
    const pdf = await this.policeService.generatePdf(stayId);
    // res.send() géré directement (pas @Res({passthrough:true})) : un Buffer
    // retourné en passthrough est sérialisé en JSON ({"type":"Buffer",...})
    // par le pipeline de réponse standard de Nest au lieu d'être envoyé en
    // binaire — seul res.send() natif d'Express respecte le Content-Type.
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fiche-police-sejour-${stayId}.pdf"`,
    );
    res.send(pdf);
  }
}
