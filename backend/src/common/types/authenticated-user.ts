// Contenu décodé du JWT d'accès, attaché à `req.user` par JwtAccessStrategy.
// roleName est utilisé pour l'affichage seulement — toute décision d'accès
// repasse par PermissionsGuard (requête RolePermission fraîche), jamais par
// une valeur figée dans le token.
export interface AuthenticatedUser {
  sub: number;
  email: string;
  roleId: number;
  roleName: string;
}
