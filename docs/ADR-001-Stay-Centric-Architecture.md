# Architecture Decision Record (ADR-001) : Stay-Centric Architecture

Ce document formalise la décision d'architecture majeure plaçant l'entité **Séjour (Stay)** au cœur du modèle de données et du cycle de vie opérationnel du Property Management System (PMS) de l'Hôtel Makarim.

---

## 1. Métadonnées

* **Identifiant :** ADR-001
* **Titre :** Stay-Centric Architecture (Centralité du Séjour)
* **Statut :** Validé
* **Date :** 2026-07-19
* **Auteur :** Architecte Logiciel PMS Makarim
* **Documents de référence :**
  * `BUSINESS_RULES.md` (BR-TR-001, BR-RES-002, BR-SEJ-001 à BR-SEJ-005, BR-FAC-001)
  * `DATA_DICTIONARY.md` (Entités `Reservation`, `Stay`, `Folio`, `RoomNight`)
  * `RBAC_MATRIX.md` (Rôles Réception, Comptable, Administration)
  * Plan d'Exécution Claude Code (`docs/plan-execution-claude-code.md`)
  * Cahier des charges final — PMS Hôtel Makarim.pdf

---

## 2. Contexte

Le développement d'un PMS pour un hôtel de 24 chambres à Tétouan nécessite une gestion rigoureuse, souple et traçable de la réalité physique et financière de l'exploitation. 

