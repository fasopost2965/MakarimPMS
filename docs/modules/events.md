# Spécification Technique — Salle de conférence & événementiel (events.md)

> **Statut au 2026-11-06** : **non implémenté** — aucun module `backend/src/modules/events/`,
> aucune entité `Salle` / `Evenement` / `Devis`.
> Spécification cible du **lot L4** de la refonte 3★.
> Référentiel métier : `BUSINESS_RULES.md` §16 (BR-EVT-001 → 006).

---

## 1. Objectif du module

Commercialiser la salle de conférence de l'hôtel : séminaires d'entreprise,
réunions, formations, cérémonies familiales. Le module doit permettre de
répondre au téléphone, de chiffrer un devis en trois minutes, de bloquer la salle
et de facturer l'acompte — sans passer par un tableur parallèle.

> **Périmètre assumé** : la salle n'est pas mentionnée dans le cahier des charges
> d'origine. Les valeurs de référence (capacité 90 m² / 60 places, 2 500 MAD la
> journée, pause-café 35 MAD, déjeuner 120 MAD, TVA 20 %, acompte 30 %) sont des
> **hypothèses paramétrables**, à confirmer par la direction.

---

## 2. Responsabilités

* Gérer les **salles** et leurs créneaux (journée, demi-journée, soirée).
* Bloquer une salle sans jamais autoriser deux événements qui se chevauchent.
* Construire un **devis** : participants ≤ capacité, prestations, total
  HT / TVA 20 % / TTC, validité paramétrable.
* Encaisser l'**acompte de 30 %** (facture d'acompte + dépôt, BR-FAC-005).
* Suivre le **solde** jusqu'au jour de l'événement.
* Facturer une **entreprise** (ICE, RC, IF, plafond de crédit, city ledger).
* Gérer l'**annulation** selon barème et produire un avoir si nécessaire.

---

## 3. Hors périmètre

* La restauration servie pendant l'événement relève du module `restaurant`
  (lignes `RESTAURANT`, TVA 20 %) ; l'événementiel n'écrit que la location et les
  prestations forfaitaires.
* La paie et le planning du personnel de service (`hr`).
* La facturation générale et les avoirs (`billing`).

---

## 4. Entités cibles

| Objet | Rôle | Champs principaux |
|---|---|---|
| `Salle` | référentiel | nom, capacité max, surface, tarifs par créneau |
| `Evenement` | exploitation | salle, client ou société, date, créneau, participants, statut (`OPTION`, `CONFIRME`, `ANNULE`, `TERMINE`) |
| `EvenementPrestation` | détail | libellé, quantité, prix TTC, TVA |
| `Devis` | commercial | lignes, total HT/TVA/TTC, validité, acompte attendu |
| `FolioLine` (type `EXTRA`, `nature = SALLE_REUNION`) | financier | montant TTC, TVA 20 % |

---

## 5. Règles métier applicables

* **BR-EVT-001** — exclusivité de la salle : aucun chevauchement, option à
  expiration automatique (48 h par défaut), contrôle transactionnel.
* **BR-EVT-002** — devis : participants ≤ capacité, prix TTC, ventilation TVA 20 %,
  validité paramétrable.
* **BR-EVT-003** — acompte 30 % encaissé avant planification définitive, solde dû
  au jour de l'événement.
* **BR-EVT-004** — barème d'annulation (remboursé / 50 % / acquis) et avoir si
  facture déjà émise.
* **BR-EVT-005** — facturation entreprise : mentions légales obligatoires
  (BR-CLI-006) et plafond de crédit (BR-CLI-004).
* **BR-EVT-006** — effectif ≤ capacité de sécurité, refus côté serveur.

---

## 6. Écrans (prototype de refonte)

Planning **7 jours × 3 créneaux**, liste des événements dépliables (client,
participants, prestations, solde), et **constructeur de devis** avec calcul
HT / TVA 20 % / TTC / acompte 30 % en direct.

---

## 7. Points de vigilance

1. **Double réservation de salle** : le risque n°1 commercialement — un contrôle
   applicatif seul ne suffit pas, il faut une contrainte transactionnelle.
2. **Acompte non encaissé** : un événement ne doit jamais être « confirmé » sans
   acompte, sinon l'option est bloquée pour rien.
3. **Facturation mixte** : une entreprise qui prend la salle et le déjeuner
   produit deux natures de lignes (location + restauration), toutes deux à 20 %.
