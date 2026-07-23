# Matrice module backend → API → écran frontend

Vue de couverture technique — pour chaque module backend, l'endpoint principal connu (confirmé pendant l'audit ou par lecture directe des controllers cités dans les rapports) et l'écran qui le consomme. **Cette matrice n'est pas un inventaire exhaustif de tous les endpoints** (ce travail relève de `docs/api/*.md`, dont la fraîcheur n'a pas été revérifiée pendant l'audit — voir `docs/governance/ECARTS_DOC_VS_CODE.md`) : elle couvre les endpoints effectivement cités dans les 10 rapports d'audit, ce qui suffit à statuer sur la couverture frontend.

| Module | Endpoint(s) confirmé(s) par l'audit | Écran frontend | Couverture |
|---|---|---|---|
| `rooms` | (consommé via `housekeeping`) | Housekeeping | ✅ |
| `parameters` | tarifs, taxes, politiques d'annulation, restrictions | Paramètres | ✅ |
| `reservations` | `POST/GET/PATCH/DELETE /reservations`, `/disponibilites`, `/availability` | Réservations | ✅ |
| `stay` | `POST /checkin/*`, `POST /checkout/:stayId` | Check-in/Séjours | ✅ |
| `housekeeping` | `GET /rooms`, `PATCH /rooms/:id/statut` | Housekeeping | ✅ |
| `housekeeping` (historique) | *(inexistant — à créer, CH-014)* | *(É-07, à créer)* | 🔴 |
| `maintenance` | `POST /maintenance-tickets`, `PATCH /:id/resoudre`, `GET` | Maintenance | ✅ |
| `guests` | `GET/POST/PATCH /guests`, `/companies` | Clients, Entreprises | ✅ |
| `billing` | `POST /folios/:id/lignes`, `POST /invoices/generer`, `PATCH /folios/:id/taxes-exclues` | Check-in/Séjours (embarqué, `BillingTabContent.tsx`) | ✅ |
| `billing` (avoir) | *(inexistant — CH-001)* | *(inexistant)* | 🔴 |
| `payments` | `POST /payments`, deposits `POST/GET/PATCH` | Check-in/Séjours (embarqué, `RecordPaymentDialog.tsx`) | ✅ |
| `dashboard` | `GET /dashboard/*` | Tableau de bord | ✅ |
| `audit` | `GET /audit-logs` *(route exacte à confirmer)* | *(É-06, à créer)* | 🔴 |
| `auth` | `POST /auth/login`, `/refresh`, `/forgot-password`, `/reset-password`, `GET /roles-actifs` | Connexion, Mot de passe oublié | ✅ |
| `auth` (identité courante) | `GET /auth/me` | Prérequis transverse — `AppSidebar` (gating RBAC, granularité onglet, RD-009) | ✅ |
| `police` | `POST /police/:stayId`, `GET /police/:stayId/pdf` | *(É-01, à créer)* | 🔴 |
| `notifications` | CRUD `NotificationTemplate`, lecture `NotificationLog` | *(É-03, à créer)* | 🔴 |
| `self-checkin` | `GET/POST /self-checkin/:token` (public), `POST /reservations/:id/self-checkin-link`, `GET /self-checkin-pending` (staff) | *(É-02, à créer côté staff — le flux public n'a pas d'écran staff, c'est normal)* | 🔴 (staff) |
| `booking-engine` | `GET /booking/availability`, `POST /booking/reservations` (public) | *(aucun écran staff attendu — façade publique pure)* | n/a |
| `document-ocr` | `POST /document-ocr/scan` | *(É-05, à créer)* | 🔴 |
| `reporting` | `GET /reporting/*` (synthèse fiscale, grand livre, taxes, police-register, yield-forecast) | Reporting | ✅ |
| `hr` | employés, pointage, paie | RH | ✅ |
| `stock` | items, mouvements, réassort | Stock | ✅ |
| `channel-manager` | `POST/GET/DELETE /channel-manager/mappings`, webhooks (externes, pas staff) | *(É-04, à créer)* | 🔴 |

## Synthèse de couverture

- **15/21 modules** ont une couverture frontend complète pour leurs endpoints staff connus (le prérequis transverse RBAC, CH-011, est désormais résolu).
- **6 zones de couverture manquante** restantes, correspondant aux 6 écrans manquants de `CARTOGRAPHIE_ECRANS.md` + le futur endpoint historique chambre (CH-014) + le futur endpoint avoir (CH-001, lui-même sans écran tant qu'il n'existe pas côté backend).
- Aucune incohérence inverse trouvée (aucun écran frontend n'appelle un endpoint qui n'existe pas) — cohérent avec le constat de la Phase 8 : « zéro donnée mockée », le frontend existant est strictement aligné sur des endpoints réels.
