# Peut-on mettre la documentation en conformité ? — état au 2026-11-06

**Réponse courte : oui — et l'essentiel est déjà fait.** La documentation n'était
pas fausse sur le fond (les ADR, le modèle folio/séjour et les invariants tiennent),
elle était **en retard sur le code** et **incomplète sur deux modules à venir**.
Les écarts constatés étaient tous de nature documentaire : aucun ne révélait une
architecture erronée.

Trois niveaux, à ne pas confondre :

| Niveau | Nature | État |
|---|---|---|
| **1. Corrigé aujourd'hui** | la documentation contredisait un fait vérifiable (rôle, enum, renvoi de règle, nombre de modules) | ✅ aligné |
| **2. À trancher par la direction** | la documentation doit choisir une règle de gestion (imputation, taxe de séjour, plafond espèces…) | ⏳ 6 arbitrages, valeurs recommandées déjà appliquées |
| **3. Dépend d'une migration ou d'une ADR** | la règle est écrite mais le code ne peut pas encore la respecter | 🔧 3 migrations + 2 ADR à réviser |

---

## 1. Ce que la vérification a établi (preuves)

| Fait vérifié | Documentation avant | Réalité du code | Source |
|---|---|---|---|
| Nombre de modules backend | 21 | **24** | `ls backend/src/modules` |
| Rôles | 6 (RBAC + ADR-006) | **7** (`+ RESTAURATEUR`) | `backend/prisma/seed.ts` l. 604-805 |
| Types de lignes de folio | 4 | **7** (`+ RESTAURANT`, `AJUSTEMENT_HAUSSE`, `AJUSTEMENT_BAISSE`) | `schema.prisma`, enum `TypeLigneFolio` |
| Canaux de réservation | 3 | **5** (`+ EXPEDIA`, `+ AIRBNB`) | enum `CanalReservation` |
| Modes de paiement | 4 dont `ACOMPTE` | `ACOMPTE` présent **et** dépôt géré séparément | enum `MoyenPaiement` + `ReservationDeposit` |
| Politiques d'annulation | non implémentées *(1ʳᵉ passe)* | **implémentées** | `cancellation-policy.service.ts`, `computeCancellationPenalty()` |
| Registre de dépôts | absent *(1ʳᵉ passe)* | **implémenté** | `ReservationDeposit`, `stay.service.ts` l. 505-522 |
| No-show | non traité | **marquage existant** (`markNoShow`), automatisation à faire | `reservations.service.ts` l. 694 |
| Renvois de règles | 4 identifiants cassés | — | `BR-PAY-001/002/003`, `BR-STK-003` |
| Règles métier | 60 | **80** après alignement | `BUSINESS_RULES.md` |

> **Honnêteté de méthode** : trois verdicts de ma première revue étaient trop
> sévères (politique d'annulation, dépôts, no-show jugés absents alors qu'ils
> existaient en partie). Ils ont été corrigés dans `REVUE_COHERENCE_REGLES_2026-11.md`
> et dans ce document. Une revue qui n'est pas vérifiable ne vaut pas mieux qu'une
> documentation périmée.

---

## 2. Ce qui a été mis en conformité aujourd'hui

| Document | Correction |
|---|---|
| `BUSINESS_RULES.md` → **v1.1** | 8 règles réécrites, **20 ajoutées** (dont restaurant et événementiel), changelog en tête |
| `RBAC_MATRIX.md` → **révision 2026-11** | 7 rôles documentés + 1 à créer, encaissement Réception, séparation encaissement/avoirs, matrice à 7 colonnes, sections Restaurateur et rôles à créer |
| `DATA_DICTIONARY.md` | `CanalReservation` (5), `TypeLigneFolio` (7 + `nature`), `MoyenPaiement` (dette `ACOMPTE` documentée) |
| `MODULES_INDEX.md` | 24 modules, ligne « events » signalée non implémentée |
| `modules/restaurant.md` | **créé** — état réel (charge folio + rapport du jour) et cible L3 |
| `modules/events.md` | **créé** — spécification cible L4, périmètre assumé |
| `modules/payments.md` | renvois `BR-PAY-*` → `BR-PAI-*`, `ACOMPTE` requalifié en dépôt |
| `modules/stock.md` | renvoi `BR-STK-003` (inexistant) → `BR-AUD-002` |
| `governance/ECARTS_DOC_VS_CODE.md` | 9 nouveaux écarts consignés avec leur traitement |
| `governance/REGISTRE_CHANTIERS.md` | **CH-051** créé (en cours), livrables et reste-à-faire |
| `governance/REGISTRE_DECISIONS.md` | **RD-029** : principes d'alignement + arbitrages restants |

**Contrôle final** : 0 renvoi `BR-*` cassé hors historique de registre ; aucun
identifiant de règle en doublon ; 80 règles numérotées.

---

## 3. Ce qui ne peut pas être « mis en conformité » par écriture seule

### 3.1 Six arbitrages de direction

