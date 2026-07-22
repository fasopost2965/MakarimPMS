import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
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
}
