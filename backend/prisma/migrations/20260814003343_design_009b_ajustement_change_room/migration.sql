-- DESIGN-009B — ajout de 2 valeurs à l'enum TypeLigneFolio pour matérialiser
-- l'impact tarifaire d'un changement de chambre en cours de séjour
-- (StayService.changeRoom). Additif uniquement : aucune autre modification
-- de schéma (les renommages d'index détectés par `prisma migrate dev` sur
-- HousekeepingStockConsumption/StockMovement relèvent d'une dérive
-- préexistante entre l'historique de migrations et schema.prisma, sans lien
-- avec ce lot — volontairement exclus de cette migration).
-- AlterTable
ALTER TABLE `FolioLine` MODIFY `type` ENUM('HEBERGEMENT', 'EXTRA', 'TAXE_SEJOUR', 'PAIEMENT', 'RESTAURANT', 'AJUSTEMENT_HAUSSE', 'AJUSTEMENT_BAISSE') NOT NULL;
