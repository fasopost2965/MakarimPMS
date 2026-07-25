# Spécification Technique — Module Facturation (billing.md)

---

## 1. Objectif du module
Le module **Facturation** assure la gestion des comptes de séjours, la répartition des charges, le calcul des taxes d'exploitation et la production d'écritures fiscales conformes de l'Hôtel Makarim. Il garantit la traçabilité indélébile de chaque mouvement de débit financier et scelle de manière immuable les factures émises pour répondre aux contraintes fiscales de la législation marocaine.

---

## 2. Responsabilités
Le module est seul responsable de :
* La création, l'administration, et le verrouillage des folios d'hébergement et d'extras (`Folio`).
* L'imputation unifiée et le calcul des charges financières sur les folios d'exploitation (`FolioLine`).
* L'ajustement de lignes de facturation via une procédure d'exception stricte exigeant une justification écrite.
* L'application rigoureuse des taxes de séjour hôtelières et de la TVA marocaine par type de ligne de facturation.
* La consolidation des soldes de folios pour autoriser ou bloquer la procédure de check-out physique.
* L'édition de documents fiscaux réglementaires immuables (Factures d'hébergement, Factures d'avoirs/Crédits).

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* L'enregistrement des encaissements financiers physiques (confié au module `payments`).
* La commercialisation prospective des nuitées d'hébergement (confié au module `reservations`).
* L'attribution physique des chambres ou l'accueil des voyageurs (confié au module `stay`).

---

## 4. Entités manipulées
Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `Folio` (Conteneur financier du séjour)
* `FolioLine` (Détail de charge : Hébergement, Extra, Taxe, Crédit de règlement)
* `Invoice` (Document fiscal officiel scellé et immuable)
* `Stay` (Relation d'association opérationnelle d'hébergement)
* `TaxRateConfig` (Fichier de configuration des taux de TVA et taxes de séjour)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-FAC-001 (Capacité Multi-Folios) :** Possibilité d'associer plusieurs folios à un séjour.
* **BR-FAC-002 (Typologie des Charges de Folio) :** Catégorisation stricte des mouvements.
* **BR-FAC-003 (Immutabilité des Factures Émises) :** Interdiction de modifier ou de supprimer physiquement une facture émise.
* **BR-FAC-004 (Application des Taxes de Séjour) :** Taxe de séjour calculée par nuitée et par personne, facturée à TVA 0%.
* **BR-SEJ-004 (Invariant de Solde de Check-out) :** Solde cumulé des folios égal à 0.00 MAD requis pour clore le séjour.
* **BR-AUD-002 (Justification d'ajustement de folio) :** Justification écrite >= 10 caractères et écriture synchrone dans `AuditLog` de toute modification ou soft-delete de ligne de folio d'extras.

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-002 (Folio & Billing Model)](/docs/ADR-002-Folio-Billing-Model.md) :** Structuration financière découpée et transferts inter-folios de charges.
* **[ADR-004 (Payment & Financial Integrity)](/docs/ADR-004-Payment-Financial-Integrity.md) :** Calculs monétaires stricts en MAD et neutralisation par avoirs.
* **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md) :** Traçabilité et interdiction d'effacement physique des données financières.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Ségrégation des habilitations d'écriture financière.

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `billing:read` : Autorisé pour `ADMINISTRATEUR`, `RECEPTION`, `COMPTABLE`.
* `billing:write` (Édition de folio, ajustement de taxes, génération de facture) : Autorisé exclusivement pour `ADMINISTRATEUR` et `COMPTABLE`.
* *Note :* La Réception consultera le solde pour la validation de départ, mais n'a aucun droit de modification ou de suppression de ligne de folio.

---

## 8. Flux entrants
Le module intercepte les événements et requêtes suivants :
* Initialisation d'un séjour (génère le folio principal d'hébergement).
* Demande d'imputation d'une charge d'hébergement quotidienne (calculé à la nuitée).
* Requête d'imputation d'un extra de consommation (Room Service, blanchisserie).
* Demande d'ajustement ou d'annulation de ligne de folio par le Comptable.
* Demande d'édition d'une facture fiscale définitive de séjour.

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* `FOLIO_SOLDE_MODIFIE` : Émis après chaque mise à jour de ligne de charge ou paiement (permet d'actualiser le solde d'exploitation).
* `FACTURE_EMISE` : Émis après génération légale de la facture (déclenche le verrouillage définitif du folio associé).
* `SOLDE_APURE_NOTIF` : Notifie le module `stay` que le solde est égal à 0.00 MAD pour autoriser le départ physique.

