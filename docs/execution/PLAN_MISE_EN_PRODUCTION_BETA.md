# Plan de mise en production — version bêta (VPS Hostinger)

**Statut** : validé par l'utilisateur (29 juillet 2026) — périmètre v2 confirmé tel quel (6 fonctionnalités, sans scanner QR/capture caméra), accès VPS Hostinger réels disponibles (domaine + SSH, v2 y était déjà déployé en test — bascule prévue vers cette version une fois prête), exécution par phase avec point de validation à chaque phase (A puis B puis C puis D), pas à chaque chantier individuel.
**Objectif** : amener `main` à un état déployable en production réelle sur le VPS Hostinger, en beta, avec la même rigueur (tests, documentation, gouvernance) des deux côtés backend et frontend.
**Méthode** : documenter avant de coder, chantier par chantier, avec critères d'acceptation et tests métier réels avant de considérer un chantier terminé — même discipline que tous les chantiers déjà livrés sur `main` (`docs/governance/REGISTRE_CHANTIERS.md`).

---

## 0. Constat de départ — vérifié dans le code réel, pas supposé

### 0.1. Ce qui est déjà solide sur `main`
- Backend : 21 modules, RBAC, audit, soft-delete centralisé, 23 suites e2e contre MySQL réel, CI verte.
- Presque toutes les fonctionnalités listées comme « incomplètes » dans `docs/governance/FONCTIONNALITES_INCOMPLETES.md` sont en réalité déjà résolues (vérifié fichier par fichier) — une seule ligne du registre était elle-même obsolète (audit UI, résolu par CH-015/CH-032/B4, sera corrigée en CH-045 ci-dessous).
- CH-026(a→f) (sécurité auth) et les Lots A→D (qualité frontend : ErrorBoundary, code splitting, composants partagés, responsive) sont terminés.

### 0.2. Écarts réels identifiés — vérifiés, pas supposés
| Écart | Preuve | Impact |
|---|---|---|
| **Zéro test e2e automatisé frontend** | Aucune trace de Playwright dans `package.json`/repo ; les 15 fichiers `*.test.tsx` existants ne couvrent que des composants unitaires, aucune des 16 pages `*Page.tsx` | Le frontend n'a pas la même rigueur de vérification que le backend — exactement le point que tu soulèves |
| **`GO_LIVE_CHECKLIST.md`** | 15/15 lignes non cochées, décrit une infra Google Cloud (Secret Manager) qui ne correspond pas au VPS Hostinger | Aucun critère de sortie réellement vérifiable pour un vrai go-live |
| **`OPERATIONS_RUNBOOK.md`** | §1 décrit Cloud Run + Cloud SQL + GitLab CI — stack générique jamais utilisé par ce projet | Runbook actuellement inutilisable en cas d'incident réel sur le VPS |
| **`.github/workflows/deploy.yml`** | N'existe pas (seul `ci.yml` existe : lint/build/test sur PR, aucun déploiement) | Le skill `deploiement-vps` référence un pipeline qui n'a jamais été construit |
| **Sauvegarde MySQL production** | Aucune trace de script `mysqldump` planifié ni d'exercice de restauration testé | Non-négociable avant tout go-live réel (perte de données irréversible sinon) |
| **2 alertes CodeQL ouvertes** | PR #21, faux positifs documentés, jamais dismissées côté Security | Hygiène avant annonce publique de mise en production |
| **`docs/governance/DETTE_TECHNIQUE.md` #9** | Dit encore « aucune dépendance de test » côté frontend — obsolète depuis CH-028 | Doc désynchronisée du code réel |
| **Multi-folio (ADR-002)** | Schéma le permet, aucun code ne crée jamais plus d'un folio par séjour | Décision à trancher formellement (garder tel quel ou corriger la doc), pas un bug |

### 0.3. Ce que `MakarimPMS_v2` a de réellement exploitable (vérifié dans le code, pas dans la doc de v2 qui est peu fiable)
Confirmé en lisant le code source (pas les commentaires marketing) :
- `CancelFolioLineDto`/`cancelFolioLine()` : logique **correcte**, respecte déjà ADR-002 (aucune mutation de montant, flag `annulee` seulement) et ADR-005 (audit log dans la même transaction, bloque si facture `EMISE` active). Bon candidat au portage.
- `RoomsController` + DTOs CRUD chambre/type de chambre : comble un écart déjà documenté dans le `CLAUDE.md` de `main` lui-même.
- Mouvements de stock étendus (dotation chambre, changement/lavage de linge).
- Composants frontend d'impression (facture, bon de travail maintenance, confirmation de réservation par email), widgets tableau de bord (alertes, courbe de réservations, tâches ménage).
- **Aucun de ces éléments n'a de test e2e dans v2** (vérifié : les fichiers e2e de v2 sont identiques à ceux de `main`, zéro ajout) — le portage doit donc être vérifié depuis zéro, pas fait confiance au code source de v2.
- Écarté du portage : couche Zod (incohérent avec `class-validator` déjà en place), `bun.lock`/scripts racine ad hoc, scanner QR/capture caméra (accès matériel, périmètre plus large — proposé en post-bêta, voir §4).

