-- AlterTable
ALTER TABLE `NotificationLog` MODIFY `evenement` ENUM('RESERVATION_CONFIRMEE', 'RAPPEL_J_MOINS_1', 'POST_SEJOUR', 'SELF_CHECKIN_LIEN', 'FACTURE_EMISE') NOT NULL;

-- AlterTable
ALTER TABLE `NotificationTemplate` MODIFY `evenement` ENUM('RESERVATION_CONFIRMEE', 'RAPPEL_J_MOINS_1', 'POST_SEJOUR', 'SELF_CHECKIN_LIEN', 'FACTURE_EMISE') NOT NULL;

-- AlterTable
ALTER TABLE `Room` ADD COLUMN `etage` INTEGER NULL;

-- CreateTable
CREATE TABLE `InvoiceDownloadToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `invoiceId` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `InvoiceDownloadToken_token_key`(`token`),
    INDEX `InvoiceDownloadToken_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InvoiceDownloadToken` ADD CONSTRAINT `InvoiceDownloadToken_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

