-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('CHANGE_CATEGORY', 'BLACKLIST_CLIENT', 'UPDATE_PRICE', 'CANCEL_RESERVATION', 'UPDATE_HOTEL_CONFIG', 'UPDATE_TAX_RATE', 'CREATE_SEASON_RATE', 'UPDATE_SEASON_RATE', 'DELETE_SEASON_RATE', 'ADJUST_TIME_SHIFT', 'INVALIDATE_TIME_SHIFT', 'AUTO_CLOSE_TIME_SHIFT', 'VALIDATE_PAYSLIP', 'CREATE_POLICE_RECORD', 'CREATE_DEPOSIT', 'IMPUTE_DEPOSIT', 'REFUND_DEPOSIT') NOT NULL,
    MODIFY `targetEntity` ENUM('Guest', 'Reservation', 'Stay', 'Room', 'Payment', 'Invoice', 'HotelConfig', 'TaxRateConfig', 'SeasonRate', 'TimeShift', 'PaySlip', 'POLICE_RECORD', 'RESERVATION_DEPOSIT') NOT NULL;

-- CreateTable
CREATE TABLE `ReservationDeposit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reservationId` INTEGER NOT NULL,
    `montant` DECIMAL(10, 2) NOT NULL,
    `moyen` ENUM('ESPECES', 'CARTE', 'VIREMENT', 'ACOMPTE') NOT NULL,
    `statut` ENUM('EN_ATTENTE', 'ENCAISSE', 'IMPUTE', 'REMBOURSE') NOT NULL DEFAULT 'ENCAISSE',
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `imputeAuFolioId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ReservationDeposit_idempotencyKey_key`(`idempotencyKey`),
    INDEX `ReservationDeposit_deletedAt_idx`(`deletedAt`),
    INDEX `ReservationDeposit_reservationId_idx`(`reservationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReservationDeposit` ADD CONSTRAINT `ReservationDeposit_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReservationDeposit` ADD CONSTRAINT `ReservationDeposit_imputeAuFolioId_fkey` FOREIGN KEY (`imputeAuFolioId`) REFERENCES `Folio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
