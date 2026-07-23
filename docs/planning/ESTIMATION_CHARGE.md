# Estimation de charge — Makarim PMS v1 (post-audit)

Estimation construite en sommant les estimations par chantier déjà posées dans `docs/governance/REGISTRE_CHANTIERS.md` (chaque chiffre y est individuellement justifié et sourcé) — pas un chiffre global inventé. Unité : **jour-développeur** (durée de travail effectif d'un développeur à temps plein, hors réunions/interruptions). La conversion en temps calendaire dépend du nombre de personnes mobilisées en parallèle — donnée explicitement comme hypothèse, pas comme un fait.

**Hypothèse de base commune aux 3 scénarios** : un seul développeur backend et un seul développeur frontend, travaillant en parallèle sur des lots indépendants quand la dépendance le permet (ex. Lot 0 frontend peut démarrer pendant que le backend traite CH-001). Cette hypothèse est **à confirmer** selon les ressources réellement disponibles.

---

## Scénario prudent

| Poste | Jours-développeur |
|---|---|
| Backend — chantiers bloquants (CH-001, CH-002, CH-004 implémenté) | 8 |
| Backend — chantiers importants (CH-005, CH-006, CH-010, CH-011 partie backend, CH-012) | 9,5 |
| Backend — chantiers secondaires retenus (CH-013, CH-014, CH-018, CH-019, CH-024, CH-025) | 8 |
| Frontend — Lots 0 à 6 | 20 |
| Frontend — Lot 7 (financier, dépend du backend) | 2 |
| Stabilisation/régression (notamment post-CH-006, suite e2e complète) | 5 |
| Documentation continue (mise à jour matrice de traçabilité, statut modules à chaque clôture) | 2 |
| **Total** | **≈ 54,5 jours-développeur** |

**Durée calendaire estimée** : ≈ 11-12 semaines à un développeur équivalent temps plein par filière ; ≈ 6-7 semaines avec un backend et un frontend en parallèle (hypothèse de base).

**Hypothèses** : CH-004 est implémenté (pas seulement accepté comme risque) ; tous les chantiers secondaires retenus sont traités ; CH-016, CH-017 (couverture de tests étendue), CH-021, CH-023, CH-026 restent **hors de ce chiffrage** (traités comme continus/conditionnels, non bornés — voir §Hors périmètre).

**Dépendances** : CH-012 ne démarre qu'après CH-001 ; Lot 3 frontend (gating RBAC) ne démarre qu'après Lot 0 et la livraison backend de CH-011.

**Risques pouvant faire dériver ce scénario** : un arbitrage produit qui tarde (CH-001, CH-004, CH-005, CH-010) bloque le développement correspondant sans consommer de jours-développeur mais allonge le calendaire ; une régression détectée tardivement après CH-006 (soft-delete) pourrait consommer plus que les 5 jours de stabilisation prévus, ce chantier touchant transversalement 12 modèles.

**Degré de confiance** : élevé — ce scénario inclut une marge par construction (choix des bornes hautes des estimations individuelles du registre).

---

## Scénario réaliste

| Poste | Jours-développeur |
|---|---|
| Backend — chantiers bloquants | 5 |
| Backend — chantiers importants | 7 |
| Backend — chantiers secondaires retenus | 5 |
| Frontend — Lots 0 à 6 | 17 |
| Frontend — Lot 7 | 1,5 |
| Stabilisation/régression | 3 |
| Documentation continue | 1 |
| **Total** | **≈ 39,5 jours-développeur** |

**Durée calendaire estimée** : ≈ 8 semaines à un développeur équivalent temps plein par filière ; ≈ 5 semaines avec backend et frontend en parallèle.

**Hypothèses** : les arbitrages produit (CH-001, CH-004, CH-005, CH-010, CH-020, CH-021, CH-023) sont tranchés rapidement (moins d'une semaine chacun) et n'introduisent pas d'allers-retours de conception ; le développeur backend connaît déjà la base de code (pas de montée en compétence supplémentaire à chiffrer) ; CH-004 est implémenté au niveau médian de son estimation.

**Dépendances** : identiques au scénario prudent.

**Risques pouvant faire dériver ce scénario** : découverte d'un nouveau « mécanisme commencé mais inachevé » similaire à ceux déjà identifiés (motif récurrent confirmé Phase 9/10) pendant le développement d'un chantier — l'audit a explicitement noté que d'autres cas de ce type pourraient exister sans avoir été détectés par les 10 phases ; changement de périmètre en cours de route sur un chantier à arbitrage (ex. CH-001 découvert plus complexe qu'anticipé une fois le périmètre exact de l'avoir tranché).

**Degré de confiance** : moyen — c'est le scénario central, mais il repose sur l'hypothèse optimiste que les arbitrages produit ne créent pas de retard, ce qui n'est pas garanti.

---

## Scénario optimiste mais crédible

| Poste | Jours-développeur |
|---|---|
| Backend — chantiers bloquants (CH-004 documenté comme risque accepté, pas implémenté) | 3 |
| Backend — chantiers importants | 5 |
| Backend — chantiers secondaires retenus (quick wins uniquement : CH-013, CH-018, CH-019, CH-024) | 3 |
| Frontend — Lots 0 à 6 (Lot 4/5/6 réduits au strict nécessaire, ex. channel-manager reporté si aucun canal OTA actif) | 14 |
| Frontend — Lot 7 | 1 |
| Stabilisation/régression | 2 |
| Documentation continue | 0,5 |
| **Total** | **≈ 28,5 jours-développeur** |

**Durée calendaire estimée** : ≈ 6 semaines à un développeur équivalent temps plein par filière ; ≈ 3,5-4 semaines avec backend et frontend en parallèle.

**Hypothèses** : CH-004 est documenté comme écart assumé plutôt qu'implémenté (arbitrage rapide en faveur du report, avec date de réexamen) ; CH-009 (channel-manager) est reporté faute de canal OTA actif confirmé ; aucune régression significative ne survient sur CH-006 ; les arbitrages produit sont tranchés en une seule session de décision.

**Dépendances** : identiques, mais le périmètre réduit limite les enchaînements.

**Risques pouvant faire dériver ce scénario** : c'est le scénario le plus sensible à un imprévu — toute régression, tout arbitrage qui traîne, ou toute découverte d'un mécanisme inachevé supplémentaire le fait immédiatement basculer vers le scénario réaliste. Ce n'est pas un scénario à utiliser comme engagement ferme, seulement comme borne basse crédible si tout se passe sans accroc.

**Degré de confiance** : faible-à-moyen — crédible (fondé sur les bornes basses réelles du registre, pas inventé), mais dépend de plusieurs conditions favorables simultanées.

---

## Hors périmètre de ce chiffrage (volontairement, pas un oubli)

- **CH-016** (découpage `ReservationsService`) : 3-5 jours si entrepris, mais non urgent (Phase 9/10) — à chiffrer séparément le jour où il est engagé.
- **CH-017** (couverture de tests unitaires de service) : pratique continue, pas un chantier borné — son coût est distribué sur chaque futur chantier plutôt que concentré ici.
- **CH-021** (city ledger) : 3-5 jours si retenu, mais dépend d'un arbitrage stratégique (priorité commerciale entreprise) hors du périmètre de cet audit.
- **CH-023** (matérialisation financière des pénalités) : dépend d'un arbitrage produit non tranché.
- **CH-026** (durcissement sécurité secondaire, 6 sous-points) : 3-5 jours cumulés, à répartir librement dans le temps, sans dépendance avec le reste.

Inclure ces 5 postes dans un chiffrage global ajouterait entre 9 et 18 jours-développeur supplémentaires selon lesquels sont retenus — **à ajouter explicitement si le pilotage décide de les inclure dans le périmètre de cette trajectoire plutôt que de les traiter au fil de l'eau**.

## Ce que cette estimation ne couvre pas

- Le temps de revue de code / validation humaine (dépend de l'organisation de l'équipe, non déductible du code).
- Le déploiement en production réel (couvert par `docs/execution/GO_LIVE_CHECKLIST.md` et `docs/deploiement-vps` — processus déjà existant, indépendant de cette trajectoire).
- Une éventuelle formation du personnel de l'hôtel aux nouveaux écrans (hors périmètre technique).
