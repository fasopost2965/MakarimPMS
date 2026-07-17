-- AlterTable
ALTER TABLE `Reservation` ADD COLUMN `ajustementManuel` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `motifAjustement` VARCHAR(191) NULL,
    ADD COLUMN `prixTotalCalcule` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `prixTotalFinal` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `SeasonRate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `roomTypeId` INTEGER NOT NULL,
    `libelle` VARCHAR(191) NOT NULL,
    `dateDebut` DATE NOT NULL,
    `dateFin` DATE NOT NULL,
    `prixNuit` DECIMAL(10, 2) NOT NULL,

    UNIQUE INDEX `SeasonRate_roomTypeId_libelle_key`(`roomTypeId`, `libelle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SeasonRate` ADD CONSTRAINT `SeasonRate_roomTypeId_fkey` FOREIGN KEY (`roomTypeId`) REFERENCES `RoomType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
