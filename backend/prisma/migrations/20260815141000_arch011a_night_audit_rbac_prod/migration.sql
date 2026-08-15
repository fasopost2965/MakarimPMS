-- ARCH-011A production RBAC data migration.
--
-- The Night Audit schema migration added the domain tables, while the three
-- permissions were initially created only by prisma/seed.ts. Production
-- deploys run `prisma migrate deploy` but deliberately do not re-run the seed,
-- so an already-initialized production database would not receive the new
-- permissions and the frontend would correctly hide the Night Audit module.
--
-- This migration is intentionally safe on both kinds of database:
--   * existing/prod DB (roles already exist): provision permissions + grants;
--   * fresh CI DB (roles do not exist yet): do nothing, then seed.ts creates
--     the same permissions and grants normally.
-- No existing permission or role grant is removed or modified.

-- Provision the three dedicated Night Audit permissions only when this is an
-- already-initialized database (at least one Role exists). The NOT EXISTS
-- guards make the data migration idempotent at the logical level.
INSERT INTO `Permission` (`module`, `action`)
SELECT 'night-audit', 'read'
WHERE EXISTS (SELECT 1 FROM `Role` LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM `Permission`
    WHERE `module` = 'night-audit' AND `action` = 'read'
  );

INSERT INTO `Permission` (`module`, `action`)
SELECT 'night-audit', 'run'
WHERE EXISTS (SELECT 1 FROM `Role` LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM `Permission`
    WHERE `module` = 'night-audit' AND `action` = 'run'
  );

INSERT INTO `Permission` (`module`, `action`)
SELECT 'night-audit', 'close'
WHERE EXISTS (SELECT 1 FROM `Role` LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM `Permission`
    WHERE `module` = 'night-audit' AND `action` = 'close'
  );

-- Administrateur: full Night Audit capabilities.
INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.`id`, p.`id`
FROM `Role` r
JOIN `Permission` p
  ON p.`module` = 'night-audit'
 AND p.`action` IN ('read', 'run', 'close')
WHERE r.`nom` = 'Administrateur';

-- Réception and Comptable: read-only, matching seed.ts and ARCH-011A RBAC.
INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.`id`, p.`id`
FROM `Role` r
JOIN `Permission` p
  ON p.`module` = 'night-audit'
 AND p.`action` = 'read'
WHERE r.`nom` IN ('Réception', 'Comptable');
