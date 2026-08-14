import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { BillingService } from './billing.service';
import { AddFolioLineDto } from './dto/add-folio-line.dto';
import { ExcludeFolioTaxesDto } from './dto/exclude-folio-taxes.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { CancelFolioLineDto } from './dto/cancel-folio-line.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { ListStaysFacturablesQueryDto } from './dto/list-stays-facturables-query.dto';

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

  // CH-040 (BR-AUD-002) — annulation contrôlée d'une ligne de folio d'extras
  // (motif obligatoire), jamais une suppression physique (ADR-005).
  @RequirePermission('billing', 'write')
  @ApiOperation({
    summary:
      'Annule une ligne de folio de type EXTRA (motif obligatoire) — interdit une fois la facture émise',
  })
  @Delete('folios/lignes/:id')
  cancelFolioLine(
    @Param('id', ParseIntPipe) lineId: number,
    @Body() dto: CancelFolioLineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billingService.cancelFolioLine(lineId, dto, user.sub);
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

  // DESIGN-010 (Billing Center) — registre global des factures, paginé.
  @RequirePermission('billing', 'read')
  @ApiOperation({ summary: 'Registre paginé des factures' })
  @Get('invoices')
  findInvoices(@Query() query: ListInvoicesQueryDto) {
    return this.billingService.findInvoicesPaginated(query);
  }

  // DESIGN-010 — bande de KPI du Billing Center (factures du jour, CA
  // facturé, à facturer, à encaisser). Chemin déclaré avant `invoices/:id`
  // ci-dessous pour éviter toute ambiguïté de routage sur un segment
  // littéral (même précédent que stays/en-cours avant stays/:id dans
  // StayController).
  @RequirePermission('billing', 'read')
  @ApiOperation({ summary: 'KPI de la bande de synthèse du Billing Center' })
  @Get('billing/kpis')
  getKpis(@Query('from') from?: string, @Query('to') to?: string) {
    return this.billingService.getKpis(from, to);
  }

  // DESIGN-010 — séjours facturables (Stay.statut = CHECKOUT, aucune
  // Invoice EMISE active — voir BillingService.findStaysFacturables pour la
  // définition complète). Déclarée dans BillingController malgré le
  // préfixe `/stays` (permission billing:read, pas de logique métier
  // dupliquée — même convention que generateInvoice qui lit déjà Stay via
  // la relation Folio sans jamais importer StayModule, docs/modules/
  // billing.md).
  @RequirePermission('billing', 'read')
  @ApiOperation({ summary: 'Séjours facturables (à facturer)' })
  @Get('stays/facturables')
  findStaysFacturables(@Query() query: ListStaysFacturablesQueryDto) {
    return this.billingService.findStaysFacturables(query);
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

  // CH-050 (docs/execution/PLAN_MODULE_FACTURATION.md) — même convention que
  // PoliceController.generatePdf : res.send() direct (pas @Res({passthrough:
  // true}), qui sérialiserait le Buffer en JSON au lieu de l'envoyer en
  // binaire).
  @RequirePermission('billing', 'read')
  @ApiOperation({ summary: "Génère le PDF d'une facture" })
  @Get('invoices/:id/pdf')
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdf = await this.billingService.generateInvoicePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="facture-${id}.pdf"`,
    );
    res.send(pdf);
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

  // CH-050 suite (docs/execution/PLAN_MODULE_FACTURATION.md) — déclenche
  // l'envoi de la facture par email/WhatsApp (canaux réellement tentés
  // déterminés par les NotificationTemplate actifs pour FACTURE_EMISE,
  // même logique que tout le reste du module notifications — voir
  // NotificationsService.notify()). 202 : traitement asynchrone (file
  // BullMQ), le résultat réel se consulte dans le journal de notifications.
  // DESIGN-010 (correction RBAC finale suite) — billing:send, pas
  // billing:write : n'écrit jamais dans FolioLine/Invoice, seulement une
  // notification asynchrone (voir seed.ts, rôle Réception). Permission
  // dédiée hors grille read/write/delete/export, même famille que
  // guests:blacklist/payments:refund/checkin:force-checkout.
  @RequirePermission('billing', 'send')
  @ApiOperation({
    summary: 'Demande l’envoi de la facture au client (email/WhatsApp)',
  })
  @Post('invoices/:id/envoyer')
  async requestDelivery(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.billingService.requestDelivery(id, user.sub);
    return { statut: 'demande envoyée' };
  }

  // Lien public à durée limitée (InvoiceDownloadToken) — nécessaire pour que
  // Twilio (WhatsApp mediaUrl) et un lien email puissent atteindre le PDF
  // sans passer par l'authentification cookie de l'API privée. Throttlé
  // comme les autres routes publiques du projet (self-checkin).
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Télécharge une facture via un lien public temporaire',
  })
  @Get('invoices/download/:token')
  async downloadByToken(@Param('token') token: string, @Res() res: Response) {
    const pdf = await this.billingService.resolveDownloadToken(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="facture.pdf"');
    res.send(pdf);
  }
}
