import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  module: string;
  // 'control' (housekeeping), 'change-room' (GL-002, stay), 'extend'
  // (GL-003, stay) et 'report-incident' (B0.4A, housekeeping mobile) sont des
  // actions dédiées hors de la grille CRUD générique mais dont l'exigibilité
  // ne dépend jamais du contenu de la requête (contrairement à
  // guests:blacklist/checkin:force-checkout/payments:refund, qui restent
  // volontairement hors de cette union et vérifiés dynamiquement dans le
  // service concerné) — elles peuvent donc être exprimées directement par ce
  // décorateur statique.
  action:
    | 'read'
    | 'write'
    | 'delete'
    | 'export'
    | 'control'
    | 'change-room'
    | 'extend'
    | 'report-incident';
}

// Déclare la permission (module, action) nécessaire pour atteindre une
// route. Vérifiée par PermissionsGuard contre les RolePermission du rôle de
// l'utilisateur authentifié (jamais contre le contenu du JWT lui-même, pour
// que les changements de permissions prennent effet sans réémettre de token).
export const RequirePermission = (
  module: string,
  action: RequiredPermission['action'],
) => SetMetadata(PERMISSION_KEY, { module, action });
