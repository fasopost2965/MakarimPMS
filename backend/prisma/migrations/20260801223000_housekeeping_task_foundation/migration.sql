-- HK-P1-03A — fondation structurelle des tâches Housekeeping.
-- Le backfill des chambres existantes est volontairement séparé et doit être
-- exécuté par prisma/scripts/backfill-housekeeping-tasks.ts.

-- AlterTable
ALTER TABLE `AuditLog`
    MODIFY `action` ENUM('CHANGE_CATEGORY', 'BLACKLIST_CLIENT', 'UPDATE_PRICE', 'CANCEL_RESERVATION', 'UPDATE_HOTEL_CONFIG', 'UPDATE_TAX_RATE', 'CREATE_TAX_RATE', 'CREATE_SEASON_RATE', 'UPDATE_SEASON_RATE', 'DELETE_SEASON_RATE', 'ADJUST_TIME_SHIFT', 'INVALIDATE_TIME_SHIFT', 'AUTO_CLOSE_TIME_SHIFT', 'VALIDATE_PAYSLIP', 'CREATE_POLICE_RECORD', 'CREATE_DEPOSIT', 'IMPUTE_DEPOSIT', 'REFUND_DEPOSIT', 'EXCLUDE_FOLIO_TAX', 'CREATE_CANCELLATION_POLICY', 'UPDATE_CANCELLATION_POLICY', 'MARK_NO_SHOW', 'CREATE_RATE_RESTRICTION', 'UPDATE_RATE_RESTRICTION', 'DELETE_RATE_RESTRICTION', 'CREATE_NOTIFICATION_TEMPLATE', 'UPDATE_NOTIFICATION_TEMPLATE', 'CREATE_CHANNEL_ROOM_TYPE_MAPPING', 'DELETE_CHANNEL_ROOM_TYPE_MAPPING', 'CREATE_CREDIT_NOTE', 'FORCE_CHECKOUT', 'CREATE_ROOM', 'UPDATE_ROOM', 'DELETE_ROOM', 'CREATE_ROOM_TYPE', 'UPDATE_ROOM_TYPE', 'CANCEL_FOLIO_LINE', 'CREATE_RESTAURANT_CHARGE', 'FORCE_CHECKOUT_RESTAURANT', 'CREATE_SUPPLIER', 'UPDATE_SUPPLIER', 'DELETE_SUPPLIER', 'CREATE_PURCHASE_ORDER', 'UPDATE_PURCHASE_ORDER', 'SUBMIT_PURCHASE_ORDER', 'VALIDATE_PURCHASE_ORDER', 'CANCEL_PURCHASE_ORDER', 'REASSIGN_HOUSEKEEPING_TASK', 'CANCEL_HOUSEKEEPING_TASK', 'VALIDATE_HOUSEKEEPING_TASK', 'REFUSE_HOUSEKEEPING_TASK', 'REOPEN_HOUSEKEEPING_TASK') NOT NULL,
    MODIFY `targetEntity` ENUM('Guest', 'Reservation', 'Stay', 'Room', 'Payment', 'Invoice', 'HotelConfig', 'TaxRateConfig', 'SeasonRate', 'TimeShift', 'PaySlip', 'POLICE_RECORD', 'RESERVATION_DEPOSIT', 'Folio', 'CancellationPolicy', 'RateRestriction', 'NotificationTemplate', 'ChannelRoomTypeMapping', 'RoomType', 'FolioLine', 'Supplier', 'PurchaseOrder', 'HousekeepingTask') NOT NULL;

-- CreateTable
CREATE TABLE `HousekeepingTask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `roomId` INTEGER NOT NULL,
    `assignedUserId` INTEGER NULL,
    `statut` ENUM('A_FAIRE', 'AFFECTEE', 'EN_COURS', 'TERMINEE', 'VALIDEE', 'ANNULEE') NOT NULL DEFAULT 'A_FAIRE',
    `origine` ENUM('CHECKOUT', 'MANUELLE', 'REPRISE') NOT NULL,
    `sourceEventKey` VARCHAR(64) NULL,
    `activeRoomKey` INTEGER NULL,
    `assignedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `validatedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HousekeepingTask_sourceEventKey_key`(`sourceEventKey`),
    UNIQUE INDEX `HousekeepingTask_activeRoomKey_key`(`activeRoomKey`),
    INDEX `HousekeepingTask_roomId_createdAt_idx`(`roomId`, `createdAt`),
    INDEX `HousekeepingTask_statut_idx`(`statut`),
    INDEX `HousekeepingTask_assignedUserId_statut_idx`(`assignedUserId`, `statut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HousekeepingTaskLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` INTEGER NOT NULL,
    `type` ENUM('CREATION', 'AFFECTATION', 'REAFFECTATION', 'RETRAIT_AFFECTATION', 'DEMARRAGE', 'COMPLETION', 'VALIDATION', 'REFUS_CONTROLE', 'ANNULATION', 'REOUVERTURE') NOT NULL,
    `actorUserId` INTEGER NULL,
    `ancienStatut` ENUM('A_FAIRE', 'AFFECTEE', 'EN_COURS', 'TERMINEE', 'VALIDEE', 'ANNULEE') NULL,
    `nouveauStatut` ENUM('A_FAIRE', 'AFFECTEE', 'EN_COURS', 'TERMINEE', 'VALIDEE', 'ANNULEE') NULL,
    `ancienAssignedUserId` INTEGER NULL,
    `nouveauAssignedUserId` INTEGER NULL,
    `ancienAssignedUserNom` VARCHAR(191) NULL,
    `nouveauAssignedUserNom` VARCHAR(191) NULL,
    `actorUserNom` VARCHAR(191) NULL,
    `motif` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HousekeepingTaskLog_taskId_createdAt_idx`(`taskId`, `createdAt`),
    INDEX `HousekeepingTaskLog_actorUserId_idx`(`actorUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HousekeepingTask`
    ADD CONSTRAINT `HousekeepingTask_roomId_fkey`
    FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HousekeepingTask`
    ADD CONSTRAINT `HousekeepingTask_assignedUserId_fkey`
    FOREIGN KEY (`assignedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HousekeepingTaskLog`
    ADD CONSTRAINT `HousekeepingTaskLog_taskId_fkey`
    FOREIGN KEY (`taskId`) REFERENCES `HousekeepingTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HousekeepingTaskLog`
    ADD CONSTRAINT `HousekeepingTaskLog_actorUserId_fkey`
    FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Permission additive : sur une base déjà seedée, accorder le contrôle aux
-- deux rôles validés uniquement. Sur une base vierge, le seed rejouable crée
-- ensuite les rôles et leurs attributions.
INSERT INTO `Permission` (`module`, `action`)
VALUES ('housekeeping', 'control')
ON DUPLICATE KEY UPDATE `id` = `id`;

INSERT INTO `RolePermission` (`roleId`, `permissionId`)
SELECT `Role`.`id`, `Permission`.`id`
FROM `Role`
JOIN `Permission`
  ON `Permission`.`module` = 'housekeeping'
 AND `Permission`.`action` = 'control'
WHERE `Role`.`nom` IN ('Administrateur', 'Gouvernante')
ON DUPLICATE KEY UPDATE `roleId` = `roleId`;
