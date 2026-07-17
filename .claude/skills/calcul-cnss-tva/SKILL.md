---
name: calcul-cnss-tva
description: Encapsule les calculs CNSS (cotisations salarié/employeur par branche, plafonds), TVA hôtelière (10 %/20 %) et taxe de séjour, toujours à partir des tables de config CnssRateConfig/TaxRateConfig — jamais de taux codé en dur. Utiliser pour tout calcul de bulletin de paie, de facture ou de ligne de folio impliquant un taux.
---

# Calcul CNSS / TVA / taxe de séjour

Ce skill encapsule les formules de calcul de charges et de taxes du PMS Hôtel Makarim. Règle absolue : **aucun taux métier (CNSS, TVA, taxe de séjour) ne doit jamais être une constante dans le code appelant** — toujours lu depuis la base (`docs/plan-execution-claude-code.md` §8).

## Sources de vérité (tables de config)

- `CnssRateConfig` (backend/prisma/schema.prisma) : `branche`, `tauxEmployeur`, `tauxSalarie`, `plafondMensuel` (nullable = sans plafond), `applicableDepuis`.
- `TaxRateConfig` : `type` (`TVA_HEBERGEMENT` | `TVA_ANNEXE` | `TAXE_SEJOUR`), `taux`, `applicableA`, `actifDepuis`.

Toujours sélectionner la ligne de config **active à la date du calcul** (`applicableDepuis`/`actifDepuis` <= date de la période), pas seulement la dernière insérée.

## Calcul CNSS (module `hr-payroll`, 5.12)

1. Pour chaque `branche` active, appliquer le taux salarié/employeur au salaire brut de la période.
2. Si `plafondMensuel` est renseigné, plafonner l'assiette de cotisation de cette branche avant d'appliquer le taux.
3. Sommer les cotisations salarié → `Payslip.cotisationsSalarie` ; sommer les cotisations employeur → `Payslip.cotisationsEmployeur`.
4. `Payslip.net = Payslip.brut - Payslip.cotisationsSalarie`.
5. Ne jamais régénérer un `Payslip` déjà émis : toute correction passe par un nouveau bulletin ou un ajustement tracé (cohérent avec la règle 4 de `CLAUDE.md` — trace d'audit).

## Calcul TVA hôtelière et taxe de séjour (module `billing`, 5.13)

1. Chaque `FolioLine` porte son propre `tauxTva`, résolu depuis `TaxRateConfig` au moment de la création de la ligne (ne pas recalculer rétroactivement si le taux change ensuite — la ligne garde le taux appliqué à sa création).
2. `TVA_HEBERGEMENT` s'applique aux lignes de type `HEBERGEMENT` ; `TVA_ANNEXE` aux lignes `EXTRA` ; `TAXE_SEJOUR` est une ligne dédiée de type `TAXE_SEJOUR`, calculée en fonction du nombre de nuitées/personnes selon la config `applicableA`.
3. Le montant TTC d'une facture (`Invoice.montantTotal`) est la somme des lignes de folio non annulées (`annulee = false`) du ou des folios facturés.

## À ne jamais faire

- Écrire `0.10`, `0.20`, un pourcentage CNSS ou un montant de taxe de séjour en dur dans un service, un DTO ou un composant frontend.
- Modifier une ligne de folio ou un bulletin de paie déjà émis au lieu de créer une correction tracée (avoir, ajustement).
- Calculer un taux applicable sans vérifier sa date d'entrée en vigueur.
