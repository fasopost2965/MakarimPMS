# Audit technique — Makarim PMS v1
## Phase 6 — Finance

Analyse fondée sur lecture directe du code : `billing.service.ts` et `billing.controller.ts` (intégral), `billing/utils/invoice-calc.ts` (intégral), `payments.service.ts` et `deposits.service.ts` (intégral), `stay/utils/solde.ts` (intégral), `stay.service.ts` (`createFolioPrincipal`, `imputerAcomptes`, `checkout`), `reservations/utils/cancellation-penalty.ts` (intégral), `reservations.service.ts` (`remove`/`markNoShow`), `parameters.service.ts` (`getTaxRateMap`/`getApplicableTaxes`), et recherche exhaustive sur `CreditNote`/`ANNULEE_PAR_AVOIR` dans tout le backend. Aucune modification de fichier effectuée.

---

## 1. Folios et lignes de folio

**Création du folio** : un seul site d'écriture dans tout le backend — `StayService.createFolioPrincipal` (privée, appelée uniquement au check-in). Crée un `Folio` unique par séjour avec une ligne `HEBERGEMENT` et, conditionnellement, une ligne `EXTRA` pour la formule d'hébergement. Aucun autre point du code n'appelle `tx.folio.create`.

**Ajout de lignes** : `BillingService.addFolioLine` est le seul point d'ajout manuel de charge. `assertFolioWritable` vérifie que `folio.stay.statut === 'EN_COURS'` avant toute écriture.

**Ligne créditrice de paiement** : `BillingService.creditFolioLine` est l'unique point d'écriture d'une `FolioLine` de type `PAIEMENT`, appelé exclusivement par `PaymentsService.createPayment` et `StayService.imputerAcomptes`. `tx` est un paramètre obligatoire (pas optionnel).

**Solde du folio** : `computeSoldeDu` (`stay/utils/solde.ts`) est la seule fonction de calcul de solde — somme des lignes non annulées, `PAIEMENT` soustrait.

---

## 2. Taxes

**Deux mécanismes distincts, non redondants** :
- **TVA (HEBERGEMENT/EXTRA)** : appliquée en **marge** au moment du calcul du total de facture, jamais matérialisée en `FolioLine` propre — taux par défaut codé en dur uniquement en fallback si `TaxRateConfig` correspondant absent/inactif.
- **Taxes configurables (taxe de séjour et assimilées)** : matérialisées en `FolioLine` de type `TAXE_SEJOUR` au moment de `generateInvoice()`. `computeTaxLineAmount` applique soit `MONTANT_FIXE` (taux × nuits × `nbPersonnes`, proxy `RoomType.capacite`), soit `POURCENTAGE`. `TVA_HEBERGEMENT`/`TVA_ANNEXE` explicitement exclues de cette injection.

**Exclusions de taxe par folio** (`FolioTaxExclusion`) : `excludeTaxes()` bloquée dès qu'une facture existe déjà pour le folio, motif obligatoire, journalisé dans `AuditLog`.

**Aucune duplication de calcul de taux détectée** : `ParametersService.getTaxRateMap()`/`getApplicableTaxes()` sont les deux seules façades, consommées uniquement par `BillingService`.

---

## 3. Génération de facture

**Chemin unique** : `BillingService.generateInvoice(folioId)`, transaction unique, blocage si `folio.invoices.length > 0` (« un folio = une facture maximum »).

**Numérotation** : `FAC-{YYYYMM}-{id zero-paddé sur 6}`. La facture est créée une première fois avec un placeholder puis mise à jour avec le numéro final dans la même transaction. Le suffixe numérique est l'**ID global auto-incrémenté**, pas un compteur remis à zéro chaque mois.

**Immutabilité** : une fois `EMISE`, aucune méthode du code n'expose de mise à jour de `Invoice.montantTotal`/`Invoice.statut`.

**Avoir / `CreditNote` — absence totale de chemin d'écriture** : le modèle `CreditNote` existe dans le schéma, la relation `Invoice.creditNotes` est incluse dans les lectures, et `StatutFacture.ANNULEE_PAR_AVOIR` existe comme valeur d'enum — mais **recherche exhaustive dans tout `backend/src` ne trouve aucun appel `creditNote.create`, aucune route `POST` de création d'avoir, et aucune écriture de `Invoice.statut = 'ANNULEE_PAR_AVOIR'`**. La seule occurrence du mot « CreditNote » dans le code source est un commentaire dans `billing.service.ts`. **Une facture émise ne peut aujourd'hui jamais être corrigée, annulée ni compensée par le système.**

---

## 4. Paiements et acomptes

**`PaymentsService.createPayment`** : idempotence par `idempotencyKey` — capture explicite de `P2002`, transaction annulée avant toute écriture si la clé existe déjà, paiement existant relu et retourné. `PaymentsService` ne dépend que de `BillingService`.

