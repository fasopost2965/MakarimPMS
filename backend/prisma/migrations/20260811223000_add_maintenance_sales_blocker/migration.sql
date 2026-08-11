-- B0.2 — classification explicite des tickets Maintenance.
-- Le préflight production a confirmé l'absence de ticket ouvert. Le
-- backfill historique reste néanmoins déterministe et rejouable : les
-- tickets liés à une chambre sont classés bloquants, les tickets de zone
-- sans chambre ne le sont pas.
SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'MaintenanceTicket'
    AND COLUMN_NAME = 'bloqueVente'
);

SET @add_column = IF(
  @column_exists = 0,
  'ALTER TABLE `MaintenanceTicket` ADD COLUMN `bloqueVente` BOOLEAN NULL',
  'SELECT 1'
);
PREPARE add_column_stmt FROM @add_column;
EXECUTE add_column_stmt;
DEALLOCATE PREPARE add_column_stmt;

UPDATE `MaintenanceTicket`
SET `bloqueVente` = (`roomId` IS NOT NULL)
WHERE `bloqueVente` IS NULL;

ALTER TABLE `MaintenanceTicket`
  MODIFY `bloqueVente` BOOLEAN NOT NULL DEFAULT true;