---

## 10. Dépendances autorisées
Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `stay` : Pour valider l'existence du séjour et s'assurer que le folio est rattaché à un dossier opérationnel actif.
* `audit` : Pour consigner immédiatement les audits d'anomalies financières lors de corrections de notes.

---

## 11. Dépendances interdites
Ce module a l'interdiction stricte de dépendre de :
* `housekeeping` / `maintenance` : Le module de facturation ne doit jamais importer de logique d'entretien physique des chambres ou de réparation technique. *Justification : Préservation absolue de l'étanchéité des flux financiers hôteliers.*
* `hr` : Pas d'accès fonctionnel ou technique au pointage ou à la masse salariale. *Justification : Ségrégation comptabilité d'exploitation et ressources humaines.*
* `reservations` : Pour la facturation d'exploitation courante, le module ne dialogue qu'avec le séjour actif. *Justification : Découplage de la phase d'exploitation et de la phase prospective de vente.*

---

## 12. Contraintes métier
* **Calcul monétaire en Dirham Marocain (MAD) :** Tous les calculs financiers sont stockés et calculés en Dirhams Marocains sous la forme d'un type Decimal à deux décimales pour éviter toute dérive d'arrondi sur les montants de taxes hôtelières.
* **TVA Marocaine Multi-taux :** Le système de facturation applique :
  * Un taux de **10%** pour les charges d'hébergement.
  * Un taux de **20%** pour les services d'extras (SPA, blanchisserie, Room Service).
  * La taxe de séjour est quant à elle facturée à un taux de **0%** de TVA (non soumise à la TVA).

---

## 13. Invariants
* **INV-FAC-001 (Immutabilité Fiscale de Facture) :** Une facture enregistrée à l'état `EMISE` ne peut être ni supprimée de la base de données, ni modifiée sur ses lignes de débits, de crédits, ou de montants de taxes collectées.
* **INV-FAC-002 (Verrouillage de Folio) :** Un folio associé à une facture à l'état `EMISE` est définitivement bloqué à l'état `VERROUILLE`. Toute tentative d'ajout, de modification, ou d'annulation de ligne sur un folio verrouillé est bloquée.

---

## 14. États manipulés
Ce module gère le cycle de vie des folios et factures :
* **Folio :** `OUVERT`, `VERROUILLE`.
* **Invoice :** `EMISE`, `ANNULEE_PAR_AVOIR` (neutralisation fiscale réglementaire).

---

## 15. Points sensibles
* **Ajustements sauvages de tarifs :** Risque de fraudes d'exploitation où un réceptionniste pourrait modifier manuellement le tarif d'une chambre pour accorder des remises indues à un proche sans laisser de traces.
  * *Résolution :* Resserrement strict des permissions RBAC d'écriture sur le folio au Comptable/Admin, et obligation de justifier par écrit toute modification de tarif de nuitée de séjour avec traçabilité synchrone dans `AuditLog` d'anomalie financière.

---

## 16. Dette technique connue
* *Aucune dette technique identifiée à ce stade.*

---

## 17. Fonctionnalités prévues ultérieurement
* **Phase 2 :** Mise en œuvre de l'export automatique des données comptables de ventes du mois vers un fichier normalisé compatible avec les logiciels comptables marocains d'audit fiscal (Sage, Cegid).

---

## 18. Checklist de Pull Request
Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Toutes les requêtes d'ajustement ou d'annulation de ligne de folio vérifient l'existence d'un motif explicatif d'au moins 10 caractères.
* [ ] Le contrôleur d'API d'imputation financière ou d'ajustement bloque l'accès aux utilisateurs ne possédant pas la permission `billing:write`.
* [ ] Les calculs financiers et de taxes sont stockés sous forme de types Decimal Prisma et ne font l'objet d'aucun arrondi instable de type Float natif JavaScript.
* [ ] Les factures générées sont marquées `EMISE` et provoquent de manière synchrone le passage du folio ciblée à l'état `VERROUILLE`.
