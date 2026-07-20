-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('CHANGE_CATEGORY', 'BLACKLIST_CLIENT', 'UPDATE_PRICE', 'CANCEL_RESERVATION', 'UPDATE_HOTEL_CONFIG', 'UPDATE_TAX_RATE', 'CREATE_SEASON_RATE', 'UPDATE_SEASON_RATE', 'DELETE_SEASON_RATE') NOT NULL,
    MODIFY `targetEntity` ENUM('Guest', 'Reservation', 'Stay', 'Room', 'Payment', 'Invoice', 'HotelConfig', 'TaxRateConfig', 'SeasonRate') NOT NULL;

-- CreateTable
CREATE TABLE `CnssRateConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branche` VARCHAR(191) NOT NULL,
    `tauxSalarie` DECIMAL(5, 2) NOT NULL,
    `tauxEmployeur` DECIMAL(5, 2) NOT NULL,
    `plafondMensuel` DECIMAL(10, 2) NULL,
    `applicableDepuis` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
