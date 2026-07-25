import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  module: string;
  action: 'read' | 'write' | 'delete' | 'export';
}

// Déclare la permission (module, action) nécessaire pour atteindre une
// route. Vérifiée par PermissionsGuard contre les RolePermission du rôle de
// l'utilisateur authentifié (jamais contre le contenu du JWT lui-même, pour
// que les changements de permissions prennent effet sans réémettre de token).
export const RequirePermission = (
  module: string,
  action: RequiredPermission['action'],
) => SetMetadata(PERMISSION_KEY, { module, action });
