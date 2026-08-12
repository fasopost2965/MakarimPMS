-- Durable intent and idempotency ledger for automatic welcome-kit consumption.
ALTER TABLE `HousekeepingTask`
  ADD COLUMN `stockCycle` INTEGER NOT NULL DEFAULT 1;

CREATE TABLE `HousekeepingStockConsumption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `housekeepingTaskId` INTEGER NOT NULL,
    `cycle` INTEGER NOT NULL,
    `stockItemId` INTEGER NOT NULL,
    `quantite` INTEGER NOT NULL,
    `statut` ENUM('PENDING', 'DONE', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `erreur` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `processedAt` DATETIME(3) NULL,

    UNIQUE INDEX `HKStockConsumption_task_cycle_item_key`(`housekeepingTaskId`, `cycle`, `stockItemId`),
    INDEX `HKStockConsumption_status_created_idx`(`statut`, `createdAt`),
    INDEX `HKStockConsumption_task_cycle_idx`(`housekeepingTaskId`, `cycle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `StockMovement`
  ADD COLUMN `housekeepingStockConsumptionId` INTEGER NULL;

CREATE UNIQUE INDEX `StockMovement_hkConsumption_key`
  ON `StockMovement`(`housekeepingStockConsumptionId`);

ALTER TABLE `HousekeepingStockConsumption`
  ADD CONSTRAINT `HousekeepingStockConsumption_housekeepingTaskId_fkey`
    FOREIGN KEY (`housekeepingTaskId`) REFERENCES `HousekeepingTask`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `HousekeepingStockConsumption_stockItemId_fkey`
    FOREIGN KEY (`stockItemId`) REFERENCES `StockItem`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `StockMovement`
  ADD CONSTRAINT `StockMovement_housekeepingStockConsumptionId_fkey`
    FOREIGN KEY (`housekeepingStockConsumptionId`) REFERENCES `HousekeepingStockConsumption`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
