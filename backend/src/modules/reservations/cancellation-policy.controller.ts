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
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CancellationPolicyService } from './cancellation-policy.service';
import { CreateCancellationPolicyDto } from './dto/create-cancellation-policy.dto';
import { UpdateCancellationPolicyDto } from './dto/update-cancellation-policy.dto';

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations/cancellation-policies')
export class CancellationPolicyController {
  constructor(
    private readonly cancellationPolicyService: CancellationPolicyService,
  ) {}

  @RequirePermission('reservations', 'read')
  @ApiOperation({ summary: "Liste les politiques d'annulation" })
  @Get()
  findAll() {
    return this.cancellationPolicyService.findAll();
  }

  @RequirePermission('reservations', 'read')
  @ApiOperation({ summary: "Détail d'une politique d'annulation" })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cancellationPolicyService.findOne(id);
  }

  @RequirePermission('reservations', 'write')
  @ApiOperation({
    summary: "Crée une politique d'annulation (motif obligatoire)",
  })
  @Post()
  create(
    @Body() dto: CreateCancellationPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cancellationPolicyService.create(dto, user.sub);
  }

  @RequirePermission('reservations', 'write')
  @ApiOperation({
    summary: "Met à jour une politique d'annulation (motif obligatoire)",
  })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCancellationPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cancellationPolicyService.update(id, dto, user.sub);
  }
}
