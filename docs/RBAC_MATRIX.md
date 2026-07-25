# RBAC_MATRIX.md — Matrice de Contrôle d'Accès Basé sur les Rôles (RBAC)

Ce document spécifie la matrice complète des droits et permissions de sécurité régissant l'accès aux fonctionnalités du **Property Management System (PMS) de l'Hôtel Makarim**. Cette politique RBAC est implémentée de manière étanche côté serveur (backend) sur chaque endpoint d'API, assurant la conformité et la sécurité des données d'exploitation.

---

## 🔑 Rôles du Système
Le PMS s'articule autour de six rôles professionnels identifiés, correspondant aux profils réels d'utilisation de l'établissement :
1. **Administrateur** : Accès total de configuration, d'audit et d'administration de la plateforme.
2. **Réception** : Acteur opérationnel du front-desk assurant la relation client, les réservations et les mouvements quotidiens.
3. **Gouvernante** : Superviseur de l'état de propreté et du ménage des chambres physiques.
4. **Comptable** : Gestionnaire financier de la facturation, des encaissements, des avoirs et des exports de clôture fiscale.
5. **Maintenance** : Équipe technique en charge des réparations, du blocage technique et de l'entretien lourd.
6. **RH** : En charge de la gestion des employés, des plannings de shifts, des pointages et de la préparation de la paie.

---

## 📊 Matrice Visuelle Globale

Le croisement des **Modules** du PMS et des **Actions** d'accès s'établit selon la grille de répartition suivante.
*Légende : **R** = Read (Lecture), **W** = Write (Écriture/Modification), **D** = Delete (Soft Delete uniquement), **E** = Export (Extraction externe).*

| Module / Périmètre | Administrateur | Réception | Gouvernante | Comptable | Maintenance | RH |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **reservations** | R / W / D / E | R / W | ❌ | ❌ | ❌ | ❌ |
| **checkin** (Stays) | R / W / D / E | R / W | ❌ | ❌ | ❌ | ❌ |
| **guests** (CRM / Blacklist) | R / W / D / E | R / W | ❌ | ❌ | ❌ | ❌ |
| **housekeeping** | R / W / D / E | R / W | R / W | ❌ | ❌ | ❌ |
| **maintenance** | R / W / D / E | ❌ | R | ❌ | R / W | ❌ |
| **billing** (Folios, Factures) | R / W / D / E | ❌ | ❌ | R / W / E | ❌ | ❌ |
| **dashboard** (Météo/Stats) | R / W / D / E | R | ❌ | R | ❌ | ❌ |
| **stock** (Fournisseurs) | R / W / D / E | ❌ | R / W | ❌ | ❌ | ❌ |
| **rh** (Shifts, Paie CNSS) | R / W / D / E | ❌ | ❌ | ❌ | ❌ | R / W / E |
| **audit** (Logs système) | R / E | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🛠️ Spécification Détaillée des Permissions par Rôle

---

### 1. Rôle : Administrateur

Le rôle d'administrateur dispose de l'intégralité des privilèges de lecture, d'écriture, d'exportation et d'annulation sur l'ensemble des modules applicatifs.

| Module | Action | Autorisé | Justification Métier | Source | Criticité |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **Tous les modules** | `read` | **OUI** | Nécessaire pour la supervision globale de l'exploitation hôtelière. | Plan d'exécution | Critique |
| **Tous les modules** | `write` | **OUI** | Permet la modification de configuration globale, l'override de prix, et la correction d'erreurs humaines. | Plan d'exécution | Critique |
| **Tous les modules** | `delete` | **OUI** | Autorisé à déclencher des procédures de désactivation ou Soft Delete sur les entités de référence. | Plan d'exécution | Critique |
| **Tous les modules** | `export` | **OUI** | Nécessaire pour l'extraction exhaustive des bases de données en vue d'audits ou de sauvegardes externes. | Plan d'exécution | Critique |

---

### 2. Rôle : Réception

Le rôle Réception est centré sur le front-desk et le parcours opérationnel immédiat du voyageur, du premier contact (réservation) jusqu'au départ physique (check-out).

