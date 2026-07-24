-- CH-025 (docs/governance/REGISTRE_CHANTIERS.md, Phase 3 §3.4 de l'audit) :
-- contraintes CHECK natives MySQL 8, non représentables dans le schéma
-- Prisma (aucun attribut `@check`) — migration manuelle, comme
-- explicitement anticipé par l'audit ("Prisma/MySQL le permettrait via
-- dbgenerated ou migration manuelle, non utilisé ici"). Défense en
-- profondeur uniquement : chaque invariant ci-dessous est déjà porté par la
-- couche service (ex. `ReservationsService.assertDateRangeValid`), ces
-- contraintes empêchent seulement qu'une écriture Prisma directe
-- (script, migration de données, bug applicatif futur) les contourne.
--
-- Non gérées par `prisma migrate dev`/`db push` (fonctionnalité non
-- supportée par le schéma Prisma) : elles survivent aux migrations futures
-- tant qu'aucune migration ne recrée la table (DROP/CREATE) sans les
-- reporter explicitement.

-- Reservation : un séjour ne peut jamais avoir une date de départ
-- antérieure ou égale à la date d'arrivée (ReservationsService.assertDateRangeValid
-- applique déjà ce contrôle applicatif — même invariant, ceinture et
-- bretelles).
ALTER TABLE `Reservation`
  ADD CONSTRAINT `chk_reservation_dates`
  CHECK (`dateDepart` > `dateArrivee`);

-- Payment : aucun règlement à montant nul ou négatif. Gap réel identifié en
-- écrivant cette migration : `CreatePaymentDto.montant` n'a aujourd'hui
-- aucune contrainte de positivité côté DTO (`@IsDecimal` seul) — cette
-- contrainte DB comble ce trou tant qu'un correctif DTO n'est pas fait
-- séparément (hors périmètre de CH-025, qui porte sur la base, pas les DTO).
ALTER TABLE `Payment`
  ADD CONSTRAINT `chk_payment_montant_positif`
  CHECK (`montant` > 0);

-- FolioLine : invariant réel du code (vérifié dans billing/payments avant
-- cette migration) — TOUTE ligne de folio, quel que soit son
-- `TypeLigneFolio` (HEBERGEMENT/EXTRA/TAXE_SEJOUR/PAIEMENT), est toujours
-- écrite avec un montant positif ou nul, jamais négatif ; `computeSoldeDu`
-- (`stay/utils/solde.ts`) est seul responsable de traiter les lignes
-- PAIEMENT comme des débits (soustraction), jamais en inversant le signe
-- stocké. Contrainte volontairement inconditionnelle (pas de CASE sur
-- `type`) plutôt que la formulation "PAIEMENT en négatif" envisagée par
-- l'audit initial (Phase 3 §3.4) — cette dernière ne correspond pas au
-- comportement réel du code, vérifié avant d'écrire cette migration.
-- `>= 0` plutôt que `> 0` (contrairement à Payment ci-dessus) : un montant
-- nul est un cas réel rencontré en écrivant cette migration (suite e2e
-- `billing.e2e-spec.ts` — une ligne TAXE_SEJOUR calculée sur un séjour
-- fixture à 0 nuit facturable). `> 0` aurait rejeté ce cas légitime en
-- plus des vraies erreurs (montants négatifs) que cette contrainte cible.
ALTER TABLE `FolioLine`
  ADD CONSTRAINT `chk_folioline_montant_positif`
  CHECK (`montant` >= 0);

-- TimeShiftSegment : une fin de segment ne peut jamais précéder son début.
-- Gap réel identifié en écrivant cette migration : `AttendanceService.ajusterSegment`
-- (correction manuelle RH, ADR-007 §6.4) ne validait jusqu'ici aucune
-- cohérence entre `nouveauDebut`/`nouvelleFin` avant écriture — cette
-- contrainte DB comble ce trou. `fin` reste NULL tant que le segment est en
-- cours (ADR-007) : la contrainte l'autorise explicitement.
ALTER TABLE `TimeShiftSegment`
  ADD CONSTRAINT `chk_timeshiftsegment_fin_apres_debut`
  CHECK (`fin` IS NULL OR `fin` >= `debut`);
