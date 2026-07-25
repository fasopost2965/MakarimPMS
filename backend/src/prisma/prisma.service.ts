import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Sert uniquement de token/type d'injection (`constructor(private prisma:
// PrismaService)` dans tous les services) — jamais instanciée directement.
// L'objet réellement fourni par le DI (client Prisma étendu avec le
// chiffrement transparent de Guest.pieceIdentite, cycle de vie
// $connect/$disconnect inclus) vient de prisma.module.ts (CH-004).
@Injectable()
export class PrismaService extends PrismaClient {}