Historiquement, de nombreux systèmes hôteliers légers ont adopté un modèle "centré sur la réservation" (Reservation-Centric), où la réservation porte directement les détails de la chambre, la facturation, et le solde financier. Cependant, l'analyse de l'exploitation réelle de l'Hôtel Makarim montre que ce modèle présente des limites critiques :
1. **Divergence entre prévisionnel et réel :** Une réservation est une intention d'arrivée. Dans la réalité, un client peut ne pas se présenter (No-Show), écourter son séjour, le prolonger, ou changer de chambre en cours de séjour. Lier directement la facturation ou l'état physique de la chambre à la réservation crée de graves incohérences en base de données lors de ces ajustements opérationnels.
2. **Gestion des clients spontanés (Walk-In) :** Les arrivées sans réservation préalable sont fréquentes. Forcer la création d'une fausse "réservation" artificielle pour pouvoir enregistrer un client sur place alourdit le flux et pollue les données de prévisions.
3. **Complexité du fractionnement de facture (Multi-Folio) :** Un séjour corporatif (très fréquent à l'Hôtel Makarim) exige fréquemment que les nuitées d'hébergement soient facturées à l'entreprise partenaire (City Ledger) tandis que les extras (Room Service, SPA, minibar) soient réglés sur place par l'occupant. Si la facture est directement rattachée à la réservation, il est techniquement impossible de gérer ce fractionnement de manière étanche.
4. **Instabilité des données financières :** Si une réservation est modifiée ou annulée après que des consommations ou des acomptes ont été enregistrés, l'intégrité comptable et fiscale (exigée par la réglementation marocaine) est compromise.

---

## 3. Décision

Pour pallier ces limites, nous actons l'adoption d'un modèle **Stay-Centric (Centré sur le Séjour)**. La structure et le cycle de vie opérationnel sont définis selon les principes stricts suivants :

1. **La Réservation prépare un Séjour :** L'entité `Reservation` n'est qu'un document de planification prévisionnelle. Elle bloque des nuitées (`RoomNight`) mais ne contient aucune écriture comptable définitive d'exploitation (hors acomptes éventuels versés en amont).
2. **Le Check-In crée ou active un Séjour :** Le processus opérationnel d'enregistrement (Check-In) marque la fin de la phase de planification et génère l'entité opérationnelle `Stay`. Si l'arrivée est un Walk-In, le `Stay` est créé directement sans passer par une `Reservation` (relation `Reservation` ➔ `Stay` optionnelle de type 1-to-1).
3. **Les Folios appartiennent au Séjour :** L'entité `Stay` détient une relation 1-to-N avec l'entité `Folio` (portefeuille de facturation). Aucun folio ne peut exister en dehors d'un séjour.
4. **Toute consommation appartient au Séjour :** Les consommations (nuits d'hébergement, taxes de séjour, room service, SPA, minibar) sont matérialisées sous forme de lignes de folio (`FolioLine`) de type `HEBERGEMENT` ou `EXTRA`, rattachées exclusivement à un folio du séjour actif.
5. **Toute facturation est rattachée au Séjour :** Les factures (`Invoice`) et avoirs (`CreditNote` / Décision métier à confirmer) sont émis à partir de la clôture partielle ou totale d'un ou plusieurs folios appartenant au séjour.
6. **Les Paiements soldent un Séjour :** Les règlements financiers des clients ou des entreprises partenaires sont enregistrés sous forme de lignes de folio créditrices de type `PAIEMENT` ou de transactions liées aux folios du séjour. Ils réduisent le solde comptable du séjour.
7. **Le Check-Out clôture un Séjour :** Le Check-Out est l'acte de clôture opérationnel et comptable qui ne peut se faire que si le solde financier de tous les folios du séjour est apuré, ce qui libère physiquement la chambre pour l'entretien.

---

## 4. Conséquences

* **Réservations :** Elles redeviennent des pièces d'intention légères. Les modifications de dernière minute sur une réservation n'impactent pas l'historique financier d'autres séjours passés ou présents. Après le Check-In, l'entité `Reservation` passe au statut `TRANSFORMEE_EN_SEJOUR` et n'est plus modifiable directement.
* **Chambres :** Les chambres physiques ne stockent plus de solde financier ni d'historique de consommations. Elles sont simplement reliées au séjour actif (`Stay`) pour déterminer leur statut d'occupation (`OCCUPEE` ou `DEPART_PREVU`). Le passage de chambre (ex. relogement suite à une panne) consiste simplement à modifier la clé étrangère `roomId` dans le `Stay` actif et à réassigner les `RoomNight` physiques, sans altérer les folios ou fiches factures déjà accumulés.
* **Housekeeping :** Le check-out opérationnel du séjour déclenche immédiatement la libération de la chambre physique et génère automatiquement une tâche de nettoyage (`HousekeepingTask`) au statut `A_FAIRE`, assurant la déconnexion complète entre la finance du client et la logistique interne.
* **Billing & Folios :** Flexibilité totale pour diviser les charges. Un réceptionniste peut transférer une ligne de consommation d'un folio principal (ex. hébergement) vers un folio d'extras à la demande du client en un clic, tant que le folio n'est pas facturé (verrou d'immutabilité).
* **Paiements :** L'idempotence des transactions (`Idempotency-Key`) protège les folios du séjour contre les doubles débits accidentels. Les paiements anticipés (acomptes) enregistrés lors de la réservation sont automatiquement transférés comme solde créditeur de départ sur le folio principal au moment du check-in.
* **Comptabilité :** Clarté absolue pour l'établissement des journaux de ventes. Le chiffre d'affaires est constaté uniquement lors de la facturation des folios de séjours réels (calcul des bases HT de 10% pour l'hébergement et 20% pour les extras).
* **Reporting :** La distinction entre le prévisionnel (réservations actives sur le planning) et le réalisé (séjours actifs ou archivés) permet de calculer des indicateurs de performance (taux d'occupation réel, RevPAR, ADR) d'une fiabilité indiscutable.
* **Audit :** Les actions sensibles (transfert de charges entre folios, annulations logiques avec flag `annulee = true`, réouverture de folios) écrivent obligatoirement un journal d'audit immuable avec référence au séjour et motif obligatoire.

---

## 5. Alternatives étudiées

### Alternative A : Modèle centré sur la Réservation (Reservation-Centric)
* **Description :** Toutes les charges, factures et paiements sont directement rattachés à la table `Reservation`.
* **Pourquoi elle a été rejetée :** Incapable de gérer proprement les séjours Walk-In sans complexifier le schéma (obligation de créer une réservation fantôme). Inadaptée en cas de prolongation ou de réduction de séjour en cours de route, car elle force à modifier rétroactivement les dates d'une réservation déjà consommée. Impossible d'isoler des folios multiples pour la facturation d'entreprises.

### Alternative B : Modèle centré sur la Facture (Invoice-Centric)
* **Description :** Le point d'entrée de toute transaction est la facture. Les consommations et paiements sont rattachés directement à un compte de facturation globale sans passer par la matérialisation d'un séjour physique.
* **Pourquoi elle a été rejetée :** Trop éloignée de la réalité opérationnelle hôtelière. Ce modèle déconnecte la gestion physique (les nuits d'occupation en chambre, l'état de propreté) de la comptabilité. Il rend l'allocation des chambres, les alertes de ménage et les statistiques d'occupation extrêmement complexes et sujettes aux erreurs de synchronisation.

### Alternative C : Modèle centré sur la Chambre (Room-Centric)
* **Description :** Toutes les consommations, extras, et états de facturation sont enregistrés et cumulés directement sur l'entité physique `Room`.
* **Pourquoi elle a été rejetée :** Risque majeur de mélange de comptes et de failles de données financières. Une chambre physique voit défiler des centaines de clients différents. Si les charges "collent" à la chambre, toute erreur humaine lors du check-out ou de l'affectation du client suivant peut amputer le compte d'un client et facturer indûment le nouveau.

---

## 6. Invariants (Règles architecturales absolues)

* **Invariant 1 :** Une facture (`Invoice`) ne peut pas exister ou être émise sans être reliée à un ou plusieurs folios appartenant à un séjour (`Stay`) valide.
* **Invariant 2 :** Un paiement ou encaissement financier de séjour ne peut jamais être orphelin ; il doit être inscrit comme une ligne de folio créditrice ou une transaction rattachée à un folio du séjour.
* **Invariant 3 :** Une ligne de charge (`FolioLine` de type `HEBERGEMENT` ou `EXTRA`) appartient toujours à un folio, qui lui-même est rigoureusement rattaché à un séjour unique.
* **Invariant 4 :** Une chambre physique (`Room`) n'est jamais propriétaire des consommations ou des transactions financières. Les consommations appartiennent au séjour de l'occupant.
* **Invariant 5 :** Une réservation (`Reservation`) ne peut générer au maximum qu'un seul séjour (`Stay`) (relation d'unicité physique `Stay.reservationId` unique).
* **Invariant 6 :** Le check-out physique et comptable d'un séjour exige que le solde cumulé de tous ses folios soit rigoureusement égal à 0.00 MAD (les débits équilibrés par les crédits de paiement ou par des transferts de responsabilité vers des comptes d'entreprises partenaires autorisés - *Décision métier à confirmer sur les modalités de facturation différée*).
* **Invariant 7 :** Les nuitées réelles facturées doivent correspondre exactement aux enregistrements de présence physique stockés dans la table pivot `RoomNight`, garantissant la cohérence fiscale.

---

## 7. Impact sur le développement

* **Modules concernés :** 
  * `reservations` (backend/src/modules/reservations)
  * `checkin` (backend/src/modules/checkin)
  * `billing` (backend/src/modules/billing)
  * `housekeeping` (backend/src/modules/housekeeping)
  * `security-audit` (backend/src/modules/security-audit - *Phase Future*)
* **Entités concernées :** `Reservation`, `Stay`, `Room`, `RoomNight`, `Folio`, `FolioLine`, `Invoice`, `Payment`.
* **BUSINESS_RULES impactées :** `BR-TR-001`, `BR-RES-002`, `BR-SEJ-001`, `BR-SEJ-002`, `BR-SEJ-004`, `BR-FAC-001`, `BR-FAC-002`, `BR-FAC-003`, `BR-HK-001`.
* **Contraintes Prisma concernées :**
  * `Stay.reservationId` unique (`@unique`) pour la relation 1-to-1 optionnelle.
  * Index composite unique `@@unique([roomId, date])` sur `RoomNight` assurant qu'une chambre ne peut pas avoir deux nuitées allouées (double-booking) pour la même date, que ce soit pour une réservation ou un séjour actif.
* **Implications RBAC :**
  * Le rôle *Réception* peut créer des séjours (`checkin`) et planifier des nuitées, mais n'est pas habilité à manipuler directement les structures financières ou forcer des équilibrages de folios sans paiement réel (réservé à l'administrateur ou au comptable).
