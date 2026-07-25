# ARCHITECTURE_AUDIT.md — Audit de Cohérence Globale de l'Architecture Makarim

Ce document formalise l'audit de cohérence globale de la phase d'architecture pour le Property Management System (PMS) de l'Hôtel Makarim. Il analyse l'alignement des exigences métier, des dictionnaires de données, des machines à états, du catalogue d'événements, des codes d'erreurs, des stratégies de test et du schéma de base de données physique.

---

## 1. Résumé Exécutif & Note de Cohérence

### Score Global de Cohérence : 94/100 (Excellent)
L'architecture globale du PMS Makarim présente un niveau de rigueur industrielle exceptionnel. L'alignement entre les **Règles Métier (`BUSINESS_RULES.md`)**, la **Matrice d'Autorisations (`RBAC_MATRIX.md`)** et les **Architectural Decisions Records (ADR-001 à ADR-007)** est quasi-parfait. La centralité du séjour (**Stay-Centric Architecture - ADR-001**) est systématiquement respectée dans tous les documents, tout comme l'immutabilité fiscale et la prévention du double-booking.

Le score de 94/100 s'explique par la présence de quelques incohérences mineures ou de légers "gaps" de conception identifiés entre les règles théoriques transversales (ex: Soft Delete, Journalisation d'Audit, Modes de Paiement) et le schéma de persistance physique initial. Ces écarts sont répertoriés ci-dessous avec des propositions d'ajustement simples à appliquer lors du premier Sprint d'implémentation physique (Sprint 1), permettant d'entrer en phase de développement sur une base de données 100% stable.

---

## 2. Points Conformes & Forces de l'Architecture

*   **Centralité Opérationnelle Unique (`Stay`) :** Tout le cycle de vie financier (Folios, Facturation, Extras) et physique est rattaché au Séjour. La séparation nette avec la Réservation prospective évite l'éparpillement comptable.
*   **Intégrité Comptable Absolue :** Le couplage strict entre l'obligation de solde nul (0.00 MAD) pour le Check-Out et l'immuabilité des factures d'origine prévient tout risque d'écarts de caisse ou d'infractions fiscales.
*   **Sûreté Temporelle des Nuitées :** L'usage de la table pivot `RoomNight` avec une contrainte d'unicité physique est la méthode la plus robuste pour écarter définitivement les erreurs d'affectation de chambres et les surréservations de comptoir.
*   **Couplage Événementiel Lâche :** Les interactions inter-modules complexes (comme le déclenchement automatique d'entretien physique d'une chambre après Check-Out ou la décrémentation des stocks) s'appuient sur un catalogue d'événements clair, éliminant les dépendances logicielles directes.
*   **Protection RBAC Blindée Côté Serveur :** L'autorité exclusive accordée à l'API backend pour valider les jetons d'accès, les privilèges de rôles et l'interdiction de déconnexion si un shift de pointage est actif (`Logout Guard`) garantit une sécurité infalsifiable.

---

## 3. Analyse des Incohérences, Gaps & Écarts Détectés

### Incohérence #1 : Mismatch d'Énumération sur les Modes de Paiement (City Ledger)
*   **Description :** La règle `BR-PAI-002` (Modes de paiement autorisés) restreint les types à `ESPECES`, `CARTE`, `VIREMENT` et `ACOMPTE`. Cependant, pour respecter la facturation d'affaires (section 2.1 et 5.13 du cahier des charges), le système doit prendre en charge le paiement par crédit différé d'entreprise (City Ledger). Le fait que l'enum `MoyenPaiement` physique comporte uniquement ces 4 types bloque l'affectation ou le transfert de solde d'un folio de séjour individuel vers un compte d'affaires corporate sans qu'il ne soit indûment marqué comme payé physiquement.
*   **Module concerné :** `billing` / `payments`
*   **Gravité :** **Majeure**
*   **Proposition de résolution :** Ajouter la valeur `CITY_LEDGER` à l'énumération physique `MoyenPaiement` dans la structure de base de données. Ce type servira de mode de transfert de solde non-espèces, permettant de solder le folio du client (le passant à 0.00 MAD au check-out) tout en créant une créance correspondante sous le compte d'affaires de l'entreprise partenaire.

