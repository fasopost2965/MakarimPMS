# Architecture Decision Record (ADR-002) : Folio & Billing Model

Ce document formalise de manière définitive le modèle de facturation et de gestion des comptes clients du Property Management System (PMS) de l'Hôtel Makarim, s'appuyant sur le concept de **Folio** comme carnet d'imputation financière exclusif.

---

## 1. Métadonnées

* **Identifiant :** ADR-002
* **Titre :** Folio & Billing Model (Modèle d'imputation et de facturation par Folios)
* **Statut :** Validé
* **Date :** 2026-07-19
* **Auteur :** Architecte Logiciel PMS Makarim
* **Documents de référence :**
  * `ADR-001 — Stay-Centric Architecture`
  * `BUSINESS_RULES.md` (BR-TR-001, BR-TR-002, BR-TR-003, BR-SEJ-002, BR-SEJ-004, BR-FAC-001 à BR-FAC-005, BR-PAI-001 à BR-PAI-003, BR-COM-002)
  * `DATA_DICTIONARY.md` (Entités `Stay`, `Folio`, `FolioLine`, `Invoice`, `CreditNote`, `Payment`)
  * `RBAC_MATRIX.md` (Permissions des rôles Réception, Comptable et Administrateur sur `billing`)
  * Cahier des charges final — PMS Hôtel Makarim.pdf

---

## 2. Contexte

Au sein d'un établissement hôtelier de standing comme l'Hôtel Makarim (Tétouan), la facturation des séjours clients est soumise à des exigences de flexibilité opérationnelle et de rigueur fiscale élevées :
1. **Divergence temporelle de facturation :** Un séjour s'étale sur plusieurs nuitées. Les charges s'accumulent au fil de l'eau (nuitées, taxes de séjour journalières, consommations de room service ou blanchisserie) alors que le règlement effectif de ces prestations peut s'effectuer en plusieurs fois (acomptes pré-séjour, paiements partiels durant le séjour, règlement du solde au check-out) ou être différé (prise en charge par une entreprise partenaire).
2. **Absence de rigidité légale avant l'édition :** Une facture commerciale est, selon la réglementation marocaine, une pièce comptable définitive, immuable et séquentielle qui ne peut en aucun cas être modifiée une fois émise. Cependant, durant le séjour, le client peut contester un extra, demander un geste commercial, ou souhaiter diviser la note entre collègues.
3. **Le besoin de fractionnement de note :** Il est extrêmement fréquent qu'un client d'affaires demande d'isoler les frais professionnels (ex. nuitées d'hébergement et taxes de séjour) pour qu'ils soient facturés directement à son entreprise, tout en gardant à sa charge personnelle les extras personnels (ex. repas, minibar, SPA).

Pour répondre à ces besoins, lier directement les transactions à une entité "Facture" dès le départ est impossible car la facture ne peut être altérée. De même, lier les transactions directement au séjour sans structure intermédiaire de tri empêche tout fractionnement ou partitionnement. Le concept de **Folio** (compte courant ou carnet d'imputation temporaire associé à un séjour) est l'unique abstraction logicielle résolvant ce problème.

---

## 3. Décision

Nous actons l'implémentation d'un modèle d'imputation financière reposant exclusivement sur des **Folios**, structuré selon les décisions suivantes :

1. **Relation Un-à-Plusieurs entre Séjour et Folio :** Un séjour physique (`Stay`) possède un ou plusieurs folios actifs (`Folio`). Lors du check-in, le système initialise obligatoirement un premier folio par défaut, qualifié de "Folio Principal - Hébergement" (ou *Master Folio*).
2. **Imputation exclusive sur Folio (`FolioLine`) :** Toute transaction financière concernant un séjour — qu'il s'agisse d'un débit (charge d'hébergement, taxe de séjour, extra consommé) ou d'un crédit (acompte, paiement partiel, paiement du solde) — doit impérativement s'inscrire sous forme de ligne d'écriture (`FolioLine`) au sein d'un folio rattaché au séjour.
3. **Immutabilité absolue de la Facture :** Une facture (`Invoice`) n'est générée qu'en guise de clôture de compte. L'édition d'une facture fige l'état de tout ou partie des lignes du folio sélectionné. Une fois générée, l'entité `Invoice` devient strictement immuable en base. Aucune ligne de charge ne peut être rattachée directement à une facture déjà émise, et aucune modification de montant n'est tolérée sur celle-ci.
4. **Correction par Avoir uniquement :** En cas d'erreur de facturation constatée après émission, la rectification comptable s'effectue obligatoirement par l'émission d'un avoir fiscal (`CreditNote`) rattaché à la facture d'origine.
5. **Autonomie des Paiements :** Les paiements (`Payment`) sont rattachés à des lignes de folio créditrices pour apurer le solde opérationnel du séjour. Lors de la facturation, l'historique des règlements appliqués au folio est consolidé sur la facture pour en dégager le solde dû (MAD).

---

## 4. Invariants (Règles d'intégrité absolues)

