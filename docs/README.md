# PMS Hôtel Makarim — Index de la Documentation d'Architecture

Bienvenue dans le référentiel d'architecture du Property Management System (PMS) de l'Hôtel Makarim. Ce répertoire contient l'intégralité des spécifications fonctionnelles, techniques, d'ingénierie des données et d'exécution régissant la conception et le développement du système.

> [!IMPORTANT]
> **Règle d'or de conformité :** Tout le code source, la structure de base de données, l'ordonnancement des développements et les interfaces doivent être **strictement conformes** à cette documentation. Aucun écart, raccourci ou fonctionnalité non documentée n'est toléré sans un processus d'ADR (Architectural Decisions Record) préalable validé par l'architecte.

---

## 🗺️ 1. Arborescence de la Documentation

Voici la structure complète du répertoire `/docs/` :

```text
/docs/
├── README.md                           # Ce fichier (Point d'entrée unique)
├── BUSINESS_RULES.md                   # Règles métier, invariants & contraintes
├── DATA_DICTIONARY.md                  # Dictionnaire des données & typages
├── SYSTEM_ARCHITECTURE.md              # Architecture globale & flux de données
├── RBAC_MATRIX.md                      # Matrice d'autorisations & contrôles d'accès
├── ARCHITECTURE_AUDIT.md               # Audit de cohérence globale de l'architecture
├── SPRINT_BACKLOG.md                   # Plan de sprints & jalons de livraison
├── DEPENDENCY_GRAPH.md                 # Graphe de dépendances & opportunités de parallélisation
├── HAIP_BENCHMARK.md                   # [Non normatif] Notes d'inspiration issues de HAIP
│
├── ADR_INDEX.md                        # Registre et index des décisions d'architecture
├── ADR-001-Stay-Centric-Architecture.md# Centralité opérationnelle sur le Séjour (Stay)
├── ADR-002-Folio-Billing-Model.md      # Structure de facturation multi-folio
├── ADR-003-Room-State-Machine.md       # Cycle de vie et statuts physiques des chambres
├── ADR-004-Payment-Financial-Integrity.md # Idempotence et barrière stricte de Check-Out
├── ADR-005-Audit-Soft-Delete.md        # Journalisation d'audit et suppression logique
├── ADR-006-RBAC-Enforcement.md         # Contrôle d'accès basé sur les rôles côté API
├── ADR-007-Time-Shift-Attendance.md    # Inviolabilité temporelle du pointage RH
│
├── modules/                            # Spécifications détaillées par domaine
│   ├── MODULES_INDEX.md                # Index et cartographie des 13 modules
│   ├── auth.md                         # Module 1 : Authentification & RBAC
│   ├── audit.md                        # Module 2 : Audit Log
│   ├── rooms.md                        # Module 3 : Gestion physique des chambres
│   ├── guests.md                       # Module 4 : Gestion des clients CRM
│   ├── reservations.md                 # Module 5 : Réservations prospective
│   ├── stay.md                         # Module 6 : Séjours, Walk-In & Check-In
│   ├── billing.md                      # Module 7 : Facturation client
│   ├── payments.md                     # Module 8 : Règlements de caisse
│   ├── housekeeping.md                 # Module 9 : Logistique du ménage
│   ├── maintenance.md                  # Module 10: Logistique technique
│   ├── hr.md                           # Module 11: Pointage & Ressources Humaines
│   ├── stock.md                        # Module 12: Gestion des stocks
│   └── reporting.md / accounting.md    # Module 13: Rapports légaux & comptabilité
│
├── api/                                # Spécifications des Endpoints d'API
│   └── ...
│
└── execution/                          # Directives et feuilles de route d'implémentation
    ├── EXECUTION_MASTER_PLAN.md        # Plan directeur d'exécution & cadre d'ingénierie
    ├── SPRINT_01.md                    # Feuille de route d'implémentation : Auth & RBAC
    ├── SPRINT_02.md                    # Feuille de route d'implémentation : Audit Log
    ├── SPRINT_03.md                    # Feuille de route d'implémentation : Rooms
    ├── SPRINT_04.md                    # Feuille de route d'implémentation : Guests CRM
    ├── SPRINT_05.md                    # Feuille de route d'implémentation : Reservations
    ├── SPRINT_06.md                    # Feuille de route d'implémentation : Stays & Check-In
    ├── SPRINT_07.md                    # Feuille de route d'implémentation : Folios Billing
    ├── SPRINT_08.md                    # Feuille de route d'implémentation : Payments & Caisse
    ├── SPRINT_09.md                    # Feuille de route d'implémentation : Housekeeping
    ├── SPRINT_10.md                    # Feuille de route d'implémentation : Maintenance
    ├── SPRINT_11.md                    # Feuille de route d'implémentation : HR Clock
    ├── SPRINT_12.md                    # Feuille de route d'implémentation : Stock
    ├── SPRINT_13.md                    # Feuille de route d'implémentation : Reporting
    ├── RELEASE_CHECKLIST.md            # Protocole de validation avant chaque release
    └── GO_LIVE_CHECKLIST.md            # Protocole de mise en production de l'hôtel
```

---

## 📖 2. Ordre de Lecture Recommandé

Pour assimiler parfaitement l'architecture du système, il est vivement conseillé de parcourir les documents dans l'ordre suivant :

```
 1. BUSINESS_RULES.md       ➔  Invariants métier fondamentaux à ne jamais enfreindre
           ▼
 2. DATA_DICTIONARY.md      ➔  Structures physiques, clés et typages de données Prisma
           ▼
 3. DECISIONS (ADR)         ➔  Choix d'architecture fondamentaux (ADR-001 à ADR-007)
           ▼
 4. SYSTEM_ARCHITECTURE.md  ➔  Relations inter-modules, flux de données et événements
           ▼
 5. MODULES & API           ➔  Spécifications par domaine et signatures des endpoints REST
           ▼
 6. PLAN D'EXÉCUTION        ➔  Master Plan et feuille de route détaillée par Sprints
```

---

## 🛠️ 3. Conventions Applicatives & d'Ingénierie

*   **Identifiants d'Erreurs :** Toute levée d'exception doit être typée et retourner un code unique au format `PMS-XXX` défini dans `ERROR_CATALOG.md`.
*   **Idempotence :** Toutes les écritures de caisse ou d'encaissement de règlements financiers exigent un en-tête `Idempotency-Key` unique pour neutraliser le risque de double facturation.
*   **Sécurité Systématique :** Toutes les routes d'API d'écriture ou d'accès à des données sensibles doivent être protégées côté serveur par le garde de sécurité RBAC (`PermissionsGuard`) basé sur les permissions fines de la matrice `RBAC_MATRIX.md`.
*   **Attributs HTML Unique :** Tous les éléments d'interface utilisateur (boutons, formulaires, cartes) doivent posséder un attribut `id` unique écrit au format kebab-case pour garantir la testabilité E2E.

---

## 📚 4. Annexes & Notes de Recherche (Non Normatif)

Contrairement aux sections 1 à 3, les documents listés ici **n'engagent pas la conformité du
code**. Ce sont des notes de veille/benchmark à consulter pour inspiration au moment de
spécifier un module — toute idée retenue doit ensuite être formalisée dans un ADR ou un
`modules/*.md` avant d'être implémentée.

*   **`HAIP_BENCHMARK.md`** — Idées de conception (paiements, comptabilité, housekeeping,
    RBAC, UI, sécurité) tirées de l'analyse du code source de HAIP, un PMS open source
    concurrent évalué puis écarté comme socle (voir section "Décision" du document). À
    consulter avant les Sprints 11-13 et lors des passes de polish UI.
