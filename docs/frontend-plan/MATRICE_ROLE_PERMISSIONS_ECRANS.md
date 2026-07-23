# Matrice rôle → permissions → écrans → actions

Source des permissions : `backend/prisma/seed.ts` (`rolesData`, lu intégralement — pas une supposition). 6 rôles réels. Écrans existants (✅) référencés par leur nom d'onglet actuel ; écrans manquants (🔴) référencés par leur identifiant `É-0X` (voir `CARTOGRAPHIE_ECRANS.md`).

| Rôle | Permissions accordées (exact, seed) | Écrans accessibles (existants) | Écrans accessibles (à créer) | Actions clés |
|---|---|---|---|---|
| **Administrateur** | Toutes (`Object.keys(permissions)`) | Les 11 écrans existants | É-01 à É-08 (tous) | Tout, y compris `guests:blacklist`, `payments:refund`, `parameters:write` |
| **Réception** | `reservations:*` (read/write), `checkin:*`, `housekeeping:*`, `dashboard:read`, `guests:read/write`, `payments:read`, `parameters:read`, `notifications:read` | Tableau de bord, Réservations, Check-in/Séjours, Housekeeping, Clients, Entreprises, Paramètres (lecture seule) | É-01 (police, write), É-02 (self-checkin, write), É-03 (notifications, **lecture seule** — pas d'édition de template) | Créer/gérer réservations, check-in/out, saisir police, générer self-checkin, consulter paiements (jamais encaisser directement — confirmé `payments:read` seul) |
| **Gouvernante** | `housekeeping:*`, `maintenance:read`, `stock:*` (read/write) | Housekeeping, Maintenance (lecture), Stock | É-07 (historique statuts chambre) | Changer statut chambre, réassort stock, voir tickets maintenance sans les créer/résoudre |
| **Comptable** | `billing:*`, `payments:*` (read/write), `dashboard:read`, `guests:read`, `parameters:read`, `reporting:read/export` | Tableau de bord, Check-in/Séjours (facturation embarquée), Clients (lecture), Paramètres (lecture), Reporting | — | Générer factures, encaisser paiements, exporter rapports — **jamais** `payments:refund` (réservé Administrateur) |
| **Maintenance** | `maintenance:*` (read/write) | Maintenance | — | Créer/résoudre tickets |
| **RH** | `rh:*` (read/write/export) | RH | — | Gérer employés, pointages, bulletins de paie — jamais `rh:delete` (non accordé à aucun rôle, y compris RH — cohérent avec l'interdiction de suppression physique d'un dossier RH) |

## Constats issus de cette matrice

- **Aucun rôle non-Administrateur n'a accès à `audit`, `police` (write), `self-checkin` (write), `notifications` (write), `channel-manager`/`parameters:write`, `document-ocr`** au sens strict des permissions du seed — sauf `police`/`self-checkin` qui réutilisent `checkin:*`/`reservations:*`, donc accessibles à la Réception (cohérent avec É-01/É-02 ci-dessus).
- **`Comptable` n'a jamais accès à `guests:write`** — ne peut pas modifier une fiche client, seulement la consulter (cohérent avec la note du seed : « c'est le rôle Réception qui gère le CRM au quotidien »).
- **`Gouvernante` a `maintenance:read` mais pas `maintenance:write`** — l'écran Maintenance existant doit donc masquer les actions de création/résolution de ticket pour ce rôle si le gating est appliqué (aujourd'hui, confirmé Phase 5/8, aucun masquage n'existe — la Gouvernante voit les mêmes boutons que le rôle Maintenance).
- **Aucun rôle n'a de permission `police` dédiée** — confirme le choix backend de réutilisation documenté dans `CLAUDE.md` ; l'écran É-01 doit donc être gaté sur `checkin:write`, pas une clé `police:write` qui n'existe pas.

## Implication pour le chantier CH-011 (gating RBAC frontend)

Le gating ne peut pas se limiter à masquer des onglets entiers par écran — plusieurs écrans existants (Maintenance, Paramètres) doivent aussi masquer des **actions à l'intérieur d'un même écran** selon la permission exacte (`read` vs `write`), pas seulement l'accès à l'écran dans son ensemble. Ceci doit être pris en compte dans la conception du contexte `AuthContext`/`GET /auth/me` (§Plan backend) : la granularité exposée doit être `(module, action)`, pas un simple booléen par écran.
