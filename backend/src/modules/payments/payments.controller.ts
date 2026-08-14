import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';

@ApiTags('payments')
@ApiBearerAuth()
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @RequirePermission('payments', 'write')
  @ApiOperation({
    summary: 'Enregistre un règlement (idempotent) et crédite le folio',
  })
  @Post('payments')
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(dto);
  }

  // DESIGN-010 (Billing Center) — registre global des paiements, paginé.
  // Déclarée avant `payments/:id` ci-dessous : chemin littéral sans
  // paramètre, aucune ambiguïté de segment possible avec `:id`.
  @RequirePermission('payments', 'read')
  @ApiOperation({ summary: 'Registre paginé des paiements' })
  @Get('payments')
  findAll(@Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.findPaginated(query);
  }

  @RequirePermission('payments', 'read')
  @ApiOperation({ summary: "Détail d'un paiement" })
  @Get('payments/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.findById(id);
  }
}
