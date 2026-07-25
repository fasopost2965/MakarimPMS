# Note de Cadrage de Reprise Frontend — PMS Hôtel Makarim

## 1. Contexte & Identité du Projet

Le système **PMS Hôtel Makarim** (3 étoiles, 24 chambres, Tétouan, Maroc) est un outil d'exploitation hôtelière mono-établissement, conçu pour un usage professionnel quotidien par l'équipe de réception, la gouvernance, la direction et la gestion administrative.

Le backend NestJS / Prisma / MySQL est audité et fonctionnel sur la chaîne opérationnelle principale (réservation → check-in → séjour → housekeeping → billing → check-out). Le présent cadrage vise à élever le frontend React + Vite + TypeScript + Tailwind CSS au niveau des exigences de productivité, d'ergonomie et de clarté d'un poste de travail hôtelier moderne.

---

## 2. Source de Vérité Documentaire

Afin d'éviter toute régression ou divergence d'architecture, la hiérarchie documentaire suivante fait foi :

1. **Rapports d'Audit & Gouvernance (`docs/audits/`, `docs/governance/ETAT_ACTUEL_PROJET.md`)** : prime sur toute autre documentation pour établir l'état réel du code backend et des contraintes.
2. **Spécifications d'Exigences UX (`docs/frontend-plan/EXIGENCES_UX.md`)** : fixe les règles d'or d'interface (aucune donnée simulée, pattern de chargement/erreur unifié, validations explicites, respect des rôles RBAC).
3. **Cartographie des Écrans & Matrice API (`docs/frontend-plan/CARTOGRAPHIE_ECRANS.md`, `MATRICE_MODULE_API_ECRAN.md`)** : liste le périmètre fonctionnel des 18 modules frontend actuels.
4. **Dictionnaire de Données & Règles Métier (`docs/DATA_DICTIONARY.md`, `BUSINESS_RULES.md`)** : définit le vocabulaire métier invariant (Séjour, Folio, Acompte, Avoir, Registre de Police, Exonération TPT/TVA).

---

## 3. Périmètre & Mandat de la Reprise Frontend

### Objectif Principal
Sublimer et professionnaliser le frontend existant sans refonte chaotique, en renforçant l'efficacité opérationnelle des réceptionnistes et gestionnaires.

### Principes Directeurs
- **Respect des acquis** : Ne pas repartir de zéro. Conserver l'architecture modulaire React 19, les bindings d'API NestJS réels, les composants UI partagés et la charte visuelle institutionnelle « Ardoise & Laiton ».
- **Approche No-AI-Slop** : Bannir les éléments cosmétiques inutiles, les fausses métriques génériques et les dashboards passifs. Chaque composant doit servir une action métier.
- **Strictement sans données simulées** : Tous les indicateurs, graphiques, formulaires et listes doivent être branchés sur les endpoints réels de l'API REST backend.
- **Isolation du Backend** : Aucun changement de schéma de base de données ni de contrat API backend n'est effectué dans cette phase frontend. Tout ajustement éventuel côté serveur est consigné comme dépendance future.

---

## 4. Orientations Stratégiques de la Refonte Ergonomique

1. **Poste de Travail Front Desk & Dashboard Dynamique** :
   - Transformer le tableau de bord actuel (simple grille de KPI statiques) en un véritable poste de commande réception.
   - Intégrer les listes d'arrivées et départs du jour, la grille de statut des chambres en temps réel (Occupée, Propre, Sale, En maintenance), les raccourcis Walk-In/Check-In rapides et des visualisations de tendance basées sur les données réelles (taux d'occupation, chiffre d'affaires, RevPAR, ADR).

2. **Professionnalisation des Formulaires Métier** :
   - Standardiser la saisie avec guidage fort : validation des champs requis, masques de saisie (numéro de téléphone marocain/international, dates, pièces d'identité), retour d'erreur contextualisé et clair.
   - Saisie accélérée pour les arrivées directes (Walk-In) et la fiche de police légale (DGSN).

3. **Restructuration de la Navigation & Organisation des Modules** :
   - Réorganiser la barre de navigation selon un parcours métier fluide : Front Desk / Exploitation → CRM / Clients → Logistique → Finance / RH → Configuration.
   - Reclasser le menu **Paramètres** comme espace global de configuration (Hôtel, Tarifs, Utilisateurs, Moteur de Réservation, Channel Manager) et le positionner systématiquement en **dernière position** dans la navigation.

4. **Clarté Financière & Conformité Réglementaire Marocaine** :
   - Affichage limpide du solde de séjour, de l'état des folios et des garanties d'acompte.
   - Mise en évidence de l'obligation légale de la Fiche de Police pour chaque client hébergé.
