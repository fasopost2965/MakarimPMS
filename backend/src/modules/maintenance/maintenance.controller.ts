import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceTicketDto } from './dto/create-maintenance-ticket.dto';

@ApiTags('maintenance')
@ApiBearerAuth()
@Controller('maintenance-tickets')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @RequirePermission('maintenance', 'write')
  @ApiOperation({ summary: 'Ouvre un ticket de maintenance' })
  @Post()
  create(
    @Body() dto: CreateMaintenanceTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.maintenanceService.createTicket(dto, user.sub);
  }

  @RequirePermission('maintenance', 'read')
  @ApiOperation({ summary: 'Liste les tickets de maintenance' })
  @Get()
  findAll(
    @Query('roomId', new ParseIntPipe({ optional: true })) roomId?: number,
    @Query('ouvert', new ParseBoolPipe({ optional: true })) ouvert?: boolean,
  ) {
    return this.maintenanceService.findAll({ roomId, ouvert });
  }

  @RequirePermission('maintenance', 'read')
  @ApiOperation({ summary: "Détail d'un ticket de maintenance" })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.maintenanceService.findOne(id);
  }

  @RequirePermission('maintenance', 'write')
  @ApiOperation({
    summary:
      'Résout un ticket de maintenance (libère la chambre si dernier ticket ouvert)',
  })
  @Patch(':id/resoudre')
  resolve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.maintenanceService.resolve(id, user.sub);
  }
}