* **Impact sur les futures ADR :**
  * Servira de fondation directe pour l'**ADR-002 (Multi-Folio Billing)** détaillant la répartition des charges, et l'**ADR-003 (Payment Idempotency & Validation Rules)**.

---

## 8. Risques de non-conformité

### Risque 1 : Lier des extras (Room service, SPA) directement à la Réservation
* **Description :** Un développeur ajoute un endpoint permettant d'imputer une charge d'extra en passant un `reservationId` au lieu de requérir le `folioId` d'un séjour actif.
* **Conséquence :** Si la réservation est écourtée, annulée rétroactivement ou si le client change de chambre, ces lignes d'extras se retrouvent orphelines, causant des pertes financières ou des erreurs d'édition de factures de séjour.
* **Gravité :** Critique.
* **Recommandation :** Interdire par linter ou par revue de code tout lien direct entre les dépenses opérationnelles courantes et la table `Reservation`. Toute charge passe obligatoirement par un folio de `Stay`.

### Risque 2 : Double allocation physique de chambre lors du Check-In Walk-In
* **Description :** Un réceptionniste enregistre un client en Walk-In immédiat sans que le système ne crée d'enregistrement associé dans la table pivot `RoomNight`.
* **Conséquence :** Le planificateur de réservations considérera la chambre comme libre pour des réservations en ligne, provoquant une surréservation (double-booking) physique immédiate.
* **Gravité :** Critique.
* **Recommandation :** Encapsuler la création de l'entité `Stay` et l'injection des lignes `RoomNight` correspondantes au sein d'une **transaction Prisma isolée** (`prisma.$transaction`).