* **INV-001 (Unicité de Folio d'imputation) :** Un enregistrement d'écriture financière (`FolioLine`) ne peut appartenir qu'à un et un seul folio (`Folio`).
* **INV-002 (Absence de Facture orpheline) :** Une facture (`Invoice`) doit être légalement rattachée à un folio d'origine (`Folio`) existant en base.
* **INV-003 (Aucune modification sur Facture) :** Les routes d'API de type `PUT`, `PATCH` ou `DELETE` sont strictement interdites sur l'entité `Invoice`. Toute modification de la balance exige une transaction d'avoir (`CreditNote`) ou l'annulation du folio source (si non encore facturé).
* **INV-004 (Équilibre obligatoire du Folio au Checkout) :** L'action de check-out d'un séjour (`Stay`) est bloquée en base tant que la somme algébrique des lignes actives de tous ses folios rattachés n'est pas strictement égale à `0.00 MAD` :
  $$\sum \text{Montant}_{\text{charges active (débits)}} + \sum \text{Montant}_{\text{paiements active (crédits)}} = 0.00 \text{ MAD}$$
* **INV-005 (Inviolabilité des transactions annulées) :** Pour respecter la conformité réglementaire de traçabilité, une ligne de folio annulée ne doit jamais être supprimée physiquement de la base de données. Elle est désactivée logiquement à l'aide d'un flag (`annulee = true`), et sa valeur est neutralisée dans les calculs de somme cumulée.
* **INV-006 (Isolation des extras) :** Une chambre physique n'enregistre jamais de charges. Les extras sont liés au folio du client occupant, éliminant les risques de facturation croisée lors des changements de chambre.

---

## 5. Cycle de Vie Financier d'un Séjour

Le flux de traitement comptable des séjours et folios respecte la séquence linéaire suivante :

```
[ Étape 1 : Enregistrement ]
  Stay (Check-in) ➔ Création automatique du Folio Principal (Hébergement)
                         |
                         v
[ Étape 2 : Accumulation au fil de l'eau ]
  Saisie d'extras (Room Service, SPA) OU Calcul des Nuitées de présence (RoomNight)
  ➔ Écriture de FolioLines de Débit (Montant > 0, TVA correspondante)
                         |
                         v
[ Étape 3 : Règlements intermédiaires ]
  Enregistrement d'Acomptes (lors de la réservation) OU Règlements partiels (durant le séjour)
  ➔ Écriture de FolioLines de Crédit (Type PAIEMENT, Montant < 0)
                         |
                         v
[ Étape 4 : Clôture / Facturation ]
  Génération de la Facture (Invoice) à partir du Folio
  ➔ Consolidation immuable des FolioLines actives ➔ Génération d'un PDF scellé
                         |
                         v
[ Étape 5 : Libération physique ]
  Ajustement final si nécessaire (solde = 0) ➔ Validation du Check-Out (chambre libérée)
```

---

## 6. Traitement des Cas Particuliers

### 6.1. Le Check-out et l'Apurage Financier
Avant de clore le séjour (`Stay.statut = CHECKOUT`), l'utilisateur doit éditer la facture de clôture. Si le solde total cumulé des folios n'est pas égal à zéro au comptoir, l'action est rejetée (BR-SEJ-004). Le solde doit être apuré soit par un paiement physique immédiat, soit par un transfert vers un compte d'affaires d'entreprise (*City Ledger*) :
* *Note : Les modalités précises de transfert vers le compte d'affaires corporate d'un partenaire sont en attente d'une décision métier à confirmer.*

### 6.2. Les Paiements Partiels et Multiples
Le système permet d'enregistrer plusieurs règlements successifs pour un même séjour (ex. un premier versement en espèces de 1000 MAD, puis le reste par carte bancaire). Chaque versement génère une ligne `FolioLine` créditrice distincte liée au folio actif, historisant avec précision le mode de paiement employé (BR-PAI-002).

### 6.3. La Gestion Multi-Folios (Séjours Corporatifs et Groupes)
Un réceptionniste habilité peut, à tout moment du séjour, créer un second folio distinct de type "Folio Extras" et transférer des lignes d'extras d'un folio à l'autre. Lors du départ, l'utilisateur génère deux factures distinctes :
1. Une facture pour l'hébergement (émise au nom de la société de type `Company` - *Décision métier à confirmer sur la structure physique de la table Company*).
2. Une facture pour les extras (émise au nom du client physique `Guest`).

### 6.4. Les Extras et les Taxes de Séjour
* **Les extras :** Sont soumis à un taux de TVA de 20.00% (BR-COM-002).
* **Les taxes de séjour :** Sont calculées par nuitée et par personne hébergée, selon un tarif forfaitaire lié à la catégorie d'étoiles de l'établissement (BR-COM-002). Elles doivent figurer sous forme de lignes de débits isolées de type `TAXE_SEJOUR` sur le folio principal et sont exonérées de TVA (TVA à 0.00%).

---

## 7. Alternatives rejetées

### Alternative A : Imputation directe de la facture au séjour (Invoice-Centric)
* **Description :** Créer une facture dès le premier jour et y ajouter les lignes d'extras au fur et à mesure.
* **Pourquoi elle a été rejetée :** Totalement illégale d'un point de vue fiscal au Maroc. Une facture émise ne peut pas voir son contenu fluctuer au jour le jour. Si la facture est générée de manière "brouillon" non émise, elle ne permet pas de fractionner la facturation entre un compte entreprise et un compte client en fin de séjour.

### Alternative B : Enregistrement des paiements directement sur la Réservation
* **Description :** Lier les règlements du séjour à la table `Reservation`.
* **Pourquoi elle a été rejetée :** Ne permet pas de gérer les clients spontanés (Walk-In) qui n'ont pas de réservation, ni de diviser la perception des fonds selon qu'ils soldent des consommations de folios distincts (ex. hébergement vs. extras).

---

## 8. Conséquences de la Décision

* **Réservations :** N'ont aucun impact sur la facturation. Les acomptes versés sont stockés dans la réservation et transférés sur le folio principal du séjour uniquement au check-in sous forme d'une ligne de crédit `FolioLine` de type `PAIEMENT` avec mention "ACOMPTE".
* **Séjours :** Sont simplifiés. La validité financière du séjour est lue en temps réel en agrégeant les lignes de folios rattachés.
* **Facturation :** Bénéficie d'une étanchéité fiscale absolue. Le numéro séquentiel unique de facture (`Invoice.numero`) garantit la chronologie obligatoire des ventes.
* **Paiements :** Sont protégés de manière transactionnelle. Un paiement est représenté sous forme de `FolioLine` créditrice, ce qui permet d'utiliser le moteur de base de données pour assurer l'idempotence (`idempotencyKey` unique).
* **Comptabilité :** Les exports comptables extraient des lignes de factures d'ores et déjà figées, éliminant tout risque de désynchronisation entre le PMS et le logiciel du comptable externe.
* **Reporting :** Les tableaux de bord de ventes distinguent avec précision le chiffre d'affaires facturé (factures émises) et le chiffre d'affaires latent ou non facturé (charges cumulées sur les folios de séjours en cours).

---

## 9. Anti-patterns (Pratiques strictement interdites)

* **Anti-Pattern #1 (Paiement sans Folio) :** Enregistrer une ligne de paiement directement liée à un `Stay` sans passer par l'intermédiaire d'un `Folio`.
* **Anti-Pattern #2 (Facture modifiable) :** Exposer un endpoint d'API ou une méthode de service permettant d'altérer le montant, le destinataire ou les lignes d'une `Invoice` après sa création en base.
* **Anti-Pattern #3 (Extras sur Réservation) :** Imputer des lignes de charges de room service ou d'activités sur l'entité `Reservation`.
* **Anti-Pattern #4 (Suppression d'écriture financière) :** Effectuer des appels `DELETE` physiques sur les tables `FolioLine` ou `Payment`. Les corrections d'erreurs d'imputation exigent une écriture logique inverse ou l'annulation de la ligne (`annulee = true`).
* **Anti-Pattern #5 (Nuitée gratuite déguisée) :** Offrir une nuitée d'hébergement en forçant arbitrairement le montant de la ligne de folio d'hébergement à 0.00 MAD sans motif écrit et sans validation du droit RBAC d'ajustement manuel d'un rôle qualifié (Admin/Comptable).

---

## 10. Checklist de conformité pour les Pull Requests (Module Billing)

Avant de soumettre une modification de code sur les contrôleurs ou les services du module de facturation, assurez-vous de cocher l'intégralité des points suivants :

* [ ] **Absence de suppression physique :** Aucun appel à `prisma.folioLine.delete` ou `prisma.payment.delete` n'est introduit dans le code. Les annulations sont matérialisées par `annulee: true` et un motif valide.
* [ ] **Intégrité de la Facture :** Aucune méthode d'écriture ou de mise à jour (`update`, `updateMany`) n'est appelée sur l'entité `Invoice`. Toute modification passe par l'édition d'une `CreditNote`.
* [ ] **Transversale Folio-Stay :** La validation d'un extra vérifie au préalable que le `folioId` fourni correspond à un folio actif rattaché au séjour en cours (`Stay.statut = EN_COURS`).
* [ ] **Calcul dynamique de TVA :** La création d'une ligne de charge applique rigoureusement les taux de TVA légaux récupérés dynamiquement depuis le référentiel `TaxRateConfig` (10.00% pour l'hébergement, 20.00% pour les extras, 0.00% pour les taxes de séjour).
* [ ] **Idempotence des transactions :** L'enregistrement d'un paiement physique exige la transmission d'un jeton d'idempotence unique et valide la contrainte d'unicité physique en base.
* [ ] **Validation RBAC :** L'imputation d'un extra ou la modification d'un tarif d'hébergement fait l'objet d'un contrôle de permissions étanche côté serveur, conformément à la grille spécifiée dans `RBAC_MATRIX.md` (permissions `billing:write`).
