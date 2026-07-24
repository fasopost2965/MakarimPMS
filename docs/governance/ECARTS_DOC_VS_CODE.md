# Écarts entre documentation cible et code réel — Makarim PMS v1

`docs/` (hors `docs/audits/` et `docs/governance/`, ajoutés par cette structuration) est une **spécification pré-implémentation** : ADR, `BUSINESS_RULES.md`, `DATA_DICTIONARY.md`, `SYSTEM_ARCHITECTURE.md`, `modules/*.md`, plan de sprints `execution/SPRINT_01.md` à `SPRINT_13.md`. Elle se présente elle-même comme normative (`docs/README.md` : « Aucun écart, raccourci ou fonctionnalité non documentée n'est toléré »). L'audit a confirmé que cette documentation est **mesurablement en retard sur le code réel** sur plusieurs points précis, listés ici avec leur source.

## Écarts confirmés par l'audit

| Document | Ce qu'il affirme | Réalité du code | Source |
|---|---|---|---|
| ~~`docs/modules/MODULES_INDEX.md`, `CLAUDE.md`~~ | 13-17 modules selon le document | **Résolu (CH-018, session courante)** — `MODULES_INDEX.md` liste désormais les 21 modules réels (+ `accounting` explicitement marqué non implémenté) ; `CLAUDE.md` (§Architecture backend) mis à jour de 17 à 21 (`hr`/`reporting`/`stock`/`channel-manager` ajoutés à l'énumération). | Phases 1, 4 §1 |
| ~~`docs/modules/MODULES_INDEX.md`~~ | Module « accounting » listé | **Résolu/confirmé (CH-018, session courante)** — écart réel confirmé (aucun dossier `backend/src/modules/accounting/`) : `accounting.md` décrit une clôture comptable journalière/rapprochement de caisse/City Ledger jamais construits. `MODULES_INDEX.md` marque désormais explicitement cette ligne « non implémenté », avec renvoi vers `CH-021`/`EA-001` pour la partie City Ledger. | Phase 1 → confirmé CH-018 |
| `docs/execution/SPRINT_01.md` à `SPRINT_13.md` | Périmètre couvrant jusqu'au Sprint 13 (reporting/comptabilité) | Le code va bien au-delà : F1 à F10 (self-checkin, notifications, booking-engine, document-ocr, mobile housekeeping, channel-manager, etc.) ne correspondent à aucun sprint documenté dans cette série | Constats cumulés des Phases 2-9 sur les modules F1-F10 |
| `docs/ADR-002-Folio-Billing-Model.md` | « Un séjour peut avoir plusieurs folios » | Un seul site de code crée des folios ; jamais plus d'un par séjour en pratique | Phases 2, 3 §6 |
| ~~`docs/execution/GO_LIVE_CHECKLIST.md`~~ | Exige une variable `ENCRYPTION_KEY` | **Résolu (CH-004, session courante)** — `ENCRYPTION_KEY` existe désormais (`backend/.env.example`, validée au bootstrap dans tous les environnements, `assertEncryptionKeyConfigured`), chiffre `Guest.pieceIdentite` en AES-256-GCM. `docs/execution/GO_LIVE_CHECKLIST.md` lui-même n'a pas été réécrit (référentiel gelé pré-implémentation, hors périmètre) mais son exigence n'est plus un écart avec le code réel. | Phase 5 §3 |
| Commentaire schéma (`HotelConfig.id`) | « id fixé à 1 par convention applicative » | `CLAUDE.md` interdit explicitement cette hypothèse (`findFirst()` obligatoire) — contradiction interne au projet, pas seulement doc vs code | Phase 3 §6 |
| ~~Pas de spec `docs/modules/police.md` dédiée~~ | — | **Résolu (CH-018, session courante)** — `docs/modules/police.md` créé, ainsi que 7 autres specs manquantes découvertes au passage (`auth`, `booking-engine`, `channel-manager`, `dashboard`, `document-ocr`, `notifications`, `self-checkin`) — l'écart réel était plus large que ce qui avait été repéré pendant l'audit initial. | Résolu CH-018 |
| `docs/api/API_INDEX.md` et fichiers `docs/api/*.md` | Liste des endpoints par module | **Non revérifiés endpoint par endpoint contre le code réel pendant cet audit** — statut de fraîcheur inconnu | À confirmer explicitement (chantier futur, non couvert par CH-018 en l'état) |

## Ce que cela signifie pour l'usage de `docs/`

- **Pour comprendre l'intention d'origine et les décisions d'architecture fondamentales (ADR)** : `docs/` reste une référence utile et globalement fiable — les ADR n'ont pas été trouvés faux par l'audit, seulement l'ADR-002 en tension avec l'usage réel (folio unique en pratique).
- **Pour connaître l'état réel du système au moment présent** : `docs/audits/` et `docs/governance/` font foi, pas les documents pré-implémentation listés ci-dessus.
- **Règle pratique** : en cas de contradiction entre un document sous `docs/modules/`, `docs/execution/`, ou `docs/api/` et un constat d'audit, **le constat d'audit l'emporte** — il a été vérifié par lecture de code directe, la documentation pré-implémentation ne l'a pas été (par construction, elle précède le code).

## Chantier associé

**CH-018** (`REGISTRE_CHANTIERS.md`) couvre la resynchronisation de `MODULES_INDEX.md` et `CLAUDE.md`. Les autres écarts de ce tableau (ADR-002, `docs/api/*.md`) ne sont pas encore couverts par un chantier dédié dans le registre — **à ajouter au registre lors du prochain passage de mise à jour**, une fois les arbitrages associés tranchés (le sort de l'ADR-002 dépend de l'arbitrage « multi-folio vs folio unique » listé dans `ECARTS_ASSUMES.md`).
