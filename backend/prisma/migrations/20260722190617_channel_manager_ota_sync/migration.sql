-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('CHANGE_CATEGORY', 'BLACKLIST_CLIENT', 'UPDATE_PRICE', 'CANCEL_RESERVATION', 'UPDATE_HOTEL_CONFIG', 'UPDATE_TAX_RATE', 'CREATE_TAX_RATE', 'CREATE_SEASON_RATE', 'UPDATE_SEASON_RATE', 'DELETE_SEASON_RATE', 'ADJUST_TIME_SHIFT', 'INVALIDATE_TIME_SHIFT', 'AUTO_CLOSE_TIME_SHIFT', 'VALIDATE_PAYSLIP', 'CREATE_POLICE_RECORD', 'CREATE_DEPOSIT', 'IMPUTE_DEPOSIT', 'REFUND_DEPOSIT', 'EXCLUDE_FOLIO_TAX', 'CREATE_CANCELLATION_POLICY', 'UPDATE_CANCELLATION_POLICY', 'MARK_NO_SHOW', 'CREATE_RATE_RESTRICTION', 'UPDATE_RATE_RESTRICTION', 'DELETE_RATE_RESTRICTION', 'CREATE_NOTIFICATION_TEMPLATE', 'UPDATE_NOTIFICATION_TEMPLATE', 'CREATE_CHANNEL_ROOM_TYPE_MAPPING', 'DELETE_CHANNEL_ROOM_TYPE_MAPPING') NOT NULL,
    MODIFY `targetEntity` ENUM('Guest', 'Reservation', 'Stay', 'Room', 'Payment', 'Invoice', 'HotelConfig', 'TaxRateConfig', 'SeasonRate', 'TimeShift', 'PaySlip', 'POLICE_RECORD', 'RESERVATION_DEPOSIT', 'Folio', 'CancellationPolicy', 'RateRestriction', 'NotificationTemplate', 'ChannelRoomTypeMapping') NOT NULL;

-- AlterTable
ALTER TABLE `Reservation` MODIFY `canal` ENUM('WALK_IN', 'DIRECT', 'BOOKING_COM', 'EXPEDIA', 'AIRBNB') NOT NULL DEFAULT 'DIRECT';

-- CreateTable
CREATE TABLE `ChannelRoomTypeMapping` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `canal` ENUM('WALK_IN', 'DIRECT', 'BOOKING_COM', 'EXPEDIA', 'AIRBNB') NOT NULL,
    `externalRoomTypeId` VARCHAR(191) NOT NULL,
    `roomTypeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChannelRoomTypeMapping_canal_externalRoomTypeId_key`(`canal`, `externalRoomTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChannelReservationImport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `canal` ENUM('WALK_IN', 'DIRECT', 'BOOKING_COM', 'EXPEDIA', 'AIRBNB') NOT NULL,
    `otaReservationId` VARCHAR(191) NOT NULL,
    `reservationId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChannelReservationImport_reservationId_key`(`reservationId`),
    UNIQUE INDEX `ChannelReservationImport_canal_otaReservationId_key`(`canal`, `otaReservationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChannelRoomTypeMapping` ADD CONSTRAINT `ChannelRoomTypeMapping_roomTypeId_fkey` FOREIGN KEY (`roomTypeId`) REFERENCES `RoomType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChannelReservationImport` ADD CONSTRAINT `ChannelReservationImport_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
