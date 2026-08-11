# Backend — invariants locaux

Appliquer d'abord le `AGENTS.md` racine. Charger seulement la documentation du
module concerné et les ADR associés.

## Architecture et données

- Un domaine propriétaire reste le seul auteur de ses entités et états métier.
- Passer par les services exportés des autres modules ; éviter Prisma direct sur
  leurs tables.
- Conserver un chemin canonique unique pour chaque écriture sensible.
- Écrire l'audit sensible dans la même transaction Prisma que la mutation.
- Préserver les machines d'état, gardes RBAC et invariants documentés ; ne pas
  ajouter de transition ou permission par déduction.
- Ne jamais supposer qu'une transaction applicative prouve une sérialisation :
  vérifier les verrous et relectures sur le moteur réel.

## Prisma et migrations

- Inspecter `backend/prisma/schema.prisma`, les migrations existantes et les
  données concernées avant toute modification de schéma.
- Une migration est au minimum `HIGH` ; destructive ou appliquée à des données
  réelles, elle devient `CRITICAL`.
- Ne jamais utiliser `prisma migrate dev` contre la production.
- Ne pas présenter un rollback applicatif comme un rollback de schéma.
- Les taux, permissions et données de seed restent dans leurs sources de vérité,
  jamais codés en dur pour satisfaire un test.

## Validation

- Utiliser les commandes de `backend/package.json` plutôt qu'une commande
  inventée dans un prompt.
- Pour logique pure : test unitaire ciblé puis lint/build selon le diff.
- Pour service, persistance ou frontière de module : E2E ciblé.
- Pour concurrence, transactions, contraintes, migrations ou Redis : MySQL 8
  et Redis réels selon le besoin ; mocks insuffisants comme preuve finale.
- Préserver un échec d'environnement comme `NOT VERIFIED`, sans utiliser la
  production ni affaiblir le scénario.
