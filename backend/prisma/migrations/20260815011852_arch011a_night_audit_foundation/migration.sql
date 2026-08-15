-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('CHANGE_CATEGORY', 'BLACKLIST_CLIENT', 'UPDATE_PRICE', 'CANCEL_RESERVATION', 'UPDATE_HOTEL_CONFIG', 'UPDATE_TAX_RATE', 'CREATE_TAX_RATE', 'CREATE_SEASON_RATE', 'UPDATE_SEASON_RATE', 'DELETE_SEASON_RATE', 'ADJUST_TIME_SHIFT', 'INVALIDATE_TIME_SHIFT', 'AUTO_CLOSE_TIME_SHIFT', 'VALIDATE_PAYSLIP', 'CREATE_POLICE_RECORD', 'CREATE_DEPOSIT', 'IMPUTE_DEPOSIT', 'REFUND_DEPOSIT', 'EXCLUDE_FOLIO_TAX', 'CREATE_CANCELLATION_POLICY', 'UPDATE_CANCELLATION_POLICY', 'MARK_NO_SHOW', 'CREATE_RATE_RESTRICTION', 'UPDATE_RATE_RESTRICTION', 'DELETE_RATE_RESTRICTION', 'CREATE_NOTIFICATION_TEMPLATE', 'UPDATE_NOTIFICATION_TEMPLATE', 'CREATE_CHANNEL_ROOM_TYPE_MAPPING', 'DELETE_CHANNEL_ROOM_TYPE_MAPPING', 'CREATE_CREDIT_NOTE', 'FORCE_CHECKOUT', 'CREATE_ROOM', 'UPDATE_ROOM', 'DELETE_ROOM', 'CREATE_ROOM_TYPE', 'UPDATE_ROOM_TYPE', 'CANCEL_FOLIO_LINE', 'CREATE_RESTAURANT_CHARGE', 'FORCE_CHECKOUT_RESTAURANT', 'CREATE_SUPPLIER', 'UPDATE_SUPPLIER', 'DELETE_SUPPLIER', 'CREATE_PURCHASE_ORDER', 'UPDATE_PURCHASE_ORDER', 'SUBMIT_PURCHASE_ORDER', 'VALIDATE_PURCHASE_ORDER', 'CANCEL_PURCHASE_ORDER', 'REASSIGN_HOUSEKEEPING_TASK', 'CANCEL_HOUSEKEEPING_TASK', 'VALIDATE_HOUSEKEEPING_TASK', 'REFUSE_HOUSEKEEPING_TASK', 'REOPEN_HOUSEKEEPING_TASK', 'CHANGE_ROOM', 'EXTEND_STAY', 'RECONCILE_TAXE_SEJOUR', 'NIGHT_AUDIT_STARTED', 'NIGHT_AUDIT_WARNING_ACKNOWLEDGED', 'NIGHT_AUDIT_POSTING_COMPLETED', 'NIGHT_AUDIT_RECONCILIATED', 'BUSINESS_DAY_CLOSED', 'BUSINESS_DAY_OPENED') NOT NULL,
    MODIFY `targetEntity` ENUM('Guest', 'Reservation', 'Stay', 'Room', 'Payment', 'Invoice', 'HotelConfig', 'TaxRateConfig', 'SeasonRate', 'TimeShift', 'PaySlip', 'POLICE_RECORD', 'RESERVATION_DEPOSIT', 'Folio', 'CancellationPolicy', 'RateRestriction', 'NotificationTemplate', 'ChannelRoomTypeMapping', 'RoomType', 'FolioLine', 'Supplier', 'PurchaseOrder', 'HousekeepingTask', 'BusinessDay', 'NightAuditRun', 'NightAuditException') NOT NULL;

-- AlterTable
ALTER TABLE `HotelConfig` ADD COLUMN `timezone` VARCHAR(191) NOT NULL DEFAULT 'Africa/Casablanca';

-- CreateTable
CREATE TABLE `BusinessDay` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `status` ENUM('OPEN', 'CLOSING', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `openLock` INTEGER NULL,
    `openedAt` DATETIME(3) NULL,
    `openedByUserId` INTEGER NULL,
    `closedAt` DATETIME(3) NULL,
    `closedByUserId` INTEGER NULL,
    `source` ENUM('SYSTEM_BOOTSTRAP', 'NIGHT_AUDIT') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BusinessDay_date_key`(`date`),
    UNIQUE INDEX `BusinessDay_openLock_key`(`openLock`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NightAuditRun` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessDayId` INTEGER NOT NULL,
    `status` ENUM('PRECHECK', 'EXCEPTIONS', 'POSTING', 'RECONCILIATION', 'CLOSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PRECHECK',
    `activeBusinessDayKey` INTEGER NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedByUserId` INTEGER NULL,
    `completedAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `error` TEXT NULL,
    `reportVersion` INTEGER NULL,
    `reportSnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NightAuditRun_activeBusinessDayKey_key`(`activeBusinessDayKey`),
    INDEX `NightAuditRun_businessDayId_idx`(`businessDayId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NightAuditStep` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `runId` INTEGER NOT NULL,
    `type` ENUM('PRECHECK', 'POSTING_FOUNDATION', 'RECONCILIATION', 'CLOSING') NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `attempt` INTEGER NOT NULL DEFAULT 1,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NightAuditStep_idempotencyKey_key`(`idempotencyKey`),
    INDEX `NightAuditStep_runId_idx`(`runId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NightAuditException` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `runId` INTEGER NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `severity` ENUM('BLOCKER', 'WARNING', 'INFO') NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` INTEGER NULL,
    `status` ENUM('OPEN', 'RESOLVED', 'ACKNOWLEDGED') NOT NULL DEFAULT 'OPEN',
    `message` TEXT NOT NULL,
    `detectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `acknowledgedByUserId` INTEGER NULL,
    `acknowledgementReason` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NightAuditException_runId_idx`(`runId`),
    UNIQUE INDEX `NightAuditException_runId_code_entityType_entityId_key`(`runId`, `code`, `entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BusinessDay` ADD CONSTRAINT `BusinessDay_openedByUserId_fkey` FOREIGN KEY (`openedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessDay` ADD CONSTRAINT `BusinessDay_closedByUserId_fkey` FOREIGN KEY (`closedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NightAuditRun` ADD CONSTRAINT `NightAuditRun_businessDayId_fkey` FOREIGN KEY (`businessDayId`) REFERENCES `BusinessDay`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NightAuditRun` ADD CONSTRAINT `NightAuditRun_startedByUserId_fkey` FOREIGN KEY (`startedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NightAuditStep` ADD CONSTRAINT `NightAuditStep_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `NightAuditRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NightAuditException` ADD CONSTRAINT `NightAuditException_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `NightAuditRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NightAuditException` ADD CONSTRAINT `NightAuditException_acknowledgedByUserId_fkey` FOREIGN KEY (`acknowledgedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ARCH-011A note : `prisma migrate dev` avait initialement généré 4
-- instructions RenameIndex supplémentaires ici (HousekeepingStockConsumption/
-- StockMovement) — pur bruit de drift de nommage préexistant sur
-- origin/main (les index de la migration 20260812000100 ont des noms
-- raccourcis manuellement pour respecter la limite MySQL de 64 caractères,
-- différents du nom par défaut que Prisma générerait). Retirées
-- volontairement : hors périmètre ARCH-011A, aucune migration historique
-- ne doit être modifiée ni un renommage d'index sans rapport ajouté à cette
-- migration.
