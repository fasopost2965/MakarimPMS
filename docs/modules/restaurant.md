# Spécification Technique — Module Restauration (restaurant.md)

> **Statut au 2026-11-06** : module **partiellement implémenté**.
> Existant : `POST` de charge restaurant sur folio + rapport du jour
> (`RestaurantService.addCharge`, `getDailyReport`), type `TypeLigneFolio.RESTAURANT`,
> permission `restaurant:read` / `restaurant:write`, rôle `RESTAURATEUR`.
> À construire (lot L3) : carte, tables, notes et ruptures.
> Référentiel métier : `BUSINESS_RULES.md` §15 (BR-RST-001 → 005).

---

## 1. Objectif du module

Le module **Restauration** couvre le service du restaurant de l'hôtel : carte,
plan de salle, prise de commande, envoi de la note en chambre, encaissement
direct et petit-déjeuner. Il doit produire un chiffre d'affaires traçable là où
l'exploitation réelle se fait aujourd'hui sur papier.

---

## 2. Responsabilités

* Tenir la **carte** (catégories, articles, prix TTC, disponibilité).
* Gérer le **plan de salle** et l'occupation des tables, un service à la fois.
* Créer et clôturer des **notes** (commande) rattachées à une table et à un
  nombre de couverts.
* **Envoyer en chambre** : écrire les lignes `RESTAURANT` (TVA 20 %) sur le folio
  du séjour en cours, jamais sur un folio clôturé.
* Encaisser directement une note (espèces, carte) et produire un ticket non fiscal.
* Compter les **couverts du petit-déjeuner** par formule, sans refacturer les
  petits-déjeuners déjà inclus (BR-RST-003 / ADR-008 §4.5).
* Produire le **rapport du jour** : CA par mode de règlement, couverts, tickets
  annulés avec motif.

---

## 3. Hors périmètre

* La tarification de l'hébergement et des pensions (`stay`, `billing`).
* Le registre de dépôts et les avoirs (`billing`).
* Les achats et stocks de denrées (`stock`, `purchase-orders`) — la rupture de
  carte est un indicateur d'exploitation, pas un mouvement de stock.
* La comptabilité générale (`accounting`, non implémenté).

---

## 4. Entités et objets manipulés

| Objet | Nature | Statut |
|---|---|---|
| `FolioLine` (type `RESTAURANT`, `nature = RESTAURANT`) | écriture financière | **existe** |
| `ArticleCarte` (nom, catégorie, prix TTC, disponible) | référentiel | à créer |
| `Commande` (table, couverts, heure, statut, lignes, `folioId`) | exploitation | à créer |
| `Rupture` (article, motif, auteur, horodatage) | exploitation | à créer |

Le catalogue de démonstration (22 articles, 12 tables) est visible dans
`prototype/src/data.js`.

---

## 5. Règles métier applicables

* **BR-RST-001** — une seule note ouverte par table et par service.
* **BR-RST-002** — envoi en chambre = lignes `RESTAURANT` sur le folio du séjour
  actif ; refus si le folio est clôturé ou le séjour soldé ; journalisation.
* **BR-RST-003** — petit-déjeuner inclus dans la formule : aucune charge
  additionnelle ; hors formule : prestation facturable.
* **BR-RST-004** — rupture : article non commandable, réversible, journalisé.
* **BR-RST-005** — encaissement idempotent (BR-PAI-001), annulation logique avec
  motif (BR-AUD-002), TVA 20 % (BR-COM-002).
* **BR-FAC-002** — typologie des charges : le type `RESTAURANT` est distinct
  d'`EXTRA` et suit son propre taux.

---

## 6. Écrans (prototype de refonte)

Quatre onglets : *Service du jour* (plan de salle + prise de commande),
*Carte & ruptures*, *Petit-déjeuner* (couverts par formule), *Rapport du jour*.
Le panneau de commande s'ouvre à droite, la note se règle ou part en chambre.

---

## 7. Points de vigilance

1. **Concurrence** : deux serveurs ne doivent jamais écrire la même note — verrou
   par table, comme pour les chambres.
2. **Argent** : l'encaissement doit être idempotent, sinon double recette.
3. **TVA** : 20 % sur la carte ; 10 % uniquement pour les repas inclus dans une
   pension (déjà couverts par le prix de la chambre).
4. **Rôle** : seul `RESTAURATEUR` (ou Administrateur) écrit une note ; la
   Réception peut en créer une en cas d'affluence (matrice RBAC révisée).
