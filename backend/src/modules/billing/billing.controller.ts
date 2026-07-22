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
import { BillingService } from './billing.service';
import { AddFolioLineDto } from './dto/add-folio-line.dto';

@ApiTags('billing')
@ApiBearerAuth()
@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @RequirePermission('billing', 'write')
  @ApiOperation({ summary: 'Ajoute une ligne (extra) à un folio' })
  @Post('folios/:id/lignes')
  addFolioLine(
    @Param('id', ParseIntPipe) folioId: number,
    @Body() dto: AddFolioLineDto,
  ) {
    return this.billingService.addFolioLine(folioId, dto);
  }

  @RequirePermission('billing', 'write')
  @ApiOperation({ summary: "Génère une facture immuable à partir d'un folio" })
  @Post('invoices/generer')
  generateInvoice(@Query('folioId', ParseIntPipe) folioId: number) {
    return this.billingService.generateInvoice(folioId);
  }

  @RequirePermission('billing', 'read')
  @ApiOperation({ summary: "Détail d'un folio (lignes, factures)" })
  @Get('folios/:id')
  findFolioById(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.findFolioById(id);
  }

  @RequirePermission('billing', 'read')
  @ApiOperation({ summary: "Détail d'une facture" })
  @Get('invoices/:id')
  findInvoiceById(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.findInvoiceById(id);
  }

  @RequirePermission('billing', 'read')
  @ApiOperation({ summary: "Liste les folios d'un séjour" })
  @Get('stays/:stayId/folios')
  findFoliosByStay(@Param('stayId', ParseIntPipe) stayId: number) {
    return this.billingService.findFoliosByStayId(stayId);
  }
}
