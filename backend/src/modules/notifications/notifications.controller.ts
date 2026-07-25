import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { NotificationsService } from './notifications.service';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @RequirePermission('notifications', 'read')
  @ApiOperation({ summary: 'Liste les templates de notification' })
  @Get('templates')
  findTemplates() {
    return this.notificationsService.findTemplates();
  }

  @RequirePermission('notifications', 'write')
  @ApiOperation({
    summary: 'Crée un template de notification (motif obligatoire)',
  })
  @Post('templates')
  createTemplate(
    @Body() dto: CreateNotificationTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.createTemplate(dto, user.sub);
  }

  @RequirePermission('notifications', 'write')
  @ApiOperation({
    summary: 'Met à jour un template de notification (motif obligatoire)',
  })
  @Patch('templates/:id')
  updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNotificationTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.updateTemplate(id, dto, user.sub);
  }

  @RequirePermission('notifications', 'read')
  @ApiOperation({
    summary:
      'Journal des notifications envoyées (filtrable par client/réservation)',
  })
  @Get('logs')
  findLogs(
    @Query('guestId') guestId?: string,
    @Query('reservationId') reservationId?: string,
  ) {
    return this.notificationsService.findLogs({
      guestId: guestId ? Number(guestId) : undefined,
      reservationId: reservationId ? Number(reservationId) : undefined,
    });
  }
}
