// Contenu décodé du JWT d'accès, attaché à `req.user` par JwtAccessStrategy.
// roleName est utilisé pour l'affichage seulement — toute décision d'accès
// repasse par PermissionsGuard (requête RolePermission fraîche), jamais par
// une valeur figée dans le token.
//
// scope (F9, app mobile housekeeping) : absent sur un jeton desktop normal.
// "mobile-housekeeping" marque un jeton émis par
// AuthService.loginMobile() — même secret JWT_ACCESS_SECRET, TTL bien plus
// court, restreint côté serveur (JwtAuthGuard) aux seules routes
// /mobile/housekeeping/* même si le rôle sous-jacent aurait par ailleurs
// une permission plus large. Défense en profondeur contre un appareil
// mobile perdu/volé — jamais une deuxième source de vérité RBAC (le
// contrôle d'autorisation réel reste PermissionsGuard, inchangé).
export interface AuthenticatedUser {
  sub: number;
  email: string;
  roleId: number;
  roleName: string;
  scope?: 'mobile-housekeeping';
}
