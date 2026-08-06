# ADR-008 — Tarification TTC et ventilation fiscale

---

## 1. Titre

ADR-008 — Tarification TTC et ventilation fiscale

---

## 2. Statut

Proposé pour validation

* **Date :** 2026-08-06
* **Auteur :** Architecte Logiciel PMS Makarim
* **Documents de référence :**
  * `ADR-002 — Folio & Billing Model`
  * `BUSINESS_RULES.md` (BR-SEJ-004, BR-COM-002)
  * `docs/audit/01_FRONTEND_UX_AUDIT.md` §2.8 (« Règles métier validées pour l'Hôtel Makarim »)
  * Rapport d'architecture FIN-001 (mission de cadrage préalable à la présente ADR)

---

## 3. Contexte

L'analyse d'architecture menée en amont de cette ADR (missions FIN-001A, FIN-001A2, FIN-001) a établi factuellement les constats suivants dans le code actuel :

1. **Incohérence entre `computeSoldeDu` et `calculateInvoiceTotal`.** `computeSoldeDu` (`backend/src/modules/stay/utils/solde.ts`) additionne les montants bruts des `FolioLine` sans jamais appliquer de TVA. `calculateInvoiceTotal` (`backend/src/modules/billing/utils/invoice-calc.ts`) ajoute une marge de TVA (10 % HEBERGEMENT, 20 % EXTRA) au moment de la facturation. Le check-out est autorisé dès que `computeSoldeDu` atteint zéro (BR-SEJ-004), ce qui permet à un séjour d'être soldé pour un montant inférieur au total qui serait facturé si une facture était générée.
2. **TVA actuellement ajoutée dans certains calculs de facture.** `calculateInvoiceTotal` applique une majoration sur le montant brut de la ligne plutôt que d'en extraire une composante déjà incluse.
3. **Tarifs métier réellement exprimés TTC.** `docs/audit/01_FRONTEND_UX_AUDIT.md §2.8` documente une règle métier validée : les tarifs affichés au client sont TTC, avec un exemple chiffré (tarif 400 MAD = 350,70 hébergement + 45,00 petit-déjeuner + 1,00 TPT + 3,30 taxe de séjour). Cette règle n'a jamais été reprise dans `BUSINESS_RULES.md` ni dans une ADR, et n'est pas reflétée par le code actuel, qui traite `RoomType.prixBase` comme un montant hors taxe.
4. **Absence de cohérence pour RESTAURANT.** Le type `TypeLigneFolio.RESTAURANT` n'est couvert par aucune branche de `calculateInvoiceTotal` (ni majoration TVA, ni pass-through explicite) et est absent de `calculerVentilationFiscale` (`backend/src/modules/reporting/utils/ventilation-fiscale.util.ts`) : une note restaurant n'apparaît dans aucun total de la ventilation fiscale du reporting.
5. **Double facturation actuelle du petit-déjeuner standard.** `Reservation.formule`/`Stay.formule` valent `BED_AND_BREAKFAST` par défaut (`schema.prisma`), `RoomType.prixPetitDejeuner` est seedé à une valeur non nulle (50 MAD/personne/nuit), et `createFolioPrincipal`/`extendStay` (`backend/src/modules/stay/stay.service.ts`) créent une ligne `FolioLine EXTRA` additive pour ce montant, en plus de la ligne `HEBERGEMENT`. Si `prixBase` est conçu pour déjà inclure le petit-déjeuner (conformément à la règle métier citée au point 3), ce mécanisme facture le petit-déjeuner une seconde fois sur toute réservation utilisant la formule par défaut.
6. **Besoin de cohérence entre folio, facture, paiement et reporting.** Ces quatre surfaces doivent aujourd'hui être réconciliées manuellement faute d'un modèle unique de vérité sur ce qu'est le montant dû par le client.

Ces constats sont des observations factuelles issues de la lecture du code et des documents cités ; aucune donnée de production (VPS) n'a été consultée ni utilisée pour cette ADR, conformément au périmètre analyse-only des missions préalables.

---

## 4. Décision

### 4.1 Prix commerciaux TTC

Tous les prix saisis et affichés au client sont TTC, sans exception :

* hébergement ;
* restaurant ;
* room service ;
* minibar ;
* salle de réunion ;
* nuit de noces ;
* spa ;
* massage ;
* hammam ;
* blanchisserie ;
* parking ;
* navette ;
* location véhicule ;
* téléphone ;
* autres prestations.

Toute nouvelle prestation commerciale suit automatiquement ce modèle TTC. Aucune exception n'est autorisée.

### 4.2 Sens unique du calcul fiscal

```
Prix TTC
→ ventilation fiscale et comptable
→ HT + TVA + taxes
```

Jamais :

```
HT + TVA
→ prix client
```

### 4.3 Solde du séjour

`computeSoldeDu` :

* additionne uniquement les montants TTC actifs des `FolioLine` ;
* soustrait les paiements et acomptes imputés ;
* ne lit jamais `TaxRateConfig` ;
* ne lit jamais `HotelConfig` ;
* ne dépend jamais de `ParametersService`, même indirectement via un paramètre optionnel ;
* ne calcule aucune TVA.

Cette étanchéité est une garantie architecturale durable : la signature de `computeSoldeDu` ne doit jamais accepter de taux ni de configuration fiscale, afin qu'aucune évolution future ne puisse réintroduire une marge de TVA dans le calcul du solde.

### 4.4 Facturation

Le total de facture correspond à la somme TTC des charges actives du folio — il n'est pas recalculé, il est déjà connu. La facture peut afficher une ventilation informative :

* base HT ;
* TVA incluse ;
* taxe de séjour ;
* TPT lorsqu'elle sera formalisée (composante actuellement absente de toute configuration technique — `TaxRateConfig` ne contient aucun type `TPT`) ;
* ventilation par activité (nature métier, voir §4.7).

Cette ventilation fiscale et comptable est produite selon la formule (`baseHT = composanteTTC / (1 + taux/100)`, `tva = composanteTTC − baseHT`) et ne modifie jamais le montant TTC total.

### 4.5 Petit-déjeuner

Le petit-déjeuner standard inclus dans le tarif public :

* ne crée aucune charge additive ;
* peut apparaître à titre informatif dans la ventilation ou sur la facture ;
* ne doit jamais augmenter une deuxième fois le montant du folio.

Un petit-déjeuner vendu séparément (hors formule incluse, ex. à la carte pour un accompagnant ou un client `ROOM_ONLY`) constitue une prestation indépendante pouvant créer une ligne de folio à part entière — la règle de non-additivité ne s'applique qu'au petit-déjeuner déjà compris dans le tarif public de la formule réservée.

### 4.6 Restaurant et autres prestations

Toutes les prestations commerciales du PMS sont exprimées en TTC. Le mécanisme de ventilation fiscale et comptable est identique quel que soit le type de prestation — restaurant compris. Exemple :

```
Café : 14 MAD TTC
```

Le client paie 14 MAD. La TVA fait l'objet d'une ventilation fiscale et comptable à partir du montant de 14 MAD pour le reporting fiscal, jamais ajoutée par-dessus.

### 4.7 Nature de charge

Le modèle distingue deux notions :

* un **type comptable stable** (`TypeLigneFolio` existant : `HEBERGEMENT`, `EXTRA`, `RESTAURANT`, `TAXE_SEJOUR`, `PAIEMENT`), seul support des calculs fiscaux (taux de TVA applicable) ;
* une **nature métier** distincte, servant d'axe analytique : libellé de facture, chiffre d'affaires par activité, tableaux de bord, exports comptables, analyses de rentabilité, filtres et rapports.

Modèle retenu pour la nature :

```
FolioLine.nature: String?
```

Champ nullable (compatibilité totale avec les lignes historiques, jamais rétro-remplies), pas un enum Prisma — extensibilité sans migration future. La liste des valeurs autorisées est cependant **validée applicativement** (couche DTO), pas laissée en saisie libre incontrôlée, afin d'éviter des variantes incohérentes (`Room Service` / `ROOM_SERVICE` / `Room-service`) qui rendraient les rapports peu fiables. Une valeur `AUTRE` est prévue, accompagnée d'un libellé libre distinct pour les cas hors liste.

**La nature n'a aucun impact sur les calculs financiers. Elle constitue exclusivement un axe analytique.** Toute logique de calcul (TVA, solde, facturation) doit continuer à discriminer exclusivement sur le type comptable (`if type === RESTAURANT`) — jamais sur la nature (`if nature === "Restaurant"`), qui reste réservée au libellé, aux statistiques et au reporting.

Liste de référence, centralisée backend et frontend :

```
HEBERGEMENT
RESTAURANT
ROOM_SERVICE
MINIBAR
PETIT_DEJEUNER
DEJEUNER
DINER
SALLE_REUNION
SPA
MASSAGE
HAMMAM
BLANCHISSERIE
PARKING
NAVETTE
LOCATION_VEHICULE
NUIT_DE_NOCES
TELEPHONE
AUTRE
```

### 4.8 Paiements

Le paiement règle le solde global du folio. Aucune affectation manuelle par nature de prestation n'est requise ni proposée — un `computeSoldeParNature` est explicitement exclu de ce modèle.

Le dialogue d'encaissement devra afficher :

* total TTC du séjour ;
* déjà payé ;
* reste à payer ;
* montant à encaisser, préempli automatiquement avec le solde ;
* possibilité de paiement partiel (montant modifiable).

### 4.9 Surpaiement

Le surpaiement doit être empêché dans une transaction :

```
Folio FOR UPDATE
→ FolioLine FOR UPDATE
→ recalcul du solde TTC
→ validation
→ Payment
→ FolioLine PAIEMENT
```

Erreurs structurées :

```
OVERPAYMENT
PAYMENT_NOT_REQUIRED
```

### 4.10 Immutabilité

Aucune facture `EMISE` ne doit être recalculée silencieusement, quel que soit l'écart constaté a posteriori entre son montant et une évolution ultérieure du modèle de calcul. Aucun montant historique de `FolioLine` ne doit être réécrit automatiquement lors du déploiement de cette décision — seule la logique de calcul future (lecture et écriture des nouvelles opérations) est concernée.

---

## 5. Conséquences positives

* **Cohérence client/folio/facture :** le montant affiché au client, le montant du folio, le montant de l'écran d'encaissement et le total de la facture deviennent structurellement identiques pour un même ensemble de prestations à un instant donné.
* **Suppression du risque de double TVA :** plus aucune majoration n'est appliquée par-dessus un tarif déjà TTC.
* **Simplicité du solde :** `computeSoldeDu` reste une simple addition, sans dépendance fiscale, plus simple à auditer et à faire évoluer sans risque de régression.
* **Reporting plus fiable :** RESTAURANT et les futures prestations (spa, salle de réunion, etc.) deviennent visibles et correctement ventilées dans le chiffre d'affaires par activité, alors qu'elles sont aujourd'hui partiellement ou totalement absentes.
* **Extensibilité des activités :** l'ajout d'une nouvelle prestation (ex. « Excursion ») ne nécessite ni migration de schéma ni modification de la logique fiscale, seulement un ajout dans la liste de référence de la nature.
* **UX d'encaissement simplifiée :** le montant à encaisser est préempli automatiquement, supprimant le calcul manuel actuellement à la charge du réceptionniste.
* **Réduction des erreurs de caisse :** moins de saisie manuelle de montant signifie moins de risque d'erreur de frappe ou de calcul au comptoir.

---

## 6. Conséquences négatives et coûts

* **Correction du petit-déjeuner :** nécessite de revoir le mécanisme de création de la ligne `EXTRA` additive dans `createFolioPrincipal` et `extendStay`, avec un examen attentif des séjours en cours au moment de la bascule.
* **Refactor de la facturation :** `calculateInvoiceTotal` doit passer d'une logique d'addition à une logique de ventilation fiscale et comptable, avec couverture explicite du type `RESTAURANT` qui en est aujourd'hui absent.
* **Refactor du reporting fiscal :** `calculerVentilationFiscale` doit être aligné sur le même principe de ventilation fiscale et comptable et couvrir tous les types de charge, y compris RESTAURANT.
* **Ajout de `nature` :** migration Prisma additive sur `FolioLine`, mise à jour des DTO d'écriture (`AddFolioLineDto`, `CreateRestaurantChargeDto`), validation applicative de la liste autorisée.
* **Adaptation de l'API :** `GET /stays/:id` doit exposer un `financialSummary` structuré (total dû, déjà payé, solde), les endpoints d'ajout de charge doivent accepter et retourner `nature`.
* **Adaptation du frontend :** deux écrans distincts à faire évoluer (ajout de charge avec sélection de nature ; encaissement avec montant préempli), sans fusion conceptuelle des deux opérations.
* **Tests de non-régression :** l'ensemble des tests e2e touchant à la facturation, au solde et au check-out (`checkin-flow.e2e-spec.ts`, `billing.e2e-spec.ts`, `solde.spec.ts`) devra être revu pour refléter le nouveau modèle TTC.
* **Analyse des séjours ouverts avant déploiement :** les séjours `EN_COURS` au moment de la bascule verront leur solde recalculé différemment dès l'activation (impact immédiat, à communiquer à la réception avant tout déploiement).

---

## 7. Alternatives rejetées

### Alternative A : TVA ajoutée au prix client

**Description :** conserver le comportement actuel où `calculateInvoiceTotal` majore le montant brut de la ligne d'une marge de TVA au moment de la facturation.
**Pourquoi elle a été rejetée :** contradictoire avec la règle métier validée selon laquelle le tarif communiqué au client est déjà TTC ; c'est précisément le mécanisme à l'origine de l'incohérence P0 identifiée entre `computeSoldeDu` et `calculateInvoiceTotal`.

### Alternative B : `computeSoldeDu` fiscalisé

**Description :** faire évoluer `computeSoldeDu` pour qu'il calcule lui-même une marge de TVA sur les lignes de charge, afin de le réconcilier avec `calculateInvoiceTotal`.
**Pourquoi elle a été rejetée :** introduirait une dépendance du solde vers la configuration fiscale (`TaxRateConfig`/`ParametersService`), rendant le calcul du solde plus complexe et plus fragile qu'une simple addition, pour un problème qui se résout entièrement en corrigeant le sens du calcul de facturation plutôt que le solde.

### Alternative C : solde par nature (`computeSoldeParNature`)

**Description :** calculer un reste-à-payer distinct par nature de prestation (séjour, restaurant, spa, etc.), pour permettre un encaissement affecté à une catégorie précise.
**Pourquoi elle a été rejetée :** aucun besoin métier explicite d'affectation comptable des paiements par prestation n'a été validé ; le paiement règle le solde global du folio, la nature reste un axe purement analytique (facturation, statistiques), jamais un axe de calcul du solde.

### Alternative D : extension massive de `TypeLigneFolio`

**Description :** ajouter une valeur d'enum `TypeLigneFolio` par prestation (SPA, PARKING, SALLE_REUNION, etc.) plutôt que d'introduire un champ `nature` distinct.
**Pourquoi elle a été rejetée :** disperserait le barème fiscal (taux de TVA par type) dans une logique de présentation commerciale, exigerait une migration Prisma à chaque nouvelle prestation, et casserait la stabilité des branches de calcul existantes (`invoice-calc.ts`, `ventilation-fiscale.util.ts`, gardes de `cancelFolioLine`) qui raisonnent aujourd'hui sur un nombre restreint de types.

### Alternative E : table administrable de natures dès la première version

**Description :** créer un référentiel en base (table dédiée) pour administrer dynamiquement la liste des natures, sans déploiement de code.
**Pourquoi elle a été rejetée :** prématuré en l'absence de besoin exprimé d'ajout fréquent de natures par un utilisateur non développeur (contrairement à `TaxRateConfig`/`SeasonRate`, où ce besoin est explicitement établi) ; une liste centralisée en `String` libre validée applicativement suffit pour une première version, et la migration vers un référentiel administrable reste possible plus tard sans perte.

### Alternative F : recalcul rétroactif des factures émises

**Description :** recalculer les factures déjà émises pour les aligner sur le nouveau modèle TTC lors de la bascule.
**Pourquoi elle a été rejetée :** viole directement l'invariant d'immutabilité des factures déjà établi par `ADR-002` (INV-003) ; toute correction d'une facture déjà émise doit passer par un avoir (`CreditNote`), jamais par une réécriture silencieuse.

---

## 8. Invariants

```
INV-FIN-001
Pour un même ensemble de prestations et au même instant :
total TTC des charges actives
=
total TTC à facturer
=
total TTC dû avant déduction des paiements.
```

```
INV-FIN-002
Solde à encaisser
=
total TTC des charges actives
− paiements
− acomptes imputés.
```

```
INV-FIN-003
La ventilation fiscale ne modifie jamais le total TTC.
```

```
INV-FIN-004
computeSoldeDu ne dépend jamais de la fiscalité.
```

```
INV-FIN-005
Le petit-déjeuner standard inclus ne crée aucune charge additive.
```

---

## 9. Plan de transition

1. ADR-008 validée ;
2. correction du petit-déjeuner ;
3. correction de `calculateInvoiceTotal` ;
4. correction de la ventilation fiscale et couverture de RESTAURANT ;
5. ajout de `FolioLine.nature` ;
6. ajout de `financialSummary` (`GET /stays/:id`) ;
7. protection contre le surpaiement ;
8. nouvelle UX d'encaissement ;
9. nouvelle UX d'ajout de charge ;
10. recette complète paiement → facture → check-out.

Chaque étape reste indépendamment déployable et non destructive sur les données existantes : aucune migration ne réécrit de valeur historique, et le backend précède systématiquement le frontend qui en dépend.

---

## 10. Critères de validation

Cette ADR est considérée comme correctement implémentée si elle permet de démontrer les deux scénarios suivants :

```
Café 14 MAD TTC
→ facture 14 MAD
→ ventilation HT/TVA informative
→ paiement 14 MAD
→ solde 0
```

```
Tarif chambre 400 MAD TTC
→ petit-déjeuner inclus non additif
→ facture totale 400 MAD
→ paiement 400 MAD
→ solde 0
→ check-out autorisé
```

---

## 11. Gouvernance

Toute évolution du modèle financier doit préserver :

* INV-FIN-001
* INV-FIN-002
* INV-FIN-003
* INV-FIN-004
* INV-FIN-005

Toute évolution incompatible avec l'un de ces invariants nécessite une nouvelle ADR, validée avant tout code, jamais l'inverse — conformément à la règle de gouvernance générale du projet (`CLAUDE.md`, « Architecture gelée — référentiel unique de vérité »). Aucune Pull Request touchant `computeSoldeDu`, `calculateInvoiceTotal`, `calculerVentilationFiscale` ou le modèle de `FolioLine` ne peut être fusionnée si elle contredit un invariant de la présente ADR sans qu'une nouvelle ADR l'ait explicitement révisé.