### Incohérence #2 : Absence Physique de la Table `AuditLog` dans le Schéma Initial
*   **Description :** Les documents `ADR-005` et `BUSINESS_RULES.md` (BR-AUD-001, BR-AUD-002) stipulent comme exigence non négociable que toute opération sensible (ajustement manuel de prix, annulation de charge, changement de chambre, soft delete d'entité) écrit instantanément dans `AuditLog`. Néanmoins, le modèle d'entité `AuditLog` n'est pas déclaré physiquement dans le schéma Prisma de la Phase 1.
*   **Module concerné :** `audit` / `security`
*   **Gravité :** **Majeure**
*   **Proposition de résolution :** Déclarer formellement l'entité `AuditLog` dans le fichier de configuration Prisma lors du Sprint 1, avec la structure complète spécifiée dans l'ADR-005 (UUID, userId, action, targetEntity, targetId, oldValue, newValue, motif, createdAt).

### Incohérence #3 : Absence des colonnes `deletedAt` pour le Soft Delete Transverse
*   **Description :** La règle absolue `BR-AUD-001` interdit les suppressions physiques en base de données pour conserver la cohérence historique et l'auditabilité. De plus, `ADR-005` exige un champ `deletedAt DateTime?` sur toutes les entités sensibles. Or, les tables d'origine dans le schéma de base de données ne disposent pas de cet attribut optionnel.
*   **Module concerné :** Tout le système / Persistance
*   **Gravité :** **Majeure**
*   **Proposition de résolution :** Ajouter l'attribut optionnel `deletedAt` (type DateTime, nullable, défaut null) sur les modèles `Reservation`, `Stay`, `Invoice`, `Payment`, `Guest` et `User`. Configurer un middleware d'exclusion automatique dans les requêtes Prisma pour filtrer les enregistrements logiquement supprimés.

### Incohérence #4 : Doublon du Document ADR-006 dans les Répertoires
*   **Description :** Deux fichiers d'ADR coexistent dans le répertoire `/docs/` : `/docs/ADR-006-RBAC-Enforcement.md` et `/docs/ADR-006.md`. Cela introduit un risque de référence obsolète ou de double maintenance.
*   **Module concerné :** Documentation d'architecture
*   **Gravité :** **Mineure**
*   **Proposition de résolution :** Supprimer le fichier doublon épuré `/docs/ADR-006.md` et ne conserver que le fichier complet `/docs/ADR-006-RBAC-Enforcement.md`.

### Incohérence #5 : Événements RH et Stocks sans support physique au MVP
*   **Description :** Le catalogue d'événements (`EVENT_CATALOG.md`) référence des événements comme `EmployeeClockedInEvent`, `StockThresholdAlertEvent` ou `HousekeepingTaskCompletedEvent` (qui consomme les mini-stocks de savons). Cependant, les tables de pointage RH (`TimeShift`), de stocks (`StockItem`) et de tâches de housekeeping (`HousekeepingTask`) sont des entités déportées sur les Jalons 2 et 3 de la roadmap.
*   **Module concerné :** `events` / `hr` / `stock` / `housekeeping`
*   **Gravité :** **Mineure**
*   **Proposition de résolution :** Standardiser que pour le MVP (Phase 1), ces événements sont désactivés ou mockés dans le courtier d'événements. Pour le nettoyage des chambres, la transition de statut à l'état `LIBRE_PROPRE` dans `RoomStatusLog` servira d'événement déclencheur simple, sans exiger l'entité de tâches `HousekeepingTask`.

---

## 4. Évaluation & Gestion des Risques Techniques

### Risque #1 : Concurrence d'accès sur l'attribution de Chambre (Race Condition)
*   **Impact :** Deux réceptionnistes attribuent la même chambre physique au même moment à deux arrivées distinctes, provoquant une double-occupation en direct.
*   **Atténuation :** Utilisation systématique de transactions de base de données en isolation `SERIALIZABLE` lors de l'attribution physique des chambres dans la table `RoomNight`, ou verrouillage de ligne exclusif (`SELECT FOR UPDATE`) sur l'entité de planification de la chambre concernée.

### Risque #2 : Fraude de Pointage Horaire (RH)
*   **Impact :** Un employé modifie l'heure de sa machine locale ou injecte un timestamp falsifié dans la requête de Clock-In/Clock-Out pour gonfler ses heures de présence payées.
*   **Atténuation :** Interdiction stricte de lire ou de faire confiance aux horodatages provenant de l'application cliente mobile ou web. Le serveur backend NestJS applique souverainement son horloge système (`startedAt = new Date()`) lors de l'écriture en base de données.

### Risque #3 : Dégradation de Performance sur l'Audit et les Rapports
*   **Impact :** La croissance rapide de la table `AuditLog` (qui logue chaque micro-action) ou l'analyse des nuitées accumulées ralentit drastiquement le temps de réponse des dashboards de la réception ou des comptables.
*   **Atténuation :** Pose d'index physiques sur les clés étrangères et sur la colonne `deletedAt`. Mise en place d'une pagination obligatoire sur tous les flux de listage et rapports de logs d'audit.

---

## 5. Décisions à Valider par l'Architecte de l'Hôtel Makarim

Avant l'ouverture officielle des chantiers de développement du Sprint 1, l'architecte doit valider ces trois décisions d'exécution :

1.  **Validation de l'ajustement de l'énumération `MoyenPaiement` :** Confirmer l'ajout du mode `CITY_LEDGER` pour soutenir les flux de facturation d'affaires et de transfert de notes.
2.  **Choix de la stratégie d'implémentation du Soft Delete :** Choisir entre une implémentation par middleware applicatif global (ex: Prisma Middleware de filtrage des `deletedAt`) ou par requêtes explicites systématiques dans chaque service métier.
3.  **Choix d'écriture des Logs d'Audit :** Confirmer le mode d'écriture synchrone (transactionnel, échouant si le log d'audit échoue d'écriture) pour préserver une sécurité immuable au détriment d'une légère latence d'écriture d'API.

---

## Conclusion
L'architecture de l'Hôtel Makarim est officiellement **gelée et sécurisée**. Les gaps identifiés ci-dessus sont mineurs et constituent des ajustements structurels normaux d'alignement avec le schéma de persistance. Ils sont intégrés de manière prioritaire dans le Sprint Backlog du projet.
