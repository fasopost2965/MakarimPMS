# Registre des écarts assumés — Makarim PMS v1

Ce document consigne les écarts entre l'architecture cible/le code idéal et le code réel qui ont fait l'objet d'une **décision explicite d'acceptation** (report ou abandon assumé), par opposition aux écarts encore ouverts comme chantiers actifs dans `REGISTRE_CHANTIERS.md`. Un écart n'entre ici qu'après arbitrage — tant qu'aucune décision n'a été prise, il reste dans le registre des chantiers ou dans les questions ouvertes d'une phase d'audit.

## EA-001 — City ledger / `Company` non raccordé (CH-021)

- **Chantier source** : CH-021 (`docs/governance/REGISTRE_CHANTIERS.md`)
- **Constat d'audit d'origine** : Phase 2, Phase 3 §5.3 ; `docs/ARCHITECTURE_AUDIT.md` Incohérence #1
- **Décision** : reporté
- **Date de la décision** : session courante
- **Décideur** : utilisateur (voir `REGISTRE_DECISIONS.md`, RD-014)
- **Justification** : la facturation entreprise (raccordement réel de `Company` à `Reservation`/`Invoice`, vérification de `plafondCredit`) n'est pas confirmée comme une priorité commerciale actuelle pour l'Hôtel Makarim — le coût de développement (3–5 jours, touche `reservations`/`billing`/`payments`) n'est pas engagé tant que ce besoin n'est pas avéré.
- **Risque résiduel accepté** : `Company` reste une fiche purement déclarative (contact, ICE) sans aucune garantie de plafond de crédit appliquée — un client entreprise qui dépasserait un plafond convenu hors système ne serait jamais bloqué par le PMS. Jugé tolérable : la facturation entreprise réelle, si elle existe aujourd'hui, se fait hors système (devis/facture manuels), donc ce risque ne dégrade pas un usage actuel, il empêche seulement une automatisation future.
- **Condition de réexamen** : à réexaminer si l'hôtel signe un ou plusieurs contrats entreprise avec facturation différée régulière (city ledger réel), ou si le volume de réservations `canal` entreprise devient significatif.
- **Date de réexamen prévue** : non fixée — déclenchée par un signal métier, pas une échéance calendaire.

## EA-002 — Recouvrement de la pénalité d'annulation/no-show hors PMS (CH-023)

- **Chantier source** : CH-023 (`docs/governance/REGISTRE_CHANTIERS.md`)
- **Constat d'audit d'origine** : Phase 6 §5
- **Décision** : reporté
- **Date de la décision** : session courante
- **Décideur** : utilisateur (voir `REGISTRE_DECISIONS.md`, RD-015)
- **Justification** : `Reservation.montantPenalite` (BR-RES-006) est déjà calculé et figé de façon fiable ; le traduire en écriture financière traçable exigerait d'inventer un mécanisme (aucun `Folio` n'existe pour une réservation annulée avant tout séjour, ADR-002) pour un besoin que le processus humain actuel (retenue sur acompte existant ou facturation manuelle) couvre déjà en pratique.
- **Risque résiduel accepté** : aucune trace système du recouvrement effectif d'une pénalité — si la réception omet de retenir/facturer manuellement, rien dans le PMS ne le signale. Jugé tolérable : le montant reste visible sur la réservation (`montantPenalite`), donc l'information n'est pas perdue, seul le geste de recouvrement n'est pas tracé.
- **Condition de réexamen** : à réexaminer si le volume d'annulations/no-show avec pénalité calculée devient significatif au point de rendre le suivi manuel peu fiable, ou si un contrôle comptable externe exige une piste d'audit systématique du recouvrement.
- **Date de réexamen prévue** : non fixée — déclenchée par un signal opérationnel, pas une échéance calendaire.

## EA-003 — Numérotation de facture : séquence continue conservée (CH-020)

