# Architecture Decision Record (ADR-005) : Audit & Soft Delete

Ce document formalise les décisions d'architecture concernant la préservation de l'intégrité des données, la traçabilité des opérations sensibles, et la politique d'annulation logique (**Soft Delete**) et de journalisation d'audit (**Audit Logging**) au sein du Property Management System (PMS) de l'Hôtel Makarim.

---

## 1. Métadonnées

* **Identifiant :** ADR-005
* **Titre :** Audit & Soft Delete (Traçabilité et non-suppression physique des données)
* **Statut :** Validé
* **Date :** 2026-07-19
* **Auteur :** Architecte Logiciel PMS Makarim
* **Documents de référence :**
  * `BUSINESS_RULES.md` (BR-AUD-001, BR-AUD-002, BR-TR-001, BR-RES-002, BR-FAC-003, BR-PAI-003)
  * `DATA_DICTIONARY.md` (Table `RoomStatusLog`, Gap #7 - absence de la table `AuditLog`, Gap #8 - absence des colonnes `deletedAt`)
  * `RBAC_MATRIX.md` (Droits d'accès des rôles Administrateur et Comptable aux logs système)
  * `ADR-001 — Stay-Centric Architecture`
  * `ADR-002 — Folio & Billing Model`
  * `ADR-004 — Payment & Financial Integrity`
  * Cahier des charges final — PMS Hôtel Makarim.pdf

---

## 2. Contexte

Dans la gestion quotidienne d'un hôtel de standing, les données stockées dans le PMS ne sont pas seulement des indicateurs de fonctionnement ; elles constituent la base légale, fiscale et comptable de l'établissement. L'activité hôtelière fait face à d'importants défis en matière de sécurité des données et de contrôle interne :
1. **Risque de fraude interne :** Sans traçabilité stricte, un utilisateur indélicat pourrait supprimer une ligne de facturation d'un extra payé en espèces après le départ du client, et empocher la somme sans laisser de trace en base de données.
2. **Perte de cohérence financière et statistique :** La suppression physique d'un séjour (`Stay`) ou d'une réservation (`Reservation`) détruit l'historique de fréquentation de l'hôtel, faussant définitivement les calculs du taux d'occupation, du RevPAR, de l'historique des préférences clients (CRM) et des bilans comptables de TVA.
3. **Erreurs de manipulation humaine :** Les réceptionnistes travaillent sous pression lors des périodes d'affluence (check-ins/check-outs simultanés). Une erreur de saisie (ex. annuler la mauvaise réservation) doit pouvoir être inversée ou analysée grâce à un journal d'activité précis, plutôt que d'aboutir à une disparition irrémédiable de l'information.
4. **Exigences légales de conservation :** La législation commerciale marocaine exige la conservation des pièces et des écritures comptables sur une période de 10 ans. Le système informatique doit donc garantir qu'aucune donnée de facturation ou d'encaissement réelle ne puisse être détruite.

Le recours à des suppressions physiques en base de données (`DELETE` SQL) ou l'absence de traçabilité structurée des ajustements manuels de prix et d'état est incompatible avec la rigueur d'un PMS professionnel.

---

## 3. Décision

Pour garantir une sécurité et une auditabilité à toute épreuve, nous actons l'adoption d'une politique stricte de **Soft Delete** et d'**Audit Trail**, déclinée selon les règles architecturales suivantes :

### 3.1. Politique de Soft Delete Transversale
1. **Bannissement de la suppression physique :** L'usage d'instructions de suppression physique (ex: `DELETE` SQL ou `prisma.reservation.delete`) est **strictement proscrit** sur l'ensemble des entités métiers sensibles (`Reservation`, `Stay`, `Invoice`, `Payment`, `Guest`, `Room`, `User`).
2. **Marquage temporel logique :** Les entités concernées doivent intégrer un champ optionnel `deletedAt DateTime?` dans le schéma de la base de données.
   * Si `deletedAt` est nul (`null`), l'enregistrement est considéré comme actif.
   * Si `deletedAt` contient une valeur temporelle, l'enregistrement est considéré comme logiquement supprimé à cette date.
3. **Neutralisation automatique des requêtes :** Tous les services d'extraction de données (requêtes Prisma `findMany`, `findFirst`, etc.) doivent systématiquement inclure le filtre `deletedAt: null` pour masquer les éléments supprimés logiquement des affichages opérationnels de l'application.

### 3.2. Mécanisme de Journalisation d'Audit Centralisé (`AuditLog`)
Toute opération opérationnelle ou financière sensible doit générer de manière synchrone et transactionnelle un enregistrement dans une table dédiée, baptisée **`AuditLog`** (BR-AUD-002).
1. **Structure de l'entité `AuditLog` :**
   * `id` : Identifiant unique (UUID).
   * `userId` : Référence de l'utilisateur ayant exécuté l'action.
   * `action` : Type d'action (ex: `UPDATE_PRICE`, `SOFT_DELETE`, `REOPEN_FOLIO`, `CANCEL_FOLIO_LINE`, `ROOM_CHANGE`).
   * `targetEntity` : Nom de la table physique concernée (ex: `Reservation`, `FolioLine`).
   * `targetId` : Identifiant de l'enregistrement impacté.
   * `oldValue` : Représentation JSON de l'état avant modification.
   * `newValue` : Représentation JSON de l'état après modification.
   * `motif` : Explication textuelle obligatoire fournie par l'utilisateur.
   * `createdAt` : Date et heure précises côté serveur.
2. **Opérations soumises à l'audit obligatoire (BR-AUD-001) :**
   * Annulation de réservations ou de séjours.
   * Modification manuelle du prix d'une nuitée ou ajustement de charges sur un folio.
   * Annulation logique d'une ligne d'extra sur un folio (`FolioLine.annulee = true`).
   * Changement de chambre d'un client en cours de séjour.
   * Réouverture d'un folio de séjour clôturé.
   * Transfert de charges d'un folio à un autre.

---

## 4. Invariants (Règles d'intégrité absolues)

* **INV-AUD-001 (Inviolabilité des logs d'audit) :** Les enregistrements de la table `AuditLog` sont strictement en **écriture seule (Append-Only)**. Les actions de type `UPDATE` ou `DELETE` sur la table `AuditLog` sont techniquement bloquées au niveau de la base de données.
* **INV-AUD-002 (Obligation de motif écrit) :** Toute requête d'annulation de ligne d'écriture financière, de modification tarifaire ou de soft delete d'entité exige la soumission d'une chaîne de caractères explicative non vide d'au moins 10 caractères dans l'argument `motif`. À défaut, le serveur rejette la requête (Code 400 Bad Request).
* **INV-AUD-003 (Soft Delete transitaire de Cascade) :** Le Soft Delete d'une entité parente doit se propager logiquement aux entités enfants dépendantes en une seule transaction (ex. le soft delete d'un `Stay` doit automatiquement appliquer un soft delete aux folios associés et passer les `RoomNight` associées à l'état annulé, afin d'éviter les orphelins financiers et les blocages de chambres).
* **INV-AUD-004 (Sûreté comptable des Factures) :** Le soft delete est **strictement interdit** sur l'entité `Invoice`. Une facture émise ne peut être ni supprimée physiquement, ni supprimée logiquement. Seule l'émission d'un avoir fiscal (`CreditNote`) est autorisée pour neutraliser ses effets comptables (BR-FAC-003).

---

## 5. Cycle de Vie d'une Action Auditable

Le schéma suivant décrit le traitement synchrone et sécurisé d'une opération d'annulation logique soumise à audit :

```
             [ Requête Client : POST /api/billing/lines/:id/cancel ]
                                  │
                                  │ (Payload: { motif: "Erreur de saisie room service" })
                                  ▼
                     [ Validation du Contrôleur ]
                                  │
                                  ├──► Vérifie si motif est présent et >= 10 caractères ──► NON ──► Erreur 400
                                  └──► OUI
                                       │
                                       ▼
                     [ Transaction Unique Base de Données ]
                                       │
                  ┌────────────────────┴────────────────────┐
                  ▼                                         ▼
         { Mise à jour logique }                   { Écriture d'Audit }
      FolioLine.annulee = true                Insertion dans la table `AuditLog` :
      (Conserve l'historique)                 - userId: de la session active
                                              - action: CANCEL_FOLIO_LINE
                                              - targetId: :id
                                              - oldValue: { montant: 250, ... }
                                              - newValue: { annulee: true, ... }
                                              - motif: "Erreur de saisie room service"
                  │                                         │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                       [ Commit de la Transaction ]
                                       │
                                       ▼
                         [ Réponse Client (Success) ]
```

---

## 6. Traitement des Cas Particuliers

### 6.1. La Modification Manuelle d'un Tarif d'Hébergement (Ajustement)
Lorsqu'un réceptionniste habilité applique une remise manuelle sur le prix d'une nuitée d'une réservation (BR-RES-002) :
* Le système n'écrase pas silencieusement la valeur.
* L'ancien tarif est conservé. La ligne d'ajustement est ajoutée, et l'opération génère une ligne d'audit d'action `UPDATE_PRICE` détaillant l'ancienne valeur de nuitée, la nouvelle valeur, l'ID de la réservation et le motif impératif saisi par l'utilisateur.

### 6.2. La Réouverture Exceptionnelle d'un Folio Clôturé
Si, après avoir validé un check-out et facturé un séjour, l'hôtel s'aperçoit d'un oubli majeur et doit exceptionnellement réouvrir le folio (action hautement sensible) :
* L'action exige la permission d'administration supérieure (`billing:reopen` / Rôle Administrateur).
* Elle commute le statut du folio à actif, mais génère immédiatement une entrée d'audit critique d'action `REOPEN_FOLIO`, notifiant le motif de réouverture dans les logs système accessibles uniquement par la Direction et le Comptable.

### 6.3. Le Traitement du Pointage RH (Inviolabilité Temporelle)
* *Note : Les mécanismes de détection de déviation horaire (TimeShift) sur le pointage des employés et d'impossibilité de modifier rétroactivement les heures d'arrivée saisies par les employés en base sont en attente d'une décision métier à confirmer pour la Phase 3.*

---

## 7. Alternatives rejetées

### Alternative A : Journalisation dans des fichiers textes plats sur le serveur (logs applicatifs)
* **Description :** Écrire les logs de traçabilité dans un fichier `app.log` géré par une bibliothèque comme Winston ou Morgan.
* **Pourquoi elle a été rejetée :** Ces fichiers ne sont pas interrogeables dynamiquement par l'application pour des besoins d'affichage d'audit de l'interface utilisateur. De plus, ils risquent d'être détruits ou modifiés si le conteneur Cloud Run est redémarré ou si un administrateur système accède au serveur VPS, violant les contraintes d'inviolabilité.

### Alternative B : Utilisation d'une base de données de réplication ou d'archivage séparée
* **Description :** Transférer les données supprimées logiquement vers une base de données de sauvegarde distincte.
* **Pourquoi elle a été rejetée :** Solution trop lourde et complexe pour un établissement de 24 chambres. Elle compliquerait inutilement les jointures relationnelles requises pour afficher les séjours passés et les statistiques d'exploitation au sein du monorepo. Le marquage logique `deletedAt` est parfaitement adapté et performant.

---

## 8. Conséquences de la Décision

* **Réservations & Séjours :** Ne risquent plus de disparaître. Les statistiques d'exploitation passées sont préservées de manière indéfectible.
* **Facturation & Comptabilité :** Une traçabilité parfaite des flux de caisse garantit l'absence de "trous" dans les écritures comptables, simplifiant les audits fiscaux annuels.
* **Développement Backend :** Exige une discipline systématique. Les requêtes Prisma doivent inclure des filtres `deletedAt: null`. 
  * *Note : Pour simplifier le développement, un middleware d'extension Prisma global sera mis en place pour intercepter et injecter automatiquement le filtre `deletedAt: null` sur toutes les opérations de lecture standard.*
* **Performance :** L'accumulation de lignes supprimées logiquement peut à terme ralentir les scans de tables. Pour y pallier, un **index physique** est obligatoire sur la colonne `deletedAt` de toutes les tables sensibles en base de données.

---

## 9. Anti-patterns (Pratiques strictement interdites)

* **Anti-Pattern #1 (Méthode de suppression physique) :** Utiliser la fonction Prisma `delete` ou `deleteMany` sur l'une des tables hôtelières clés.
* **Anti-Pattern #2 (Logs d'audit éditables) :** Déclarer des méthodes d'API ou des services NestJS permettant de modifier, réordonner ou supprimer des lignes de la table `AuditLog`.
* **Anti-Pattern #3 (Saisie de motif fictif) :** Remplir automatiquement le champ motif avec des valeurs automatiques ou inutiles (ex: "suppression", "abc", "test12345") pour contourner la barrière des 10 caractères minimum. Le motif doit décrire précisément la cause humaine ou technique de l'ajustement.
* **Anti-Pattern #4 (Écriture de log asynchrone non garantie) :** Lancer l'écriture d'un log d'audit dans une promesse asynchrone détachée (`without await`) du flux d'annulation financière. Si le log échoue, l'annulation ne doit pas être validée (les deux écritures doivent échouer ou réussir ensemble au sein d'une transaction unique).

---

## 10. Checklist de conformité pour les Pull Requests (Audit & Soft Delete)

Avant d'intégrer des modifications sur le modèle de données, les routes d'ajustement tarifaire, ou les services d'annulation, vérifiez la conformité des développements aux points suivants :

* [ ] **Absence de suppression physique :** Aucun contrôleur ou service n'emploie d'appel de suppression physique (`delete`). Toutes les fonctions de suppression font appel à des mises à jour logiques (`update` avec renseignement de `deletedAt: new Date()`).
* [ ] **Intégration d'index :** Les nouvelles tables sensibles introduisant `deletedAt` possèdent un index physique dédié sur cette colonne au sein de `schema.prisma`.
* [ ] **Transactions coordonnées :** L'annulation ou la modification d'un tarif d'écriture s'effectue au sein d'une transaction Prisma (`prisma.$transaction`) encapsulant de manière atomique la mise à jour de la cible et l'insertion dans `AuditLog`.
* [ ] **Validation stricte du motif :** L'API valide programmatiquement que l'argument `motif` est de type chaîne de caractères, non nul, et dispose d'une longueur supérieure ou égale à 10 caractères.
* [ ] **Filtrage systématique des lectures :** Les requêtes d'affichage opérationnel des listes de clients, de réservations actives ou de séjours filtrent explicitement les éléments logiquement supprimés en ajoutant la clause `deletedAt: null` (ou via le middleware de filtrage global).
* [ ] **Protection d'immutabilité des logs d'audit :** Aucun fichier ou contrôleur d'API ne permet d'exposer d'action d'écriture corrective ou de mise à jour sur la table `AuditLog`.
