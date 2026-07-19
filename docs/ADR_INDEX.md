# Index des Décisions d'Architecture (ADR Index) — PMS Hôtel Makarim

Ce document constitue la table des matières officielle et le registre central de toutes les **Architecture Decision Records (ADR)** validées pour le Property Management System (PMS) de l'Hôtel Makarim (Tétouan, Maroc).

Il permet à l'équipe de développement, ainsi qu'aux agents de codage autonomes (comme Claude Code), de localiser instantanément la décision de référence, les contraintes d'intégrité et les invariants techniques liés à chaque grand domaine de l'application.

---

## 📅 Registre Historique des Décisions

| Identifiant | Titre de la Décision | Date de Validation | Statut | Auteur | Concept Pivot & Invariants Majeurs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **[ADR-001](/docs/ADR-001-Stay-Centric-Architecture.md)** | **Stay-Centric Architecture** | 2026-07-19 | ✅ Validé | Architecte PMS | Le **Séjour (Stay)** est l'objet central opérationnel, décorrélé de la Réservation. Gestion de la liaison 1-à-1 et de l'historique des modifications d'attribution. |
| **[ADR-002](/docs/ADR-002-Folio-Billing-Model.md)** | **Folio & Billing Model** | 2026-07-19 | ✅ Validé | Architecte PMS | Découplage complet Séjour ➔ Facture. Imputation financière par **Folios multiples** (hébergement vs extras). Invariabilité des lignes facturées. |
| **[ADR-003](/docs/ADR-003-Room-State-Machine.md)** | **Room State Machine** | 2026-07-19 | ✅ Validé | Architecte PMS | Machine à états des chambres (`statut` de Room) pilotée par les événements de Check-out, de ménage (`Gouvernante`) et de pannes bloquantes de `Maintenance`. |
| **[ADR-004](/docs/ADR-004-Payment-Financial-Integrity.md)** | **Payment & Financial Integrity** | 2026-07-19 | ✅ Validé | Architecte PMS | Idempotence obligatoire des paiements par index unique `idempotencyKey`. Immutabilité des factures émises, calculs en Dirham Marocain (MAD), plafonds espèces. |
| **[ADR-005](/docs/ADR-005-Audit-Soft-Delete.md)** | **Audit & Soft Delete** | 2026-07-19 | ✅ Validé | Architecte PMS | Bannissement des suppressions physiques (`DELETE`). Remplacement par le **Soft Delete** (`deletedAt`). Table de traçabilité indélébile `AuditLog` avec motif écrit obligatoire (>= 10 caractères). |
| **[ADR-006](/docs/ADR-006-RBAC-Enforcement.md)** | **RBAC Enforcement** | 2026-07-19 | ✅ Validé | Architecte PMS | Sécurité d'accès absolue contrôlée par le serveur (Server-Side JWT Guards). Ségrégation stricte des tâches métiers entre les 6 rôles de la matrice. |
| **[ADR-007](/docs/ADR-007-Time-Shift-Attendance.md)** | **Time Shift & Attendance State Machine** | 2026-07-19 | ✅ Validé | Architecte PMS | Pointage et présence des collaborateurs gérés par une machine à états (`TimeShiftSegment`), horloge exclusivement serveur, blocage de déconnexion si shift actif. |

---

## 🗺️ Cartographie des Décisions par Domaine Métier

Pour toute modification, correction ou ajout d'une brique applicative, référez-vous impérativement aux ADR correspondantes :

### 🏨 1. Réservations, Enregistrement & Séjours
* **Sujets :** Attribution de chambre, Walk-In, Check-In, Check-Out, modification de séjour, fiches de police, CRM client.
* **ADR de référence :**
  * **[ADR-001 (Stay-Centric Architecture)](/docs/ADR-001-Stay-Centric-Architecture.md)** : Gestion de la transition Réservation ➔ Séjour et centralisation des opérations sur le séjour.
  * **[ADR-003 (Room State Machine)](/docs/ADR-003-Room-State-Machine.md)** : Règles de blocage d'enregistrement (veto d'occupation) si chambre sale ou en panne.
  * **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md)** : Traçabilité des annulations de séjours et d'ajustements manuels de tarifs.

### 💰 2. Facturation, Encaissements & Comptabilité
* **Sujets :** Création de folios, ajout d'extras, paiement par carte/espèces, impression de factures, édition d'avoirs fiscaux (Credit Notes), TVA marocaine, taxe de séjour.
* **ADR de référence :**
  * **[ADR-002 (Folio & Billing Model)](/docs/ADR-002-Folio-Billing-Model.md)** : Structure des folios et transfert de charges entre chambres.
  * **[ADR-004 (Payment & Financial Integrity)](/docs/ADR-004-Payment-Financial-Integrity.md)** : Sécurisation d'idempotence des flux bancaires et application des taxes de séjour à taux TVA 0%.
  * **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md)** : Verrouillage comptable définitif des folios facturés, soft delete des extras erronés.

### 🧹 3. Entretien, Stocks & Maintenance Technique
* **Sujets :** Tâches de ménage des équipiers, inspection des gouvernantes, signalement d'incidents, réparation de pannes, sortie de consommables de stock.
* **ADR de référence :**
  * **[ADR-003 (Room State Machine)](/docs/ADR-003-Room-State-Machine.md)** : Cycle de vie complet de l'état des chambres, règles de libération après réparation vers le nettoyage.
  * **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md)** : Autorisation de contrôle de propreté exclusive au rôle de Gouvernante (`housekeeping:control`).

### 👥 4. Ressources Humaines, Shifts & Pointage
* **Sujets :** Planification des plannings d'équipes, validation d'échanges de shifts, bulletins de paie, cotisations CNSS, pointage de début/fin de service.
* **ADR de référence :**
  * **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md)** : Isolation stricte du module RH et des salaires CNSS, invisibles aux autres rôles.
  * **[ADR-007 (Time Shift & Attendance)](/docs/ADR-007-Time-Shift-Attendance.md)** : Règles anti-fraude d'horodatage serveur, machine à états des shifts, blocage de déconnexion d'application.

---

## 🛠️ Protocole d'Intégration pour les Développeurs et Agents IA

Chaque fois qu'une nouvelle brique de code ou une modification de structure est initiée sur ce projet, l'intervenant doit respecter scrupuleusement la séquence d'intégration suivante :

1. **Vérification de l'Index (le présent document) :** Identifier les ADR impactées par la nature du ticket ou de l'Issue de développement.
2. **Consultation et Lecture obligatoire :** Appeler la commande d'affichage ou ouvrir le fichier de l'ADR de référence avant d'écrire la moindre ligne de code (ex: *Lire ADR-004 avant de modifier les routes de paiement*).
3. **Application des Invariants :** Les règles listées dans la section "Invariants" de chaque ADR font office de tests d'intégration absolus. Si une route ou une structure de données enfreint l'un de ces invariants, elle sera systématiquement rejetée à l'étape de revue ou d'intégration continue (CI).
4. **Validation par Checklist :** Avant de soumettre une Pull Request ou de déclarer une tâche terminée, l'intervenant doit cocher et valider l'intégralité de la **Checklist de conformité pour les Pull Requests** située à la fin de chaque ADR concernée.