| Module | Action | Autorisé | Justification Métier | Source | Criticité |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **reservations** | `read` | **OUI** | Doit pouvoir rechercher une réservation existante pour répondre aux appels ou préparer l'accueil. | Cahier des charges | Haute |
| **reservations** | `write` | **OUI** | Doit pouvoir saisir de nouvelles réservations ou enregistrer des annulations demandées par le client. | Cahier des charges | Haute |
| **reservations** | `delete` | **NON** | Interdit de supprimer physiquement une réservation de la base pour maintenir l'historique et l'auditabilité. | Plan d'exécution | Haute |
| **reservations** | `export` | **NON** | Réservé à l'administrateur afin d'éviter la fuite massive de fichiers clients (RGPD / CRM). | Décision Product Owner | Moyenne |
| **checkin** (Stays) | `read` | **OUI** | Doit suivre les séjours en cours d'occupation pour coordonner les services. | Cahier des charges | Haute |
| **checkin** (Stays) | `write` | **OUI** | Réalise l'acte opérationnel de Check-in, de Walk-In et initie la clôture de séjour (Check-out). | Cahier des charges | Haute |
| **checkin** (Stays) | `delete` | **NON** | Un séjour consommé ou commencé ne peut en aucun cas être détruit physiquement. | Plan d'exécution | Critique |
| **checkin** (Stays) | `export` | **NON** | Non requis pour la gestion quotidienne de l'accueil. | Décision Product Owner | Faible |
| **guests** | `read` | **OUI** | Doit rechercher les fiches CRM pour accélérer les saisies et identifier les VIP. | Cahier des charges | Moyenne |
| **guests** | `write` | **OUI** | Crée ou met à jour les informations des fiches clients lors de la saisie d'une réservation ou au check-in. | Cahier des charges | Moyenne |
| **guests** | `delete` | **NON** | Interdit de détruire des historiques de fiches clients. | Plan d'exécution | Moyenne |
| **guests** | `export` | **NON** | La base de données clients est un actif hautement confidentiel de l'établissement. | Décision Product Owner | Haute |
| **housekeeping** | `read` | **OUI** | Doit lister les chambres propres pour y attribuer immédiatement les clients qui arrivent. | Cahier des charges | Haute |
| **housekeeping** | `write` | **OUI** | Autorisé à forcer le changement de statut d'une chambre en cas de besoin critique au comptoir. | Décision Product Owner | Moyenne |
| **housekeeping** | `delete` | **NON** | Aucun droit de suppression sur les plannings ou tâches d'entretien. | Plan d'exécution | Faible |
| **housekeeping** | `export` | **NON** | Pas d'utilité opérationnelle d'exportation pour la réception. | Décision Product Owner | Faible |
| **maintenance** | `read` / `write` | **NON** | Les questions techniques complexes sont escaladées directement à la Gouvernante ou aux techniciens. | ADR validée | Moyenne |
| **billing** | `read` / `write` | **NON** | La validation des comptes de folio, l'émission des factures finales et des avoirs réglementaires incombent uniquement au Comptable ou à l'Admin. *Note : La réception peut voir l'état des soldes durant le checkout pour s'assurer qu'il est à 0 MAD, mais sans droits de write comptables.* | ADR validée | Haute |
| **dashboard** | `read` | **OUI** | Suit le résumé immédiat de l'activité du jour (arrivées prévues, départs prévus, taux d'occupation actuel). | Cahier des charges | Moyenne |
| **dashboard** | `write` / `delete` | **NON** | Le dashboard consolidé est une interface d'agrégation d'indicateurs système non modifiable manuellement. | Plan d'exécution | Moyenne |

---

### 3. Rôle : Gouvernante

Le rôle de Gouvernante orchestre la logistique interne, le nettoyage des chambres, les flux de consommables ménagers (stocks) et gère le contrôle qualité de la remise en vente.

| Module | Action | Autorisé | Justification Métier | Source | Criticité |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **housekeeping** | `read` | **OUI** | Doit cartographier en temps réel l'ensemble des états de propreté et d'occupation des chambres. | Cahier des charges | Haute |
| **housekeeping** | `write` | **OUI** | Assigne les tâches de ménage aux équipiers et valide le contrôle qualité final réactivant la chambre en `LIBRE_PROPRE`. | Cahier des charges | Haute |
| **housekeeping** | `delete` | **NON** | Les structures de tâches de ménage sont des traces immuables d'historique de propreté. | Plan d'exécution | Faible |
| **housekeeping** | `export` | **NON** | Pas d'exigence réglementaire ou métier d'extraction brute. | Décision Product Owner | Faible |
| **maintenance** | `read` | **OUI** | Doit identifier quelles chambres sont indisponibles pour cause de panne technique afin d'adapter les plannings de ménage. | ADR validée | Moyenne |
| **maintenance** | `write` / `delete` | **NON** | L'ouverture et la fermeture réglementaire des pannes relèvent du personnel de maintenance. | Plan d'exécution | Moyenne |
| **stock** | `read` | **OUI** | Suit l'état des consommables de chambre (savons, kits d'accueil, draps de rechange) en réserve. | Cahier des charges | Moyenne |
| **stock** | `write` | **OUI** | Déclare l'utilisation réelle de produits ou enregistre les entrées de nouveaux colis de nettoyage. | Cahier des charges | Moyenne |
| **stock** | `delete` / `export` | **NON** | Pas de privilège de destruction des stocks ou d'exportation massive de données fournisseurs. | Plan d'exécution | Faible |
| **Autres modules** | Tous | **NON** | Ségrégation étanche des rôles. La Gouvernante n'a aucune action sur la finance, la paie, les fiches de police ou les réservations. | ADR validée | Haute |

