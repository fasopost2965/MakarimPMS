import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marque une route comme accessible sans JWT — réservé aux routes du flux
// d'authentification lui-même (login, refresh, forgot/reset-password,
// roles-actifs), plus (depuis le design Marine & Or) l'identité visuelle
// publique de l'hôtel (ParametersController.getBranding — nom + logo
// uniquement, jamais de donnée fiscale) consommée par l'écran de connexion
// avant l'obtention d'un token. Le guard global JwtAuthGuard vérifie cette
// métadonnée avant d'exiger un token.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
