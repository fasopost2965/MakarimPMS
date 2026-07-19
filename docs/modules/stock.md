# Spécification Technique — Module Stocks & Consommables (stock.md)

---

## 1. Objectif du module
Le module **Stocks & Consommables** assure le suivi, la valorisation et le contrôle d'inventaire en temps réel de l'ensemble des ressources physiques d'exploitation de l'Hôtel Makarim (produits d'accueil, linge d'étages, café, consommations de minibars et fournitures techniques de maintenance). Il protège l'établissement contre les ruptures de stock critiques et assure le contrôle de consommation interne.

---

## 2. Responsabilités
Le module est seul responsable de :
* Le maintien du référentiel physique des articles en stock d'exploitation (`StockItem`).
* L'enregistrement rigoureux de chaque mouvement physique d'inventaire (Entrées de livraisons fournisseurs, Sorties d'exploitation).
* La surveillance des seuils de stocks de sécurité et la publication d'alertes de ruptures critiques.
* La consignation des justifications écrites pour toute sortie d'inventaire exceptionnelle (casse, vol, péremption).
* La valorisation financière instantanée de l'inventaire en stock de l'hôtel (méthode d'évaluation comptable du stock).

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* Le processus d'achat direct ou de facturation fournisseurs (confié au module comptable général externe).
* L'enregistrement des heures de présence des salariés ou du pointage (confié au module `hr`).
* L'imputation financière de consommations extras au client final (confié au module `billing`).

---

## 4. Entités manipulées
Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `StockItem` (Fiche article en stock, quantité et seuil critique)
* `StockMovement` (Journal transactionnel d'entrée/sortie de ressources physiques)
* `Room` (Lieu de destination physique pour le réassort de consommables)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-STK-001 (Seuil critique d'alerte) :** Émission d'une notification prioritaire dès que le stock physique descend sous le seuil d'alerte configuré pour l'article.
* **BR-STK-002 (Valorisation de stock) :** Évaluation comptable du stock de l'Hôtel Makarim selon la méthode du Coût Unitaire Moyen Pondéré (CUMP).
* **BR-STK-003 (Justification de sortie exceptionnelle) :** Exigence de motif et saisie de justification explicative de 10 caractères minimum lors d'ajustements d'écarts d'inventaire.

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md) :** Obligation d'auditer de manière synchrone toutes les écritures d'ajustement ou de pertes d'inventaires sensibles.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Cloisonnement des permissions de mise à jour des inventaires d'exploitation.

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `stock:read` : Autorisé pour tous les rôles de l'hôtel (`ADMINISTRATEUR`, `RECEPTION`, `GOUVERNANTE`, `COMPTABLE`, `MAINTENANCE`, `RH`).
* `stock:write` (Enregistrement de livraison, déclaration de sortie, modification d'article) : Autorisé pour `ADMINISTRATEUR`, `GOUVERNANTE` (produits d'accueil, linge), `MAINTENANCE` (fournitures de maintenance).
* *Note :* Les réceptionnistes peuvent consulter l'inventaire des minibars, mais n'ont aucun droit de modification ou de saisie de livraisons.

---

## 8. Flux entrants
Le module intercepte les événements et requêtes suivants :
* Réception d'une commande fournisseur (déclare une entrée physique d'articles).
* Sortie de draps ou de produits d'accueil par un équipier de ménage pour la réfection d'une chambre.
* Consommation d'un article de minibar signalée lors de l'inspection de départ de la chambre (déclenche la sortie de stock d'exploitation).
* Saisie d'un constat de perte ou de péremption de produits par la Gouvernante.

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* `STOCK_SEUIL_CRITIQUE_ALERTE` : Notifie la gouvernante et l'administrateur qu'un article de stock exige d'être réapprovisionné en urgence.
* `INVENTAIRE_VALORISE` : Émis mensuellement pour la clôture comptable d'exploitation de la direction.

---

## 10. Dépendances autorisées
Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `rooms` : Pour valider que le lieu physique de destination ou de retrait d'articles de minibars correspond à une chambre physique réelle et existante en base.

---

## 11. Dépendances interdites
Ce module a l'interdiction stricte de dépendre de :
* `billing` / `payments` : Le module de stock ne doit pas manipuler de données financières de factures clients. Les coûts des articles en stock sont des coûts d'achats internes et non des prix de ventes d'extras. *Justification : Ségrégation absolue des coûts de revient internes et de la facturation d'exploitation.*
* `guests` / `reservations` : Aucun lien avec le CRM client ou la planification prospective de nuitées. *Justification : Découplage de la gestion logistique interne et de l'activité commerciale.*
* `hr` : Pas d'accès fonctionnel ou technique à la masse salariale ou au pointage des équipiers de ménage. *Justification : Indépendance RH.*

---

## 12. Contraintes métier
* **Non-Négativité Rigoureuse :** La colonne d'inventaire physique restant `StockItem.quantity` ne peut en aucun cas afficher une valeur négative en base de données. Toute requête de sortie de stock physique tentant de soumettre un volume supérieur à la ressource disponible en stock est bloquée et lève une exception descriptive `400 Bad Request`.
* **Justification d'Écart :** Toute correction d'inventaire exceptionnelle (casse, vol, perte) exige la saisie d'un motif textuel explicatif d'au moins **10 caractères**.

---

## 13. Invariants
* **INV-STK-001 (Limite de quantité physique) :** La contrainte d'intégrité de niveau base de données impose `StockItem.quantity >= 0`.

---

## 14. États manipulés
Le module d'inventaire n'implémente pas de machine à états complexe ; il suit des états quantitatifs de niveaux de stocks en base.

---

## 15. Points sensibles
* **Les coules d'inventaire (Vol ou Oubli de saisie) :** Risques d'écarts chroniques entre le stock physique réel de l'hôtel et la valeur théorique déclarée dans l'application PMS.
  * *Résolution :* Organisation de contrôles d'inventaires physiques réguliers (mensuels) par la Gouvernante avec saisie obligatoire des écarts et justification systématique des pertes en base de données.

---

## 16. Dette technique connue
* *Aucune dette technique identifiée à ce stade.*

---

## 17. Fonctionnalités prévues ultérieurement
* **Phase 2 :** Intégration de verrous automatiques de minibars par détection de poids ou de capteurs RFID en chambre pour l'imputation financière immédiate sans saisie manuelle.

---

## 18. Checklist de Pull Request
Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Le contrôleur d'API de mouvement de stock vérifie que la quantité finale restante d'un article ne peut jamais être négative.
* [ ] Toute saisie d'ajustement exceptionnel d'inventaire ou de pertes exige la saisie d'un motif explicatif écrit d'au moins 10 caractères.
* [ ] Les validations d'accès RBAC interdisent à des rôles non autorisés (ex: Réception ou Maintenance) de valider des entrées de stocks d'entretien.
* [ ] La création de mouvements de stocks est historisée de manière immuable sans aucune option d'effacement physique de la ligne transactionnelle.
