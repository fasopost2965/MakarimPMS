-- AlterTable
ALTER TABLE `RoomNight` ADD COLUMN `stayId` INTEGER NULL,
    MODIFY `reservationId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Stay` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reservationId` INTEGER NULL,
    `roomId` INTEGER NOT NULL,
    `guestId` INTEGER NOT NULL,
    `dateCheckin` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dateCheckoutPrevue` DATE NOT NULL,
    `dateCheckoutReelle` DATETIME(3) NULL,
    `statut` ENUM('EN_COURS', 'CHECKOUT', 'ANNULE') NOT NULL DEFAULT 'EN_COURS',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Stay_reservationId_key`(`reservationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Folio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stayId` INTEGER NOT NULL,
    `libelle` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FolioLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `folioId` INTEGER NOT NULL,
    `type` ENUM('HEBERGEMENT', 'EXTRA', 'TAXE_SEJOUR', 'PAIEMENT') NOT NULL,
    `libelle` VARCHAR(191) NOT NULL,
    `montant` DECIMAL(10, 2) NOT NULL,
    `annulee` BOOLEAN NOT NULL DEFAULT false,
    `motifAnnulation` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RoomNight` ADD CONSTRAINT `RoomNight_stayId_fkey` FOREIGN KEY (`stayId`) REFERENCES `Stay`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Stay` ADD CONSTRAINT `Stay_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Stay` ADD CONSTRAINT `Stay_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Stay` ADD CONSTRAINT `Stay_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Folio` ADD CONSTRAINT `Folio_stayId_fkey` FOREIGN KEY (`stayId`) REFERENCES `Stay`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FolioLine` ADD CONSTRAINT `FolioLine_folioId_fkey` FOREIGN KEY (`folioId`) REFERENCES `Folio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
