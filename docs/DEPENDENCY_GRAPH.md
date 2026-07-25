# DEPENDENCY_GRAPH.md — Graphe de Dépendances & Chemin d'Exécution

Ce document spécifie le chemin critique et l'ordonnancement obligatoire du développement des 13 modules du PMS de l'Hôtel Makarim. Il identifie les modules bloquants, les flux parallélisables, et cartographie les liaisons de données physiques et événementielles.

---

## 1. Graphe d'Ordonnancement des Développements (Mermaid)

Le diagramme ci-dessous représente le chemin d'implémentation logique. Les flèches pleines représentent les dépendances de compilation ou d'écriture directes (chemin critique obligatoirement séquentiel). Les flèches en pointillés représentent les couplages événementiels asynchrones (couplage lâche).

```mermaid
flowchart TD
    %% Déclaration des styles
    classDef baseStyle stroke:#333,stroke-width:2px;
    classDef critical stroke:#f43f5e,stroke-width:3px,stroke-dasharray: 0;
    classDef blocking stroke:#ea580c,stroke-width:2px,stroke-dasharray: 0;
    classDef parallel stroke:#06b6d4,stroke-width:2px,stroke-dasharray: 5 5;
    classDef readOnly stroke:#10b981,stroke-width:2px;

    %% Nœuds
    M1[1. Module auth]:::blocking
    M2[2. Module audit]:::critical
    M3[3. Module rooms]:::blocking
    M4[4. Module guests]:::baseStyle
    M5[5. Module reservations]:::blocking
    M6[6. Module stay]:::critical
    M7[7. Module billing]:::critical
    M8[8. Module payments]:::critical
    M9[9. Module housekeeping]:::baseStyle
    M10[10. Module maintenance]:::parallel
    M11[11. Module hr]:::parallel
    M12[12. Module stock]:::parallel
    M13[13. Module reporting & accounting]:::readOnly

    %% Relations du Chemin Critique (Directs / Sync)
    M1 --> M2
    M1 --> M11
    M2 --> M5
    M2 --> M7
    M3 --> M5
    M3 --> M9
    M3 --> M10
    M4 --> M5
    M5 --> M6
    M3 --> M6
    M4 --> M6
    M6 --> M7
    M7 --> M8
    M8 --> M6

    %% Relations Événementielles (Asynchrones / Dotted)
    M6 -.->|Check-Out Event| M9
    M9 -.->|Task Completed Event| M12
    M10 -.->|Incident Resolved Event| M9
    M12 -.->|Threshold Alert Event| M13
    
    %% Lectures Transverses Analytiques
    M7 --> M13
    M8 --> M13
    M11 --> M13

    %% Légende intégrée
    subgraph Légende des Types de Modules
        C_Legende[Module Critique]:::critical
        B_Legende[Module Bloquant]:::blocking
        P_Legende[Module Parallélisable]:::parallel
        R_Legende[Module Analytique Read-Only]:::readOnly
    end
```

---

## 2. Analyse des Rôles et Chemin Critique

### 2.1. Les Modules Bloquants (Blocking Nodes)
Ces modules constituent des goulots d'étranglement majeurs. Aucune étape aval ne peut débuter si ces modules ne sont pas finalisés et stables :
*   **`auth` (Module 1) :** Bloque tout le système car il définit les identités (`userId`) et valide les privilèges de rôles (RBAC) exigés par l'ensemble des routes d'API d'écriture.
*   **`rooms` (Module 3) :** Bloque les Réservations (Module 5), les Séjours (Module 6) et la Logistique (Ménage/Maintenance). Sans l'inventaire physique des 24 chambres et son dictionnaire de statuts, aucun planning ou affectation n'est possible.
*   **`reservations` (Module 5) :** Bloque la matérialisation des Séjours (Module 6). L'unicité temporelle d'occupation des chambres (`RoomNight`) est le verrou de sécurité du moteur d'attribution.

### 2.2. Les Modules Critiques (Critical Paths)
Ces modules forment le noyau financier et opérationnel de l'établissement. Une erreur d'implémentation sur ces nœuds compromet directement l'exploitation réelle et l'intégrité comptable de l'Hôtel Makarim :
*   **`stay` (Module 6) :** Gère le check-in, la transition d'état physique de la chambre à `OCCUPEE` et l'ouverture automatique du folio de facturation.
*   **`billing` (Module 7) :** Encapsule l'algèbre de division des notes, de ventilation de TVA et d'imputation de charges.
*   **`payments` (Module 8) :** Gère l'encaissement et garantit la barrière inviolable du check-out à solde nul (0.00 MAD) avec verrou d'idempotence contre le double-clic de carte bancaire.

---

## 3. Opportunités de Parallélisation du Code

Pour optimiser le temps de développement, plusieurs modules autonomes peuvent être produits en parallèle par différentes équipes une fois le socle fondamental validé :

1.  **Binôme Maintenance / Ménage (Modules 9 & 10) :**
    *   *Pourquoi :* Ils dépendent uniquement de l'inventaire physique des chambres (`rooms`) et n'interfèrent pas avec le flux d'accueil ou de facturation du client.
    *   *Moment possible :* Dès la validation du **Sprint 2**.
2.  **Module Ressources Humaines & Pointage (Module 11) :**
    *   *Pourquoi :* Il est totalement étanche vis-à-vis des réservations et folios clients. Il requiert uniquement la présence du module `auth` (pour la liaison aux profils de comptes d'utilisateurs `User`).
    *   *Moment possible :* Dès la validation du **Sprint 1**.
3.  **Module de Gestion de Stocks (Module 12) :**
    *   *Pourquoi :* Il n'interagit avec la logistique de ménage que via l'écoute asynchrone d'événements de fin d'entretien. La structure de base de données d'inventaire de consommables peut être codée de manière isolée.
    *   *Moment possible :* Dès la validation du **Sprint 7** (Housekeeping).

---

## 4. Stratégie de Déploiement & Validation Continue

L'intégration continue (CI/CD) suit une stratégie de validation par couches (Layer-by-Layer Verification) :
*   **Validation des Fondations (Sprint 1) :** Validation des transactions immuables d'audit et des gardes de jetons de sessions JWT.
*   **Validation Opérationnelle (Sprint 2 à 4) :** Simulation de parcours de réservations multiples avec tentatives d'écritures simultanées pour valider la prévention du surbooking.
*   **Validation Financière (Sprint 5 & 6) :** Validation de l'intégrité des folios de charges et tentative de check-out illégal de séjours avec solde débiteur non réglé.
*   **Validation Analytique Légale (Sprint 10) :** Extraction et contrôle de conformité du fichier de police réglementaire et du journal fiscal consolidé.
