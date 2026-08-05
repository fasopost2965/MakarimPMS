-- GL-003: HotelConfig.paiementImmediatProlongationObligatoire
-- Quand actif, une prolongation de séjour (StayService.extendStay) n'est
-- appliquée que si le crédit disponible du folio couvre déjà le supplément.
ALTER TABLE `HotelConfig` ADD COLUMN `paiementImmediatProlongationObligatoire` BOOLEAN NOT NULL DEFAULT false;
