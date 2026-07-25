-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('CHANGE_CATEGORY', 'BLACKLIST_CLIENT', 'UPDATE_PRICE', 'CANCEL_RESERVATION', 'UPDATE_HOTEL_CONFIG', 'UPDATE_TAX_RATE', 'CREATE_SEASON_RATE', 'UPDATE_SEASON_RATE', 'DELETE_SEASON_RATE', 'ADJUST_TIME_SHIFT', 'INVALIDATE_TIME_SHIFT', 'AUTO_CLOSE_TIME_SHIFT', 'VALIDATE_PAYSLIP', 'CREATE_POLICE_RECORD') NOT NULL,
    MODIFY `targetEntity` ENUM('Guest', 'Reservation', 'Stay', 'Room', 'Payment', 'Invoice', 'HotelConfig', 'TaxRateConfig', 'SeasonRate', 'TimeShift', 'PaySlip', 'POLICE_RECORD') NOT NULL;

-- CreateTable
CREATE TABLE `PoliceRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stayId` INTEGER NOT NULL,
    `guestId` INTEGER NOT NULL,
    `numeroPiece` VARCHAR(191) NOT NULL,
    `typePiece` ENUM('CIN', 'PASSEPORT', 'SEJOUR', 'AUTRE') NOT NULL,
    `nationalite` VARCHAR(191) NOT NULL,
    `dateNaissance` DATE NOT NULL,
    `paysProvenance` VARCHAR(191) NULL,
    `villeProvenance` VARCHAR(191) NULL,
    `paysDestination` VARCHAR(191) NULL,
    `villeDestination` VARCHAR(191) NULL,
    `dateArrivee` DATETIME(3) NOT NULL,
    `dateDepart` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PoliceRecord_stayId_key`(`stayId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PoliceRecord` ADD CONSTRAINT `PoliceRecord_stayId_fkey` FOREIGN KEY (`stayId`) REFERENCES `Stay`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PoliceRecord` ADD CONSTRAINT `PoliceRecord_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