- **Chantier source** : CH-020 (`docs/governance/REGISTRE_CHANTIERS.md`)
- **Constat d'audit d'origine** : Phase 6 §3
- **Décision** : abandonné *(l'alternative envisagée — remise à zéro mensuelle — est écartée, pas le comportement actuel qui n'a jamais été non conforme)*
- **Date de la décision** : session courante
- **Décideur** : utilisateur (voir `REGISTRE_DECISIONS.md`, RD-013)
- **Justification** : la remise à zéro mensuelle était une préférence comptable envisagée, jamais une exigence documentée — l'utilisateur confirme que la séquence continue actuelle est suffisante.
- **Risque résiduel accepté** : aucun — il ne s'agit pas d'un écart fonctionnel, seulement de la fermeture formelle d'une alternative qui ne sera pas développée.
- **Condition de réexamen** : à réexaminer si une exigence comptable/fiscale marocaine explicite impose une remise à zéro périodique de la numérotation.
- **Date de réexamen prévue** : non fixée.

## Historique (structuration post-audit)

Aucune entrée n'existait dans ce registre au moment de la structuration post-audit (session Claude 1) — la totalité des écarts identifiés par l'audit étaient, à ce stade, soit des chantiers ouverts (`REGISTRE_CHANTIERS.md`), soit des questions ouvertes non tranchées (dans les phases d'audit elles-mêmes, `docs/audits/`). Les trois premières entrées ci-dessus (EA-001 à EA-003) sont les premières décisions effectivement actées, à la suite d'un arbitrage utilisateur explicite (session courante).

## Gabarit à utiliser pour chaque écart assumé

```
### EA-0XX — <Titre de l'écart>

- **Chantier source** : CH-0XX (docs/governance/REGISTRE_CHANTIERS.md)
- **Constat d'audit d'origine** : docs/audits/PHASE_0X_....md, §X
- **Décision** : reporté / abandonné
- **Date de la décision** :
- **Décideur** :
- **Justification** : (pourquoi ce report/abandon est acceptable maintenant)
- **Risque résiduel accepté** : (reprendre le risque du REGISTRE_RISQUES.md concerné, expliciter pourquoi il est jugé tolérable)
- **Condition de réexamen** : (ex. "à réexaminer si le volume de réservations OTA dépasse X/mois", "à réexaminer avant toute ouverture à une seconde propriété", "à réexaminer dans 6 mois")
- **Date de réexamen prévue** :
```

## Candidats probables à cette catégorie (à trancher, pas encore décidés)

- ~~CH-004~~ (chiffrement PII) — retiré de cette liste : l'arbitrage a tranché en faveur de l'implémentation immédiate, pas de l'acceptation de risque (voir `REGISTRE_DECISIONS.md`, RD-006 ; chantier terminé, `REGISTRE_CHANTIERS.md`).
- ~~CH-020~~ (numérotation de facture mensuelle) — retiré de cette liste : tranché (séquence continue conservée), voir EA-003 ci-dessus.
- ~~CH-021~~ (city ledger / `Company`) — retiré de cette liste : tranché (reporté), voir EA-001 ci-dessus.
- ~~CH-023~~ (matérialisation financière des pénalités) — retiré de cette liste : tranché (reporté), voir EA-002 ci-dessus.
- **Multi-folio (ADR-002) vs folio unique en pratique** — seul candidat encore ouvert : alternative légitime consistant à acter formellement le folio unique comme la réalité opérationnelle voulue, et mettre à jour ADR-002 en conséquence plutôt que de laisser un schéma plus permissif que l'usage réel (voir `REGISTRE_DECISIONS.md`) — non soumis à arbitrage dans la série de questions tranchée en session courante.

## Règle d'usage

Ne jamais retirer un chantier de `REGISTRE_CHANTIERS.md` en le remplaçant silencieusement par une entrée ici sans que la décision n'ait été réellement prise par une personne habilitée (pas par une IA de manière autonome) — ce registre documente des décisions humaines, pas des suppositions.
