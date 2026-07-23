# Registre des écarts assumés — Makarim PMS v1

Ce document consigne les écarts entre l'architecture cible/le code idéal et le code réel qui ont fait l'objet d'une **décision explicite d'acceptation** (report ou abandon assumé), par opposition aux écarts encore ouverts comme chantiers actifs dans `REGISTRE_CHANTIERS.md`. Un écart n'entre ici qu'après arbitrage — tant qu'aucune décision n'a été prise, il reste dans le registre des chantiers ou dans les questions ouvertes d'une phase d'audit.

**Aucune entrée n'existe encore dans ce registre au moment de la structuration post-audit** (session Claude 1) — la totalité des écarts identifiés par l'audit sont, à ce stade, soit des chantiers ouverts (`REGISTRE_CHANTIERS.md`), soit des questions ouvertes non tranchées (dans les phases d'audit elles-mêmes, `docs/audits/`). Ce document est créé maintenant, prêt à recevoir les décisions à venir, pour éviter qu'un futur report ne se fasse silencieusement.

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

Les chantiers suivants ont, dans leur fiche du registre, une issue légitime de type « accepter le risque plutôt que développer » — ils sont listés ici comme rappel, mais **restent au statut `à faire` dans `REGISTRE_CHANTIERS.md` tant qu'aucune décision explicite n'a été prise** :

- ~~CH-004~~ (chiffrement PII) — retiré de cette liste : l'arbitrage a tranché en faveur de l'implémentation immédiate, pas de l'acceptation de risque (voir `REGISTRE_DECISIONS.md`, RD-006 ; chantier terminé, `REGISTRE_CHANTIERS.md`).
- **CH-020** (numérotation de facture mensuelle) — alternative légitime : la séquence globale actuelle peut être actée comme suffisante si la comptabilité de l'hôtel ne l'exige pas autrement.
- **CH-021** (city ledger / `Company`) — alternative légitime : documenter que la facturation entreprise n'est pas un objectif de cette version, si confirmé par le métier.
- **Multi-folio (ADR-002) vs folio unique en pratique** — alternative légitime : acter formellement le folio unique comme la réalité opérationnelle voulue, et mettre à jour ADR-002 en conséquence plutôt que de laisser un schéma plus permissif que l'usage réel (voir `REGISTRE_DECISIONS.md`).
- **CH-023** (matérialisation financière des pénalités) — alternative légitime : acter que le recouvrement reste un processus humain hors PMS par choix, pas par manque.

## Règle d'usage

Ne jamais retirer un chantier de `REGISTRE_CHANTIERS.md` en le remplaçant silencieusement par une entrée ici sans que la décision n'ait été réellement prise par une personne habilitée (pas par une IA de manière autonome) — ce registre documente des décisions humaines, pas des suppositions.
