import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { AddFolioLineDto } from './dto/add-folio-line.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

// TODO(core 5.1/5.2) : protéger ces routes avec JwtAuthGuard + RolesGuard
// une fois le module core (auth/rôles) livré.
@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('folios/:id/lignes')
  addFolioLine(
    @Param('id', ParseIntPipe) folioId: number,
    @Body() dto: AddFolioLineDto,
  ) {
    return this.billingService.addFolioLine(folioId, dto);
  }

  @Post('invoices/generer')
  generateInvoice(@Query('folioId', ParseIntPipe) folioId: number) {
    return this.billingService.generateInvoice(folioId);
  }

  @Get('folios/:id')
  findFolioById(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.findFolioById(id);
  }

  @Get('invoices/:id')
  findInvoiceById(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.findInvoiceById(id);
  }

  @Post('payments')
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.billingService.createPayment(dto);
  }

  @Get('stays/:stayId/folios')
  findFoliosByStay(@Param('stayId', ParseIntPipe) stayId: number) {
    return this.billingService.findFoliosByStayId(stayId);
  }
}
