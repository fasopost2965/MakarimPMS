# Spécification Technique — Module Reporting (reporting.md)

---

## 1. Objectif du module
Le module **Reporting & Performance** fournit les tableaux de bord analytiques, financiers, d'exploitation et statistiques consolidés nécessaires à la direction et au contrôle de gestion de l'Hôtel Makarim. Il permet de piloter la performance de l'établissement (RevPAR, Taux d'occupation), de suivre les déclarations fiscales et de garantir la production de synthèses d'activité fiables.

---

## 2. Responsabilités
Le module est seul responsable de :
* Le calcul des indicateurs clés de performance hôtelière (ADR, RevPAR, Chiffre d'Affaires consolidé, Taux d'Occupation Net).
* La consolidation mensuelle des déclarations de taxes hôtelières municipales (taxe de séjour collectée).
* La compilation statistique des nuitées hôtelières pour la déclaration de police et les enquêtes du ministère du Tourisme.
* La génération de synthèses graphiques interactives de performance d'exploitation pour la direction de l'hôtel.
* L'exportation de fichiers de statistiques d'activité aux formats PDF et Excel.
* **(F3, implémenté)** La prévision du taux d'occupation par type de chambre et par jour, avec recommandation tarifaire indicative (Revenue Manager / Yield Management) — voir §17.

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* **Toute écriture, modification, ou insertion de données** opérationnelles au sein des tables de base hôtelière (le module reporting est STRICTEMENT limité à de la lecture analytique).
* La modification directe de tarifs ou l'imputation de paiements (confiés aux modules `billing` et `payments`).
* La création ou l'affectation de tâches d'entretien ou de pannes (confiées aux modules `housekeeping` et `maintenance`).

---

