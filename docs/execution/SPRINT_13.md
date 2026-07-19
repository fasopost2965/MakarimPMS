# SPRINT_13.md — Spécification d'Exécution : Module Reporting & Accounting (Rapport de Police & Clôture fiscale)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 13**, dédié aux extractions analytiques réglementaires et à la ventilation financière.

---

## 1. Objectif du Sprint
Développer la console d'extractions analytiques de l'hôtel, permettant de générer en un clic le **Rapport de Police Réglementaire** requis par les autorités marocaines pour les clients hébergés, et de ventiler comptablement les revenus par lignes d'imputations fiscales étanches.

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `reporting` / `accounting`
*   **Documents de référence :** `BUSINESS_RULES.md`, `DATA_DICTIONARY.md`
*   **ADR utilisée :** `ADR-004-Payment-Financial-Integrity.md`
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-COM-001` : Génération automatique journalière conforme du Rapport de Police Réglementaire compilant les fiches d'identités des résidents.
    *   `BR-COM-002` : Ventilation fiscale étanche du chiffre d'affaires : montant HT, TVA Hébergement (10%), TVA Extras (20%) et taxes de séjour perçues pour la comptabilité de l'hôtel.

---

## 3. Contrat d'Ingénierie & Signature Physique

### 3.1. Tables Prisma Concernées
*   Ce module fonctionne principalement en **lecture seule (Read-Only)** sur l'intégralité des tables d'exploitation de la base de données : `Stay`, `Guest`, `Room`, `FolioLine`, `Payment`, `Invoice`.

### 3.2. Services NestJS à Implémenter
*   `PoliceReportService` : Extraction des données d'identités chiffrées des résidents du jour (`Guest`), déchiffrement à la volée en mémoire serveur et formatage dans le format officiel requis par les autorités marocaines.
*   `FinancialReportingService` : Agrégation et consolidation des écritures de la table `FolioLine` et `Invoice` pour ventiler de façon exacte les assiettes de TVA Hébergement (10%) et TVA Extras (20%).

### 3.3. Controllers & Routes d'API
*   `ReportingController` :
    *   `GET /api/v1/reporting/police-report` : Téléchargement du Rapport de Police officiel du jour (formats CSV et PDF sécurisé).
    *   `GET /api/v1/reporting/financial-summary` : Consultation du tableau de bord de ventilation fiscale sur une plage de dates sélectionnée.
    *   `GET /api/v1/reporting/export` : Exportation du grand livre financier au format Excel/CSV pour le cabinet comptable externe de l'hôtel.

### 3.4. DTOs
*   `FinancialSummaryQueryDto` : Date de début, date de fin de la période d'analyse.
*   `FinancialSummaryResponseDto` : Format de données de ventilation consolidée (CA Net HT Hébergement, CA Net HT Extras, TVA Hébergement collectée, TVA Extras collectée, Taxes de séjour collectées, Solde brut global encaissé).

### 3.5. Guards, Pipes & Middlewares
*   `ReportingAccessGuard` : Assure que seuls les collaborateurs de la direction générale, de la comptabilité ou les administrateurs possèdent le privilège d'extraire les données consolidées ou les fiches de police.

---

## 4. Stratégie de Validation & Tests

*   **Tests Unitaires :**
    *   Validation de l'exactitude mathématique de la formule de ventilation inversée (Calcul du HT et de la TVA à partir du TTC facturé).
*   **Tests d'Intégration :**
    *   Vérification qu'une tentative d'extraction du rapport de police par un équipier de ménage ou un technicien est bloquée avec le code HTTP 403.
    *   Vérification du parfait déchiffrement et de l'affichage des informations d'identités (CIN, Passeport) dans le rapport de police extrait pour l'autorité.
*   **Tests E2E :**
    *   Extraction d'un bilan de CA mensuel ➔ Comparaison des totaux consolidés avec la somme brute des factures immuables émises dans la base de données.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :**
    *   Les modules d'extractions analytiques réglementaires et financiers sont fonctionnels et conformes. Les exports de fichiers s'effectuent sans latence grâce à la mise en place d'index physiques sur les clés étrangères et colonnes de dates.
*   **Points de Vigilance :** Ne stocker aucun fichier d'export temporaire contenant des données personnelles de clients sur le disque dur du serveur de production de manière permanente (nettoyage après téléchargement).
*   **Dette Technique Autorisée :** Aucune dérogation sur l'accès restreint aux données financières et personnelles.
*   **Définition de Terminé (DoD) :** Compilation réussie, linter impeccable, tests d'intégration analytiques validés.
