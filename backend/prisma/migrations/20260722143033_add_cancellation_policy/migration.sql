-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('CHANGE_CATEGORY', 'BLACKLIST_CLIENT', 'UPDATE_PRICE', 'CANCEL_RESERVATION', 'UPDATE_HOTEL_CONFIG', 'UPDATE_TAX_RATE', 'CREATE_TAX_RATE', 'CREATE_SEASON_RATE', 'UPDATE_SEASON_RATE', 'DELETE_SEASON_RATE', 'ADJUST_TIME_SHIFT', 'INVALIDATE_TIME_SHIFT', 'AUTO_CLOSE_TIME_SHIFT', 'VALIDATE_PAYSLIP', 'CREATE_POLICE_RECORD', 'CREATE_DEPOSIT', 'IMPUTE_DEPOSIT', 'REFUND_DEPOSIT', 'EXCLUDE_FOLIO_TAX', 'CREATE_CANCELLATION_POLICY', 'UPDATE_CANCELLATION_POLICY', 'MARK_NO_SHOW') NOT NULL,
    MODIFY `targetEntity` ENUM('Guest', 'Reservation', 'Stay', 'Room', 'Payment', 'Invoice', 'HotelConfig', 'TaxRateConfig', 'SeasonRate', 'TimeShift', 'PaySlip', 'POLICE_RECORD', 'RESERVATION_DEPOSIT', 'Folio', 'CancellationPolicy') NOT NULL;

-- AlterTable
ALTER TABLE `Reservation` ADD COLUMN `cancellationPolicyId` INTEGER NULL,
    ADD COLUMN `montantPenalite` DECIMAL(10, 2) NULL;

-- CreateTable
CREATE TABLE `CancellationPolicy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(191) NOT NULL,
    `type` ENUM('FLEXIBLE', 'MODEREE', 'NON_REMBOURSABLE') NOT NULL,
    `delaiFrancHeures` INTEGER NOT NULL,
    `pourcentagePenaliteAnnulation` DECIMAL(5, 2) NOT NULL,
    `pourcentagePenaliteNoShow` DECIMAL(5, 2) NOT NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CancellationPolicy_nom_key`(`nom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_cancellationPolicyId_fkey` FOREIGN KEY (`cancellationPolicyId`) REFERENCES `CancellationPolicy`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
