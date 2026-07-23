-- CH-010 (docs/governance/REGISTRE_DECISIONS.md, RD-011) : index aveugle
-- (HMAC déterministe) pour la déduplication dure sur Guest.pieceIdentite,
-- lui-même chiffré de façon non-déterministe (CH-004) et donc inutilisable
-- directement pour une contrainte d'unicité.
-- AlterTable
ALTER TABLE `Guest` ADD COLUMN `pieceIdentiteHash` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Guest_pieceIdentiteHash_key` ON `Guest`(`pieceIdentiteHash`);
