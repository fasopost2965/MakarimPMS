# Architecture Decision Record (ADR-004) : Payment & Financial Integrity

Ce document formalise de manière définitive les décisions d'architecture concernant le traitement des encaissements, l'idempotence des transactions financières, et le respect de la conformité comptable et légale au sein du Property Management System (PMS) de l'Hôtel Makarim.

---

## 1. Métadonnées

* **Identifiant :** ADR-004
* **Titre :** Payment & Financial Integrity (Intégrité financière et traitement des paiements)
* **Statut :** Validé
* **Date :** 2026-07-19
* **Auteur :** Architecte Logiciel PMS Makarim
* **Documents de référence :**
  * `ADR-001 — Stay-Centric Architecture`
  * `ADR-002 — Folio & Billing Model`
  * `BUSINESS_RULES.md` (BR-TR-002, BR-FAC-003, BR-FAC-004, BR-PAI-001 à BR-PAI-003, BR-COM-002, BR-AUD-001, BR-AUD-002)
  * `DATA_DICTIONARY.md` (Entités `Payment`, `FolioLine`, `Invoice`, `CreditNote`, `TaxRateConfig`)
  * `RBAC_MATRIX.md` (Permissions des rôles Comptable et Administrateur sur `billing`)
  * Cahier des charges final — PMS Hôtel Makarim.pdf

---

## 2. Contexte

Le PMS de l'Hôtel Makarim (Tétouan, Maroc) pilote l'intégralité des flux financiers opérationnels de l'établissement. Une gestion financière défaillante ou laxiste présente des risques critiques :
1. **Risques de double prélèvement ou de désynchronisation réseau :** Lors de l'utilisation d'un terminal de paiement électronique (TPE) ou d'une passerelle bancaire, les micro-coupures réseau ou le double clic de l'utilisateur sur le bouton "Payer" peuvent soumettre deux fois la même transaction. Sans barrière technique, cela crée des doublons de paiement en base de données, requérant des remboursements fastidieux.
2. **Vulnérabilités fiscales et d'audit :** La législation fiscale marocaine impose une traçabilité inviolable des encaissements de TVA (10% sur l'hébergement, 20% sur les extras) et des taxes de séjour journalières. Toute suppression physique d'un règlement reçu ou toute modification rétroactive d'un montant facturé est considérée comme une fraude.
3. **Planchers légaux sur les espèces :** Au Maroc, les paiements en espèces sont soumis à des limites réglementaires strictes pour lutter contre le blanchiment (plafond légal marocain par facture ou par jour, typiquement fixé à 10 000 MAD - *Décision métier à confirmer sur l'application exacte de cette contrainte automatique dans l'application*). Le PMS doit veiller à alerter ou bloquer les encaissements non conformes.
4. **Prélèvements d'acomptes pré-séjour :** Les acomptes versés lors d'une réservation doivent être sécurisés et proprement imputés comme un crédit de démarrage lors du séjour réel, sans risque de double comptabilisation ou de perte de trace.

---

## 3. Décision

Pour garantir une étanchéité financière absolue, nous actons la mise en œuvre de plusieurs mécanismes transactionnels et de contraintes d'intégrité non négociables :

### 3.1. Mécanisme d'Idempotence des Paiements
Tout enregistrement de paiement physique (`Payment`) exige obligatoirement la fourniture d'une clé d'idempotence unique (`idempotencyKey`), générée par le client (frontend) avant l'appel.
* Le moteur de base de données impose un **index physique unique** (`@unique`) sur la colonne `idempotencyKey` de la table `Payment`.
* Toute requête d'insertion de paiement partageant une clé d'idempotence déjà enregistrée est immédiatement rejetée par la base de données, éliminant les doublons de transactions concurrentes.

