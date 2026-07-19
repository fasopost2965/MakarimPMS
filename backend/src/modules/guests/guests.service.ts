import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategorieClient, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';

const SEARCH_LIMIT = 20;

@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  // Recherche rapide multi-critères (cahier des charges §5.7) : nom,
  // prénom, téléphone, pièce d'identité. Sans `q`, renvoie les clients les
  // plus récents (utile pour un premier affichage de liste).
  async search(q?: string) {
    if (!q) {
      return this.prisma.guest.findMany({
        orderBy: { createdAt: 'desc' },
        take: SEARCH_LIMIT,
      });
    }
    return this.prisma.guest.findMany({
      where: {
        OR: [
          { nom: { contains: q } },
          { prenom: { contains: q } },
          { telephone: { contains: q } },
          { pieceIdentite: { contains: q } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: SEARCH_LIMIT,
    });
  }

  async create(dto: CreateGuestDto) {
    return this.prisma.guest.create({ data: dto });
  }

  async findOne(id: number) {
    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest) {
      throw new NotFoundException(`Client ${id} introuvable.`);
    }
    return guest;
  }

  async update(id: number, dto: UpdateGuestDto) {
    await this.findOne(id);
    return this.prisma.guest.update({ where: { id }, data: dto });
  }

  // Seul chemin d'écriture de Guest.categorie (CLAUDE.md règle 4 : trace
  // d'audit obligatoire pour une opération sensible — blacklister un client
  // en particulier). Journalise systématiquement dans GuestCategoryLog,
  // même quand la catégorie ne change pas réellement (motif tout de même
  // significatif, ex. "reconfirmé VIP").
  async updateCategorie(
    id: number,
    categorie: CategorieClient,
    motif: string,
    userId?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const guest = await tx.guest.findUnique({ where: { id } });
      if (!guest) {
        throw new NotFoundException(`Client ${id} introuvable.`);
      }

      const updated = await tx.guest.update({
        where: { id },
        data: { categorie },
      });

      await tx.guestCategoryLog.create({
        data: {
          guestId: id,
          ancienneCategorie: guest.categorie,
          nouvelleCategorie: categorie,
          motif,
          userId,
        },
      });

      return updated;
    });
  }

  // Vérifie qu'un client n'est pas blacklisté avant de le laisser réserver
  // ou effectuer un check-in — la seule règle "associée" à une catégorie
  // qui soit applicable sans inventer de configuration chiffrée absente du
  // cahier des charges (CLAUDE.md règle 5 : réutilisée par reservations et
  // checkin, jamais dupliquée). Renvoie le client pour éviter un second
  // aller-retour base aux appelants.
  async assertNotBlacklisted(guestId: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    const guest = await client.guest.findUnique({ where: { id: guestId } });
    if (!guest) {
      throw new NotFoundException(`Client ${guestId} introuvable.`);
    }
    if (guest.categorie === CategorieClient.BLACKLIST) {
      throw new ConflictException(
        `${guest.nom} ${guest.prenom} est en liste noire : réservation et check-in impossibles.`,
      );
    }
    return guest;
  }

  async historique(id: number) {
    await this.findOne(id);
    return this.prisma.stay.findMany({
      where: { guestId: id },
      include: { room: { include: { roomType: true } } },
      orderBy: { dateCheckin: 'desc' },
    });
  }

  async factures(id: number) {
    await this.findOne(id);
    return this.prisma.invoice.findMany({
      where: { folio: { stay: { guestId: id } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