---

## 1. Phases proposées

### Phase A — Rigueur frontend (répond directement à ta demande explicite)
- **CH-036 — Socle Playwright** : installation, configuration CI, 6 parcours critiques réels (connexion, réservation walk-in, check-in, check-out + paiement, changement de statut ménage, déconnexion) contre données seedées réelles.
- **CH-037 — Tests unitaires des pages non couvertes** : au minimum `ReservationsCalendarPage`, `CheckinPage`, `HousekeepingPage`, `GuestsPage` (Vitest + Testing Library, même pattern que `BillingTabContent.test.tsx` déjà existant).

### Phase B — Portage sélectif depuis v2 (fonctionnalités, pas le dépôt)
Chaque ligne = un chantier CH-XXX complet : DTO/service/controller réécrits, RBAC, audit si sensible, doc module mise à jour, **e2e réel écrit dans `main`** (jamais copié depuis v2), vérification navigateur réelle.
- **CH-038** — CRUD chambres/types de chambre + route de configuration RBAC dédiée (comble l'écart déjà noté `rooms:read`/`rooms:write` dans `CLAUDE.md` §RBAC).
- **CH-039** — Mouvements de stock étendus (dotation chambre, linge).
- **CH-040** — Annulation contrôlée d'une ligne de folio.
- **CH-041** — Raccourcissement de séjour — **nécessite une vérification d'impact sur `RoomNight`/facturation avant tout code**, traité comme une étude d'impact avant chantier, pas un simple portage.
- **CH-042** — Impression frontend (facture, bon de travail maintenance, confirmation réservation).
- **CH-043** — Widgets tableau de bord (alertes, courbe réservations, tâches ménage) — lecture seule.

### Phase C — Décisions & nettoyage documentation
- **CH-044** — Trancher le multi-folio (ADR-002) : implémenter réellement, ou acter le single-folio comme réalité pratique et corriger la doc en conséquence.
- **CH-045** — Corriger les 3 documents obsolètes identifiés en §0.2 (`DETTE_TECHNIQUE.md` #9, la ligne audit UI de `FONCTIONNALITES_INCOMPLETES.md`, la stratégie de branches jamais suivie d'`EXECUTION_MASTER_PLAN.md`).

### Phase D — Infrastructure de production réelle
- **CH-046** — Réécriture de `GO_LIVE_CHECKLIST.md` et `OPERATIONS_RUNBOOK.md` pour le stack réel (Docker Compose + Nginx + Certbot sur VPS Hostinger, pas GCP), configuration Nginx hôte committée et testée, pipeline `deploy.yml` réel, script de sauvegarde MySQL automatisé + un exercice de restauration effectivement testé.
- **CH-047** — Passage effectif de la checklist Go-Live (15 points), smoke tests bout-en-bout, dismiss des 2 alertes CodeQL.

---

## 2. Ce qui reste explicitement hors périmètre de cette bêta (déjà tranché par toi précédemment, ou confirmé le 29 juillet 2026)
- Facturation entreprise / city ledger (RD-014, écart assumé EA-001).
- Recouvrement tracé des pénalités d'annulation (RD-015, écart assumé EA-002).
- Branding définitif (CH-033, dépriorisé, en attente d'un asset graphique).
- Scanner QR check-in / capture caméra OCR (v2) — confirmé hors périmètre bêta (29 juillet 2026), accès matériel, périmètre plus large, à reproposer en post-bêta.

## 2bis. Infrastructure VPS Hostinger — état confirmé (29 juillet 2026)
Accès réels disponibles (domaine + SSH) ; `MakarimPMS_v2` y a déjà été déployé en test — la bascule vers cette version se fera une fois la Phase D terminée. La Phase D (CH-046/CH-047) sera donc exécutée jusqu'au bout, y compris un déploiement réel de vérification, pas seulement une préparation documentaire. Détails de connexion (domaine exact, méthode d'accès SSH) à recueillir explicitement au démarrage de la Phase D — jamais supposés.

---

## 3. Discipline d'exécution (rappel, déjà en vigueur tout le long de la session)
Pour chaque chantier CH-036 à CH-047 : documenter dans `REGISTRE_CHANTIERS.md` → coder → `build`/`lint`/`test`/`test:e2e` verts → vérification navigateur réelle sur données seedées → mise à jour gouvernance dans le même commit → commit détaillé → passage au chantier suivant. Sabotage/restore documenté pour toute règle non-négociable testée.