| # | Question | Valeur appliquée par défaut |
|---|---|---|
| D1 | Imputation : une nuit = une ligne (night audit) ou séjour entier au check-in ? | nuit par nuit |
| D2 | Contrôle gouvernante obligatoire avant remise en vente ? | oui, avec contrôle possible par la Gouvernante elle-même |
| D3 | Taxe de séjour : assiette et exonérations | par adulte et par nuit, exonérations paramétrables |
| D4 | Espèces au-delà de 10 000 MAD | blocage + dérogation motivée |
| D5 | Création du rôle Équipier de ménage | oui |
| D6 | Validation formelle d'ADR-008 (modèle fiscal TTC) | à valider avant L0 |

Chacune se change en une passe : le référentiel est écrit pour être réversible.

### 3.2 Trois migrations de schéma

| Élément | Pourquoi | Lot |
|---|---|---|
| `StatutReservation.OPTION` + job d'expiration | BR-RES-005 est inapplicable sans la valeur d'enum | L0 |
| `MoyenPaiement` : retirer `ACOMPTE`, ajouter `CHEQUE` | BR-PAI-002 / BR-FAC-006 (caution) | L0 |
| `TaxRateConfig` : type `TPT` + exonérations de taxe de séjour | BR-FAC-007 / BR-FAC-008 | L0 |

### 3.3 Deux ADR à réviser

- **ADR-006** (validée) fige **6 rôles immuables** : elle contredit la base (7) et
  bloque la création du 8ᵉ. Révision ou ADR-009 « extension du modèle de rôles ».
- **ADR-008** porte encore le statut « Proposé pour validation » alors que le code
  applique déjà le TTC et la ventilation. À valider, sinon le modèle fiscal
  n'engage personne.

### 3.4 Deux spécifications de modules encore absentes

`night-audit` et `purchase-orders` existent dans le code mais n'ont pas de fiche.
Référencées « spec à créer » dans `MODULES_INDEX.md` (CH-051).

---

## 4. Comment la documentation reste conforme

La mise en conformité n'est pas un état, c'est une boucle. Le dépôt possède déjà
les instruments ; il suffit de les brancher sur la refonte :

1. **Une règle = un identifiant = un test.** Toute règle ajoutée dans
   `BUSINESS_RULES.md` doit citer sa source (cahier des charges, ADR, décision
   propriétaire) et être reprise dans au moins un test ou une recette de lot.
2. **Le code vérifié fait foi.** Quand un document contredit le code, ce n'est pas
   au code de changer par défaut : c'est un écart à consigner dans
   `ECARTS_DOC_VS_CODE.md`, puis à trancher.
3. **Un chantier par écart structurant** (`REGISTRE_CHANTIERS.md`), **une décision
   par arbitrage** (`REGISTRE_DECISIONS.md`). C'est ce qui a été fait avec CH-051 / RD-029.
4. **Contrôle automatisable** (à ajouter en CI, 30 lignes) : vérifier que chaque
   `BR-XXX-000` cité dans `docs/` existe dans `BUSINESS_RULES.md`, et que chaque
   valeur d'enum citée dans la documentation existe dans `schema.prisma`. C'est
   exactement ce qui aurait détecté les 9 écarts d'aujourd'hui — je le recommande
   au lot L0.

---

## 5. Verdict document par document

| Document | Verdict | Commentaire |
|---|---|---|
| `BUSINESS_RULES.md` | ✅ conforme (v1.1) | 80 règles, sources citées, 6 arbitrages signalés |
| `RBAC_MATRIX.md` | ✅ conforme (révision 2026-11) | 7 rôles réels + 1 à créer ; encaissement tranché |
| `DATA_DICTIONARY.md` | ✅ conforme | Enums resynchronisés ; dette `ACOMPTE` documentée |
| `MODULES_INDEX.md` | 🟡 conforme | 2 specs de modules encore à écrire |
| `modules/restaurant.md` | ✅ créé | Décrit l'existant **et** la cible |
| `modules/events.md` | ✅ créé | Spécification cible, statut « non implémenté » affiché |
| `modules/payments.md`, `stock.md` | ✅ corrigés | Renvois de règles valides |
| `ADR-001 → 005, 007` | ✅ conformes | Aucune contradiction relevée |
| `ADR-006` | 🔧 à réviser | Fige 6 rôles, la base en a 7 |
| `ADR-008` | 🔧 à valider | Statut « proposé » alors que le code l'applique |
| `Cahier des charges` (PDF) | ✅ conforme | Source de référence, non modifiable |
| `docs/api/*.md` | ⚠️ non revérifiés | Écart déjà connu (ECARTS_DOC_VS_CODE) |
| `docs/execution/SPRINT_*.md` | ⚠️ figés | Référentiel pré-implémentation, hors périmètre |
| `docs/governance/*` | ✅ à jour | CH-051 et RD-029 consignés |

---

## 6. Ce qu'il reste à faire, dans l'ordre

1. **Vous** : trancher D1 → D6 (une heure de réunion, valeurs recommandées prêtes).
2. **Moi** : rédiger `night-audit.md` et `purchase-orders.md`, amender ADR-006, ajouter le contrôle de cohérence en CI.
3. **Lot L0** : les 3 migrations puis l'implémentation de D1.
4. **Lots L1 → L4** : chaque lot commence par relire les règles qu'il implémente — c'est désormais possible sans ambiguïté.
