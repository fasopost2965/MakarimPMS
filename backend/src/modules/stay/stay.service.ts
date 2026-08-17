import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  AuditEntity,
  FormuleHebergement,
  OrigineTacheHousekeeping,
  Prisma,
  StatutAcompte,
  StatutChambre,
  StatutReservation,
  StatutSejour,
  TypeLigneFolio,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTodayRange } from '../../common/utils/date-range';
import { getNightsBetween } from '../reservations/utils/nights';
import {
  calculateFormuleSupplement,
  calculateNightlyTotal,
} from '../reservations/utils/pricing';
import { RoomsService } from '../rooms/rooms.service';
import { GuestsService } from '../guests/guests.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
// FIN-102 (composition du tarif public TTC) — fonction pure canonique
// unique, réutilisée par createFolioPrincipal/checkinFromReservation/
// checkinWalkIn/extendStay (jamais une variante locale, voir
// common/fiscal/tarif-decomposition.ts). computeTaxLineAmount réutilisé tel
// quel (billing/utils/invoice-calc.ts, aucune modification) pour le
// recalcul ponctuel de la réconciliation départ anticipé ci-dessous.
import {
  CompositionTarifaireImpossibleError,
  decomposerTarifPublicTTC,
  TaxeApplicableLike,
} from '../../common/fiscal/tarif-decomposition';
import { assertNombreOccupantsValide } from '../../common/utils/occupancy';
import { computeTaxLineAmount } from '../billing/utils/invoice-calc';
// GL-003 — module feuille (parameters.module.ts n'importe que AuditModule),
// consommé en façade pour la grille tarifaire saisonnière (SeasonRate) et le
// paramètre paiementImmediatProlongationObligatoire, jamais de lecture
// directe de ces tables (CLAUDE.md, docs/modules/parameters.md §10).
import { ParametersService } from '../parameters/parameters.service';
// Jeton + interface uniquement (fichier feuille, aucune dépendance vers
// stay/*) — jamais d'import de housekeeping.module.ts ni de la classe
// concrète HousekeepingTaskService ici : un aller-retour entre fichiers
// .module.ts casse le chargement CommonJS au démarrage (constaté en le
// testant). Résolu à l'exécution via ModuleRef#get (voir changeRoom).
import {
  HOUSEKEEPING_TASK_WRITER,
  type HousekeepingTaskWriter,
} from '../housekeeping/housekeeping-task-writer.token';
import { WalkinDto } from './dto/walkin.dto';
import { CheckinFromReservationDto } from './dto/checkin-from-reservation.dto';
import { ForceCheckoutDto } from './dto/force-checkout.dto';
import { ExtensionDepositDto } from './dto/extension-deposit.dto';
import { computeSoldeDu } from './utils/solde';
import { CheckoutEffectueEvent } from './events/checkout-effectue.event';
// GL-003B — façade PaymentsModule (voir stay.module.ts) uniquement pour
// createExtensionDeposit, jamais consommé par extendStay lui-même.
import { PaymentsService } from '../payments/payments.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { BusinessDateService } from '../night-audit/business-date.service';
// DESIGN-009B — hash déterministe du pricing preview (pricingFingerprint),
// jamais utilisé comme secret d'autorisation (voir computeChangeRoomPricing
// ci-dessous), simple détection de dérive entre preview et commit.
import { createHash } from 'crypto';

const STAY_INCLUDE = {
  reservation: true,
  guest: true,
  room: { include: { roomType: true } },
  folios: { include: { lignes: true } },
  policeRecord: true,
} as const;

// Message d'avertissement non bloquant (registre légal DGSN) — jamais une
// exception : un walk-in doit pouvoir être enregistré rapidement, la fiche
// de police peut être complétée juste après (voir PoliceController).
const POLICE_RECORD_WARNING =
  'Fiche de police (registre légal des personnes hébergées) non renseignée pour ce séjour.';

// Priorité 3 (formules d'hébergement) — libellé de la FolioLine EXTRA créée
// au check-in pour toute formule ≠ ROOM_ONLY.
const FORMULE_LABEL: Partial<Record<FormuleHebergement, string>> = {
  BED_AND_BREAKFAST: 'petit-déjeuner',
  HALF_BOARD: 'demi-pension',
  FULL_BOARD: 'pension complète',
};