## 4. Entités manipulées
Ce module consulte et analyse en lecture exclusive les entités suivantes du `DATA_DICTIONARY.md` :
* `RoomNight` (Analyse d'occupation historique)
* `Stay` (Suivi de la consommation réelle de séjours)
* `FolioLine` (Reconstitution des débits financiers et taxes)
* `Invoice` (Consolidation du chiffre d'affaires déclaré)
* `Guest` (Statistiques démographiques et nationalités pour la préfecture)
* `Room` (Inventaire matériel d'exploitation de base)
* `RoomType` (Grille de base et capacité, pour la prévision d'occupation/tarif F3)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-REP-001 (Analytique direction) :** Mise à disposition des indicateurs clés (RevPAR, TO) calculés selon les normes hôtelières.
* **BR-REP-002 (Transmission réglementaire) :** Génération des données de taxes de séjour et fiches de police conformes aux exigences marocaines.

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-001 (Stay-Centric Architecture)](/docs/ADR-001-Stay-Centric-Architecture.md) :** Modélisation unifiée de la performance d'occupation autour du séjour client.
* **[ADR-002 (Folio & Billing Model)](/docs/ADR-002-Folio-Billing-Model.md) :** Clarté et ventilation comptable des taxes par folios scellés.
* **[ADR-004 (Payment & Financial Integrity)](/docs/ADR-004-Payment-Financial-Integrity.md) :** Intégrité financière consolidée en MAD.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Protection et restriction d'accès aux rapports hautement stratégiques.

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `reporting:read` : Autorisé exclusivement pour `ADMINISTRATEUR` et `COMPTABLE`.
* *Note :* Par mesure de confidentialité et de secret des affaires, aucun autre rôle opérationnel (Réception, Ménage, Maintenance, RH) ne dispose de droits de lecture ou de consultation sur les rapports financiers consolidés de l'hôtel.

---

## 8. Flux entrants
Le module intercepte les événements et requêtes suivants :
* Requête périodique (quotidienne, mensuelle) de consultation des tableaux de bord par la direction.
* Demande de génération de l'export d'activité mensuel de l'hôtel.

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* Aucun événement d'écriture ou de modification en base n'est jamais émis par ce module. Il produit uniquement des payloads de visualisation de données et des fichiers de déchargements (PDF/Excel).

---

## 10. Dépendances autorisées
Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants en lecture-seule :
* `rooms` / `stay` / `billing` / `guests` : Pour lire les bases historiques nécessaires à la compilation des statistiques hôtelières de l'Hôtel Makarim.

---

## 11. Dépendances interdites
Ce module a l'interdiction stricte de dépendre de :
* `hr` : Le module de reporting hôtelier n'accède pas aux fiches de paie ou au pointage des équipiers de ménage. *Justification : Ségrégation absolue des données d'exploitation commerciale et de la confidentialité de la paie RH.*
* **N'IMPORTE QUEL MODULE EN ÉCRITURE :** Le module reporting ne doit jamais comporter de méthode d'écriture ou de mutation sur un service tiers. *Justification : Un module de reporting doit être passif et ne doit jamais altérer les données d'exploitation de production.*

---

## 12. Contraintes métier
* **Exclusion de l'Inventaire des Chambres Hors-Service (Taux d'Occupation Net) :** Lors du calcul du Taux d'Occupation Net de l'hôtel, le dénominateur de chambres vendables disponibles doit impérativement soustraire de l'inventaire total (24 chambres) les chambres physiques déclarées bloquées techniquement (`EN_MAINTENANCE`) sur la période ciblée.
* **Normes de Calcul Hôtelières Internationales :**
  * *Taux d'Occupation (TO) :* (Nombre de chambres occupées / Nombre de chambres vendables disponibles) * 100
  * *Prix Moyen Chambre (ADR) :* Chiffre d'Affaires hébergement HT / Nombre de chambres vendues
  * *RevPAR (Revenu par Chambre Disponible) :* Chiffre d'Affaires hébergement HT / Nombre de chambres vendables disponibles (ou TO * ADR).

---

## 13. Invariants
* **INV-REP-001 (Non-altération de production) :** Le module de reporting s'exécute strictement à l'aide de requêtes de lecture de données SQL (`SELECT` Prisma). Aucune opération d'insertion (`insert`), de modification (`update`), ou de suppression (`delete`) n'est autorisée par ce module sur les bases opérationnelles de production de l'hôtel.

---

## 14. États manipulés
Le module de reporting n'implémente pas de machine à états ; il compile et présente des données statistiques statiques et historiques consolidées.

---

## 15. Points sensibles
* **Calculs de performances sur de grands volumes de données :** Risque de dégradation du temps de réponse de l'application PMS lors d'analyses complexes sur plusieurs exercices hôteliers historiques.
  * *Résolution :* Mise en place d'index de base de données composites sur les tables pivots d'occupation (`RoomNight`) et de lignes de folio, et utilisation de requêtes de agrégations optimisées.

---

## 16. Dette technique connue
* **Seuils de recommandation tarifaire (F3) fixes, non configurables :** `GET /reporting/yield-forecast` classe le taux d'occupation prévisionnel selon deux seuils codés en dur (`reporting/utils/yield-recommendation.util.ts` : ≥80% → HAUSSE +15%, <40% → BAISSE -10%, sinon MAINTIEN) plutôt que des valeurs administrables via `parameters`. Choix délibéré : le cahier des charges ne demande qu'une recommandation consultative (jamais une écriture sur `SeasonRate`, INV-REP-001 reste respecté), un module de configuration des seuils serait une extension distincte hors périmètre de cette itération.

---

## 17. Fonctionnalités prévues ultérieurement
* **Phase 4 (F3, implémenté) :** Moteur analytique prédictif de Yield Management pour recommander de manière automatique l'augmentation ou la baisse des grilles tarifaires de nuitées selon le taux d'occupation prévisionnel. `GET /reporting/yield-forecast` (`reporting:read`) renvoie, par type de chambre et par jour sur une plage de dates, le taux d'occupation prévisionnel (dénominateur excluant les chambres `EN_MAINTENANCE`, §12), le prix actuel (`ParametersService.getSeasonRatesForRoomType`, jamais de lecture directe de `SeasonRate`) et une recommandation (`HAUSSE`/`MAINTIEN`/`BAISSE`) avec un prix suggéré — purement indicatif, aucune écriture sur `SeasonRate` (la mise à jour reste un acte humain via `parameters:write`).

---

## 18. Checklist de Pull Request
Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Le code de ce module n'émet aucune requête SQL d'écriture ou d'altération de base de données.
* [ ] Les calculs du Taux d'Occupation Net soustraient correctement les chambres en maintenance technique du dénominateur de chambres disponibles.
* [ ] Le contrôleur d'API de consultation des rapports exige de manière étanche la permission `reporting:read` côté serveur.
* [ ] Les graphiques d'analyses financières et comptables utilisent exclusivement les librairies de visualisation agréées (`d3` ou `recharts`).