**Acomptes (`ReservationDeposit`)** : `DepositsService.create` suit le même patron d'idempotence. `imputerAcomptes` impute automatiquement chaque dépôt `ENCAISSE` au folio principal au check-in, marque le dépôt `IMPUTE`.

**Remboursement d'acompte** : `DepositsService.rembourser` exige `payments:refund` vérifiée manuellement en base. Bloque explicitement le remboursement d'un acompte déjà `IMPUTE` (« le remboursement passe désormais par une note de crédit sur la facture, pas par cette route ») — **référence directe et explicite dans le code à un mécanisme de note de crédit qui n'est pas implémenté** : un acompte déjà imputé à un folio facturé n'a donc, au moment de cet audit, **aucun chemin de remboursement opérationnel**.

---

## 5. Annulations, pénalités et cohérence des statuts

**Pénalité d'annulation/no-show** : `computeCancellationPenalty` est le seul calcul de pénalité, appelé identiquement par `remove()` et `markNoShow()`. Retourne `0` si aucune `CancellationPolicy` rattachée. Montant figé sur `Reservation.montantPenalite`, jamais recalculé après coup.

**Écart matérialisation folio** : le calcul de pénalité n'est **jamais** traduit en `FolioLine` — aucune réservation annulée/no-show n'a de `Stay`/`Folio`. Le recouvrement de la pénalité reste, au niveau code, un processus **entièrement humain et hors du système**.

**Soft delete de la réservation annulée** : `remove()` change `Reservation.statut` vers `ANNULEE` mais **n'écrit jamais `Reservation.deletedAt`**.

**Checkout et solde impayé** : `StayService.checkout()` calcule `soldeDu` et le renvoie dans la réponse, mais **ne bloque à aucun moment le check-out si `soldeDu !== 0`**. Un séjour peut donc être clôturé avec un solde dû strictement positif.

---

## 6. Cohérence billing / payments / stay / reporting

- `Folio.stayId` non contraint à l'unicité au niveau schéma : la garantie « un folio par séjour » repose exclusivement sur le fait qu'un seul site de code crée des folios.
- `Invoice.folioId` non contraint à l'unicité au niveau schéma : la garantie « une facture par folio » repose exclusivement sur la vérification applicative dans `generateInvoice()`.
- `FinancialReportingService` lit `FolioLine` directement en Prisma pour ses agrégations — convention documentée et cohérente, aucune divergence de méthode de calcul détectée entre `billing` et `reporting`.
- Aucune duplication de calcul de prix/taxe entre modules détectée.

---

## 7. Évaluation globale de la chaîne financière

**Constats** : la chaîne folio → paiement est robuste et disciplinée — chemin d'écriture unique pour chaque montant critique, idempotence réellement vérifiée, taxes calculées exclusivement depuis la configuration. En revanche, la chaîne se rompt structurellement au moment où une facture doit être **corrigée** : le modèle de données promet un mécanisme d'avoir, le code lui-même y fait référence à deux reprises comme solution censée exister, mais ce mécanisme n'a aucune implémentation.

**Points forts** :
- Chemin d'écriture unique et vérifié pour chaque montant sensible.
- Idempotence de paiement et d'acompte réellement testée dans le code.
- Séparation nette et sans double comptage entre TVA en marge et taxes configurables matérialisées.
- Blocage explicite de toute modification une fois la facture émise ou le séjour clôturé.
- Audit systématique et transactionnel sur toutes les écritures financières sensibles.

**Points faibles** :
- `CreditNote`/avoir entièrement non implémenté malgré sa présence dans le schéma.
- Un acompte déjà imputé à un folio facturé n'a aucun chemin de remboursement fonctionnel.
- `checkout()` ne bloque jamais sur un solde dû non nul.
- La pénalité d'annulation/no-show n'est jamais matérialisée en écriture financière traçable.
- Numérotation de facture non remise à zéro par mois malgré un préfixe `{YYYYMM}` qui le suggère visuellement.
- Invariants « un folio par séjour », « une facture par folio » reposent uniquement sur la discipline applicative.

**Risques** :
- Toute erreur de facturation détectée après émission ne peut être corrigée par aucun outil du PMS.
- Un client peut quitter l'hôtel avec un solde impayé sans qu'aucune alerte bloquante ne soit levée côté serveur.
- Un acompte imputé mais jamais facturé, puis dont le client annule finalement le séjour, se retrouve dans un état où ni le remboursement direct ni l'avoir ne sont disponibles comme chemin système.

**Questions ouvertes** :
- Le module `CreditNote` référencé deux fois dans le code comme solution attendue est-il un chantier planifié à court terme ?
- Le non-blocage du check-out sur solde impayé est-il un choix opérationnel assumé ?
- Le recouvrement des pénalités d'annulation/no-show doit-il, à terme, produire une trace financière dans le système ?
- La numérotation de facture doit-elle réellement repartir de 1 chaque mois ?

### Note globale — Robustesse de la chaîne financière : **6/10**
