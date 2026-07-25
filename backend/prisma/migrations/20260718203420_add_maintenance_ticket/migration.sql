-- CreateTable
CREATE TABLE `MaintenanceTicket` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `roomId` INTEGER NULL,
    `typePanne` VARCHAR(191) NOT NULL,
    `priorite` ENUM('BASSE', 'MOYENNE', 'HAUTE', 'URGENTE') NOT NULL DEFAULT 'MOYENNE',
    `photoUrl` VARCHAR(191) NULL,
    `assigneA` VARCHAR(191) NULL,
    `resoluAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MaintenanceTicket` ADD CONSTRAINT `MaintenanceTicket_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
