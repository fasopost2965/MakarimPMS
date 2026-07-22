-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('CHANGE_CATEGORY', 'BLACKLIST_CLIENT', 'UPDATE_PRICE', 'CANCEL_RESERVATION', 'UPDATE_HOTEL_CONFIG', 'UPDATE_TAX_RATE', 'CREATE_SEASON_RATE', 'UPDATE_SEASON_RATE', 'DELETE_SEASON_RATE', 'ADJUST_TIME_SHIFT', 'INVALIDATE_TIME_SHIFT', 'AUTO_CLOSE_TIME_SHIFT', 'VALIDATE_PAYSLIP') NOT NULL,
    MODIFY `targetEntity` ENUM('Guest', 'Reservation', 'Stay', 'Room', 'Payment', 'Invoice', 'HotelConfig', 'TaxRateConfig', 'SeasonRate', 'TimeShift', 'PaySlip') NOT NULL;

-- CreateTable
CREATE TABLE `Employee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `matriculeCnss` VARCHAR(191) NULL,
    `salaireBase` DECIMAL(10, 2) NOT NULL,
    `dateEmbauche` DATETIME(3) NOT NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Employee_userId_key`(`userId`),
    INDEX `Employee_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimeShift` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `statut` ENUM('NON_DEMARRE', 'ACTIF', 'EN_PAUSE', 'TERMINE') NOT NULL DEFAULT 'ACTIF',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `TimeShift_employeeId_statut_idx`(`employeeId`, `statut`),
    INDEX `TimeShift_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimeShiftSegment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timeShiftId` INTEGER NOT NULL,
    `type` ENUM('TRAVAIL', 'PAUSE') NOT NULL,
    `debut` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fin` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `TimeShiftSegment_timeShiftId_idx`(`timeShiftId`),
    INDEX `TimeShiftSegment_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaySlip` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `mois` INTEGER NOT NULL,
    `annee` INTEGER NOT NULL,
    `salaireBase` DECIMAL(10, 2) NOT NULL,
    `indemnites` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `retenueCnss` DECIMAL(10, 2) NOT NULL,
    `retenueAmo` DECIMAL(10, 2) NOT NULL,
    `salaireNet` DECIMAL(10, 2) NOT NULL,
    `estValide` BOOLEAN NOT NULL DEFAULT false,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validatedById` INTEGER NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `PaySlip_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `PaySlip_employeeId_mois_annee_key`(`employeeId`, `mois`, `annee`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeShift` ADD CONSTRAINT `TimeShift_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeShiftSegment` ADD CONSTRAINT `TimeShiftSegment_timeShiftId_fkey` FOREIGN KEY (`timeShiftId`) REFERENCES `TimeShift`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaySlip` ADD CONSTRAINT `PaySlip_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaySlip` ADD CONSTRAINT `PaySlip_validatedById_fkey` FOREIGN KEY (`validatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
