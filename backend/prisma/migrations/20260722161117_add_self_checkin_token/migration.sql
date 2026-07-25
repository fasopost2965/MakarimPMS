-- AlterTable
ALTER TABLE `NotificationLog` MODIFY `evenement` ENUM('RESERVATION_CONFIRMEE', 'RAPPEL_J_MOINS_1', 'POST_SEJOUR', 'SELF_CHECKIN_LIEN') NOT NULL;

-- AlterTable
ALTER TABLE `NotificationTemplate` MODIFY `evenement` ENUM('RESERVATION_CONFIRMEE', 'RAPPEL_J_MOINS_1', 'POST_SEJOUR', 'SELF_CHECKIN_LIEN') NOT NULL;

-- CreateTable
CREATE TABLE `SelfCheckinToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reservationId` INTEGER NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `numeroPiece` VARCHAR(191) NULL,
    `typePiece` ENUM('CIN', 'PASSEPORT', 'SEJOUR', 'AUTRE') NULL,
    `dateNaissance` DATE NULL,
    `paysProvenance` VARCHAR(191) NULL,
    `villeProvenance` VARCHAR(191) NULL,
    `paysDestination` VARCHAR(191) NULL,
    `villeDestination` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SelfCheckinToken_reservationId_key`(`reservationId`),
    UNIQUE INDEX `SelfCheckinToken_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SelfCheckinToken` ADD CONSTRAINT `SelfCheckinToken_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
