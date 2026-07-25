# Spécification Technique — Module Comptabilité (accounting.md)

---

## 1. Objectif du module
Le module **Comptabilité** assure la consolidation financière journalière, le rapprochement de caisse et l'exportation légale des écritures de ventes de l'Hôtel Makarim. Il assure le pont technique entre la facturation d'exploitation hôtelière courante et les exigences fiscales d'audit et d'édition de bilans comptables de l'établissement.

---

## 2. Responsabilités
Le module est seul responsable de :
* La gestion de la procédure de clôture comptable journalière (procédure de fin de journée de l'hôtel).
* Le rapprochement financier unifié entre les transactions enregistrées dans le système et la caisse physique de l'hôtel.
* La ventilation analytique et consolidée des ventes par lignes fiscales (Hébergement, Extras par taux de TVA, Taxes de séjour).
* Le suivi des comptes courants des entreprises et agences partenaires (comptes débiteurs d'en-cours ou City Ledger).
* La génération de rapports et d'exports comptables normalisés (journaux de ventes et d'encaissements).

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* L'imputation d'un extra de consommation client sur le folio d'exploitation actif (confié au module `billing`).
* L'acte transactionnel d'encaissement physique d'un règlement (confié au module `payments`).
* La planification des nuitées ou le check-in opérationnel (confiés aux modules `reservations` et `stay`).

---

## 4. Entités manipulées
Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `Invoice` (Consolidation des écritures de ventes)
* `Payment` (Rapprochement et contrôle de trésorerie)
* `FolioLine` (Lecture comptable détaillée des débits et crédits)
* `Company` (Suivi de l'en-cours financier des entreprises)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-FAC-003 (Immutabilité des Factures Émises) :** Base fondamentale de la sincérité des écritures comptables d'exploitation.
* **BR-COM-001 (Rapprochement Obligatoire) :** Obligation légale et financière d'équilibrer la caisse physique avec les paiements enregistrés.
* **BR-COM-002 (Consolidation Quotidienne) :** Clôture comptable journalière verrouillant les écritures de la veille à 23h59.

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-002 (Folio & Billing Model)](/docs/ADR-002-Folio-Billing-Model.md) :** Clôture et isolation comptable par folios scellés.
* **[ADR-004 (Payment & Financial Integrity)](/docs/ADR-004-Payment-Financial-Integrity.md) :** Invariabilité monétaire en MAD et limitation d'espèces.
* **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md) :** Journalisation stricte de toutes les anomalies d'ajustements comptables.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Restriction et isolement du rôle de Comptable.

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `accounting:read` : Autorisé pour `ADMINISTRATEUR`, `COMPTABLE`.
* `accounting:write` (Consolidation, fermeture d'exercice, validation City Ledger) : Autorisé exclusivement pour `ADMINISTRATEUR` et `COMPTABLE`.
* *Note :* Aucun autre rôle opérationnel (Réception, Ménage, Technique, RH) n'a d'accès en lecture ou écriture sur la console comptable de consolidation.

---

## 8. Flux entrants
Le module intercepte les événements et requêtes suivants :
* Événement d'émission de facture (génère l'écriture d'exploitation définitive au journal des ventes).
* Événement de paiement reçu (génère l'écriture de trésorerie au journal des encaissements).
* Déclenchement quotidien de fermeture de journée par le Comptable (fermeture de caisse).

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* `SESSION_JOURNALIERE_CLOTUREE` : Déclenche le verrouillage définitif des écritures de la veille (interdit tout ajustement rétroactif).
* `EXPORT_COMPTABLE_GENERE` : Fichier de transfert de données comptables d'exploitation mis à disposition de la direction.

---

## 10. Dépendances autorisées
Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `billing` : Pour lire les factures émises et s'assurer de l'équilibre financier des folios consolidés.
* `payments` : Pour auditer la caisse et réconcilier les flux de règlements perçus par l'hôtel.

---

## 11. Dépendances interdites
Ce module a l'interdiction stricte de dépendre de :
* `housekeeping` / `maintenance` : Aucun point de contact technique ou fonctionnel. *Justification : Découplage de la gestion comptable consolidée et des opérations matérielles de terrain.*
* `guests` / `reservations` : Pour la comptabilité de synthèse, le module utilise uniquement des écritures financières et des identifiants fiscaux anonymes (folios, factures), sans dépendance au CRM ou aux plannings prévisionnels. *Justification : Isolement des flux financiers et des données personnelles clients.*
* `hr` : Le module comptable d'exploitation n'intervient pas dans la gestion des ressources humaines ou de la paie. *Justification : Indépendance RH.*

---

## 12. Contraintes métier
* **Exactitude de Ventilation de TVA :** Le journal des ventes consolidé doit ventiler précisément l'ensemble des débits de la journée par classe de TVA hôtelière marocaine : hébergement (10%), extras (20%) et taxe de séjour (0%).
* **Contrôle d'Écart de Caisse :** La validation d'une clôture journalière exige de consigner l'écart comptable éventuel (différence entre le numéraire compté physiquement dans le tiroir-caisse et la valeur théorique calculée par l'application) et de consigner une justification explicative si l'écart est supérieur à **5.00 MAD**.

---

## 13. Invariants
* **INV-COM-001 (Verrouillage Historique de Caisse) :** Une journée comptable consolidée et clôturée à l'état `VERROUILLE` est strictement immuable. Il est formellement interdit de modifier rétroactivement une écriture financière d'encaissement ou d'imputer une charge d'exploitation sur cette période passée.

---

## 14. États manipulés
Ce module gère le statut d'exercice journalier comptable :
* `OUVERT`
* `CONSOLIDE` (Rapprochement validé par le Comptable)
* `VERROUILLE` (Fermeture irréversible de la journée)

---

## 15. Points sensibles
* **Retards de saisie d'extras :** Risque de charge d'exploitation non imputée sur un folio avant le départ physique du client, obligeant à rouvrir un dossier financier ou à déclarer une perte d'exploitation.
  * *Résolution :* Automatisation des imputations de consommations de minibars dès la saisie de l'équipier de ménage en chambre via le module `housekeeping`.

---

## 16. Dette technique connue
* *Aucune dette technique identifiée à ce stade.*

---

## 17. Fonctionnalités prévues ultérieurement
* **Phase 3 :** Intégration d'un module d'export automatisé au format fiscal marocain normalisé de type Balance / Grand Livre pour la télétransmission comptable à l'administration d'audit.

---

## 18. Checklist de Pull Request
Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Le contrôleur d'API d'exportation comptable et de clôture de caisse exige explicitement la permission `accounting:write`.
* [ ] La clôture d'une session comptable verrouille physiquement l'ensemble des écritures financières associées en base et lève des exceptions bloquantes en cas de tentative d'altération rétroactive.
* [ ] Les données financières de ventes consolident correctement et séparément les montants HT, TVA (10% et 20%) et les taxes de séjour (TVA 0%).
* [ ] Tout écart de caisse consigné fait l'objet d'un tracé d'historique documenté en base de données.
