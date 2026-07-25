import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

interface PrismaErrorMapping {
  status: number;
  error: string;
  message: (exception: Prisma.PrismaClientKnownRequestError) => string;
}

// Codes Prisma les plus fréquents en usage courant du PMS — les services qui
// ont déjà besoin d'un traitement métier fin (ex. PaymentsService.createPayment
// sur P2002/idempotencyKey) continuent de les intercepter localement ; ce
// filtre est le filet de sécurité pour tout le reste, afin qu'aucune erreur
// Prisma non gérée ne remonte en 500 brute avec sa stack trace.
// MySQL renvoie le nom de la contrainte/l'index (pas une liste de colonnes,
// contrairement à Postgres/SQLite) dans meta.target — traduction vers un
// libellé lisible pour les cas où ce message générique remonte jusqu'à
// l'utilisateur final (ex. CH-010, contrainte de déduplication client).
const P2002_TARGET_LABEL: Record<string, string> = {
  Guest_pieceIdentiteHash_key: "numéro de pièce d'identité",
};

const PRISMA_ERROR_MAP: Record<string, PrismaErrorMapping> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    error: 'Conflict',
    message: (e) => {
      // meta.target est un tableau de colonnes sur Postgres/SQLite, mais une
      // chaîne (nom de la contrainte/l'index) sur MySQL (ce projet) —
      // .join() plantait silencieusement en un 500 brut sur toute violation
      // de contrainte unique MySQL, jamais exercé avant (les rares P2002
      // gérés jusqu'ici, ex. Payment.idempotencyKey, sont interceptés
      // localement par leur service, pas par ce filtre générique). Découvert
      // en préparant CH-010 (contrainte unique sur Guest.pieceIdentiteHash).
      const target = e.meta?.target;
      const raw = Array.isArray(target)
        ? target.join(', ')
        : typeof target === 'string'
          ? target
          : undefined;
      if (!raw) return 'Cette ressource existe déjà.';
      const label = P2002_TARGET_LABEL[raw] ?? raw;
      return `Une ressource avec la même valeur pour "${label}" existe déjà.`;
    },
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    message: () => 'Ressource introuvable.',
  },
  P2003: {
    status: HttpStatus.CONFLICT,
    error: 'Conflict',
    message: () =>
      'Cette opération référence une ressource liée invalide ou inexistante.',
  },
};

// Filtre global (voir main.ts, app.useGlobalFilters) : ne change rien pour
// les HttpException déjà levées explicitement par les services (comportement
// identique à l'absence de filtre) ; traduit les erreurs Prisma connues en
// réponses HTTP propres ; journalise et masque tout le reste derrière un 500
// générique, jamais de stack trace dans la réponse HTTP.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapping = PRISMA_ERROR_MAP[exception.code];
      if (mapping) {
        response.status(mapping.status).json({
          statusCode: mapping.status,
          error: mapping.error,
          message: mapping.message(exception),
        });
        return;
      }
      // Code Prisma non mappé explicitement : toujours une erreur de
      // requête plutôt qu'une panne serveur.
      this.logger.warn(`Code Prisma non mappé : ${exception.code}`);
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Erreur de base de données.',
      });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Erreur interne du serveur.',
    });
  }
}
