-- CH-013 (docs/governance/REGISTRE_CHANTIERS.md, RD-012) : retrait de la
-- valeur d'enum morte ANNULE (jamais écrite en base, aucun cas d'usage
-- réel et stable défini).
ALTER TABLE `Stay` MODIFY `statut` ENUM('EN_COURS', 'CHECKOUT') NOT NULL DEFAULT 'EN_COURS';
