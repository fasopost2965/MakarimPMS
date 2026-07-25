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
import { BillingService } from './billing.service';
import { AddFolioLineDto } from './dto/add-folio-line.dto';
import { ExcludeFolioTaxesDto } from './dto/exclude-folio-taxes.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';

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

  @RequirePermission('billing', 'write')
  @ApiOperation({
    summary:
      'Exclut (ou réintègre) des taxes applicables par défaut pour un folio (motif obligatoire) — interdit une fois la facture émise',
  })
  @Patch('folios/:id/taxes-exclues')
  excludeTaxes(
    @Param('id', ParseIntPipe) folioId: number,
    @Body() dto: ExcludeFolioTaxesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billingService.excludeTaxes(folioId, dto, user.sub);
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

  // CH-001 (docs/governance/REGISTRE_CHANTIERS.md) — avoir total : annule la
  // facture (ANNULEE_PAR_AVOIR), jamais ses lignes/montants d'origine.
  @RequirePermission('billing', 'write')
  @ApiOperation({
    summary:
      'Avoir total sur une facture émise (motif obligatoire) — annule la facture, permet ensuite de régénérer une facture corrigée sur le même folio',
  })
  @Post('invoices/:id/credit-notes')
  createCreditNote(
    @Param('id', ParseIntPipe) invoiceId: number,
    @Body() dto: CreateCreditNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billingService.createCreditNote(invoiceId, dto, user.sub);
  }

  @RequirePermission('billing', 'read')
  @ApiOperation({ summary: "Liste les folios d'un séjour" })
  @Get('stays/:stayId/folios')
  findFoliosByStay(@Param('stayId', ParseIntPipe) stayId: number) {
    return this.billingService.findFoliosByStayId(stayId);
  }
}
