-- DropForeignKey
ALTER TABLE `NotificationLog` DROP FOREIGN KEY `NotificationLog_guestId_fkey`;

-- DropForeignKey
ALTER TABLE `NotificationLog` DROP FOREIGN KEY `NotificationLog_reservationId_fkey`;

-- AddForeignKey
ALTER TABLE `NotificationLog` ADD CONSTRAINT `NotificationLog_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationLog` ADD CONSTRAINT `NotificationLog_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
