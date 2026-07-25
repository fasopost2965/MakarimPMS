# Matrice module backend → API → écran frontend

Vue de couverture technique — pour chaque module backend, l'endpoint principal connu (confirmé pendant l'audit ou par lecture directe des controllers cités dans les rapports) et l'écran qui le consomme. **Cette matrice n'est pas un inventaire exhaustif de tous les endpoints** (ce travail relève de `docs/api/*.md`, dont la fraîcheur n'a pas été revérifiée pendant l'audit — voir `docs/governance/ECARTS_DOC_VS_CODE.md`) : elle couvre les endpoints effectivement cités dans les 10 rapports d'audit, ce qui suffit à statuer sur la couverture frontend.

| Module | Endpoint(s) confirmé(s) par l'audit | Écran frontend | Couverture |
|---|---|---|---|
| `rooms` | (consommé via `housekeeping`) | Housekeeping | ✅ |
| `parameters` | tarifs, taxes, politiques d'annulation, restrictions | Paramètres | ✅ |
| `reservations` | `POST/GET/PATCH/DELETE /reservations`, `/disponibilites`, `/availability` | Réservations | ✅ |
| `stay` | `POST /checkin/*`, `POST /checkout/:stayId` | Check-in/Séjours | ✅ |
| `housekeeping` | `GET /rooms`, `PATCH /rooms/:id/statut` | Housekeeping | ✅ |
| `housekeeping` (historique) | `GET /rooms/:id/historique-statuts` | É-07 — `RoomHistoryDialog.tsx` | ✅ *(CH-014, terminé)* |
| `maintenance` | `POST /maintenance-tickets`, `PATCH /:id/resoudre`, `GET` | Maintenance | ✅ |
| `guests` | `GET/POST/PATCH /guests`, `/companies` | Clients, Entreprises | ✅ |
| `billing` | `POST /folios/:id/lignes`, `POST /invoices/generer`, `PATCH /folios/:id/taxes-exclues` | Check-in/Séjours (embarqué, `BillingTabContent.tsx`) | ✅ |
| `billing` (avoir) | *(inexistant — CH-001)* | *(inexistant)* | 🔴 |
| `payments` | `POST /payments`, deposits `POST/GET/PATCH` | Check-in/Séjours (embarqué, `RecordPaymentDialog.tsx`) | ✅ |
| `dashboard` | `GET /dashboard/*` | Tableau de bord | ✅ |
| `audit` | `GET /audit-logs` | É-06 — `features/audit/`, onglet « Audit » | ✅ *(CH-015, terminé)* |
| `auth` | `POST /auth/login`, `/refresh`, `/forgot-password`, `/reset-password`, `GET /roles-actifs` | Connexion, Mot de passe oublié | ✅ |
| `auth` (identité courante) | `GET /auth/me` | Prérequis transverse — `AppSidebar` (gating RBAC, granularité onglet, RD-009) | ✅ |
| `police` | `POST /police/:stayId`, `GET /police/:stayId/pdf` | É-01 — onglet « Police » dans `StayDetailsDialog.tsx` | ✅ *(CH-003, terminé)* |
| `notifications` | CRUD `NotificationTemplate`, lecture `NotificationLog` | É-03 — `features/notifications/`, onglet dédié | ✅ *(CH-008, terminé)* |
| `self-checkin` | `GET/POST /self-checkin/:token` (public), `POST /reservations/:id/self-checkin-link`, `GET /self-checkin-pending` (staff) | É-02 — `SelfCheckinPanel.tsx` dans `ReservationDetailsDialog.tsx` | ✅ *(CH-007, terminé — staff)* |
| `booking-engine` | `GET /booking/availability`, `POST /booking/reservations` (public) | *(aucun écran staff attendu — façade publique pure)* | n/a |
| `document-ocr` | `POST /document-ocr/scan` | É-05 — `features/document-ocr/`, onglet « Scan pièce d'identité » | ✅ *(CH-022, terminé)* |
| `reporting` | `GET /reporting/*` (synthèse fiscale, grand livre, taxes, police-register, yield-forecast) | Reporting | ✅ |
| `hr` | employés, pointage, paie | RH | ✅ |
| `stock` | items, mouvements, réassort | Stock | ✅ |
| `channel-manager` | `POST/GET/DELETE /channel-manager/mappings`, webhooks (externes, pas staff) | É-04 — 4e onglet dans `ParametersPage.tsx` | ✅ *(CH-009, terminé)* |

## Synthèse de couverture

*(Corrigée — session courante, CH-035/Phase 11 : la version précédente de cette matrice affichait encore 6 lignes 🔴 obsolètes depuis la clôture de CH-003/007/008/009/015/022, jamais resynchronisées après leur fermeture. Voir `docs/governance/REGISTRE_CHANTIERS.md`, fiche CH-035, pour le détail du constat.)*

- **20/21 modules à écran staff attendu** ont une couverture frontend complète pour leurs endpoints connus (le prérequis transverse RBAC, CH-011, est résolu ; `booking-engine` reste `n/a` par conception — façade publique pure, aucun écran staff attendu).
- **1 zone de couverture manquante restante** : `billing` (avoir/CreditNote), sans écran tant que CH-001 côté backend ne l'expose pas — cohérent, pas un oubli frontend.
- Aucune incohérence inverse trouvée (aucun écran frontend n'appelle un endpoint qui n'existe pas) — cohérent avec le constat de la Phase 8 : « zéro donnée mockée », le frontend existant est strictement aligné sur des endpoints réels.
- Cette matrice couvre la **couverture fonctionnelle** (module → écran) ; elle ne dit rien de la **qualité** de ce qui est livré (tests, accessibilité, résilience, performance) — voir `docs/audits/PHASE_11_FRONTEND_QUALITE.md` pour cet axe distinct.
