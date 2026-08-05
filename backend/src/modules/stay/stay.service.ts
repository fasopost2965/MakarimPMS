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
  calculateFormuleTotal,
  calculateNightlyTotal,
} from '../reservations/utils/pricing';
import { RoomsService } from '../rooms/rooms.service';
import { GuestsService } from '../guests/guests.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
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
import { ForceCheckoutDto } from './dto/force-checkout.dto';
import { computeSoldeDu } from './utils/solde';
import { CheckoutEffectueEvent } from './events/checkout-effectue.event';

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
  ) {}

  // Transformation réservation → séjour (CLAUDE.md règle 1 : le séjour
  // devient l'objet central). Les nuits sont déjà verrouillées depuis la
  // création de la réservation (RoomNight) : on les rattache au séjour au
  // lieu d'en recréer, la contrainte unique (roomId, date) reste la même
  // ligne physique.
  async checkinFromReservation(reservationId: number, userId?: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
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

        const stay = await tx.stay.create({
          data: {
            reservationId: reservation.id,
            roomId: reservation.roomId,
            guestId: reservation.guestId,
            dateCheckin: new Date(),
            dateCheckoutPrevue: reservation.dateDepart,
            formule: reservation.formule,
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
          { motif: 'Check-in depuis réservation', userId, tx },
        );

        const nights = getNightsBetween(
          reservation.dateArrivee,
          reservation.dateDepart,
        );
        // La ligne HEBERGEMENT reprend toujours prixTotalFinal tel quel —
        // jamais un recalcul indépendant (CLAUDE.md règle 3, voir aussi
        // reservations.service.ts). Priorité 3 : si une formule ≠ ROOM_ONLY
        // s'applique, prixTotalFinal (déjà calculé formule incluse, voir
        // ReservationsService.calculatePrixTotal) est éclaté en deux lignes
        // (HEBERGEMENT + EXTRA repas) pour la ventilation TVA — la SOMME
        // reste rigoureusement égale à prixTotalFinal, jamais un recalcul
        // indépendant du montant facturé. Si un ajustement manuel a ramené
        // prixTotalFinal sous le coût de la formule seule, on renonce à
        // l'éclatement (une ligne HEBERGEMENT unique, comportement
        // identique à avant Priorité 3) plutôt que produire un montant
        // négatif.
        const room = await this.roomsService.findByIdWithPricing(
          reservation.roomId,
          tx,
        );
        const formuleTotalBrut = calculateFormuleTotal(
          reservation.formule,
          room.roomType,
          nights.length,
          room.roomType.capacite,
        );
        const peutEclater =
          reservation.formule !== FormuleHebergement.ROOM_ONLY &&
          formuleTotalBrut.gt(0) &&
          formuleTotalBrut.lte(reservation.prixTotalFinal);
        const montantFormule = peutEclater
          ? formuleTotalBrut
          : new Prisma.Decimal(0);
        const montantHebergement = peutEclater
          ? reservation.prixTotalFinal.sub(montantFormule)
          : reservation.prixTotalFinal;

        const folio = await this.createFolioPrincipal(
          tx,
          stay.id,
          montantHebergement,
          nights.length,
          reservation.formule,
          montantFormule,
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
        const room = await this.roomsService.findByIdWithPricing(
          dto.roomId,
          tx,
        );

        const guest = dto.guestId
          ? await this.guestsService.assertNotBlacklisted(dto.guestId, tx)
          : await tx.guest.create({ data: dto.guest! });

        const formule = dto.formule ?? FormuleHebergement.BED_AND_BREAKFAST;

        const stay = await tx.stay.create({
          data: {
            roomId: room.id,
            guestId: guest.id,
            dateCheckin,
            dateCheckoutPrevue: new Date(dto.dateCheckoutPrevue),
            formule,
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
          motif: 'Check-in walk-in',
          userId,
          tx,
        });

        const montant = calculateNightlyTotal(
          nights,
          room.roomType.prixBase,
          room.roomType.seasonRates,
        );
        const montantFormule = calculateFormuleTotal(
          formule,
          room.roomType,
          nights.length,
          room.roomType.capacite,
        );
        await this.createFolioPrincipal(
          tx,
          stay.id,
          montant,
          nights.length,
          formule,
          montantFormule,
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
      throw this.translateConflict(
        error,
        'Chambre déjà occupée par un autre séjour sur cette période.',
      );
    }
  }

  // Priorité 3 (formules d'hébergement) : formule/montantFormule créent une
  // seconde FolioLine EXTRA distincte de HEBERGEMENT — nécessaire pour la
  // bonne ventilation TVA (hébergement et restauration ont des taux
  // différents, docs/modules/parameters.md — TVA_HEBERGEMENT vs
  // TVA_ANNEXE), jamais ajoutée pour ROOM_ONLY ni un montant à 0.
  private async createFolioPrincipal(
    tx: Prisma.TransactionClient,
    stayId: number,
    montantHebergement: Prisma.Decimal,
    nights: number,
    formule: FormuleHebergement,
    montantFormule: Prisma.Decimal,
  ) {
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

    const updated = await this.prisma.$transaction(async (tx) => {
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

      await tx.roomNight.deleteMany({ where: { stayId: id } });

      return tx.stay.update({
        where: { id },
        data: {
          statut: StatutSejour.CHECKOUT,
          dateCheckoutReelle: new Date(),
        },
        include: STAY_INCLUDE,
      });
    });

    await this.eventEmitter.emitAsync(
      'checkout.effectue',
      new CheckoutEffectueEvent(stay.roomId, stay.id, userId),
    );

    return { ...updated, soldeDu: soldeDu.toFixed(2) };
  }

  // Façade en lecture seule pour housekeeping (rattrapage quotidien du
  // statut DEPART_PREVU) — housekeeping ne lit jamais la table Stay
  // directement.
  async findActiveStayForRoom(roomId: number) {
    return this.prisma.stay.findFirst({
      where: { roomId, statut: StatutSejour.EN_COURS },
    });
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

    const { today: todayStart } = getTodayRange();

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
        StatutChambre.A_NETTOYER,
        {
          motif: `Changement de chambre depuis séjour #${id} → ${newRoomId}.`,
          userId,
          tx,
        },
      );
      await this.roomsService.transitionRoom(newRoomId, StatutChambre.OCCUPEE, {
        motif: `Changement de chambre depuis séjour #${id} (${oldRoomId} → ${newRoomId}).`,
        userId,
        tx,
      });

      // 8. Audit — écrit avant la tâche housekeeping pour disposer de son
      // ID (clé d'idempotence durable, voir étape 9).
      const auditEntry = await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CHANGE_ROOM,
        targetEntity: AuditEntity.Stay,
        targetId: id,
        oldValue: { roomId: oldRoomId },
        newValue: { roomId: newRoomId },
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

      return updatedStay;
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
  // - Aucune dépendance vers PaymentsModule dans un sens ou dans l'autre :
  //   toute lecture financière passe par les FolioLine déjà chargées ici
  //   (computeSoldeDu), jamais par PaymentsService/la table Payment.
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

    const result = await this.prisma.$transaction(async (tx) => {
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
        }>
      >`
        SELECT id, roomId, statut, dateCheckoutPrevue, formule
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
      // bloqué par le seul verrou sur Folio.
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
      const chambreIndisponible =
        lockedRoom.statut === StatutChambre.EN_MAINTENANCE ||
        conflictingNights.length > 0;
      if (chambreIndisponible) {
        const alternatives =
          await this.roomsService.findCompatibleAvailableRooms(
            lockedRoom.roomTypeId,
            nights,
            lockedRoom.id,
            tx,
          );
        throw new ConflictException({
          code: 'ROOM_UNAVAILABLE',
          message: `La chambre actuelle (${lockedRoom.id}) n'est pas disponible pour la période de prolongation demandée.`,
          alternatives,
        });
      }

      // 7. Tarification nuit par nuit selon la grille saisonnière — jamais
      // de lecture directe de SeasonRate (ParametersService en façade).
      const roomType = await tx.roomType.findUniqueOrThrow({
        where: { id: lockedRoom.roomTypeId },
      });
      const seasonRates =
        await this.parametersService.getSeasonRatesForRoomType(roomType.id, tx);
      const montantHebergement = calculateNightlyTotal(
        nights,
        roomType.prixBase,
        seasonRates,
      );
      const montantFormule =
        lockedStay.formule !== FormuleHebergement.ROOM_ONLY
          ? calculateFormuleTotal(
              lockedStay.formule,
              roomType,
              nights.length,
              roomType.capacite,
            )
          : new Prisma.Decimal(0);
      const montantSupplement = montantHebergement.add(montantFormule);

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
        throw new NotFoundException(`Aucun folio trouvé pour le séjour ${id}.`);
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

    return result;
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