@Injectable()
export class StayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
    private readonly guestsService: GuestsService,
    private readonly billingService: BillingService,
    private readonly auditService: AuditService,
    private readonly parametersService: ParametersService,
    private readonly eventEmitter: EventEmitter2,
    private readonly moduleRef: ModuleRef,
    private readonly paymentsService: PaymentsService,
    private readonly maintenanceService: MaintenanceService,
  ) {}

  private async getCurrentBusinessDate(): Promise<Date> {
    const businessDateService = this.moduleRef.get(BusinessDateService, {
      strict: false,
    });

    if (!businessDateService) {
      throw new Error(
        'BusinessDateService is required for stay business date calculations.',
      );
    }

    return businessDateService.getCurrentBusinessDate();
  }

  // FIN-102 — taxes statutaires à matérialiser au check-in/à la
  // prolongation (jamais à la facturation pour un séjour non-legacy, voir
  // BillingService.generateInvoice). Même filtre que l'actuel `taxesToApply`
  // de generateInvoice (TVA_HEBERGEMENT/TVA_ANNEXE exclues — ce ne sont
  // jamais des taxes statutaires distinctes, ADR-008/FIN-101B) : dupliqué
  // ici intentionnellement (deux points de matérialisation désormais
  // distincts — check-in/prolongation vs fallback legacy — jamais un seul
  // appelant partagé), pas une divergence.
  private async getTaxesStatutaires(
    tx: Prisma.TransactionClient,
  ): Promise<TaxeApplicableLike[]> {
    const applicableTaxes = await this.parametersService.getApplicableTaxes(tx);
    return applicableTaxes.filter(
      (t) => t.type !== 'TVA_HEBERGEMENT' && t.type !== 'TVA_ANNEXE',
    );
  }

  // Transformation réservation → séjour (CLAUDE.md règle 1 : le séjour
  // devient l'objet central). Les nuits sont déjà verrouillées depuis la
  // création de la réservation (RoomNight) : on les rattache au séjour au
  // lieu d'en recréer, la contrainte unique (roomId, date) reste la même
  // ligne physique.
  async checkinFromReservation(
    reservationId: number,
    dto: CheckinFromReservationDto,
    userId?: number,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Même verrou que ReservationsService.update() : un déplacement et
        // une transformation en séjour ne peuvent pas valider tous deux une
        // lecture CONFIRMEE concurrente.
        await tx.$queryRaw`
          SELECT id FROM Reservation WHERE id = ${reservationId} FOR UPDATE
        `;
        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
        });
        if (!reservation) {
          throw new NotFoundException(
            `Réservation ${reservationId} introuvable.`,
          );
        }
        if (reservation.statut !== StatutReservation.CONFIRMEE) {
          throw new ConflictException(
            `Cette réservation ne peut pas être transformée en séjour (statut actuel : ${reservation.statut}).`,
          );
        }

        // FIN-102 — occupation réelle : reprise de la réservation si connue,
        // sinon secours par le corps de requête (CheckinFromReservationDto).
        // Jamais un repli implicite sur room.roomType.capacite (interdiction
        // absolue, common/utils/occupancy.ts) — un nouveau séjour ne doit
        // jamais rester Stay.nombreOccupants NULL.
        const nombreOccupants =
          dto?.nombreOccupants ?? reservation.nombreOccupants ?? undefined;
        if (nombreOccupants === undefined) {
          throw new BadRequestException(
            'nombreOccupants requis pour ce check-in (ni la réservation ni la requête ne le renseignent).',
          );
        }
        const lockedRoom = await this.roomsService.lockRoomForUpdate(
          reservation.roomId,
          tx,
        );
        await this.maintenanceService.assertNoActiveSalesBlocker(
          reservation.roomId,
          tx,
        );
        const room = await this.roomsService.findByIdWithPricing(
          reservation.roomId,
          tx,
        );
        assertNombreOccupantsValide(nombreOccupants, room.roomType.capacite);

        const stay = await tx.stay.create({
          data: {
            reservationId: reservation.id,
            roomId: reservation.roomId,
            guestId: reservation.guestId,
            dateCheckin: new Date(),
            dateCheckoutPrevue: reservation.dateDepart,
            formule: reservation.formule,
            nombreOccupants,
          },
        });

        await tx.roomNight.updateMany({
          where: { reservationId: reservation.id },
          data: { stayId: stay.id },
        });

        await tx.reservation.update({
          where: { id: reservation.id },
          data: { statut: StatutReservation.TRANSFORMEE_EN_SEJOUR },
        });
        await this.roomsService.transitionRoom(
          reservation.roomId,
          StatutChambre.OCCUPEE,
          {
            expectedFrom: lockedRoom.statut,
            motif: 'Check-in depuis réservation',
            userId,
            tx,
          },
        );

        const nights = getNightsBetween(
          reservation.dateArrivee,
          reservation.dateDepart,
        );
        // FIN-102 (ADR-008 suite) — le tarif public TTC vendu
        // (prixTotalFinal, jamais recalculé indépendamment, CLAUDE.md règle
        // 3) est décomposé par la fonction canonique unique
        // decomposerTarifPublicTTC : HEBERGEMENT résiduel + EXTRA formule
        // incluse + TAXE_SEJOUR, dont la somme reproduit exactement
        // prixTotalFinal — jamais une addition par-dessus (bug corrigé ici,
        // voir CLAUDE.md/mission FIN-102).
        const taxesStatutaires = await this.getTaxesStatutaires(tx);
        const decomposition = decomposerTarifPublicTTC({
          tarifPublicTTC: reservation.prixTotalFinal,
          nuits: nights.length,
          occupants: nombreOccupants,
          formule: reservation.formule,
          roomType: room.roomType,
          taxesApplicables: taxesStatutaires,
        });

        const folio = await this.createFolioPrincipal(
          tx,
          stay.id,
          nights.length,
          reservation.formule,
          decomposition,
        );
        // Priorité 2 (acomptes) : un walk-in n'a jamais de réservation
        // préalable donc jamais d'acompte à imputer — cet appel n'existe
        // que sur ce chemin-ci, jamais dans checkinWalkIn.
        await this.imputerAcomptes(tx, reservation.id, folio.id, userId);

        const created = await tx.stay.findUniqueOrThrow({
          where: { id: stay.id },
          include: STAY_INCLUDE,
        });
        return {
          ...created,
          avertissements: created.policeRecord ? [] : [POLICE_RECORD_WARNING],
        };
      });
    } catch (error) {
      // FIN-102 — composition tarifaire impossible (formule + taxes >
      // tarif public TTC) : jamais un 500 générique, traduit en 409 comme le
      // reste des conflits métier de ce service.
      if (error instanceof CompositionTarifaireImpossibleError) {
        throw new ConflictException(error.message);
      }
      throw this.translateConflict(
        error,
        'Cette réservation a déjà été transformée en séjour.',
      );
    }
  }

  // Verrouillage anti-double-occupation (docs/plan-execution-claude-code.md
  // §8, réutilise le même mécanisme que reservations) : une ligne RoomNight
  // par nuit, protégée par la contrainte unique (roomId, date). Un walk-in
  // n'a pas de réservation préexistante : les nuits n'existent pas encore,
  // on les crée directement rattachées au séjour.
  async checkinWalkIn(dto: WalkinDto, userId?: number) {
    if (!dto.guestId && !dto.guest) {
      throw new BadRequestException(
        'guestId (client existant) ou guest (nouveau client) requis.',
      );
    }
    const dateCheckin = new Date();
    const { today: firstNight } = getTodayRange();

    if (new Date(dto.dateCheckoutPrevue) <= firstNight) {
      throw new BadRequestException(
        'dateCheckoutPrevue doit être postérieure à aujourd’hui.',
      );
    }
    const nights = getNightsBetween(firstNight, dto.dateCheckoutPrevue);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const lockedRoom = await this.roomsService.lockRoomForUpdate(
          dto.roomId,
          tx,
        );
        await this.maintenanceService.assertNoActiveSalesBlocker(
          dto.roomId,
          tx,
        );
        const room = await this.roomsService.findByIdWithPricing(
          dto.roomId,
          tx,
        );

        const guest = dto.guestId
          ? await this.guestsService.assertNotBlacklisted(dto.guestId, tx)
          : await tx.guest.create({ data: dto.guest! });

        const formule = dto.formule ?? FormuleHebergement.BED_AND_BREAKFAST;

        // FIN-102 — un walk-in n'a pas de Reservation préexistante : le
        // corps de requête (WalkinDto.nombreOccupants) est ici strictement
        // obligatoire (validé au niveau DTO), jamais un repli implicite sur
        // room.roomType.capacite (common/utils/occupancy.ts).
        assertNombreOccupantsValide(
          dto.nombreOccupants,
          room.roomType.capacite,
        );

        const stay = await tx.stay.create({
          data: {
            roomId: room.id,
            guestId: guest.id,
            dateCheckin,
            dateCheckoutPrevue: new Date(dto.dateCheckoutPrevue),
            formule,
            nombreOccupants: dto.nombreOccupants,
          },
        });

        await tx.roomNight.createMany({
          data: nights.map((date) => ({
            roomId: room.id,
            date,
            stayId: stay.id,
          })),
        });

        await this.roomsService.transitionRoom(room.id, StatutChambre.OCCUPEE, {
          expectedFrom: lockedRoom.statut,
          motif: 'Check-in walk-in',
          userId,
          tx,
        });

        // FIN-102 — un walk-in n'a pas de tarif public TTC déjà quoté
        // (contrairement à Reservation.prixTotalFinal) : le tarif public TTC
        // annoncé au check-in EST par définition la somme du tarif nuitée
        // brut et du supplément de formule — puis décomposé par la même
        // fonction canonique unique que checkinFromReservation/extendStay,
        // pour que TAXE_SEJOUR en soit absorbée exactement de la même façon
        // (jamais additionnée par-dessus). Règle métier validée (ADR-008
        // §4.5, reservations/utils/pricing.ts::calculateFormuleSupplement) :
        // BED_AND_BREAKFAST n'ajoute plus rien (petit-déjeuner déjà inclus
        // dans room.roomType.prixBase) — HALF_BOARD/FULL_BOARD restent
        // additifs, comportement historique inchangé.
        const hebergementBrut = calculateNightlyTotal(
          nights,
          room.roomType.prixBase,
          room.roomType.seasonRates,
        );
        const formuleBrute = calculateFormuleSupplement(
          formule,
          room.roomType,
          nights.length,
          dto.nombreOccupants,
        );
        const tarifPublicTTC = hebergementBrut.add(formuleBrute);

        const taxesStatutaires = await this.getTaxesStatutaires(tx);
        const decomposition = decomposerTarifPublicTTC({
          tarifPublicTTC,
          nuits: nights.length,
          occupants: dto.nombreOccupants,
          formule,
          roomType: room.roomType,
          taxesApplicables: taxesStatutaires,
        });

        await this.createFolioPrincipal(
          tx,
          stay.id,
          nights.length,
          formule,
          decomposition,
        );

        const created = await tx.stay.findUniqueOrThrow({
          where: { id: stay.id },
          include: STAY_INCLUDE,
        });
        return {
          ...created,
          avertissements: created.policeRecord ? [] : [POLICE_RECORD_WARNING],
        };
      });
    } catch (error) {
      if (error instanceof CompositionTarifaireImpossibleError) {
        throw new ConflictException(error.message);
      }
      throw this.translateConflict(
        error,
        'Chambre déjà occupée par un autre séjour sur cette période.',
      );
    }
  }

  // FIN-102 — createFolioPrincipal reçoit désormais directement le résultat
  // de decomposerTarifPublicTTC (HEBERGEMENT résiduel + EXTRA formule
  // incluse + TAXE_SEJOUR statutaire), jamais un montantHebergement/
  // montantFormule calculés séparément par l'appelant (chemin d'écriture
  // canonique unique). La ligne EXTRA formule incluse et la/les ligne(s)
  // TAXE_SEJOUR ne sont créées que si leur montant est strictement positif —
  // ROOM_ONLY ou une occupation à 0 taxe ne produisent jamais de ligne
  // vide.
  private async createFolioPrincipal(
    tx: Prisma.TransactionClient,
    stayId: number,
    nights: number,
    formule: FormuleHebergement,
    decomposition: {
      hebergement: Prisma.Decimal;
      formuleIncluse: Prisma.Decimal;
      taxesStatutaires: {
        taxRateConfigId: number;
        type: string;
        montant: Prisma.Decimal;
      }[];
    },
  ) {
    const {
      hebergement: montantHebergement,
      formuleIncluse: montantFormule,
      taxesStatutaires,
    } = decomposition;
    const folio = await tx.folio.create({
      data: { stayId, libelle: 'Folio principal' },
    });
    await tx.folioLine.create({
      data: {
        folioId: folio.id,
        type: TypeLigneFolio.HEBERGEMENT,
        libelle: `Hébergement — ${nights} nuit${nights > 1 ? 's' : ''}`,
        montant: montantHebergement,
      },
    });
    if (formule !== FormuleHebergement.ROOM_ONLY && montantFormule.gt(0)) {
      await tx.folioLine.create({
        data: {
          folioId: folio.id,
          type: TypeLigneFolio.EXTRA,
          libelle: `Formule ${FORMULE_LABEL[formule]} — ${nights} nuit${nights > 1 ? 's' : ''}`,
          montant: montantFormule,
        },
      });
    }
    // FIN-102 — TAXE_SEJOUR (et toute future taxe statutaire) matérialisée
    // dès le check-in pour un séjour non-legacy, plus jamais à la
    // facturation (BillingService.generateInvoice devient strictement
    // lecture seule sur les charges d'un tel séjour, voir §7/§8 de la
    // mission FIN-102).
    for (const taxe of taxesStatutaires) {
      if (taxe.montant.lte(0)) continue;
      await tx.folioLine.create({
        data: {
          folioId: folio.id,
          type: TypeLigneFolio.TAXE_SEJOUR,
          libelle: taxe.type,
          montant: taxe.montant,
          tauxTva: new Prisma.Decimal(0),
          taxRateConfigId: taxe.taxRateConfigId,
        },
      });
    }
    return folio;
  }

  // Priorité 2 (acomptes réservation) : impute au folio principal tout
  // ReservationDeposit ENCAISSE de cette réservation, jamais EN_ATTENTE
  // (argent pas encore réellement perçu) ni déjà IMPUTE/REMBOURSE. Toujours
  // via BillingService.creditFolioLine — jamais d'écriture FolioLine directe
  // ici (chemin d'écriture canonique unique, même règle que PaymentsService).
  private async imputerAcomptes(
    tx: Prisma.TransactionClient,
    reservationId: number,
    folioId: number,
    userId?: number,
  ) {
    const deposits = await tx.reservationDeposit.findMany({
      where: {
        reservationId,
        statut: StatutAcompte.ENCAISSE,
      },
    });

    for (const deposit of deposits) {
      await this.billingService.creditFolioLine(
        folioId,
        deposit.montant,
        `Acompte réservation — ${deposit.moyen}`,
        tx,
      );

      const updated = await tx.reservationDeposit.update({
        where: { id: deposit.id },
        data: { statut: StatutAcompte.IMPUTE, imputeAuFolioId: folioId },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: 'IMPUTE_DEPOSIT',
        targetEntity: 'RESERVATION_DEPOSIT',
        targetId: deposit.id,
        oldValue: { statut: deposit.statut },
        newValue: { statut: updated.statut, imputeAuFolioId: folioId },
        motif: `Imputation automatique de l'acompte au folio principal lors du check-in (réservation ${reservationId}).`,
      });
    }
  }

  async findEnCours() {
    return this.prisma.stay.findMany({
      where: { statut: StatutSejour.EN_COURS },
      include: STAY_INCLUDE,
      orderBy: { dateCheckin: 'asc' },
    });
  }

  async departsToday() {
    const { today, tomorrow } = getTodayRange();

    return this.prisma.stay.findMany({
      where: {
        statut: StatutSejour.EN_COURS,
        dateCheckoutPrevue: { gte: today, lt: tomorrow },
      },
      include: STAY_INCLUDE,
      orderBy: { room: { numero: 'asc' } },
    });
  }

  // ARCH-011A — façade en lecture seule pour night-audit (PRECHECK,
  // contrôle DEPARTURES_UNRESOLVED, BLOCKER) : night-audit ne lit jamais la
  // table Stay directement (CLAUDE.md, "un module ne doit jamais lire
  // directement les tables d'un autre domaine via Prisma"). Distincte de
  // departsToday ci-dessus (bornée à la fenêtre UTC du jour serveur) : ici
  // `businessDate` (résolu dans le fuseau hôtel par
  // BusinessDateService) est une borne <= explicite, pas une fenêtre
  // [jour, jour+1[ — un séjour dont le départ était prévu il y a plusieurs
  // jours et jamais clôturé doit rester bloquant tant qu'il n'est pas
  // traité, pas seulement le jour même.
  async findActiveStaysDueForCheckout(businessDate: Date) {
    return this.prisma.stay.findMany({
      where: {
        statut: StatutSejour.EN_COURS,
        dateCheckoutPrevue: { lte: businessDate },
      },
      include: STAY_INCLUDE,
      orderBy: { room: { numero: 'asc' } },
    });
  }

  async findOne(id: number) {
    const stay = await this.prisma.stay.findUnique({
      where: { id },
      include: STAY_INCLUDE,
    });
    if (!stay) {
      throw new NotFoundException(`Séjour ${id} introuvable.`);
    }
    return stay;
  }

  // Check-out = clôture du séjour + libération des nuits encore verrouillées
  // (départ anticipé compris) pour que la chambre redevienne réservable
  // immédiatement, et calcul du solde dû à partir des lignes de folio
  // existantes (jamais un nouveau calcul indépendant, CLAUDE.md règle 3).
  // Le passage de la chambre en À nettoyer ne se fait plus ici directement :
  // il est déclenché par l'événement checkout.effectue (cahier des charges
  // §5.6 Phase 2), écouté par le module housekeeping — stay n'a pas
  // besoin de connaître sa machine à états. emitAsync (pas emit) : le
  // listener écrit en base de façon asynchrone, on l'attend pour que
  // Room.statut soit déjà à jour quand checkout() répond à l'appelant.
  //
  // CH-005 : un solde positif bloque désormais le check-out (BR-SEJ-004/
  // INV-SEJ-002, jusqu'ici non appliqués — voir CLAUDE.md). Échappatoire
  // volontaire (arbitrage produit) : force=true, motif écrit obligatoire
  // (validé par ForceCheckoutDto), soumis à la permission dédiée
  // checkin:force-checkout (Administrateur uniquement, vérification
  // dynamique — le contenu de la requête, pas seulement la route, détermine
  // la permission requise, donc pas exprimable par @RequirePermission,
  // même pattern que GuestsService.updateCategorie/guests:blacklist).
  // Solde négatif ou nul : jamais bloqué, comportement inchangé.
  //
  // F11 (CH-056, RD-025/RD-F11-03) — extension de BR-SEJ-004 : une note
  // restaurant non annulée bloque aussi le check-out, indépendamment du
  // solde global. Vérification distincte (pas seulement absorbée par
  // computeSoldeDu, qui ne peut pas dire si un paiement couvre
  // spécifiquement une charge restaurant plutôt qu'une autre — aucune
  // allocation de paiement par type de ligne dans ce modèle) : tant qu'une
  // FolioLine RESTAURANT n'est pas explicitement soldée (annulée par
  // RestaurantService.updateCharge après vérification), elle bloque,
  // même si le solde total est nul ou négatif. Même échappatoire
  // (force + motif + checkin:force-checkout), mais AuditAction distinct
  // (FORCE_CHECKOUT_RESTAURANT) pour ne pas confondre les deux causes.
  async checkout(
    id: number,
    dto?: ForceCheckoutDto,
    userId?: number,
    roleId?: number,
  ) {
    const stay = await this.findOne(id);
    if (stay.statut !== StatutSejour.EN_COURS) {
      throw new ConflictException(
        `Ce séjour est déjà clôturé (statut actuel : ${stay.statut}).`,
      );
    }

    const soldeDu = computeSoldeDu(stay.folios);
    const soldePositif = soldeDu.gt(0);
    const restaurantNonAcquittee = stay.folios.some((folio) =>
      folio.lignes.some(
        (ligne) => ligne.type === TypeLigneFolio.RESTAURANT && !ligne.annulee,
      ),
    );
    const force = dto?.force === true;

    if (soldePositif && !force) {
      throw new ConflictException(
        `Solde impayé (${soldeDu.toFixed(2)} MAD) : le check-out est bloqué tant que le solde n'est pas ramené à 0 (paiement ou avoir). Un check-out forcé est possible (force: true, motif ≥ 10 caractères), réservé à la permission checkin:force-checkout.`,
      );
    }
    if (restaurantNonAcquittee && !force) {
      throw new ConflictException(
        `Une ou plusieurs notes restaurant n'ont pas été soldées pour ce séjour : le check-out est bloqué tant qu'elles ne sont pas annulées (correction) ou explicitement réglées. Un check-out forcé est possible (force: true, motif ≥ 10 caractères), réservé à la permission checkin:force-checkout.`,
      );
    }

    const dateCheckoutReelle = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const lockedStays = await tx.$queryRaw<
        Array<{ id: number; roomId: number; statut: StatutSejour }>
      >`
        SELECT id, roomId, statut
        FROM Stay
        WHERE id = ${id}
        FOR UPDATE
      `;
      if (lockedStays.length === 0) {
        throw new NotFoundException(`Séjour ${id} introuvable.`);
      }
      const lockedStay = lockedStays[0];
      if (lockedStay.statut !== StatutSejour.EN_COURS) {
        throw new ConflictException(
          `Ce séjour est déjà clôturé (statut actuel : ${lockedStay.statut}).`,
        );
      }

      if ((soldePositif || restaurantNonAcquittee) && force) {
        const grant = await tx.permission.findFirst({
          where: {
            module: 'checkin',
            action: 'force-checkout',
            roles: { some: { roleId } },
          },
        });
        if (!grant) {
          throw new ForbiddenException(
            'Permission requise : checkin:force-checkout.',
          );
        }

        if (soldePositif) {
          await this.auditService.writeLog(tx, {
            userId,
            action: AuditAction.FORCE_CHECKOUT,
            targetEntity: AuditEntity.Stay,
            targetId: id,
            oldValue: { soldeDu: soldeDu.toFixed(2) },
            newValue: { statut: StatutSejour.CHECKOUT },
            motif: dto.motif!,
          });
        }
        if (restaurantNonAcquittee) {
          await this.auditService.writeLog(tx, {
            userId,
            action: AuditAction.FORCE_CHECKOUT_RESTAURANT,
            targetEntity: AuditEntity.Stay,
            targetId: id,
            oldValue: { restaurantNonAcquittee: true },
            newValue: { statut: StatutSejour.CHECKOUT },
            motif: dto.motif!,
          });
        }
      }

      // FIN-102 — réconciliation append-only de TAXE_SEJOUR sur départ
      // anticipé (nuits réellement consommées < nuits prévues au moment du
      // check-out). Exécutée avant la suppression des RoomNight (peu
      // importe l'ordre, ni l'une ni l'autre ne dépendent du résultat de
      // l'autre) mais toujours dans cette même transaction (ADR-005). Ne
      // modifie jamais le solde déjà vérifié ci-dessus (soldePositif) — la
      // réconciliation reclasse un montant entre TAXE_SEJOUR et HEBERGEMENT,
      // jamais le total du folio.
      await this.reconcileTaxeSejourDepartAnticipe(
        tx,
        stay,
        dateCheckoutReelle,
        userId,
      );

      // Le checkout possède l'invariant physique minimal : même si son
      // effet Housekeeping post-commit échoue, la chambre devient sale dans
      // la transaction du séjour et reste donc récupérable par la
      // réconciliation normale.
      const room = await this.roomsService.lockRoomForUpdate(
        lockedStay.roomId,
        tx,
      );
      const hasBlockingTicket =
        await this.maintenanceService.hasActiveSalesBlocker(
          lockedStay.roomId,
          tx,
        );
      const checkoutTarget = hasBlockingTicket
        ? StatutChambre.EN_MAINTENANCE
        : StatutChambre.A_NETTOYER;
      if (room.statut !== checkoutTarget) {
        await this.roomsService.transitionRoom(
          lockedStay.roomId,
          checkoutTarget,
          {
            expectedFrom: room.statut,
            motif: hasBlockingTicket
              ? `Checkout du séjour #${lockedStay.id} - panne bloquant la vente toujours ouverte.`
              : `Checkout du séjour #${lockedStay.id} - passage à A_NETTOYER.`,
            userId,
            tx,
          },
        );
      }

      await tx.roomNight.deleteMany({ where: { stayId: lockedStay.id } });

      return tx.stay.update({
        where: { id: lockedStay.id },
        data: {
          statut: StatutSejour.CHECKOUT,
          dateCheckoutReelle,
        },
        include: STAY_INCLUDE,
      });
    });

    await this.eventEmitter.emitAsync(
      'checkout.effectue',
      new CheckoutEffectueEvent(updated.roomId, updated.id, userId),
    );

    return { ...updated, soldeDu: soldeDu.toFixed(2) };
  }

  // FIN-102 — réconciliation append-only de TAXE_SEJOUR à un départ
  // anticipé (nombre de nuits réellement consommées < nuits prévues au
  // moment de la matérialisation initiale au check-in/à la prolongation).
  // Chemin d'écriture dédié, distinct de BillingService.cancelFolioLine
  // (qui refuse explicitement TAXE_SEJOUR, BR-AUD-002 — ligne générée par le
  // système, jamais annulable à la main) : annulation directe
  // (annulee=true + motifAnnulation) des lignes TAXE_SEJOUR en trop, puis
  // recréation au montant réellement dû (jamais de montant négatif).
  // Décision de cadrage FIN-102 : l'hébergement réservé reste dû (aucune
  // réduction automatique de HEBERGEMENT), mais pour préserver l'invariant
  // du package TTC initial (Σlignes actives === tarif public TTC vendu), le
  // montant de taxe libéré est reclassé dans une NOUVELLE ligne HEBERGEMENT
  // (jamais une mutation d'une ligne existante) — le total facturé au
  // client ne change donc jamais, seule sa ventilation TAXE_SEJOUR/
  // HEBERGEMENT est corrigée pour rester statutairement exacte (la taxe de
  // séjour ne doit jamais dépasser les nuits réellement occupées).
  // Séjour legacy (Stay.nombreOccupants IS NULL) : TAXE_SEJOUR n'a jamais
  // été matérialisée au check-in pour ces séjours (fallback facturation
  // historique, BillingService.generateInvoice) — rien à réconcilier ici,
  // sortie immédiate.
  private async reconcileTaxeSejourDepartAnticipe(
    tx: Prisma.TransactionClient,
    stay: {
      id: number;
      dateCheckin: Date;
      dateCheckoutPrevue: Date;
      nombreOccupants: number | null;
      folios: {
        id: number;
        lignes: Array<Prisma.FolioLineGetPayload<object>>;
      }[];
    },
    dateCheckoutReelle: Date,
    userId?: number,
  ) {
    if (stay.nombreOccupants === null) return;

    const nightsPrevues = getNightsBetween(
      stay.dateCheckin,
      stay.dateCheckoutPrevue,
    ).length;
    const nightsReelles = getNightsBetween(
      stay.dateCheckin,
      dateCheckoutReelle,
    ).length;
    if (nightsReelles >= nightsPrevues) return;

    const folioPrincipal = stay.folios[0];
    if (!folioPrincipal) return;

    const taxesStatutaires = await this.getTaxesStatutaires(tx);
    let totalReclasseVersHebergement = new Prisma.Decimal(0);
    // DESIGN-010 (audit facture figée) — rien n'empêche aujourd'hui
    // BillingService.generateInvoice() d'émettre une facture sur le folio
    // d'un séjour encore EN_COURS (aucune vérification de Stay.statut dans
    // generateInvoice). Un départ anticipé consécutif à une telle facture
    // écrirait donc directement dans FolioLine (annulation + recréation
    // TAXE_SEJOUR/HEBERGEMENT ci-dessous) sans jamais passer par
    // BillingService.addFolioLine/cancelFolioLine, contournant leur garde
    // "facture émise". Vérifiée ici une seule fois avant toute écriture,
    // uniquement si une réconciliation réelle serait nécessaire (sinon
    // aucune écriture n'a jamais lieu, inutile de bloquer un checkout sans
    // impact financier).
    let invoicesActivesCache: { statut: string }[] | null = null;
    const assertFolioNonFacture = async () => {
      if (invoicesActivesCache === null) {
        invoicesActivesCache = await tx.invoice.findMany({
          where: { folioId: folioPrincipal.id },
        });
      }
      if (invoicesActivesCache.some((i) => i.statut === 'EMISE')) {
        throw new ConflictException(
          `Une facture active existe déjà pour le folio ${folioPrincipal.id} — impossible de réconcilier la taxe de séjour d'un départ anticipé dont la facture est déjà émise. Génère un avoir avant le check-out.`,
        );
      }
    };

    for (const taxe of taxesStatutaires) {
      const lignesActives = folioPrincipal.lignes.filter(
        (l) =>
          l.type === TypeLigneFolio.TAXE_SEJOUR &&
          !l.annulee &&
          l.taxRateConfigId === taxe.id,
      );
      if (lignesActives.length === 0) continue;

      const ancienMontantTotal = lignesActives.reduce(
        (acc, l) => acc.add(l.montant),
        new Prisma.Decimal(0),
      );
      // Base HT non pertinente pour TAXE_SEJOUR (MONTANT_FIXE, seul mode
      // réellement configuré aujourd'hui, cf. seed.ts) — même limite
      // documentée que common/fiscal/tarif-decomposition.ts pour une taxe
      // POURCENTAGE hypothétique, jamais exercée en pratique.
      const nouveauMontant = computeTaxLineAmount(
        taxe,
        nightsReelles,
        stay.nombreOccupants,
        new Prisma.Decimal(0),
      );
      if (nouveauMontant.gte(ancienMontantTotal)) continue;

      await assertFolioNonFacture();

      for (const ligne of lignesActives) {
        await tx.folioLine.update({
          where: { id: ligne.id },
          data: {
            annulee: true,
            motifAnnulation: `Départ anticipé — recalcul taxe de séjour (${nightsReelles} nuit(s) réelles au lieu de ${nightsPrevues} prévues).`,
          },
        });
      }
      await tx.folioLine.create({
        data: {
          folioId: folioPrincipal.id,
          type: TypeLigneFolio.TAXE_SEJOUR,
          libelle: `${taxe.type} (recalculée — départ anticipé)`,
          montant: nouveauMontant,
          tauxTva: new Prisma.Decimal(0),
          taxRateConfigId: taxe.id,
        },
      });
      totalReclasseVersHebergement = totalReclasseVersHebergement.add(
        ancienMontantTotal.sub(nouveauMontant),
      );
    }

    if (totalReclasseVersHebergement.gt(0)) {
      await tx.folioLine.create({
        data: {
          folioId: folioPrincipal.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle:
            'Réajustement hébergement — départ anticipé (taxe de séjour reclassée, nuits réservées restant dues)',
          montant: totalReclasseVersHebergement,
        },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.RECONCILE_TAXE_SEJOUR,
        targetEntity: AuditEntity.Stay,
        targetId: stay.id,
        oldValue: { nightsPrevues },
        newValue: {
          nightsReelles,
          reclasseVersHebergement: totalReclasseVersHebergement.toFixed(2),
        },
        motif: `Départ anticipé (${nightsReelles} nuit(s) réelles au lieu de ${nightsPrevues} prévues) — taxe de séjour recalculée, montant reclassé en hébergement (nuits réservées restant dues).`,
      });
    }
  }

  // Façade en lecture seule pour housekeeping (rattrapage quotidien du
  // statut DEPART_PREVU) — housekeeping ne lit jamais la table Stay
  // directement.
  async findActiveStayForRoom(roomId: number) {
    return this.prisma.stay.findFirst({
      where: { roomId, statut: StatutSejour.EN_COURS },
    });
  }

  // DESIGN-009B — moteur de pricing partagé entre le preview
  // (POST /stays/:id/change-room/preview) et le commit (changeRoom
  // ci-dessous) : LA seule et même fonction pour les deux, jamais une
  // seconde implémentation. `tx` optionnel — préview l'appelle en lecture
  // simple (this.prisma), commit l'appelle depuis l'intérieur de sa
  // transaction, APRÈS avoir verrouillé Folio/FolioLine (même précédent que
  // computeExtensionPricing) : les valeurs lues ici sont donc cohérentes
  // avec l'état verrouillé au moment de l'appel côté commit.
  //
  // Formule ancien côté (préserve le prix RÉELLEMENT CONTRACTÉ, jamais un
  // recalcul catalogue rétroactif) : tarifNuitMoyenContracte = Σ FolioLine
  // HEBERGEMENT actives / total des nuits du séjour (passées incluses),
  // multiplié par le nombre de nuits impactées. La composante formule
  // (repas) de l'ancien côté n'est PAS reconstruite depuis le folio (les
  // lignes EXTRA mélangent formule-incluse et extras manuels sans lien) :
  // calculée symétriquement au catalogue courant, comme le nouveau côté.
  //
  // Formule nouveau côté : aucun prix contractuel n'existe pour une chambre
  // où le client n'a jamais séjourné — catalogue courant intégral
  // (calculateNightlyTotal + calculateFormuleSupplement), jamais de lecture
  // directe de SeasonRate (ParametersService.getSeasonRatesForRoomType en
  // façade).
  //
  // Taxe de séjour jamais recalculée ici (MONTANT_FIXE, indépendante du prix
  // de la chambre) — aucune FolioLine TAXE_SEJOUR n'est jamais touchée par
  // ce moteur.
  private async computeChangeRoomPricing(
    stayId: number,
    newRoomId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    stay: {
      id: number;
      roomId: number;
      dateCheckoutPrevue: Date;
      formule: FormuleHebergement;
      nombreOccupants: number | null;
    };
    oldRoom: {
      id: number;
      numero: string;
      roomType: { nom: string; capacite: number };
    };
    newRoom: {
      id: number;
      numero: string;
      roomTypeId: number;
      roomType: {
        nom: string;
        capacite: number;
        prixBase: Prisma.Decimal;
        prixPetitDejeuner: Prisma.Decimal;
        prixDemiPension: Prisma.Decimal;
        prixPensionComplete: Prisma.Decimal;
      };
    };
    nuitsImpactees: Date[];
    ancienMontantRestant: Prisma.Decimal;
    nouveauMontantRestant: Prisma.Decimal;
    difference: Prisma.Decimal;
    pricingFingerprint: string;
    capaciteInsuffisante: boolean;
    folios: { id: number }[];
  }> {
    const client = tx ?? this.prisma;

    const stay = await client.stay.findUnique({ where: { id: stayId } });
    if (!stay) {
      throw new NotFoundException(`Séjour ${stayId} introuvable.`);
    }
    if (stay.statut !== StatutSejour.EN_COURS) {
      throw new ConflictException(
        `Ce séjour est déjà clôturé (statut actuel : ${stay.statut}).`,
      );
    }
    if (newRoomId === stay.roomId) {
      throw new ConflictException(
        `La chambre cible est identique à la chambre actuelle.`,
      );
    }

    const [oldRoom, newRoom, allStayNights, folios] = await Promise.all([
      client.room.findUnique({
        where: { id: stay.roomId },
        include: { roomType: true },
      }),
      client.room.findUnique({
        where: { id: newRoomId },
        include: { roomType: true },
      }),
      client.roomNight.findMany({
        where: { stayId },
        select: { date: true },
        orderBy: { date: 'asc' },
      }),
      client.folio.findMany({
        where: { stayId },
        select: {
          id: true,
          lignes: { select: { type: true, montant: true, annulee: true } },
        },
      }),
    ]);
    if (!oldRoom) {
      throw new NotFoundException(`Chambre ${stay.roomId} introuvable.`);
    }
    if (!newRoom) {
      throw new NotFoundException(`Chambre ${newRoomId} introuvable.`);
    }

    const todayStart = await this.getCurrentBusinessDate();
    const nuitsImpactees = allStayNights
      .map((n) => n.date)
      .filter((date) => date >= todayStart);
    const totalNuitsSejour = allStayNights.length;

    // Occupation réelle du séjour, jamais déduite de roomType.capacite
    // (interdiction absolue, common/utils/occupancy.ts). Un séjour légacy
    // pré-FIN-102 (nombreOccupants IS NULL, cas résiduel — tout séjour créé
    // depuis FIN-102 est obligatoirement renseigné) est traité comme 0
    // occupant plutôt que déduit de la capacité : la vérification de
    // capacité et le supplément de formule deviennent alors des no-op
    // dégénérés (jamais bloquants), sans jamais inventer une occupation.
    const occupants = stay.nombreOccupants ?? 0;
    const capaciteInsuffisante = newRoom.roomType.capacite < occupants;

    let ancienMontantRestant = new Prisma.Decimal(0);
    let nouveauMontantRestant = new Prisma.Decimal(0);

    if (nuitsImpactees.length > 0) {
      const totalHebergementContracte = folios.reduce(
        (acc, folio) =>
          folio.lignes.reduce((sousTotal, ligne) => {
            if (ligne.annulee || ligne.type !== TypeLigneFolio.HEBERGEMENT) {
              return sousTotal;
            }
            return sousTotal.add(ligne.montant);
          }, acc),
        new Prisma.Decimal(0),
      );
      const tarifNuitMoyenContracte =
        totalNuitsSejour > 0
          ? totalHebergementContracte.div(totalNuitsSejour)
          : new Prisma.Decimal(0);
      const ancienMontantRestantHebergement = tarifNuitMoyenContracte.mul(
        nuitsImpactees.length,
      );
      const ancienMontantRestantFormule = calculateFormuleSupplement(
        stay.formule,
        oldRoom.roomType,
        nuitsImpactees.length,
        occupants,
      );
      ancienMontantRestant = ancienMontantRestantHebergement.add(
        ancienMontantRestantFormule,
      );

      const seasonRatesNouvelleChambre =
        await this.parametersService.getSeasonRatesForRoomType(
          newRoom.roomTypeId,
          tx,
        );
      const nouveauMontantRestantHebergement = calculateNightlyTotal(
        nuitsImpactees,
        newRoom.roomType.prixBase,
        seasonRatesNouvelleChambre,
      );
      const nouveauMontantRestantFormule = calculateFormuleSupplement(
        stay.formule,
        newRoom.roomType,
        nuitsImpactees.length,
        occupants,
      );
      nouveauMontantRestant = nouveauMontantRestantHebergement.add(
        nouveauMontantRestantFormule,
      );
    }

    const difference = nouveauMontantRestant.sub(ancienMontantRestant);

    // pricingFingerprint — détection de dérive uniquement, jamais un
    // mécanisme d'autorisation de montant (le serveur recalcule toujours
    // authoritativement au commit). Le motif n'entre jamais dans le hash.
    const pricingFingerprint = createHash('sha256')
      .update(
        [
          stayId,
          newRoomId,
          nuitsImpactees.map((d) => d.toISOString().slice(0, 10)).join(','),
          ancienMontantRestant.toFixed(2),
          nouveauMontantRestant.toFixed(2),
        ].join(':'),
      )
      .digest('hex');

    return {
      stay,
      oldRoom,
      newRoom,
      nuitsImpactees,
      ancienMontantRestant,
      nouveauMontantRestant,
      difference,
      pricingFingerprint,
      capaciteInsuffisante,
      folios,
    };
  }

  // DESIGN-009B — mêmes contrôles de disponibilité que changeRoom
  // (chambre LIBRE_PROPRE, pas de conflit RoomNight sur la cible), en
  // lecture seule (jamais de FOR UPDATE ici — preview n'écrit rien, la
  // garantie finale reste le commit sous verrou).
  private async assertChangeRoomTargetAvailable(
    newRoomId: number,
    dateCheckoutPrevue: Date,
  ): Promise<void> {
    const hasBlockingTicket =
      await this.maintenanceService.hasActiveSalesBlocker(newRoomId);
    if (hasBlockingTicket) {
      throw new ConflictException(
        `La chambre ${newRoomId} est indisponible : une panne bloquant la vente est ouverte.`,
      );
    }
    const newRoom = await this.prisma.room.findUnique({
      where: { id: newRoomId },
    });
    if (!newRoom) {
      throw new NotFoundException(`Chambre ${newRoomId} introuvable.`);
    }
    if (newRoom.statut !== StatutChambre.LIBRE_PROPRE) {
      throw new ConflictException(
        `La chambre cible (${newRoomId}) n'est pas disponible (statut actuel : ${newRoom.statut}).`,
      );
    }
    const todayStart = await this.getCurrentBusinessDate();
    const conflict = await this.prisma.roomNight.findFirst({
      where: {
        roomId: newRoomId,
        date: { gte: todayStart, lte: dateCheckoutPrevue },
      },
    });
    if (conflict) {
      throw new ConflictException(
        `La chambre cible est réservée pendant la période du séjour.`,
      );
    }
  }

  private buildChangeRoomPreviewResponse(pricing: {
    oldRoom: { id: number; numero: string; roomType: { nom: string } };
    newRoom: { id: number; numero: string; roomType: { nom: string } };
    nuitsImpactees: Date[];
    ancienMontantRestant: Prisma.Decimal;
    nouveauMontantRestant: Prisma.Decimal;
    difference: Prisma.Decimal;
    pricingFingerprint: string;
  }) {
    const differenceStr = pricing.difference.isZero()
      ? '0.00'
      : pricing.difference.gt(0)
        ? `+${pricing.difference.toFixed(2)}`
        : pricing.difference.toFixed(2);

    return {
      oldRoom: {
        id: pricing.oldRoom.id,
        numero: pricing.oldRoom.numero,
        roomTypeNom: pricing.oldRoom.roomType.nom,
      },
      newRoom: {
        id: pricing.newRoom.id,
        numero: pricing.newRoom.numero,
        roomTypeNom: pricing.newRoom.roomType.nom,
      },
      nuitsImpactees: pricing.nuitsImpactees.map((d) =>
        d.toISOString().slice(0, 10),
      ),
      ancienMontantRestant: pricing.ancienMontantRestant.toFixed(2),
      nouveauMontantRestant: pricing.nouveauMontantRestant.toFixed(2),
      difference: differenceStr,
      pricingFingerprint: pricing.pricingFingerprint,
      warnings: [] as string[],
    };
  }

  // DESIGN-009B — POST /stays/:id/change-room/preview : lecture seule,
  // aucune écriture. Capacité insuffisante (BLOQUANT, jamais un simple
  // warning) : aucune preview tarifaire retournée, 409 structuré.
  async previewChangeRoom(stayId: number, newRoomId: number) {
    const pricing = await this.computeChangeRoomPricing(stayId, newRoomId);
    await this.assertChangeRoomTargetAvailable(
      newRoomId,
      pricing.stay.dateCheckoutPrevue,
    );

    if (pricing.capaciteInsuffisante) {
      throw new ConflictException({
        statusCode: 409,
        code: 'CHANGE_ROOM_CAPACITY_EXCEEDED',
        message: `La chambre cible (${newRoomId}) a une capacité insuffisante (${pricing.newRoom.roomType.capacite}) pour ${pricing.stay.nombreOccupants ?? 0} occupant(s).`,
      });
    }

    return this.buildChangeRoomPreviewResponse(pricing);
  }

  // GL-002 — changement de chambre pendant un séjour (transfert vers une
  // chambre disponible). Règles métier (docs/modules/stay.md §5) :
  // - Le séjour conserve son identité, folios/paiements/factures inchangés
  // - Les nuits passées (< today) restent sur l'ancienne chambre (lecture seule)
  // - Seules les nuits futures (>= today) sont transférées
  // - La cible doit être LIBRE_PROPRE et disponible sur la période
  // - Ancienne chambre → A_NETTOYER, nouvelle chambre → OCCUPEE, tâche
  //   housekeeping créée pour l'ancienne chambre — tout dans la même
  //   transaction que le transfert (aucun listener post-commit sur ce
  //   chemin : une tâche de ménage manquante après un changement de
  //   chambre serait un défaut opérationnel silencieux, contrairement au
  //   check-out où `checkout.effectue` reste acceptable — voir
  //   CheckoutEffectueListener).
  // - Motif obligatoire, audit complet, transaction atomique
  // - Permission dédiée : stay:change-room (Administrateur + Réception),
  //   exprimée directement par @RequirePermission (StayController) — pas
  //   de contenu de requête conditionnant la permission ici (contrairement
  //   à checkin:force-checkout/guests:blacklist), donc pas besoin du
  //   pattern de vérification dynamique. Le contrôle ci-dessous n'est
  //   qu'une défense en profondeur (même permission revérifiée), jamais la
  //   seule barrière.
  //
  // Écart assumé au graphe de dépendances (docs/DEPENDENCY_GRAPH.md, arête
  // pointillée M6 stay -.-> M9 housekeeping) : StayModule importe
  // désormais HousekeepingModule (via forwardRef, HousekeepingModule
  // important déjà StayModule pour ses propres façades de lecture — voir
  // HousekeepingTaskService.handleCheckoutEffectue) pour appeler
  // HousekeepingTaskService.createTask() dans CETTE transaction. Le
  // découplage événementiel reste la norme pour toute transition qui ne
  // requiert pas cette garantie (checkout notamment) ; ici la consigne est
  // explicite : pas de listener post-commit qui absorbe les erreurs, la
  // création de la tâche doit faire partie de l'atomicité de l'opération.
  async changeRoom(
    id: number,
    newRoomId: number,
    motif: string,
    pricingFingerprint: string,
    userId?: number,
    roleId?: number,
  ) {
    // Défense en profondeur — la garde réelle est @RequirePermission sur
    // la route (StayController). Hors transaction : lecture seule, aucun
    // verrou à tenir pour ça.
    const grant = await this.prisma.permission.findFirst({
      where: {
        module: 'stay',
        action: 'change-room',
        roles: { some: { roleId } },
      },
    });
    if (!grant) {
      throw new ForbiddenException('Permission requise : stay:change-room.');
    }

    const todayStart = await this.getCurrentBusinessDate();

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Verrou Stay — état frais, jamais l'objet lu avant la
      // transaction. Toutes les validations qui suivent se basent
      // exclusivement sur cette ligne verrouillée.
      const stayLocked = await tx.$queryRaw<
        Array<{
          id: number;
          roomId: number;
          statut: StatutSejour;
          dateCheckoutPrevue: Date;
        }>
      >`
        SELECT id, roomId, statut, dateCheckoutPrevue
        FROM Stay WHERE id = ${id} FOR UPDATE
      `;
      if (!stayLocked || stayLocked.length === 0) {
        throw new NotFoundException(`Séjour ${id} introuvable.`);
      }
      const lockedStay = stayLocked[0];

      if (lockedStay.statut !== StatutSejour.EN_COURS) {
        throw new ConflictException(
          `Ce séjour est déjà clôturé (statut actuel : ${lockedStay.statut}).`,
        );
      }
      if (newRoomId === lockedStay.roomId) {
        throw new ConflictException(
          `La chambre cible est identique à la chambre actuelle.`,
        );
      }
      const oldRoomId = lockedStay.roomId;

      // 2. Verrou des deux chambres, dans l'ordre croissant des ID —
      // séquentiel (jamais Promise.all, qui ne garantirait pas l'ordre
      // d'acquisition) — même chemin d'écriture/lecture verrouillée que
      // partout ailleurs (RoomsService.lockRoomForUpdate), jamais de
      // SELECT ... FOR UPDATE dupliqué ici.
      const [firstRoomId, secondRoomId] = [oldRoomId, newRoomId].sort(
        (a, b) => a - b,
      );
      const firstRoomLocked = await this.roomsService.lockRoomForUpdate(
        firstRoomId,
        tx,
      );
      const secondRoomLocked = await this.roomsService.lockRoomForUpdate(
        secondRoomId,
        tx,
      );
      const resolvedNewRoom =
        firstRoomLocked.id === newRoomId ? firstRoomLocked : secondRoomLocked;
      const resolvedOldRoom =
        firstRoomLocked.id === oldRoomId ? firstRoomLocked : secondRoomLocked;

      await this.maintenanceService.assertNoActiveSalesBlocker(newRoomId, tx);
      const oldRoomHasBlockingTicket =
        await this.maintenanceService.hasActiveSalesBlocker(oldRoomId, tx);

      // 3. Vérifier que la cible est LIBRE_PROPRE
      if (resolvedNewRoom.statut !== StatutChambre.LIBRE_PROPRE) {
        throw new ConflictException(
          `La chambre cible (${newRoomId}) n'est pas disponible (statut actuel : ${resolvedNewRoom.statut}).`,
        );
      }

      // 4. Verrouiller explicitement les RoomNight concernées :
      //    a) toutes les nuits du séjour (passées incluses, pour les
      //       préserver intégralement) ;
      //    b) toutes les nuits déjà posées sur la chambre cible pendant la
      //       période restante, quelle que soit leur origine (réservation
      //       OU séjour en cours — jamais de filtre reservationId != null,
      //       qui manquerait un conflit avec un séjour déjà en place créé
      //       sans réservation, ex. walk-in).
      const stayNights = await tx.$queryRaw<
        Array<{
          id: number;
          roomId: number;
          date: Date;
          stayId: number | null;
          reservationId: number | null;
        }>
      >`
        SELECT id, roomId, date, stayId, reservationId
        FROM RoomNight WHERE stayId = ${id} FOR UPDATE
      `;

      const targetNights = await tx.$queryRaw<
        Array<{
          id: number;
          roomId: number;
          date: Date;
          stayId: number | null;
          reservationId: number | null;
        }>
      >`
        SELECT id, roomId, date, stayId, reservationId
        FROM RoomNight
        WHERE roomId = ${newRoomId}
          AND date >= ${todayStart}
          AND date <= ${lockedStay.dateCheckoutPrevue}
        FOR UPDATE
      `;

      if (targetNights.length > 0) {
        throw new ConflictException(
          `La chambre cible est réservée pendant la période du séjour.`,
        );
      }

      // 4.5. DESIGN-009B — verrouiller Folio + FolioLine, AVANT toute
      // écriture de room/statut — protège aussi le recalcul de pricing
      // ci-dessous contre un paiement/une charge concurrente sur ce folio.
      // Même garantie que le précédent de computeExtensionPricing (Folio
      // FOR UPDATE bloque déjà toute NOUVELLE FolioLine via la vérification
      // FK au INSERT ; verrouiller aussi les FolioLine existantes ferme la
      // fenêtre côté annulation/remboursement d'un paiement déjà existant,
      // UPDATE FolioLine.annulee, qui ne déclenche pas de vérification FK),
      // mais verrouillage EN DEUX TEMPS (lecture des ID non verrouillée,
      // puis FOR UPDATE par égalité sur la clé primaire de FolioLine)
      // plutôt qu'un seul `WHERE folioId IN (...) FOR UPDATE` sur l'index
      // secondaire non-unique `folioId` : constaté en le testant (suite
      // "Idempotence : deux opérations distinctes" ci-dessous, deux séjours
      // strictement indépendants) — l'égalité sur un index secondaire non
      // unique sous REPEATABLE READ pose un verrou next-key (ligne + gap),
      // qui a produit un deadlock InnoDB réel et déterministe entre deux
      // transactions changeRoom concurrentes sur DEUX folios sans aucun
      // rapport entre eux, dès lors que leurs lignes étaient adjacentes
      // dans cet index. Verrouiller par égalité sur la clé primaire évite
      // ce verrou de gap tout en préservant la même garantie effective :
      // aucune NOUVELLE FolioLine ne peut apparaître entre la lecture des
      // ID et ce verrouillage (le FOR UPDATE sur Folio, acquis juste avant,
      // bloque déjà tout INSERT concurrent sur ce folio via la FK), et
      // toute ligne EXISTANTE reste verrouillée par ID exactement comme
      // avant. Écart documenté par rapport au précédent littéral de
      // computeExtensionPricing (non modifié ici, hors périmètre de ce
      // lot) — même risque latent non testé là-bas (ses seuls tests de
      // concurrence portent sur UN SEUL séjour à la fois, jamais deux
      // séjours indépendants), signalé dans le rapport final.
      const lockedFolioIds = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM Folio WHERE stayId = ${id} FOR UPDATE
      `;
      if (lockedFolioIds.length > 0) {
        const folioLineIds = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM FolioLine
          WHERE folioId IN (${Prisma.join(lockedFolioIds.map((f) => f.id))})
        `;
        if (folioLineIds.length > 0) {
          await tx.$queryRaw`
            SELECT id FROM FolioLine
            WHERE id IN (${Prisma.join(folioLineIds.map((l) => l.id))})
            FOR UPDATE
          `;
        }
      }

      // 4.6. Recalcul du pricing sous verrou, via le même moteur exact que
      // le preview — jamais une seconde implémentation.
      const pricing = await this.computeChangeRoomPricing(id, newRoomId, tx);

      // 4.7. Revalidation de la capacité SOUS VERROU (BLOQUANTE, jamais un
      // simple warning) : peut avoir changé entre le preview et ce commit
      // (nombreOccupants modifié entretemps) — rollback complet si
      // insuffisante.
      if (pricing.capaciteInsuffisante) {
        throw new ConflictException({
          statusCode: 409,
          code: 'CHANGE_ROOM_CAPACITY_EXCEEDED',
          message: `La chambre cible (${newRoomId}) a une capacité insuffisante (${pricing.newRoom.roomType.capacite}) pour ${pricing.stay.nombreOccupants ?? 0} occupant(s).`,
        });
      }

      // 4.8. Détection de dérive du preview : le fingerprint recalculé sous
      // verrou doit correspondre exactement à celui reçu du client — sinon
      // les conditions tarifaires ont changé depuis la confirmation
      // affichée, rollback complet, préview fraîche renvoyée pour
      // reconfirmation (jamais de renvoi automatique).
      if (pricing.pricingFingerprint !== pricingFingerprint) {
        throw new ConflictException({
          statusCode: 409,
          code: 'CHANGE_ROOM_PREVIEW_STALE',
          message:
            'Les conditions tarifaires ont changé depuis votre confirmation — relancez un aperçu (preview) puis confirmez de nouveau.',
          preview: this.buildChangeRoomPreviewResponse(pricing),
        });
      }

      // 4.9. Ligne d'ajustement tarifaire — une seule FolioLine si la
      // différence est non nulle, jamais si elle est nulle (même tarif ou
      // départ aujourd'hui, 0 nuit impactée). AJUSTEMENT_HAUSSE/BAISSE
      // stocke toujours la valeur absolue (contrainte CHECK DB, montant
      // jamais négatif) — le sens est porté par le type.
      let pricingAdjustment: {
        montant: string;
        sens: 'HAUSSE' | 'BAISSE';
        folioLineId: number;
      } | null = null;
      if (!pricing.difference.isZero()) {
        const folioPrincipal = pricing.folios[0];
        if (!folioPrincipal) {
          throw new NotFoundException(
            `Aucun folio trouvé pour le séjour ${id}.`,
          );
        }
        const isHausse = pricing.difference.gt(0);
        const montantAjustement = pricing.difference.abs();
        const ligneAjustement = await this.billingService.addFolioLine(
          folioPrincipal.id,
          {
            type: isHausse
              ? TypeLigneFolio.AJUSTEMENT_HAUSSE
              : TypeLigneFolio.AJUSTEMENT_BAISSE,
            libelle: `Ajustement tarifaire — changement de chambre ${resolvedOldRoom.numero} → ${resolvedNewRoom.numero} (${pricing.nuitsImpactees.length} nuit${pricing.nuitsImpactees.length > 1 ? 's' : ''})`,
            montant: montantAjustement.toFixed(2),
          },
          tx,
        );
        pricingAdjustment = {
          montant: montantAjustement.toFixed(2),
          sens: isHausse ? 'HAUSSE' : 'BAISSE',
          folioLineId: ligneAjustement.id,
        };
      }

      // 5. Transférer uniquement les nuits futures (>= aujourd'hui) —
      // les nuits passées restent, intégralement, sur l'ancienne chambre.
      const futureNights = stayNights.filter((n) => n.date >= todayStart);
      for (const night of futureNights) {
        await tx.roomNight.update({
          where: { id: night.id },
          data: { roomId: newRoomId },
        });
      }

      // 6. Mettre à jour Stay.roomId
      const updatedStay = await tx.stay.update({
        where: { id },
        data: { roomId: newRoomId },
        include: STAY_INCLUDE,
      });

      // 7. Statuts des deux chambres — même client transactionnel,
      // RoomsService.transitionRoom comme seul chemin d'écriture.
      await this.roomsService.transitionRoom(
        oldRoomId,
        oldRoomHasBlockingTicket
          ? StatutChambre.EN_MAINTENANCE
          : StatutChambre.A_NETTOYER,
        {
          expectedFrom: resolvedOldRoom.statut,
          motif: oldRoomHasBlockingTicket
            ? `Changement de chambre depuis séjour #${id} → ${newRoomId}; panne bloquant la vente toujours ouverte.`
            : `Changement de chambre depuis séjour #${id} → ${newRoomId}.`,
          userId,
          tx,
        },
      );
      await this.roomsService.transitionRoom(newRoomId, StatutChambre.OCCUPEE, {
        expectedFrom: resolvedNewRoom.statut,
        motif: `Changement de chambre depuis séjour #${id} (${oldRoomId} → ${newRoomId}).`,
        userId,
        tx,
      });

      // 8. Audit — écrit avant la tâche housekeeping pour disposer de son
      // ID (clé d'idempotence durable, voir étape 9). DESIGN-009B : payload
      // enrichi de l'impact tarifaire (tarif restant ancien/nouveau,
      // différence, nombre de nuits impactées, id de la FolioLine
      // d'ajustement le cas échéant).
      const auditEntry = await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CHANGE_ROOM,
        targetEntity: AuditEntity.Stay,
        targetId: id,
        oldValue: {
          roomId: oldRoomId,
          tarifRestantAncien: pricing.ancienMontantRestant.toFixed(2),
        },
        newValue: {
          roomId: newRoomId,
          tarifRestantNouveau: pricing.nouveauMontantRestant.toFixed(2),
          difference: pricing.difference.toFixed(2),
          nuitsImpactees: pricing.nuitsImpactees.length,
          folioLineId: pricingAdjustment?.folioLineId ?? null,
        },
        motif,
      });

      // 9. Tâche housekeeping pour l'ancienne chambre, dans la même
      // transaction — un échec ici fait échouer tout le changement de
      // chambre (rollback intégral), jamais un listener qui absorberait
      // l'erreur. Idempotence : clé durable liée à CETTE occurrence
      // (l'AuditLog créé à l'étape 8), pas seulement au trajet
      // stayId/oldRoomId/newRoomId — un rejeu de la même requête HTTP
      // retrouve la même tâche (même AuditLog, transaction déjà commitée
      // en amont) ; deux changements de chambre distincts sur le même
      // trajet créent chacun leur propre tâche. Résolution tardive
      // (ModuleRef, mode global) plutôt qu'injection de constructeur — voir
      // housekeeping-task-writer.token.ts pour la justification complète.
      const housekeepingTaskWriter = this.moduleRef.get<HousekeepingTaskWriter>(
        HOUSEKEEPING_TASK_WRITER,
        { strict: false },
      );
      await housekeepingTaskWriter.createTask(
        oldRoomId,
        OrigineTacheHousekeeping.CHANGE_ROOM,
        `room-change:${auditEntry.id}`,
        tx,
      );

      // DESIGN-009B — réponse enrichie de façon additive (jamais de
      // pricingAdjustment si la différence est nulle, contrat existant
      // inchangé pour tout appelant qui l'ignore).
      return pricingAdjustment
        ? { ...updatedStay, pricingAdjustment }
        : updatedStay;
    });

    return result;
  }

  // GL-003 — prolongation de séjour en cours (ajout de nuits sur la chambre
  // actuelle). Règles métier (voir instructions GL-003) :
  // - Stay.statut doit être EN_COURS (sinon 409)
  // - nouvelleDateCheckoutPrevue doit être strictement postérieure à
  //   l'ancienne dateCheckoutPrevue verrouillée (jamais l'objet lu avant la
  //   transaction — même précédent que changeRoom ci-dessus)
  // - Seules les nuits du delta sont créées (RoomNight) ; les nuits/lignes
  //   de folio historiques restent strictement inchangées
  // - Stop Sale (RateRestriction) n'est jamais consulté ici — une
  //   prolongation n'est jamais bloquée par une restriction tarifaire
  // - Stay.formule est conservée telle quelle (pas de nouveau choix de
  //   formule à la prolongation)
  // - Aucune tâche/évènement Housekeeping, Room.statut jamais modifié pour
  //   la chambre actuelle (elle reste OCCUPEE du début à la fin)
  // - Si HotelConfig.paiementImmediatProlongationObligatoire est actif, le
  //   crédit disponible du folio (paiements non annulés − charges non
  //   annulées hors PAIEMENT, jamais négatif) doit déjà couvrir le
  //   supplément calculé — sinon 409 PAYMENT_REQUIRED, rien n'est committé.
  // - extendStay lui-même n'utilise jamais PaymentsService/la table Payment :
  //   toute lecture financière passe par les FolioLine déjà chargées ici
  //   (computeSoldeDu). GL-003B ajoute StayModule -> PaymentsModule pour un
  //   AUTRE point d'entrée (createExtensionDeposit, ci-dessous) — extendStay
  //   n'en dépend pas et son comportement reste inchangé.
  async extendStay(
    id: number,
    nouvelleDateCheckoutPrevueRaw: string,
    motif: string,
    userId?: number,
    roleId?: number,
  ) {
    // 1. Défense en profondeur — la garde réelle est @RequirePermission sur
    // la route (StayController), même précédent que changeRoom ci-dessus.
    const grant = await this.prisma.permission.findFirst({
      where: {
        module: 'stay',
        action: 'extend',
        roles: { some: { roleId } },
      },
    });
    if (!grant) {
      throw new ForbiddenException('Permission requise : stay:extend.');
    }

    // Drapeau de configuration lu hors transaction — même convention que
    // les autres appels ParametersService sans tx (ex. generateInvoicePdf) :
    // pas de verrou dédié pour un simple paramètre rarement modifié en
    // pleine concurrence avec une prolongation.
    const hotelConfig = await this.parametersService.getHotelConfig();

    const result = await this.runExtendStayTransaction(
      id,
      nouvelleDateCheckoutPrevueRaw,
      motif,
      hotelConfig,
      userId,
    );
    return result;
  }

  // GL-003B — avance de prolongation bornée côté serveur
  // (POST /stays/:id/extension-deposit). Introduite pour remplacer le flux
  // historique où la réception encaissait volontairement plus que le solde
  // courant via POST /payments brut pour préfinancer une prolongation — ce
  // flux entrait directement en conflit avec la garde OVERPAYMENT de
  // PAY-001B (PaymentsService.createPayment). Décision arbitrée : ne jamais
  // assouplir POST /payments, introduire à la place ce point d'entrée dédié
  // où le serveur calcule seul le montant exact à encaisser (jamais le
  // client — ExtensionDepositDto n'a pas de champ `montant`).
  //
  // RBAC : @RequirePermission('stay', 'extend') reste la barrière statique
  // sur la route (StayController), mais cette action crée un vrai
  // encaissement — exige EN PLUS, ici, une vérification dynamique de
  // payments:write (même pattern que guests:blacklist/checkin:force-checkout
  // /payments:refund : exigibilité combinée non exprimable par le seul
  // décorateur statique). Aucune nouvelle permission créée.
  async createExtensionDeposit(
    id: number,
    dto: ExtensionDepositDto,
    userId?: number,
    roleId?: number,
  ) {
    const grant = await this.prisma.permission.findFirst({
      where: {
        module: 'payments',
        action: 'write',
        roles: { some: { roleId } },
      },
    });
    if (!grant) {
      throw new ForbiddenException('Permission requise : payments:write.');
    }

    // Idempotence traitée en premier, avant tout verrou — même convention
    // que PaymentsService.createPayment (pré-check hors transaction, filet
    // P2002 en cas de course résiduelle ci-dessous).
    const existingByKey = await this.prisma.payment.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existingByKey) {
      return {
        payment: existingByKey,
        montantEncaisse: existingByKey.montant.toFixed(2),
      };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Même verrouillage (Stay/Room/RoomNight/Folio/FolioLine) et même
        // formule de tarification que runExtendStayTransaction — protège
        // aussi contre deux avances concurrentes sur le même séjour, même
        // avec des idempotencyKey différentes (le verrou sur Folio/FolioLine
        // sérialise les deux transactions).
        const pricing = await this.computeExtensionPricing(
          id,
          dto.nouvelleDateCheckoutPrevue,
          tx,
        );
        const balanceActuelle = computeSoldeDu(pricing.folios);
        const montantAEncaisser = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          balanceActuelle.add(pricing.montantSupplement),
        );

        if (montantAEncaisser.lte(0)) {
          // Crédit déjà suffisant — aucune écriture financière (voir mission
          // GL-003B point 3).
          return {
            payment: null,
            montantEncaisse: '0.00',
            message:
              'Crédit déjà suffisant pour couvrir le supplément de cette prolongation — aucun encaissement nécessaire.',
          };
        }

        const folioPrincipal = pricing.folios[0];
        if (!folioPrincipal) {
          throw new NotFoundException(
            `Aucun folio trouvé pour le séjour ${id}.`,
          );
        }

        const payment = await this.paymentsService.createExtensionDeposit(
          folioPrincipal.id,
          dto.moyen,
          montantAEncaisser,
          dto.idempotencyKey,
          dto.reference,
          tx,
        );

        return { payment, montantEncaisse: montantAEncaisser.toFixed(2) };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Filet de sécurité — même raisonnement que
        // PaymentsService.createPayment : la transaction perdante est
        // annulée avant toute écriture, on retourne le paiement déjà créé
        // par la gagnante.
        const existing = await this.prisma.payment.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (!existing) {
          throw error;
        }
        return {
          payment: existing,
          montantEncaisse: existing.montant.toFixed(2),
        };
      }
      if (error instanceof CompositionTarifaireImpossibleError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  // FIN-102 — extrait de extendStay() pour pouvoir traduire proprement
  // CompositionTarifaireImpossibleError (levée depuis l'intérieur de la
  // transaction) en ConflictException, même précédent que
  // checkinFromReservation/checkinWalkIn ci-dessus.
  // GL-003B — steps 2-7 de runExtendStayTransaction, extraits en méthode
  // privée partagée : une seule formule de tarification/verrouillage de
  // prolongation, appelée à la fois par extendStay (via
  // runExtendStayTransaction) ET par createExtensionDeposit (nouvel
  // endpoint POST /stays/:id/extension-deposit, avance bornée) — jamais
  // recopiée. `tx` est obligatoire : l'appelant possède déjà sa propre
  // transaction (les verrous FOR UPDATE posés ici doivent vivre dans cette
  // même transaction pour protéger le calcul contre une course
  // concurrente). Ne fait strictement AUCUNE écriture (aucun createMany
  // RoomNight, aucun stay.update, aucune FolioLine) — uniquement des
  // lectures verrouillées et un calcul, comme avant l'extraction.
  private async computeExtensionPricing(
    id: number,
    nouvelleDateCheckoutPrevueRaw: string,
    tx: Prisma.TransactionClient,
  ) {
    // 2. Verrou Stay — état frais, jamais l'objet lu avant la transaction.
    // Toutes les validations qui suivent se basent exclusivement sur
    // cette ligne verrouillée.
    const stayLocked = await tx.$queryRaw<
      Array<{
        id: number;
        roomId: number;
        statut: StatutSejour;
        dateCheckoutPrevue: Date;
        formule: FormuleHebergement;
        nombreOccupants: number | null;
      }>
    >`
        SELECT id, roomId, statut, dateCheckoutPrevue, formule, nombreOccupants
        FROM Stay WHERE id = ${id} FOR UPDATE
      `;
    if (!stayLocked || stayLocked.length === 0) {
      throw new NotFoundException(`Séjour ${id} introuvable.`);
    }
    const lockedStay = stayLocked[0];

    if (lockedStay.statut !== StatutSejour.EN_COURS) {
      throw new ConflictException(
        `Ce séjour est déjà clôturé (statut actuel : ${lockedStay.statut}).`,
      );
    }

    const ancienneDate = lockedStay.dateCheckoutPrevue;
    const nouvelleDate = new Date(nouvelleDateCheckoutPrevueRaw);
    if (nouvelleDate <= ancienneDate) {
      throw new BadRequestException(
        'La nouvelle date de départ doit être strictement postérieure à la date de départ prévue actuelle.',
      );
    }

    // 3. Verrou de la chambre actuelle — même chemin d'écriture/lecture
    // verrouillée que partout ailleurs (RoomsService.lockRoomForUpdate).
    const lockedRoom = await this.roomsService.lockRoomForUpdate(
      lockedStay.roomId,
      tx,
    );

    // 4. Verrouiller explicitement les RoomNight du delta demandé sur la
    // chambre actuelle — détecter tout conflit, quelle que soit l'origine
    // (réservation OU séjour en cours, jamais de filtre reservationId !=
    // null, même correction que GL-002).
    const nights = getNightsBetween(ancienneDate, nouvelleDate);
    const conflictingNights = nights.length
      ? await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM RoomNight
            WHERE roomId = ${lockedStay.roomId}
              AND date IN (${Prisma.join(nights)})
            FOR UPDATE
          `
      : [];

    // 5. Verrouiller le Folio et ses FolioLine existantes AVANT de calculer le
    // crédit disponible — même verrou explicite que Stay/Room/RoomNight
    // ci-dessus. Le verrou sur Folio suffit à sérialiser avec un paiement
    // concurrent (POST /payments insère une nouvelle FolioLine référençant ce
    // Folio par FK — InnoDB prend un verrou partagé implicite sur la ligne
    // parente Folio lors de ce INSERT pour la vérification de contrainte,
    // donc bloque tant que ce FOR UPDATE tient la transaction). Verrouiller
    // aussi les FolioLine existantes ferme la fenêtre côté annulation/
    // remboursement d'un paiement déjà existant (UPDATE FolioLine.annulee),
    // qui ne déclenche pas de vérification FK et ne serait donc pas
    // bloqué par le seul verrou sur Folio. Ce même verrou protège aussi
    // createExtensionDeposit (GL-003B) contre deux avances concurrentes sur
    // le même séjour, y compris avec des idempotencyKey différentes.
    const lockedFolioIds = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM Folio WHERE stayId = ${id} FOR UPDATE
      `;
    if (lockedFolioIds.length > 0) {
      await tx.$queryRaw`
          SELECT id FROM FolioLine
          WHERE folioId IN (${Prisma.join(lockedFolioIds.map((f) => f.id))})
          FOR UPDATE
        `;
    }
    // Lecture fraîche du folio/de ses lignes, dans la même transaction
    // (nécessaire au calcul du crédit disponible à l'étape 8, mais aussi
    // au folio principal ciblé par addFolioLine à l'étape 11).
    const folios = await tx.folio.findMany({
      where: { stayId: id },
      include: { lignes: true },
    });

    // 6. Indisponibilité de la chambre actuelle : maintenance en cours
    // (motif d'indisponibilité explicitement demandé par GL-003, la
    // maintenance planifiée future restant hors périmètre) OU conflit
    // détecté sur une nuit du delta. Aucun changement de chambre n'est
    // jamais effectué automatiquement ici — recherche d'alternatives
    // purement informative pour le réceptionniste.
    const hasBlockingTicket =
      await this.maintenanceService.hasActiveSalesBlocker(
        lockedStay.roomId,
        tx,
      );
    const chambreIndisponible =
      lockedRoom.statut === StatutChambre.EN_MAINTENANCE ||
      hasBlockingTicket ||
      conflictingNights.length > 0;
    if (chambreIndisponible) {
      const [candidateAlternatives, blockingRoomIds] = await Promise.all([
        this.roomsService.findCompatibleAvailableRooms(
          lockedRoom.roomTypeId,
          nights,
          lockedRoom.id,
          tx,
        ),
        this.maintenanceService.findActiveBlockingRoomIds(tx),
      ]);
      const blockedIds = new Set(blockingRoomIds);
      const alternatives = candidateAlternatives.filter(
        (room) => !blockedIds.has(room.id),
      );
      throw new ConflictException({
        code: 'ROOM_UNAVAILABLE',
        message: `La chambre actuelle (${lockedRoom.id}) n'est pas disponible pour la période de prolongation demandée.`,
        alternatives,
      });
    }

    // 7. Tarification nuit par nuit selon la grille saisonnière — jamais
    // de lecture directe de SeasonRate (ParametersService en façade).
    // FIN-102 — le tarif public TTC du delta (tarifPublicTTCDelta =
    // hébergement brut + formule brute, aucune valeur tierce stockée pour
    // une prolongation) est décomposé par la même fonction canonique
    // unique que checkinFromReservation/checkinWalkIn : HEBERGEMENT
    // résiduel + EXTRA formule incluse + TAXE_SEJOUR, dont la somme
    // reproduit exactement tarifPublicTTCDelta — jamais une addition
    // par-dessus (BUG confirmé, mission FIN-102). occupantsPourFormule
    // reste roomType.capacite pour un séjour legacy
    // (Stay.nombreOccupants IS NULL — comportement historique inchangé,
    // aucune recomposition rétroactive) ; pour un séjour non-legacy,
    // l'occupation réelle du séjour est réutilisée telle quelle (jamais
    // recapturée à la prolongation). TAXE_SEJOUR n'est matérialisée ici
    // (taxesStatutaires non vide) que pour un séjour non-legacy — un
    // séjour legacy reste sur le seul fallback de facturation historique
    // (BillingService.generateInvoice), jamais une matérialisation
    // partielle qui romprait l'idempotence de ce fallback.
    const roomType = await tx.roomType.findUniqueOrThrow({
      where: { id: lockedRoom.roomTypeId },
    });
    const seasonRates = await this.parametersService.getSeasonRatesForRoomType(
      roomType.id,
      tx,
    );
    const occupantsPourFormule =
      lockedStay.nombreOccupants ?? roomType.capacite;
    const hebergementBrutDelta = calculateNightlyTotal(
      nights,
      roomType.prixBase,
      seasonRates,
    );
    // Règle métier validée (ADR-008 §4.5) : BED_AND_BREAKFAST n'ajoute
    // plus rien (petit-déjeuner déjà inclus dans roomType.prixBase) —
    // HALF_BOARD/FULL_BOARD restent additifs, comportement historique
    // inchangé (voir reservations/utils/pricing.ts::
    // calculateFormuleSupplement).
    const formuleBrutDelta = calculateFormuleSupplement(
      lockedStay.formule,
      roomType,
      nights.length,
      occupantsPourFormule,
    );
    const montantSupplement = hebergementBrutDelta.add(formuleBrutDelta);

    const taxesStatutairesDelta =
      lockedStay.nombreOccupants !== null
        ? await this.getTaxesStatutaires(tx)
        : [];
    const decompositionDelta = decomposerTarifPublicTTC({
      tarifPublicTTC: montantSupplement,
      nuits: nights.length,
      occupants: occupantsPourFormule,
      formule: lockedStay.formule,
      roomType,
      taxesApplicables: taxesStatutairesDelta,
    });
    const montantHebergement = decompositionDelta.hebergement;
    const montantFormule = decompositionDelta.formuleIncluse;

    return {
      lockedStay,
      lockedRoom,
      roomType,
      nights,
      ancienneDate,
      nouvelleDate,
      folios,
      montantSupplement,
      decompositionDelta,
      montantHebergement,
      montantFormule,
      taxesStatutairesDelta,
    };
  }

  // FIN-102 — extrait de extendStay() pour pouvoir traduire proprement
  // CompositionTarifaireImpossibleError (levée depuis l'intérieur de la
  // transaction) en ConflictException, même précédent que
  // checkinFromReservation/checkinWalkIn ci-dessus.
  private async runExtendStayTransaction(
    id: number,
    nouvelleDateCheckoutPrevueRaw: string,
    motif: string,
    hotelConfig: { paiementImmediatProlongationObligatoire: boolean },
    userId?: number,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const pricing = await this.computeExtensionPricing(
          id,
          nouvelleDateCheckoutPrevueRaw,
          tx,
        );
        const {
          lockedStay,
          nights,
          ancienneDate,
          nouvelleDate,
          folios,
          montantSupplement,
          decompositionDelta,
          montantHebergement,
          montantFormule,
        } = pricing;

        // 8. Paiement immédiat obligatoire (HotelConfig) : crédit disponible
        // = max(0, paiements non annulés − charges non annulées hors
        // PAIEMENT) — l'opposé de computeSoldeDu quand celui-ci est négatif,
        // jamais un nouveau calcul indépendant (CLAUDE.md règle 3).
        if (hotelConfig.paiementImmediatProlongationObligatoire) {
          const soldeDu = computeSoldeDu(folios);
          const creditDisponible = soldeDu.isNegative()
            ? soldeDu.neg()
            : new Prisma.Decimal(0);
          if (creditDisponible.lt(montantSupplement)) {
            throw new ConflictException({
              code: 'PAYMENT_REQUIRED',
              message:
                'Crédit disponible insuffisant pour couvrir le supplément de cette prolongation — enregistrer un paiement puis relancer la prolongation.',
              amountRequired: montantSupplement.toFixed(2),
              availableCredit: creditDisponible.toFixed(2),
            });
          }
        }

        // 9. Créer uniquement les RoomNight du delta — les nuits historiques
        // ne sont jamais recréées/modifiées.
        await tx.roomNight.createMany({
          data: nights.map((date) => ({
            roomId: lockedStay.roomId,
            date,
            stayId: id,
          })),
        });

        // 10. Mettre à jour Stay.dateCheckoutPrevue.
        await tx.stay.update({
          where: { id },
          data: { dateCheckoutPrevue: nouvelleDate },
        });

        // 11. FolioLine HEBERGEMENT (+ EXTRA formule si applicable) sur le
        // folio principal, via BillingService.addFolioLine — jamais d'écriture
        // FolioLine directe ici (chemin d'écriture canonique unique, même
        // précédent que RestaurantService.addCharge). Les lignes historiques
        // ne sont jamais touchées.
        const folioPrincipal = folios[0];
        if (!folioPrincipal) {
          throw new NotFoundException(
            `Aucun folio trouvé pour le séjour ${id}.`,
          );
        }
        // DESIGN-010 (audit facture figée) — la ligne TAXE_SEJOUR du delta
        // (étape suivante) est écrite directement via tx.folioLine.create,
        // en dehors de BillingService.addFolioLine (qui n'accepte pas
        // taxRateConfigId) : elle échapperait donc à la garde "facture
        // émise" qu'addFolioLine applique déjà aux lignes HEBERGEMENT/EXTRA
        // ci-dessous. Vérifiée ici, une seule fois, avant toute écriture de
        // cette étape — même message/sémantique que
        // BillingService.addFolioLine.
        const invoicesActives = await tx.invoice.findMany({
          where: { folioId: folioPrincipal.id },
        });
        if (invoicesActives.some((i) => i.statut === 'EMISE')) {
          throw new ConflictException(
            `Une facture active existe déjà pour le folio ${folioPrincipal.id} — impossible de prolonger un séjour dont la facture est déjà émise. Génère un avoir avant de prolonger.`,
          );
        }
        await this.billingService.addFolioLine(
          folioPrincipal.id,
          {
            type: TypeLigneFolio.HEBERGEMENT,
            libelle: `Prolongation — ${nights.length} nuit${nights.length > 1 ? 's' : ''}`,
            montant: montantHebergement.toFixed(2),
          },
          tx,
        );
        if (
          lockedStay.formule !== FormuleHebergement.ROOM_ONLY &&
          montantFormule.gt(0)
        ) {
          await this.billingService.addFolioLine(
            folioPrincipal.id,
            {
              type: TypeLigneFolio.EXTRA,
              libelle: `Prolongation — formule ${FORMULE_LABEL[lockedStay.formule]} — ${nights.length} nuit${nights.length > 1 ? 's' : ''}`,
              montant: montantFormule.toFixed(2),
            },
            tx,
          );
        }
        // FIN-102 — TAXE_SEJOUR du delta, matérialisée ici même (jamais à la
        // facturation pour un séjour non-legacy) via écriture directe
        // (BillingService.addFolioLine n'accepte pas taxRateConfigId, requis
        // pour la réconciliation append-only au départ anticipé ci-dessous) —
        // même précédent que StayService.createFolioPrincipal, qui écrit déjà
        // TAXE_SEJOUR directement plutôt que via la façade billing. Vide
        // (taxesStatutairesDelta = []) pour un séjour legacy, voir commentaire
        // de l'étape 7.
        for (const taxe of decompositionDelta.taxesStatutaires) {
          if (taxe.montant.lte(0)) continue;
          await tx.folioLine.create({
            data: {
              folioId: folioPrincipal.id,
              type: TypeLigneFolio.TAXE_SEJOUR,
              libelle: `${taxe.type} — prolongation ${nights.length} nuit${nights.length > 1 ? 's' : ''}`,
              montant: taxe.montant,
              tauxTva: new Prisma.Decimal(0),
              taxRateConfigId: taxe.taxRateConfigId,
            },
          });
        }

        // 12. Audit — dans la même transaction que toutes les écritures
        // ci-dessus (ADR-005).
        await this.auditService.writeLog(tx, {
          userId,
          action: AuditAction.EXTEND_STAY,
          targetEntity: AuditEntity.Stay,
          targetId: id,
          oldValue: { dateCheckoutPrevue: ancienneDate.toISOString() },
          newValue: { dateCheckoutPrevue: nouvelleDate.toISOString() },
          motif,
        });

        return tx.stay.findUniqueOrThrow({
          where: { id },
          include: STAY_INCLUDE,
        });
      });
    } catch (error) {
      if (error instanceof CompositionTarifaireImpossibleError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  private translateConflict(error: unknown, message: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      // P2002 : violation de la contrainte unique (roomId, date) ou
      // Stay.reservationId. P2034 : MySQL détecte parfois la même course
      // entre deux transactions concurrentes comme un conflit d'écriture
      // plutôt qu'une violation de contrainte directe (timing des verrous
      // InnoDB) — le résultat métier est identique : l'un des deux postes a
      // perdu la course, donc 409 dans les deux cas.
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return new ConflictException(message);
    }
    return error;
  }
}
