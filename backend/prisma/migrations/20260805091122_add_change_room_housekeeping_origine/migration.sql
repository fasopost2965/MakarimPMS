-- Add CHANGE_ROOM to OrigineTacheHousekeeping enum
-- GL-002: changement de chambre pendant un séjour (StayService.changeRoom)
ALTER TABLE `HousekeepingTask` MODIFY `origine` ENUM('CHECKOUT','MANUELLE','REPRISE','CHANGE_ROOM') NOT NULL;
