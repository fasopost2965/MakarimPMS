import { Prisma, StatutChambre } from '@prisma/client';

export const HOUSEKEEPING_MAINTENANCE_PROJECTION = Symbol(
  'HOUSEKEEPING_MAINTENANCE_PROJECTION',
);

// Façade de lecture Housekeeping utilisée par Maintenance après résolution
// du dernier bloqueur. Elle évite toute lecture Prisma directe de
// HousekeepingTask depuis le module Maintenance et tout cycle de modules.
export interface HousekeepingMaintenanceProjection {
  getRoomStatusAfterMaintenance(
    roomId: number,
    tx: Prisma.TransactionClient,
  ): Promise<StatutChambre>;
}
