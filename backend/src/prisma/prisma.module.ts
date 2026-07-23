import { Global, Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { guestEncryptionExtension } from './guest-encryption.extension';
import { softDeleteExtension } from './soft-delete.extension';

// CH-004 — le client réellement injecté partout sous le token PrismaService
// est le client Prisma étendu (chiffrement transparent de
// Guest.pieceIdentite, voir guest-encryption.extension.ts ; filtrage
// soft-delete centralisé, CH-006, voir soft-delete.extension.ts), pas une
// instance de la classe PrismaService elle-même : $extends() renvoie un
// nouvel objet (proxy), qui ne peut pas être obtenu en instanciant la classe
// directement (`new PrismaService()`). PrismaService reste la forme/le type
// utilisés par tous les services consommateurs
// (`constructor(private prisma: PrismaService)`) — seule cette fabrique
// change, jamais les sites d'appel. Les deux extensions sont chaînées
// (`$extends().$extends()`) — vérifié en live que la composition ne casse
// ni le chiffrement (CH-004) ni le filtrage soft-delete (CH-006) l'un pour
// l'autre.
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: (): PrismaService => {
        const client = new PrismaClient()
          .$extends(guestEncryptionExtension(process.env.ENCRYPTION_KEY))
          .$extends(softDeleteExtension());
        return client as unknown as PrismaService;
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