### Risque 3 : Suppression physique d'un séjour ou d'une ligne de paiement
* **Description :** Un développeur utilise un appel de suppression physique `prisma.stay.delete` ou `prisma.payment.delete` suite à une erreur de saisie d'un utilisateur.
* **Conséquence :** Violation flagrante des obligations de traçabilité et d'auditabilité comptable de l'Hôtel Makarim. Perte de l'historique d'occupation des chambres physiques.
* **Gravité :** Critique.
* **Recommandation :** Configurer les politiques Prisma et les services backend pour qu'ils lèvent une exception lors de suppressions physiques. N'autoriser que les annulations comptables (avoirs) ou les annulations logiques d'extras (`annulee = true` avec motif d'audit obligatoire).

---

## 9. Checklist de conformité pour les Pull Requests

Chaque développeur (y compris Claude Code) doit valider la checklist suivante avant de soumettre ou de fusionner une modification de code sur les modules de réservation, d'accueil ou de facturation :

* [ ] **Aucun paiement orphelin :** Tout enregistrement de paiement est rattaché à un folio existant, lui-même relié à un séjour (`Stay`).
* [ ] **Aucune charge hors folio :** L'imputation d'un hébergement ou d'un extra requiert exclusivement un `folioId` valide de séjour, et jamais un `reservationId` ou un `roomId` direct.
* [ ] **Intégrité de la chambre :** Le changement de chambre d'un client s'effectue exclusivement en modifiant l'association du séjour (`Stay.roomId`) et en mettant à jour la table pivot `RoomNight` associée au séjour, sans jamais modifier les folios historiques.
* [ ] **Unicité du séjour :** La création d'un séjour lié à une réservation respecte strictement la contrainte unique (relation 1-to-1) et ne peut pas dupliquer de séjour pour la même réservation.
* [ ] **Validation de solde au checkout :** L'action de check-out d'un séjour valide programmatiquement que la somme de tous les débits (charges) moins tous les crédits (paiements/acomptes) de l'intégralité des folios associés est rigoureusement égale à `0.00 MAD` (ou explicitement transférée sur un compte d'affaires corporate valide - *Décision métier à confirmer*).
* [ ] **Zéro suppression physique :** Aucun contrôleur ou service n'appelle de méthode de suppression physique sur les tables `Stay`, `Reservation`, `Folio`, `FolioLine`, `Invoice`, ou `Payment`. Les corrections passent exclusivement par des marqueurs logiques ou des écritures comptables d'annulation (avoirs).
