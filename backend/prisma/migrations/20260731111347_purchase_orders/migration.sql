-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('CHANGE_CATEGORY', 'BLACKLIST_CLIENT', 'UPDATE_PRICE', 'CANCEL_RESERVATION', 'UPDATE_HOTEL_CONFIG', 'UPDATE_TAX_RATE', 'CREATE_TAX_RATE', 'CREATE_SEASON_RATE', 'UPDATE_SEASON_RATE', 'DELETE_SEASON_RATE', 'ADJUST_TIME_SHIFT', 'INVALIDATE_TIME_SHIFT', 'AUTO_CLOSE_TIME_SHIFT', 'VALIDATE_PAYSLIP', 'CREATE_POLICE_RECORD', 'CREATE_DEPOSIT', 'IMPUTE_DEPOSIT', 'REFUND_DEPOSIT', 'EXCLUDE_FOLIO_TAX', 'CREATE_CANCELLATION_POLICY', 'UPDATE_CANCELLATION_POLICY', 'MARK_NO_SHOW', 'CREATE_RATE_RESTRICTION', 'UPDATE_RATE_RESTRICTION', 'DELETE_RATE_RESTRICTION', 'CREATE_NOTIFICATION_TEMPLATE', 'UPDATE_NOTIFICATION_TEMPLATE', 'CREATE_CHANNEL_ROOM_TYPE_MAPPING', 'DELETE_CHANNEL_ROOM_TYPE_MAPPING', 'CREATE_CREDIT_NOTE', 'FORCE_CHECKOUT', 'CREATE_ROOM', 'UPDATE_ROOM', 'DELETE_ROOM', 'CREATE_ROOM_TYPE', 'UPDATE_ROOM_TYPE', 'CANCEL_FOLIO_LINE', 'CREATE_RESTAURANT_CHARGE', 'FORCE_CHECKOUT_RESTAURANT', 'CREATE_SUPPLIER', 'UPDATE_SUPPLIER', 'DELETE_SUPPLIER', 'CREATE_PURCHASE_ORDER', 'UPDATE_PURCHASE_ORDER', 'SUBMIT_PURCHASE_ORDER', 'VALIDATE_PURCHASE_ORDER', 'CANCEL_PURCHASE_ORDER') NOT NULL,
    MODIFY `targetEntity` ENUM('Guest', 'Reservation', 'Stay', 'Room', 'Payment', 'Invoice', 'HotelConfig', 'TaxRateConfig', 'SeasonRate', 'TimeShift', 'PaySlip', 'POLICE_RECORD', 'RESERVATION_DEPOSIT', 'Folio', 'CancellationPolicy', 'RateRestriction', 'NotificationTemplate', 'ChannelRoomTypeMapping', 'RoomType', 'FolioLine', 'Supplier', 'PurchaseOrder') NOT NULL;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(191) NOT NULL,
    `adresse` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `telephone` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `Supplier_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(191) NOT NULL,
    `supplierId` INTEGER NOT NULL,
    `statut` ENUM('BROUILLON', 'EN_ATTENTE_VALIDATION', 'VALIDEE', 'ANNULEE') NOT NULL DEFAULT 'BROUILLON',
    `demandeur` VARCHAR(191) NOT NULL,
    `dateLivraisonSouhaitee` DATETIME(3) NULL,
    `createdById` INTEGER NOT NULL,
    `validatedById` INTEGER NULL,
    `validatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PurchaseOrder_numero_key`(`numero`),
    INDEX `PurchaseOrder_deletedAt_idx`(`deletedAt`),
    INDEX `PurchaseOrder_supplierId_idx`(`supplierId`),
    INDEX `PurchaseOrder_statut_idx`(`statut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrderLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseOrderId` INTEGER NOT NULL,
    `stockItemId` INTEGER NULL,
    `reference` VARCHAR(191) NULL,
    `designation` VARCHAR(191) NOT NULL,
    `quantite` INTEGER NOT NULL,
    `prixUnitaire` DECIMAL(10, 2) NOT NULL,
    `montant` DECIMAL(10, 2) NOT NULL,

    INDEX `PurchaseOrderLine_purchaseOrderId_idx`(`purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_validatedById_fkey` FOREIGN KEY (`validatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderLine` ADD CONSTRAINT `PurchaseOrderLine_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderLine` ADD CONSTRAINT `PurchaseOrderLine_stockItemId_fkey` FOREIGN KEY (`stockItemId`) REFERENCES `StockItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

