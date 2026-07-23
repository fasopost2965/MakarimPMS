# Statut des modules — Makarim PMS v1

Statut par module backend, croisé avec la présence d'une interface frontend et les chantiers ouverts. Source : `docs/audits/PHASE_04_BACKEND.md` (liste des 21 modules), `PHASE_08_FRONTEND.md` (correspondance frontend).

**Légende Backend** : ✅ fonctionnel et audité sans écart critique · ⚠️ fonctionnel avec écart(s) identifié(s) · ❌ chantier bloquant ouvert
**Légende Frontend** : ✅ interface complète · ⚠️ interface partielle (fonctionnalité intégrée ailleurs) · ❌ aucune interface

| Module | Backend | Frontend | Chantiers ouverts | Remarque |
|---|---|---|---|---|
| `auth` | ⚠️ | ✅ | CH-026 | CH-002 (reset password non sécurisé) **terminé** — reste CH-026 (durcissement sécurité secondaire : helmet, verrouillage compte, complexité mot de passe, cookie httpOnly, révocation refresh token) |
| `rooms` | ✅ | ⚠️ (via housekeeping) | CH-014 | Historique de statut jamais consultable |
| `parameters` | ✅ | ✅ | — | — |
| `reservations` | ⚠️ | ✅ | CH-016 | Service le plus volumineux, dette de découpage |
| `stay` | ⚠️ | ✅ (`checkin/`) | CH-005 | Checkout sans blocage sur solde impayé |
| `housekeeping` | ✅ | ✅ | CH-014 | — |
| `maintenance` | ✅ | ✅ | — | — |
| `guests` (+ `companies`) | ⚠️ | ✅ | CH-010, CH-021 | Pas de déduplication ; `Company` déconnectée |
| `billing` | ✅ | ⚠️ (via checkin ; pas d'UI pour l'avoir) | — | **CH-001 terminé** — avoir total (`POST /invoices/:id/credit-notes`), régénération de facture corrigée possible sur le même folio |
| `payments` | ⚠️ | ⚠️ (via checkin) | CH-012 | Remboursement d'acompte imputé non démarré (dépendance CH-001 levée) |
| `dashboard` | ✅ | ✅ | — | — |
| `audit` | ✅ | ❌ | CH-015 | Aucune UI de consultation |
| `police` | ⚠️ | ❌ | **CH-003** | Aucune UI de saisie (obligation légale) |
| `notifications` | ⚠️ | ❌ | CH-002 (extension), CH-008 | Backend fonctionnel, pas raccordé au reset password, pas d'UI de gestion |
| `self-checkin` | ✅ | ❌ | CH-007 | Backend prêt, aucune UI staff |
| `booking-engine` | ✅ | n/a | — | Façade publique pure, pas d'UI staff attendue |
| `document-ocr` | ✅ | ❌ | CH-022 | Backend prêt, aucune UI |
| `reporting` | ✅ | ✅ | — | Export CSV du registre de police fonctionnel (mais dépend de CH-003 pour avoir des données à exporter) |
| `hr` | ✅ | ✅ | — | — |
| `stock` | ✅ | ✅ | — | — |
| `channel-manager` | ✅ | ❌ | CH-009 | Backend prêt, config sans UI |

## Synthèse

- **21/21 modules** ont un backend fonctionnel au sens strict (répondent, testés en e2e pour la plupart).
- **0/21 module** porte encore un chantier bloquant côté backend — `billing` (CH-001), `auth` (CH-002) et `guests` (CH-004, chiffrement `pieceIdentite`) sont désormais résolus. Reste un seul chantier bloquant, purement frontend (CH-003, UI registre de police).
- **6/21 modules** n'ont aucune interface frontend (`audit`, `police`, `notifications`, `self-checkin`, `document-ocr`, `channel-manager`) — `booking-engine` est le 7e module sans UI staff mais c'est un choix de conception correct (façade publique).
- **`police` est le seul module cumulant un écart backend/légal ET une absence totale de frontend** — c'est le point de convergence de criticité le plus élevé du statut des modules (cf. CH-003).

*Mettre à jour ce tableau à chaque clôture de chantier du registre.*
