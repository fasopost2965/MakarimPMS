import {
  HousekeepingTask,
  OrigineTacheHousekeeping,
  Prisma,
} from '@prisma/client';

// GL-002 — jeton d'injection + interface minimale exposant uniquement
// createTask() à StayService (StayService.changeRoom), sans jamais importer
// housekeeping.module.ts ni la classe concrète HousekeepingTaskService
// depuis le module stay : un aller-retour entre les deux fichiers .module.ts
// casse le chargement CommonJS au démarrage (constaté en le testant, voir
// stay.module.ts). Fichier volontairement sans aucune dépendance vers
// stay/* — feuille pure, importable des deux côtés sans risque de cycle.
// Résolu via ModuleRef#get(HOUSEKEEPING_TASK_WRITER, { strict: false })
// (recherche globale dans le conteneur applicatif, exécutée après le
// bootstrap complet — jamais au chargement des modules).
export const HOUSEKEEPING_TASK_WRITER = Symbol('HOUSEKEEPING_TASK_WRITER');

export interface HousekeepingTaskWriter {
  createTask(
    roomId: number,
    origine: OrigineTacheHousekeeping,
    sourceEventKey: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<HousekeepingTask>;
}
