---
name: revue-migration-prisma
description: Checklist de revue obligatoire avant tout `prisma migrate deploy` en production — migration réversible, pas de perte de données, testée sur le clone de staging, sauvegarde prise juste avant. Utiliser avant de fusionner ou de déployer toute migration Prisma touchant la base MySQL de production du PMS Hôtel Makarim.
---

# Revue de migration Prisma

Checklist à dérouler intégralement avant tout `prisma migrate deploy` en production (`docs/plan-execution-claude-code.md` §7.3, §7.4).

## Avant de créer la migration

- [ ] Le modèle Prisma modifié respecte-t-il les 5 règles non négociables de `CLAUDE.md` (ex. ne pas fusionner `Folio`/`Invoice`/`Reservation`, ne pas retirer `AuditLog`) ?
- [ ] La migration livre-t-elle un module à la fois (voir note d'implémentation, `docs/plan-execution-claude-code.md` §3) plutôt qu'une migration géante multi-modules ?

## Revue de la migration générée

- [ ] **Réversible** : la migration a-t-elle un chemin de rollback clair (pas de `DROP COLUMN`/`DROP TABLE` irréversible sans confirmation explicite) ?
- [ ] **Pas de perte de données** : tout renommage de colonne/table passe par une étape intermédiaire (ajout → backfill → bascule → suppression), jamais un `DROP`+`CREATE` direct sur une colonne contenant des données.
- [ ] **Contraintes cohérentes** : les nouvelles contraintes d'unicité ou `NOT NULL` ont-elles été vérifiées contre les données existantes (pas d'échec de migration en prod faute de données conformes) ?
- [ ] **Soft delete respecté** : les entités sensibles utilisent `deletedAt`, jamais de suppression physique immédiate (`CLAUDE.md`, règle transverse sécurité/audit).

## Avant le déploiement

- [ ] La migration a été **testée sur un clone de staging** avec un jeu de données représentatif (pas une base vide).
- [ ] Une **sauvegarde `mysqldump`** de la base de production a été prise juste avant le déploiement (voir skill `deploiement-vps`).
- [ ] Le plan de rollback (restauration de la sauvegarde ou migration inverse) est écrit et compris par la personne qui déploie, pas improvisé après coup.

## À ne jamais faire

- Lancer `prisma migrate deploy` en production sans être passé par cette checklist.
- Considérer une sauvegarde comme valable si elle n'a jamais été restaurée en test (voir skill `deploiement-vps` — exercice de restauration trimestriel).
- Regrouper plusieurs modules métier dans une seule migration pour « gagner du temps ».
