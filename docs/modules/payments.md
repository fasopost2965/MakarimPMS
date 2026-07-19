# Spécification Technique — Module Paiements (payments.md)

---

## 1. Objectif du module
Le module **Paiements** gère de manière ultra-sécurisée l'ensemble des encaissements financiers et des flux de trésorerie de l'Hôtel Makarim. Il assure la saisie et la classification des règlements des clients, garantit la stricte conformité fiscale vis-à-vis des limitations de numéraire (plafonds d'espèces marocains), et met en œuvre des mécanismes d'idempotence pour écarter tout risque de double transaction d'encaissement.

---

## 2. Responsabilités
Le module est seul responsable de :
* L'enregistrement sécurisé de chaque encaissement de règlement client (`Payment`).
* La qualification du moyen de paiement (Espèces, Carte, Virement, Acompte).
* L'application absolue des vérifications de plafonds d'espèces légaux lors de règlements physiques.
* La garantie d'idempotence stricte des paiements via la clé unique `idempotencyKey` générée par le client.
* La génération des reçus financiers d'encaissement et l'imputation créditrice automatique sur les folios.

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* Le calcul des grilles tarifaires de nuitées ou l'imputation d'extras de consommations (confié au module `billing`).
* La facturation globale ou la génération des déclarations de TVA (confié au module `billing`).
* La gestion de la comptabilité d'exploitation d'entreprise (confié au module `accounting`).

---

## 4. Entités manipulées
Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `Payment` (Trace transactionnelle d'encaissement immuable)
* `Folio` (Cible d'imputation financière du crédit de règlement)
* `FolioLine` (Création de la ligne d'encaissement de type PAIEMENT)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-PAY-001 (Plafond Légal de Paiement en Espèces) :** Limitation stricte des paiements en espèces à un cumul de **10 000,00 MAD** par séjour d'exploitation pour se conformer à la loi marocaine de finances.
* **BR-PAY-002 (Idempotence de transaction) :** Exigence d'une clé d'idempotence UUID unique pour écarter les double-saisies accidentelles de règlements.
* **BR-PAY-003 (Enregistrement de la source du règlement) :** Renseignement obligatoire des données de transaction (numéro d'autorisation pour les cartes, numéro d'opération pour les virements bancaires).

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-004 (Payment & Financial Integrity)](/docs/ADR-004-Payment-Financial-Integrity.md) :** Inviolabilité monétaire, gestion du plafond légal d'espèces et garantie d'idempotence.
* **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md) :** Interdiction stricte de suppression physique de toute transaction financière d'encaissement.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Ségrégation des privilèges de saisie financière.

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `payments:read` : Autorisé pour `ADMINISTRATEUR`, `RECEPTION`, `COMPTABLE`.
* `payments:write` (Enregistrement d'un encaissement de règlement) : Autorisé exclusivement pour `ADMINISTRATEUR` et `COMPTABLE`.
* *Note :* Par sécurité comptable et contrôle interne de caisse, le rôle `RECEPTION` ne dispose d'aucun droit d'écriture sur le module des paiements en production.

---

## 8. Flux entrants
Le module intercepte les événements et requêtes suivants :
* Requête de saisie d'un règlement d'acompte (avant-séjour).
* Requête de règlement d'extras en cours de séjour au comptoir.
* Demande d'apurage final d'un folio lors de la clôture (procédure de Check-out).

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* `REGLEMENT_ENREGISTRE` : Émis après validation transactionnelle de l'encaissement (déclenche la création d'une ligne créditrice sur le folio ciblé).
* `SOLDE_APURE` : Émis si l'encaissement ramène le solde cumulé des folios du séjour à 0.00 MAD (débloque l'option de Check-out).
* `ALERTE_TENTATIVE_FRAUDE_CASH` : Émis en cas de tentative de forçage de règlement en espèces au-delà de la limite légale hôtelière.

---

## 10. Dépendances autorisées
Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `billing` : Pour injecter la ligne créditrice correspondante (`FolioLine` de type `PAIEMENT` dotée d'un montant négatif d'annulation de débit) au sein du folio associé.

---

## 11. Dépendances interdites
Ce module a l'interdiction stricte de dépendre de :
* `housekeeping` / `maintenance` : Aucun lien fonctionnel ou technique. *Justification : Préservation absolue de l'étanchéité des transactions financières.*
* `guests` / `reservations` : Le module de paiement ne doit pas interagir directement avec le CRM client ou la planification de nuitées. Il s'exécute uniquement sous la supervision et au sein d'un folio financier de séjour. *Justification : Isolation des briques financières fondamentales.*
* `hr` : Pas d'accès à la gestion du temps de présence ou de paie. *Justification : Ségrégation RH.*

---

## 12. Contraintes métier
* **Contrainte d'Idempotence Absolue :** Toute requête d'encaissement doit obligatoirement transmettre dans ses en-têtes HTTP ou son corps JSON une clé unique `idempotencyKey` de type UUID. Le backend vérifie l'absence de transaction déjà enregistrée en base dotée de cette même clé avant d'initier tout traitement comptable ou transaction bancaire.
* **Plafond Cash Marocain :** Lors d'un règlement par le moyen `ESPECES`, le système doit lire l'historique des règlements déjà perçus pour le même séjour client. Si l'ajout du nouveau montant d'espèces dépasse le plafond cumulé de **10 000,00 MAD**, la requête d'encaissement est automatiquement rejetée côté serveur.

---

## 13. Invariants
* **INV-PAY-001 (Immutabilité des Encaissements) :** Un enregistrement dans la table `Payment` est strictement immuable en base de données. Il est formellement interdit de modifier son montant, son moyen de paiement, sa clé d'idempotence ou d'effectuer une suppression physique de la ligne.
* **INV-PAY-002 (Idempotence physique unique) :** La colonne `Payment.idempotencyKey` possède une contrainte physique d'unicité au niveau du schéma MySQL.

---

## 14. États manipulés
L'entité `Payment` représente un acte comptable définitif et ne possède pas de machine à états complexe. Une fois validé et inséré, le paiement est scellé.

---

## 15. Points sensibles
* **Litiges de transactions Cartes Bancaires :** Risques d'écarts entre les paiements déclarés saisis sur l'application et les prélèvements réels portés par le Terminal de Paiement Électronique (TPE).
  * *Résolution :* Renseignement obligatoire du champ `transactionReference` (numéro de transaction monétique) pour chaque règlement par Carte avant d'autoriser la finalisation de l'encaissement dans le système.

---

## 16. Dette technique connue
* *Aucune dette technique identifiée à ce stade.*

---

## 17. Fonctionnalités prévues ultérieurement
* **Phase 3 :** Intégration directe de l'API de paiement avec la passerelle bancaire monétique du Centre Monétique Interbancaire (CMI) du Maroc pour l'enregistrement automatique des règlements par cartes bancaires.

---

## 18. Checklist de Pull Request
Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Le contrôleur d'API d'enregistrement de paiement valide de manière stricte la présence d'une clé d'idempotence unique et valide de type UUID.
* [ ] Tout prélèvement en espèces (`ESPECES`) vérifie le cumul historique du séjour et bloque la transaction si elle dépasse le plafond de 10 000 MAD.
* [ ] Le contrôleur d'API exige explicitement la permission `payments:write` pour autoriser la validation de règlements financiers.
* [ ] Aucune route de modification (`update`) ou de suppression physique (`delete`) n'est exposée ou implémentée pour l'entité `Payment` au sein des services du backend.
