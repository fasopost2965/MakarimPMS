import {
  ConflictException,
  Injectable,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { BusinessDaySource, BusinessDayStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ParametersService } from '../parameters/parameters.service';
import { resolveLocalDate } from './utils/business-date.util';

// Marqueur constant (jamais l'id de la ligne) : une seule BusinessDay peut
// porter openLock=OPEN_LOCK_MARKER à la fois (contrainte unique MySQL),
// remis à null dès qu'elle quitte le statut OPEN. Voir schema.prisma pour
// le détail du pattern (même principe que HousekeepingTask.activeRoomKey).
const OPEN_LOCK_MARKER = 1;

// ARCH-011A — façade canonique UNIQUE pour la Business Date courante.
// Aucun autre module ne doit lire/écrire BusinessDay directement (même
// convention que ParametersService pour HotelConfig/SeasonRate/…) : le
// futur code qui a besoin de "la date d'exploitation courante" doit
// toujours passer par ce service, jamais par une nouvelle lecture Prisma
// locale ni par `new Date()` seul (qui refléterait le fuseau du serveur,
// jamais celui de l'hôtel — voir utils/business-date.util.ts).
@Injectable()
export class BusinessDateService implements OnModuleInit {
  private readonly logger = new Logger(BusinessDateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parametersService: ParametersService,
  ) {}

  // Exécuté une fois au démarrage de l'application (cycle de vie Nest) —
  // idempotent par construction (voir bootstrapIfMissing ci-dessous), donc
  // sans risque même si plusieurs instances backend démarrent en même
  // temps derrière un load balancer.
  async onModuleInit() {
    await this.bootstrapIfMissing();
  }

  private async resolveHotelTimezone(): Promise<string> {
    const config = await this.parametersService.getHotelConfig();
    return config.timezone;
  }

  // Si aucune BusinessDay n'existe encore en base (tout premier démarrage
  // de l'application), en crée une avec date = date locale hôtel courante,
  // status OPEN, source SYSTEM_BOOTSTRAP. Idempotent — la protection contre
  // le doublon en cas de démarrage concurrent de plusieurs instances
  // backend repose sur la contrainte DB unique `BusinessDay.date` ET
  // `BusinessDay.openLock` (jamais un mutex applicatif) : si deux instances
  // tentent toutes deux l'insertion, une seule réussit, l'autre reçoit une
  // violation de contrainte (P2002) qu'on avale silencieusement (l'état
  // souhaité — une BusinessDay existe — est de toute façon atteint).
  async bootstrapIfMissing(): Promise<void> {
    const existing = await this.prisma.businessDay.findFirst();
    if (existing) {
      return;
    }

    const timezone = await this.resolveHotelTimezone();
    const date = resolveLocalDate(timezone);

    try {
      await this.prisma.businessDay.create({
        data: {
          date,
          status: BusinessDayStatus.OPEN,
          openLock: OPEN_LOCK_MARKER,
          openedAt: new Date(),
          source: BusinessDaySource.SYSTEM_BOOTSTRAP,
        },
      });
      this.logger.log(
        `BusinessDay bootstrap : ${date.toISOString().slice(0, 10)} (OPEN).`,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Une autre instance a déjà bootstrapé concurremment — idempotent,
        // l'état voulu (une BusinessDay OPEN existe) est déjà atteint.
        return;
      }
      throw error;
    }
  }

  // Lecture simple, sans verrou — pour l'affichage courant
  // (GET /night-audit/current) et toute lecture non transactionnelle.
  async getCurrentBusinessDay(tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    const current = await client.businessDay.findFirst({
      where: { status: BusinessDayStatus.OPEN },
    });
    if (!current) {
      // Ne devrait jamais arriver après bootstrapIfMissing() + la
      // transition atomique CLOSING->CLOSED/OPEN de closeBusinessDay — si
      // c'est le cas, l'invariant "toujours une BusinessDay OPEN" est violé
      // ailleurs (bug), pas une situation que l'appelant peut résoudre lui-
      // même en réessayant.
      throw new ConflictException(
        'Aucune BusinessDay OPEN trouvée — invariant violé.',
      );
    }
    return current;
  }

  async getCurrentBusinessDate(): Promise<Date> {
    const day = await this.getCurrentBusinessDay();
    return day.date;
  }

  // Verrouille (SELECT ... FOR UPDATE) la BusinessDay OPEN courante dans la
  // transaction fournie — même pattern que
  // HousekeepingTaskService.getRoomStatusAfterMaintenance. Utilisé par
  // NightAuditService.closeBusinessDay pour garantir qu'aucune autre
  // transaction concurrente ne peut lire/modifier cette ligne pendant la
  // transition atomique CLOSED -> J+1 OPEN.
  async lockCurrentBusinessDay(tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM BusinessDay WHERE status = 'OPEN' LIMIT 1 FOR UPDATE
    `;
    const row = rows[0];
    if (!row) {
      throw new ConflictException(
        'Aucune BusinessDay OPEN trouvée — invariant violé.',
      );
    }
    return tx.businessDay.findUniqueOrThrow({ where: { id: row.id } });
  }

  // Transition atomique J CLOSED -> J+1 OPEN, appelée UNIQUEMENT depuis
  // l'intérieur de la transaction de clôture de NightAuditService (jamais
  // exposée seule sur une route HTTP) : verrouille la BusinessDay courante,
  // vérifie son statut attendu, la clôture, puis crée immédiatement la
  // journée suivante OPEN — dans la même transaction, donc jamais aucun
  // instant observable avec 0 ou 2 BusinessDay OPEN après commit.
  async openNextBusinessDay(
    tx: Prisma.TransactionClient,
    closedByUserId: number | undefined,
  ) {
    const current = await this.lockCurrentBusinessDay(tx);
    if (current.status !== BusinessDayStatus.OPEN) {
      throw new ConflictException(
        `BusinessDay ${current.id} n'est plus OPEN (statut actuel : ${current.status}).`,
      );
    }

    await tx.businessDay.update({
      where: { id: current.id },
      data: {
        status: BusinessDayStatus.CLOSED,
        closedAt: new Date(),
        closedByUserId,
        // Libère le marqueur unique — la journée suivante peut le prendre.
        openLock: null,
      },
    });

    const nextDate = new Date(current.date.getTime() + 24 * 60 * 60 * 1000);
    const next = await tx.businessDay.create({
      data: {
        date: nextDate,
        status: BusinessDayStatus.OPEN,
        openLock: OPEN_LOCK_MARKER,
        openedAt: new Date(),
        openedByUserId: closedByUserId,
        source: BusinessDaySource.NIGHT_AUDIT,
      },
    });

    return { closed: current, opened: next };
  }

  // Invariant vérifié explicitement (tests de concurrence ARCH-011A) —
  // jamais deux BusinessDay OPEN simultanément, jamais aucune après un
  // commit réussi.
  async assertOnlyOneOpenBusinessDay(): Promise<number> {
    const count = await this.prisma.businessDay.count({
      where: { status: BusinessDayStatus.OPEN },
    });
    if (count !== 1) {
      throw new ConflictException(
        `Invariant violé : ${count} BusinessDay OPEN trouvée(s), 1 attendue.`,
      );
    }
    return count;
  }
}
