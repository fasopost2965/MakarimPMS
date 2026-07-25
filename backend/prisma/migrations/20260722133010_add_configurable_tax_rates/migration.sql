-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('CHANGE_CATEGORY', 'BLACKLIST_CLIENT', 'UPDATE_PRICE', 'CANCEL_RESERVATION', 'UPDATE_HOTEL_CONFIG', 'UPDATE_TAX_RATE', 'CREATE_TAX_RATE', 'CREATE_SEASON_RATE', 'UPDATE_SEASON_RATE', 'DELETE_SEASON_RATE', 'ADJUST_TIME_SHIFT', 'INVALIDATE_TIME_SHIFT', 'AUTO_CLOSE_TIME_SHIFT', 'VALIDATE_PAYSLIP', 'CREATE_POLICE_RECORD', 'CREATE_DEPOSIT', 'IMPUTE_DEPOSIT', 'REFUND_DEPOSIT', 'EXCLUDE_FOLIO_TAX') NOT NULL,
    MODIFY `targetEntity` ENUM('Guest', 'Reservation', 'Stay', 'Room', 'Payment', 'Invoice', 'HotelConfig', 'TaxRateConfig', 'SeasonRate', 'TimeShift', 'PaySlip', 'POLICE_RECORD', 'RESERVATION_DEPOSIT', 'Folio') NOT NULL;

-- AlterTable
ALTER TABLE `FolioLine` ADD COLUMN `taxRateConfigId` INTEGER NULL;

-- AlterTable
ALTER TABLE `TaxRateConfig` ADD COLUMN `actif` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `applicableParDefaut` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `collectePourTresor` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mode` ENUM('MONTANT_FIXE', 'POURCENTAGE') NOT NULL DEFAULT 'POURCENTAGE';

-- CreateTable
CREATE TABLE `FolioTaxExclusion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `folioId` INTEGER NOT NULL,
    `taxRateConfigId` INTEGER NOT NULL,
    `motif` VARCHAR(191) NOT NULL,
    `userId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FolioTaxExclusion_folioId_taxRateConfigId_key`(`folioId`, `taxRateConfigId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FolioLine` ADD CONSTRAINT `FolioLine_taxRateConfigId_fkey` FOREIGN KEY (`taxRateConfigId`) REFERENCES `TaxRateConfig`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FolioTaxExclusion` ADD CONSTRAINT `FolioTaxExclusion_folioId_fkey` FOREIGN KEY (`folioId`) REFERENCES `Folio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FolioTaxExclusion` ADD CONSTRAINT `FolioTaxExclusion_taxRateConfigId_fkey` FOREIGN KEY (`taxRateConfigId`) REFERENCES `TaxRateConfig`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