### 3.2. Traitement Strict des Moyens de Paiement (BR-PAI-002)
Le champ `moyen` de la table `Payment` est restreint exclusivement aux valeurs de l'énumération `MoyenPaiement` :
* **`ESPECES` :** Règlement en espèces (espèces marocaines MAD).
* **`CARTE` :** Règlement par carte de crédit/débit (TPE ou passerelle).
* **`VIREMENT` :** Virement bancaire direct (comptes de la société d'exploitation).
* **`ACOMPTE` :** Imputation d'une somme pré-encaissée lors de la phase de réservation.

### 3.3. Intégration et Traçabilité Légale (Immutabilité & Soft Delete)
1. **Verrouillage de Folio après Facturation (BR-FAC-004) :** Dès qu'une facture (`Invoice`) est générée pour un folio donné, ce folio et l'intégralité de ses écritures (`FolioLine`) sont instantanément verrouillés. Aucune écriture financière ne peut être ajoutée, modifiée ou supprimée de ce folio.
2. **Interdiction de modification des factures (BR-TR-002) :** Les factures émises sont des archives fiscales gravées dans le marbre. Toute modification de tarification ou annulation exige un document fiscal correctif (`CreditNote` ou avoir).
3. **Soft Delete obligatoire pour les écritures (BR-FAC-003) :** Aucune suppression physique de transaction (`FolioLine`) n'est autorisée. Si une erreur d'imputation d'un extra non facturé est commise, l'écriture est annulée logiquement (`annulee = true`) avec obligation de saisir un motif écrit. Cette action écrit un log d'audit système indélébile.

---

## 4. Invariants (Règles architecturales absolues)

* **INV-PAI-001 (Unicité de Clé d'Idempotence) :** Aucun paiement ne peut être validé ou inséré si son attribut `idempotencyKey` entre en collision avec une transaction existante.
* **INV-PAI-002 (Considération fiscale des taxes de séjour) :** Les lignes de folio de type `TAXE_SEJOUR` ne doivent jamais se voir appliquer de taxe sur la valeur ajoutée (TVA à 0.00%). Elles sont calculées dynamiquement selon la catégorie d'étoiles de l'hôtel (BR-COM-002).
* **INV-PAI-003 (Traitement exclusif de la monnaie locale) :** Tous les calculs financiers internes, consolidations de folios, écritures fiscales, et montants d'avoirs sont exprimés de manière absolue en **Dirhams Marocains (MAD)**. Les éventuels paiements en devises étrangères (EUR, USD) doivent être convertis au taux légal du jour avant écriture en base (*Décision métier à confirmer sur l'utilisation éventuelle d'une API de taux de change ou de saisie manuelle du taux*).
* **INV-PAI-004 (Lien obligatoire FolioLine-Payment) :** Un paiement client qui liquide le solde d'un folio de séjour doit être matérialisé par une écriture de crédit (`FolioLine` de type `PAIEMENT` et montant négatif) pointant vers l'enregistrement de transaction `Payment` correspondant.
* **INV-PAI-005 (Plafonnement des règlements espèces) :** Tout versement sous le moyen `ESPECES` cumulé pour une même facture ou un même jour ne peut excéder la limite légale marocaine en vigueur (fixée par défaut à 10 000 MAD - *Décision métier à confirmer sur le caractère bloquant ou simplement d'alerte de cette limite*).

---

## 5. Cycle de Vie d'une Transaction Financière (Paiement)

Le diagramme suivant décrit le processus sécurisé de soumission, de validation et d'enregistrement d'un flux d'encaissement de paiement :

```
             [ Client / UI Frontend ]
                       │
                       │ 1. Génère une UUID unique (Idempotency Key)
                       ▼
             [ API POST /api/billing/payments ]  (Payload: montant, moyen, idempotencyKey, folioId)
                       │
                       │ 2. Début de la Transaction d'Isolation de Base de Données
                       ▼
            { Vérification d'Idempotence }
                       │
                       ├─── [Existe déjà ?] ──► OUI ──► Rejeter (Code 409 Conflict)
                       │
                       └─── [Nouvelle clé] ───► NON
                                                 │
                                                 ▼
                                    { Vérification des Invariants }
                                                 │
                                                 ├─── Solde du folio déjà apuré ? ──► Rejeter
                                                 ├─── Moyen = ESPECES & > Plafond ? ──► Alerte / Bloquer
                                                 │
                                                 ▼
                                    [ Création de la Transaction ]
                                                 │
                                                 ├──► Création de l'entité `Payment` (idempotencyKey)
                                                 └──► Insertion `FolioLine` (type: PAIEMENT, montant: -M)
                                                 │
                                                 ▼
                                    [ Clôture de la Transaction (Commit) ]
                                                 │
                                                 ▼
                                    [ Notification Success / Code 201 ]
```

---

## 6. Traitement des Cas Particuliers

### 6.1. Le Traitement des Acomptes de Réservation
Lorsqu'un client réserve une chambre et verse un acompte à l'avance :
1. L'acompte est enregistré comme une transaction de paiement associée à la réservation.
2. Lors de l'enregistrement d'arrivée (Check-In), le système crée l'entité opérationnelle `Stay` et génère le folio d'hébergement.
3. Le système injecte immédiatement une ligne d'écriture créditrice `FolioLine` automatique de type `PAIEMENT` et de valeur négative (ex. -500 MAD) avec le libellé "ACOMPTE RECU - RESA #XYZ", réduisant ainsi le solde initial du client.

### 6.2. Le Paiement Partiel par Plusieurs Clients (Factures partagées)
Si deux collaborateurs partagent une suite et souhaitent diviser la note :
* Le système permet l'ouverture d'un second folio d'extras ou de fractionner manuellement le folio principal.
* Chaque client effectue sa transaction de paiement indépendante.
* Chaque transaction génère un enregistrement de paiement unique `Payment` (avec sa propre clé d'idempotence) et une ligne correspondante de type `PAIEMENT` sur le folio concerné, permettant d'émettre des factures individuelles conformes.

### 6.3. Le Geste Commercial ou la Remise de Facturation
Si l'hôtel souhaite accorder une réduction sur le prix de l'hébergement (ex. suite à un incident technique) avant émission de la facture :
* Le réceptionniste ou la gouvernante saisit un motif et ajoute une ligne d'écriture d'ajustement négative sur le folio (type `HEBERGEMENT` ou `EXTRA` avec montant négatif, ex: -150 MAD) (BR-RES-002).
* L'action exige la saisie d'un motif écrit qui alimente la table d'audit log.
* Si la facture est d'ores et déjà émise, cette réduction est strictement interdite sur le folio et doit obligatoirement faire l'objet de l'émission d'un avoir fiscal (`CreditNote`).

---

## 7. Alternatives rejetées

### Alternative A : Déléguer l'idempotence uniquement à la passerelle bancaire
* **Description :** Ne pas poser d'index unique sur l'idempotency key en base et laisser le processeur de paiement Stripe ou le CMI marocain gérer les doublons.
* **Pourquoi elle a été rejetée :** Risque de désynchronisation de données majeur. Si la transaction réussit sur la passerelle mais que l'appel d'enregistrement échoue côté serveur en raison d'un timeout ou d'une erreur de base de données, la base ne reflétera pas le paiement réel. Gérer l'idempotence de bout en bout au niveau de notre base de données garantit la cohérence stricte des comptes de l'hôtel.

### Alternative B : Autoriser les ajustements rétroactifs directs sur les factures émises
* **Description :** Permettre aux administrateurs de corriger les lignes de factures erronées via une simple mise à jour de base de données.
* **Pourquoi elle a été rejetée :** Risque d'infraction légale et d'exclusion d'audit. La comptabilité marocaine interdit strictement de modifier une facture finalisée. Autoriser cette pratique exposerait l'établissement à de lourdes amendes en cas d'audit fiscal.

---

## 8. Conséquences de la Décision

* **Réservations :** Sont simplifiées et déchargées de toute complexité de solde intermédiaire (les acomptes transitent proprement vers le séjour au check-in).
* **Séjours :** Bénéficient d'une intégrité de solde rigoureuse.
* **Billing & Folios :** L'historique des modifications de folios est 100% auditable grâce au soft delete systématique des lignes annulées.
* **Paiements :** Sont d'une fiabilité totale grâce au mécanisme d'idempotence.
* **Comptabilité :** Les calculs de bases d'imposition HT/TVA consolidés par facture sont d'une exactitude incontestable.

---

## 9. Anti-patterns (Pratiques strictement interdites)

* **Anti-Pattern #1 (Paiement sans Clé d'Idempotence) :** Permettre l'insertion d'un paiement `Payment` avec une valeur de clé d'idempotence nulle, vide ou dupliquée.
* **Anti-Pattern #2 (Suppression physique d'un règlement reçu) :** Exécuter un appel `DELETE` sur la table `Payment` pour corriger une erreur.
* **Anti-Pattern #3 (Application indue de TVA sur les taxes) :** Appliquer un taux de TVA non nul sur les lignes d'écritures de type `TAXE_SEJOUR`.
* **Anti-Pattern #4 (Calcul de TVA en dur dans le code) :** Coder en dur les pourcentages de TVA (ex. `0.1` ou `0.2`) directement au sein des contrôleurs ou services au lieu d'interroger dynamiquement la configuration de la table `TaxRateConfig`.

---

## 10. Checklist de conformité pour les Pull Requests (Module Paiements)

Avant de soumettre des modifications de code touchant aux écritures, aux calculs fiscaux ou aux passerelles de règlements, validez rigoureusement les contrôles suivants :

* [ ] **Vérification d'idempotence en base :** Le contrôleur de création de paiement requiert une clé d'idempotence unique et intercepte les collisions de contraintes physiques de base de données pour lever une exception de type `409 Conflict`.
* [ ] **Calcul dynamique des taxes :** Les taux de TVA appliqués aux lignes de folio d'hébergement ou d'extras sont extraits dynamiquement de l'entité `TaxRateConfig` correspondante et ne sont pas codés en dur.
* [ ] **Isolation des écritures de taxes :** Les taxes de séjour collectées sont enregistrées de manière isolée des nuitées brutes, avec un taux fiscal de TVA à 0.00%.
* [ ] **Respect du verrou de folio :** Toute tentative d'ajout ou de désactivation de ligne sur un folio vérifie au préalable que ce folio n'a pas fait l'objet d'une facture émise (`Invoice` active), et lève une exception de blocage comptable dans le cas contraire.
* [ ] **Trace d'annulation logique (Soft Delete) :** L'annulation d'un extra non facturé conserve l'enregistrement physique en base, commute la colonne `annulee` à `true`, exige un motif écrit d'annulation, et écrit une ligne de log d'audit.
