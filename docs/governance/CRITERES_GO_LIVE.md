# Critères de go-live — Makarim PMS v1

Conditions vérifiables avant toute ouverture en production réelle (clients payants, données réelles). Chaque critère est relié à un chantier du registre — un critère non satisfait bloque le go-live jusqu'à ce qu'il soit soit rempli, soit formellement accepté comme risque (voir `ECARTS_ASSUMES.md`).

## Critères bloquants (aucune exception sans acceptation formelle documentée)

- [x] **CH-001 livré** : une facture émise erronée peut être corrigée via un avoir, sans jamais modifier la facture d'origine. *(Terminé — session courante, avoir total, voir `docs/governance/REGISTRE_CHANTIERS.md`.)*
- [x] **CH-002 livré** : `POST /auth/forgot-password` n'expose plus jamais de token dans sa réponse HTTP ; l'envoi passe par email. *(Terminé — session courante, voir `docs/governance/REGISTRE_CHANTIERS.md`.)*
- [x] **CH-003 livré** : la réception peut saisir un `PoliceRecord` complet depuis l'interface, sans appel API manuel. *(Terminé — session courante, voir `docs/governance/REGISTRE_CHANTIERS.md`. Les 4 chantiers bloquants CH-001 à CH-004 sont désormais tous cochés.)*
- [x] **CH-004 tranché** : soit le chiffrement de `Guest.pieceIdentite` est implémenté et vérifié, soit une acceptation de risque formelle est consignée dans `ECARTS_ASSUMES.md` avec date de réexamen. *(Terminé — session courante, implémenté (AES-256-GCM), voir `docs/governance/REGISTRE_CHANTIERS.md`.)*

## Critères importants (fortement recommandés avant un lancement à pleine charge, tolérables pour un lancement pilote contrôlé si documentés comme dette assumée à court terme)

- [x] CH-005 : le check-out avec solde impayé est bloqué (`ConflictException`), échappatoire de check-out forcé réservée à `checkin:force-checkout` — **terminé, session courante**.
- [ ] CH-010 : une garde contre la duplication de fiche client existe (dure ou souple selon arbitrage produit).
- [ ] CH-006 : le filtrage soft-delete ne dépend plus uniquement d'une convention manuelle.
- [ ] CH-011 : au minimum, un contexte d'identité/rôle existe côté frontend pour permettre un gating a minima.

## Critères de « done » par chantier (gabarit à appliquer à chaque fiche du registre)

Un chantier n'est **« terminé »** dans `REGISTRE_CHANTIERS.md` que si, cumulativement :

1. Le livrable attendu (champ *Livrable attendu* de la fiche) est implémenté et déployé au moins en environnement de test.
2. Les critères de validation (champ *Critères de validation* de la fiche) sont vérifiés — manuellement ou par test automatisé, selon ce que la fiche prévoit.
3. Un test e2e couvre le scénario nominal si le chantier touche un flux métier critique (paiement, facturation, RBAC, check-in/out) — cohérent avec la politique du projet (`backend/test/*.e2e-spec.ts`, jamais de mock, vraie base MySQL).
4. La documentation impactée est mise à jour (matrice de traçabilité, statut des modules, et tout ADR/spec de module concerné).
5. Pour un chantier de sécurité, de conformité ou touchant l'intégrité financière (CH-001, CH-002, CH-003, CH-004, CH-010), une vérification de non-régression sur le comportement adjacent est faite (ex. CH-002 ne doit pas casser le flux `reset-password` en aval, déjà fonctionnel ; CH-001 ne doit pas casser la génération de facture nominale ni ADR-004, vérifié par la suite e2e complète rejouée sans régression imputable au chantier).

Un chantier ne doit **jamais** être marqué `terminé` sur la seule base d'un « le code compile » ou d'un « ça a l'air de marcher en local sans test » — cohérent avec l'exigence du projet de rigueur (voir `CLAUDE.md`, section Tests, exigence de preuve de sabotage/restore pour les règles non-négociables).

## Ce que ce document n'est pas

Ce n'est pas une checklist opérationnelle de déploiement (secrets, DNS, certificats, sauvegardes) — celle-ci existe déjà et reste valide indépendamment de cet audit : `docs/execution/GO_LIVE_CHECKLIST.md` et `docs/execution/RELEASE_CHECKLIST.md`. Ce document-ci est le **filtre fonctionnel/sécurité issu de l'audit** qui doit être satisfait *avant même* d'entamer la checklist opérationnelle de déploiement — les deux sont complémentaires, pas redondants.
