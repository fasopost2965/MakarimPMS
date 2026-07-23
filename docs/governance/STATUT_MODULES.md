# Statut des modules — Makarim PMS v1

Statut par module backend, croisé avec la présence d'une interface frontend et les chantiers ouverts. Source : `docs/audits/PHASE_04_BACKEND.md` (liste des 21 modules), `PHASE_08_FRONTEND.md` (correspondance frontend).

**Légende Backend** : ✅ fonctionnel et audité sans écart critique · ⚠️ fonctionnel avec écart(s) identifié(s) · ❌ chantier bloquant ouvert
**Légende Frontend** : ✅ interface complète · ⚠️ interface partielle (fonctionnalité intégrée ailleurs) · ❌ aucune interface

| Module | Backend | Frontend | Chantiers ouverts | Remarque |
|---|---|---|---|---|
| `auth` | ⚠️ | ✅ | CH-026 | CH-002 (reset password non sécurisé) **terminé**, **CH-011 terminé** (`GET /auth/me` alimente désormais le gating RBAC frontend transverse, voir `AppSidebar`) — reste CH-026 (durcissement sécurité secondaire : helmet, verrouillage compte, complexité mot de passe, cookie httpOnly, révocation refresh token) |
| `rooms` | ✅ | ⚠️ (via housekeeping) | CH-014 | Historique de statut jamais consultable |
| `parameters` | ✅ | ✅ | — | — |
| `reservations` | ⚠️ | ✅ | CH-016 | Service le plus volumineux, dette de découpage |
| `stay` | ✅ | ✅ (`checkin/`) | — | **CH-005 terminé** — checkout bloqué sur solde impayé (`ConflictException`), check-out forcé réservé à `checkin:force-checkout` |
| `housekeeping` | ✅ | ✅ | CH-014 | — |
| `maintenance` | ✅ | ✅ | — | — |
| `guests` (+ `companies`) | ⚠️ | ✅ | CH-010, CH-021 | Pas de déduplication ; `Company` déconnectée |
| `billing` | ✅ | ⚠️ (via checkin ; pas d'UI pour l'avoir) | — | **CH-001 terminé** — avoir total (`POST /invoices/:id/credit-notes`), régénération de facture corrigée possible sur le même folio |
| `payments` | ✅ | ⚠️ (via checkin) | — | **CH-012 terminé** — remboursement d'acompte imputé fonctionnel (préalable : avoir sur toute facture active) |
| `dashboard` | ✅ | ✅ | — | — |
| `audit` | ✅ | ❌ | CH-015 | Aucune UI de consultation |
| `police` | ✅ | ✅ | — | **CH-003 terminé** — onglet dédié dans `StayDetailsDialog.tsx` |
| `notifications` | ⚠️ | ✅ | CH-002 (extension) | **CH-008 terminé** — onglet dédié `features/notifications/` (templates + journal) ; reste pas raccordé au reset password (écart antérieur, hors périmètre de CH-008) |
| `self-checkin` | ✅ | ✅ | — | **CH-007 terminé** — `SelfCheckinPanel.tsx` sur le détail de réservation (génération/régénération de lien, statut d'attente) |
| `booking-engine` | ✅ | n/a | — | Façade publique pure, pas d'UI staff attendue |
| `document-ocr` | ✅ | ❌ | CH-022 | Backend prêt, aucune UI |
| `reporting` | ✅ | ✅ | — | Export CSV du registre de police fonctionnel (mais dépend de CH-003 pour avoir des données à exporter) |
| `hr` | ✅ | ✅ | — | — |
| `stock` | ✅ | ✅ | — | — |
| `channel-manager` | ✅ | ✅ | — | **CH-009 terminé** — 4e onglet « Channel Manager » dans `ParametersPage.tsx` (CRUD des mappings type de chambre ↔ canal externe) |

## Synthèse

- **21/21 modules** ont un backend fonctionnel au sens strict (répondent, testés en e2e pour la plupart).
- **0/21 module** porte encore un chantier bloquant, backend ou frontend — les 4 chantiers bloquants du registre (CH-001 à CH-004) sont désormais tous terminés (`billing`, `auth`, `guests`, `police`).
- **2/21 modules** n'ont aucune interface frontend (`audit`, `document-ocr`) — `booking-engine` est un 3e module sans UI staff mais c'est un choix de conception correct (façade publique). `police` en est retiré (CH-003 terminé), `self-checkin` (CH-007 terminé), `channel-manager` (CH-009 terminé) et `notifications` (CH-008 terminé) également.

*Mettre à jour ce tableau à chaque clôture de chantier du registre.*