---

### 4. Rôle : Comptable

Le Comptable gère exclusivement le volet financier, la validation légale des écritures de folio, la facturation définitive, les calculs de taxes de séjour et les liaisons comptables.

| Module | Action | Autorisé | Justification Métier | Source | Criticité |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **billing** | `read` | **OUI** | Doit examiner les folios ouverts, les encaissements journaliers et les facturations en suspens. | Cahier des charges | Haute |
| **billing** | `write` | **OUI** | Émet la facture de clôture définitive, valide les corrections via la génération d'Avoirs et affecte les règlements. | Cahier des charges | Haute |
| **billing** | `delete` | **NON** | Interdiction absolue de modification de facture émise (Inviolabilité comptable). Tout doit passer par un avoir. | Cahier des charges | Critique |
| **billing** | `export` | **OUI** | Extrait les journaux comptables de ventes et d'encaissements pour les intégrer au logiciel comptable externe. | Cahier des charges | Haute |
| **dashboard** | `read` | **OUI** | Analyse les graphiques financiers de performance globale, le RevPAR et l'évolution temporelle des chiffres d'affaires. | Cahier des charges | Moyenne |
| **dashboard** | `write` / `delete` | **NON** | Le dashboard financier consolide dynamiquement les écritures comptables sans intervention manuelle possible. | Plan d'exécution | Moyenne |
| **Autres modules** | Tous | **NON** | N'a aucune action opérationnelle sur les attributions physiques de chambres, la planification du ménage ou les tâches techniques. | ADR validée | Haute |

---

### 5. Rôle : Maintenance

Le rôle de Maintenance assure la résolution des pannes et gère le blocage ou déblocage technique des chambres physiques.

| Module | Action | Autorisé | Justification Métier | Source | Criticité |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **maintenance** | `read` | **OUI** | Doit lister les ordres de travail et les tickets de maintenance en attente sur l'ensemble de l'hôtel. | Cahier des charges | Haute |
| **maintenance** | `write` | **OUI** | Déclare l'ouverture d'un incident ou valide sa résolution technique (ce qui libère fonctionnellement la chambre). | Cahier des charges | Haute |
| **maintenance** | `delete` | **NON** | Les tickets ou interventions ne doivent pas être supprimés afin de conserver l'historique technique des équipements. | Plan d'exécution | Moyenne |
| **maintenance** | `export` | **NON** | Pas d'utilité opérationnelle d'exportation pour le service de maintenance. | Décision Product Owner | Faible |
| **Autres modules** | Tous | **NON** | Ségrégation stricte. Le technicien n'a aucun accès aux données clients, réservations, paie ou folios de facturation. | ADR validée | Haute |

---

### 6. Rôle : RH (Ressources Humaines)

Le rôle RH gère le capital humain de l'Hôtel Makarim, le planning des roulements d'équipes, l'enregistrement infalsifiable des heures de présence et le traitement de la paie.

| Module | Action | Autorisé | Justification Métier | Source | Criticité |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **rh** (Staff & Paie) | `read` | **OUI** | Visualise les fiches individuelles de contrat, les plannings de shifts mensuels et les rapports de pointage serveur. | Cahier des charges | Haute |
| **rh** (Staff & Paie) | `write` | **OUI** | Saisit les plannings, valide formellement les demandes d'échanges de shifts, et génère le calcul des bulletins de paie CNSS. | Cahier des charges | Haute |
| **rh** (Staff & Paie) | `delete` | **NON** | Interdit de supprimer définitivement un dossier de paie ou d'employé (Soft Delete uniquement). | Plan d'exécution | Haute |
| **rh** (Staff & Paie) | `export` | **OUI** | Extrait les relevés mensuels de cotisations CNSS et de masse salariale pour les télé-déclarations obligatoires. | Cahier des charges | Haute |
| **Autres modules** | Tous | **NON** | Protection stricte des données opérationnelles de l'hôtel. Le pôle RH n'intervient pas dans la réservation, la facturation des clients ou la gestion technique des chambres. | ADR validée | Haute |
