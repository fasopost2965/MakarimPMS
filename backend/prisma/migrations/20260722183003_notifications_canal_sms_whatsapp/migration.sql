-- AlterTable
ALTER TABLE `NotificationLog` MODIFY `canal` ENUM('EMAIL', 'SMS', 'WHATSAPP') NOT NULL;

-- AlterTable
ALTER TABLE `NotificationTemplate` MODIFY `canal` ENUM('EMAIL', 'SMS', 'WHATSAPP') NOT NULL;
