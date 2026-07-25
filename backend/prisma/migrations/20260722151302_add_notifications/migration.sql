-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('CHANGE_CATEGORY', 'BLACKLIST_CLIENT', 'UPDATE_PRICE', 'CANCEL_RESERVATION', 'UPDATE_HOTEL_CONFIG', 'UPDATE_TAX_RATE', 'CREATE_TAX_RATE', 'CREATE_SEASON_RATE', 'UPDATE_SEASON_RATE', 'DELETE_SEASON_RATE', 'ADJUST_TIME_SHIFT', 'INVALIDATE_TIME_SHIFT', 'AUTO_CLOSE_TIME_SHIFT', 'VALIDATE_PAYSLIP', 'CREATE_POLICE_RECORD', 'CREATE_DEPOSIT', 'IMPUTE_DEPOSIT', 'REFUND_DEPOSIT', 'EXCLUDE_FOLIO_TAX', 'CREATE_CANCELLATION_POLICY', 'UPDATE_CANCELLATION_POLICY', 'MARK_NO_SHOW', 'CREATE_RATE_RESTRICTION', 'UPDATE_RATE_RESTRICTION', 'DELETE_RATE_RESTRICTION', 'CREATE_NOTIFICATION_TEMPLATE', 'UPDATE_NOTIFICATION_TEMPLATE') NOT NULL,
    MODIFY `targetEntity` ENUM('Guest', 'Reservation', 'Stay', 'Room', 'Payment', 'Invoice', 'HotelConfig', 'TaxRateConfig', 'SeasonRate', 'TimeShift', 'PaySlip', 'POLICE_RECORD', 'RESERVATION_DEPOSIT', 'Folio', 'CancellationPolicy', 'RateRestriction', 'NotificationTemplate') NOT NULL;

-- AlterTable
ALTER TABLE `Guest` ADD COLUMN `consentementNotifications` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `NotificationTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `evenement` ENUM('RESERVATION_CONFIRMEE', 'RAPPEL_J_MOINS_1', 'POST_SEJOUR') NOT NULL,
    `canal` ENUM('EMAIL') NOT NULL,
    `sujet` VARCHAR(191) NULL,
    `corps` TEXT NOT NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NotificationTemplate_evenement_canal_key`(`evenement`, `canal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `guestId` INTEGER NOT NULL,
    `reservationId` INTEGER NULL,
    `evenement` ENUM('RESERVATION_CONFIRMEE', 'RAPPEL_J_MOINS_1', 'POST_SEJOUR') NOT NULL,
    `canal` ENUM('EMAIL') NOT NULL,
    `destinataire` VARCHAR(191) NOT NULL,
    `statut` ENUM('EN_ATTENTE', 'ENVOYE', 'ECHEC', 'IGNORE') NOT NULL DEFAULT 'EN_ATTENTE',
    `erreur` VARCHAR(191) NULL,
    `envoyeAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NotificationLog_guestId_idx`(`guestId`),
    INDEX `NotificationLog_reservationId_idx`(`reservationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NotificationLog` ADD CONSTRAINT `NotificationLog_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationLog` ADD CONSTRAINT `NotificationLog_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
