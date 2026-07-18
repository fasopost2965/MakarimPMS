import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BillingService } from './billing.service';
import { AddFolioLineDto } from './dto/add-folio-line.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @RequirePermission('billing', 'write')
  @Post('folios/:id/lignes')
  addFolioLine(
    @Param('id', ParseIntPipe) folioId: number,
    @Body() dto: AddFolioLineDto,
  ) {
    return this.billingService.addFolioLine(folioId, dto);
  }

  @RequirePermission('billing', 'write')
  @Post('invoices/generer')
  generateInvoice(@Query('folioId', ParseIntPipe) folioId: number) {
    return this.billingService.generateInvoice(folioId);
  }

  @RequirePermission('billing', 'read')
  @Get('folios/:id')
  findFolioById(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.findFolioById(id);
  }

  @RequirePermission('billing', 'read')
  @Get('invoices/:id')
  findInvoiceById(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.findInvoiceById(id);
  }

  @RequirePermission('billing', 'write')
  @Post('payments')
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.billingService.createPayment(dto);
  }

  @RequirePermission('billing', 'read')
  @Get('stays/:stayId/folios')
  findFoliosByStay(@Param('stayId', ParseIntPipe) stayId: number) {
    return this.billingService.findFoliosByStayId(stayId);
  }
}
