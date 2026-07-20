/*
  Warnings:

  - Added the required column `folioId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `folioId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_folioId_fkey` FOREIGN KEY (`folioId`) REFERENCES `Folio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
