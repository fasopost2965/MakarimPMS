import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marque une route comme accessible sans JWT — réservé aux routes du flux
// d'authentification lui-même (login, refresh, forgot/reset-password,
// roles-actifs). Le guard global JwtAuthGuard vérifie cette métadonnée avant
// d'exiger un token.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
