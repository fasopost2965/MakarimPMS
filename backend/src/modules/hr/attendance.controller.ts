import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AttendanceService } from './attendance.service';
import { AjusterSegmentDto } from './dto/ajuster-segment.dto';

@ApiTags('hr-attendance')
@ApiBearerAuth()
@Controller('rh/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // Routes self-service (démarrer/pause/reprendre/terminer/statut-courant) :
  // volontairement SANS @RequirePermission('rh', ...). Le pointage est une
  // action que chaque employé exerce sur SA PROPRE fiche (dérivée du JWT,
  // jamais d'un employeeId transmis) — restreindre au module `rh` limiterait
  // le pointage au seul rôle RH, alors qu'ADR-007 attend son usage par tout
  // le personnel (réception, ménage, technicien). JwtAuthGuard (déjà global)
  // suffit, même pattern documenté dans PermissionsGuard pour les routes
  // authentifiées sans permission dédiée.
  @ApiOperation({
    summary: "Démarre le service de pointage de l'utilisateur courant",
  })
  @Post('demarrer')
  demarrer(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.demarrer(user.sub);
  }

  @ApiOperation({ summary: 'Met en pause le service de pointage en cours' })
  @Post('pause')
  pause(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.mettreEnPause(user.sub);
  }

  @ApiOperation({ summary: 'Reprend un service de pointage en pause' })
  @Post('reprendre')
  reprendre(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.reprendre(user.sub);
  }

  @ApiOperation({ summary: 'Clôture le service de pointage en cours' })
  @Post('terminer')
  terminer(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.terminer(user.sub);
  }

  // Appelé par le handler de déconnexion du frontend avant de détruire la
  // session JWT locale (BR-RH-004) — voir le commentaire de
  // AttendanceService.statutCourant pour le contrat complet.
  @ApiOperation({
    summary: 'Statut de pointage courant (bloque la déconnexion si actif)',
  })
  @Get('statut-courant')
  statutCourant(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.statutCourant(user.sub);
  }

  // Vues/actions administratives RH : ici la permission `rh` s'applique.
  @RequirePermission('rh', 'read')
  @ApiOperation({ summary: "Historique de pointage d'un employé" })
  @Get('employees/:employeeId')
  historique(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.attendanceService.findHistorique(employeeId);
  }

  @RequirePermission('rh', 'write')
  @ApiOperation({
    summary:
      "Ajustement rétroactif RH d'un segment de pointage (motif obligatoire)",
  })
  @Patch('segments/:id/ajuster')
  ajuster(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AjusterSegmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.ajusterSegment(id, dto, user.sub);
  }
}
