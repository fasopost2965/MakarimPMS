-- COMMERCIAL-001C.1 — Idempotent data migration for Taxe de Promotion Touristique (TPT)
--
-- Ensures the statutory tax config TPT exists in production databases and has the canonical configuration:
-- mode = 'MONTANT_FIXE', taux = 1.30, actif = true, applicableParDefaut = true, collectePourTresor = true.

UPDATE `TaxRateConfig`
SET `taux` = 1.30,
    `mode` = 'MONTANT_FIXE',
    `actif` = true,
    `applicableParDefaut` = true,
    `collectePourTresor` = true
WHERE `type` = 'TPT';

INSERT INTO `TaxRateConfig` (
  `type`,
  `mode`,
  `taux`,
  `actif`,
  `applicableParDefaut`,
  `collectePourTresor`,
  `actifDepuis`,
  `createdAt`
)
SELECT
  'TPT',
  'MONTANT_FIXE',
  1.30,
  true,
  true,
  true,
  NOW(3),
  NOW(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `TaxRateConfig` WHERE `type` = 'TPT'
);
