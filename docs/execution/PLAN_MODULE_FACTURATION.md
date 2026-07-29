# PLAN_MODULE_FACTURATION.md — Module de facturation complet (backend → frontend)

**Statut** : CH-050 **entièrement livré** (PDF facture, UI d'ajout de charge extra, **et** diffusion email/WhatsApp — voir `docs/governance/REGISTRE_CHANTIERS.md`). Le blocage de migration DB locale est résolu (§2ter de `docs/execution/PLAN_MISE_EN_PRODUCTION_BETA.md`). Seuls CH-048 (facturation scindée) et CH-049 (durée de séjour) restent en attente de validation utilisateur sur les questions ouvertes Q1/Q2 ci-dessous (Q3, WhatsApp, est tranchée : pièce jointe native via `mediaUrl` Twilio, voir la fiche CH-050 du registre).
**Origine** : demande explicite de l'utilisateur (session courante), qui recoupe et **tranche** une décision produit jusque-là en attente (CH-044, multi-folio) et redonne une justification métier concrète à un chantier jusque-là gelé (CH-041, raccourcissement de séjour).
**Méthode** : ce document ne modifie aucun code — il documente l'état réel vérifié, propose une conception, et pose les questions encore ouvertes avec une recommandation pour chacune. Rien n'est codé avant validation.

---

## 0. Ce qui existe déjà réellement (vérifié dans le code, pas supposé)

| Besoin exprimé | État réel |
|---|---|
| Facture avec infos légales hôtel | `HotelConfig` a déjà tous les champs nécessaires (`raisonSociale`, `ice`, `identifiantFiscal`, `rc`, `adresse`, `logoUrl`) — déjà utilisés par `InvoicePrintModal.tsx` (CH-042). |
| Facture imprimable | Fait (CH-042) — aperçu HTML + `window.print()` via iframe masqué. |
| Facture en PDF téléchargeable | **Résolu (CH-050)** — `GET /invoices/:id/pdf` (`billing:read`), même bibliothèque/convention que le registre de police (F1, `pdfkit`). Bouton "Télécharger la facture en PDF" dans `BillingTabContent.tsx`. |
| Envoi facture par email | **Résolu (CH-050)** — `MailerService.send()` accepte désormais des pièces jointes (nodemailer natif), `POST /invoices/:id/envoyer` déclenche l'envoi via `NotificationsService.notify()` (`EvenementNotification.FACTURE_EMISE`). Vérifié en live : `NotificationLog` réel avec statut `ENVOYE`. |
| Envoi facture par WhatsApp | **Résolu (CH-050)** — pièce jointe native via `mediaUrl` Twilio, pointant vers `GET /invoices/download/:token` (`@Public()`, jeton `InvoiceDownloadToken` à durée limitée). Vérifié en live : `NotificationLog` réel avec statut `ENVOYE`, destinataire = téléphone réel du client. |
| Facturation scindée entreprise/client (multi-folio) | **Absent.** `Stay.folios: Folio[]` est bien 1:N dans le schéma (ADR-002), mais un seul folio est jamais créé en pratique (`createFolioPrincipal`, un seul appel dans tout le code). `Company` existe (`raisonSociale`, `ice`, `plafondCredit`, `conditionsPaiement`) mais **zéro FK** vers `Reservation`/`Stay`/`Folio`/`Invoice` — c'était `CH-021`, fermé comme écart assumé (RD-014) faute de cas d'usage concret. Le cas que tu décris (entreprise paie 3 nuits, client paie 2 nuits supplémentaires) **est** ce cas d'usage — CH-044 (jusque-là "à trancher") est donc tranché par cette demande : on implémente réellement. |
| Ajustement de séjour (raccourcissement/prolongation) | **Partiellement absent.** `StayService.checkout()` libère déjà les nuits restantes (`roomNight.deleteMany`) pour un départ anticipé — mais **ne recalcule jamais le montant de la ligne HEBERGEMENT**, qui reste figée au montant plein calculé au check-in (`reservation.prixTotalFinal`, couvrant la durée initialement réservée). Un départ à J+6 sur une réservation de 10 nuits facturerait aujourd'hui encore les 10 nuits. Aucun endpoint ne permet non plus de choisir une durée différente **au moment du check-in** (`checkinFromReservation` reprend systématiquement `reservation.dateArrivee`/`dateDepart` telles quelles). |
| Correction/annulation d'une ligne de folio | **Absent** (CH-040, jamais construit). Le schéma a déjà `FolioLine.annulee`/`motifAnnulation` et le code de lecture les respecte déjà (`invoice-calc.ts` filtre `!l.annulee`), mais aucune méthode n'écrit jamais ces deux champs — nécessaire pour corriger une ligne HEBERGEMENT lors d'un raccourcissement. |
| Ajout d'une consommation restaurant à la facture chambre | **Résolu (CH-050)** — `AddFolioLineDialog.tsx` (nouveau), bouton "Ajouter une charge" dans `BillingTabContent.tsx`, type figé à `EXTRA`. Bug réel détecté au passage et corrigé : `addFolioLine` ne bloquait pas l'ajout après émission d'une facture (charge qui n'y serait jamais apparue) — garde ajoutée côté backend + reflet visuel côté frontend. |
| Module restaurant dédié (saisie des consommations par le personnel du restaurant) | **Explicitement hors périmètre pour cette itération** (mot de l'utilisateur : "cela ne fait pas partie du plan initial nous pourrons y revenir") — noté ici pour mémoire, pas traité plus loin dans ce document. |

---

## 1. Portée proposée — 3 chantiers, dans cet ordre de dépendance

### CH-048 — Facturation scindée entreprise/client (tranche CH-044)
Rend possible un séjour facturé à deux parties différentes sans casser la comptabilité existante (ADR-002 : plusieurs folios par séjour, chaque folio garde ses propres lignes/factures immuables).

**Conception proposée :**
- `Folio` gagne un champ `companyId Int?` (FK vers `Company`, nullable — `null` = comportement actuel inchangé, facturé au client). Migration Prisma simple (colonne nullable, aucune donnée existante affectée).
- Nouvel endpoint `POST /stays/:id/folios` (`billing:write`) : crée un **folio secondaire** vide sur un séjour `EN_COURS` (`libelle` libre, ex. "Folio entreprise — Société X", `companyId` optionnel).
- Nouvel endpoint `POST /folios/:id/lignes/:lineId/transfer` (`billing:write`, motif obligatoire, audité — c'est une opération sensible sur la répartition financière) : déplace une `FolioLine` d'un folio vers un autre du même séjour. Pour scinder un hébergement de 5 nuits en 3 (entreprise) + 2 (client), la réception : (1) annule la ligne HEBERGEMENT unique existante (nécessite CH-040, voir plus bas), (2) crée deux nouvelles lignes HEBERGEMENT (3 nuits / 2 nuits) sur les deux folios respectivement, via `addFolioLine` déjà existant sur chaque folio.
- `BillingService.generateInvoice` : si `folio.companyId` est renseigné, la facture affiche la raison sociale/ICE de la `Company` comme partie facturée au lieu du client — `InvoicePrintModal`/le futur PDF lisent `invoice.folio.companyId` et vont chercher `Company` seulement dans ce cas (aucun changement pour les folios sans entreprise).
- **Aucune notion de compte courant/solde entreprise** (`plafondCredit`/`conditionsPaiement` restent des champs informatifs affichés sur la facture, jamais vérifiés/appliqués automatiquement) — reste hors périmètre, cohérent avec RD-014 : on résout le cas d'usage concret exprimé, pas le city ledger complet (relance de créances, plafond bloquant), qui resterait un chantier bien plus lourd si jamais nécessaire.

**Question ouverte Q1 — mécanique de répartition.** Deux façons de scinder l'hébergement entre les deux folios :
- **(a) Manuelle, via transfert de ligne** (ce que je propose ci-dessus) — la réception annule/recrée les lignes à la main, flexible pour n'importe quel découpage (pas seulement "nuits"), réutilisable aussi pour d'autres scénarios futurs (ex. transférer un extra mal affecté).
- **(b) Automatique** — un champ "nombre de nuits couvertes par l'entreprise" saisi une fois (à la réservation ou au check-in), le système calcule et crée les deux lignes HEBERGEMENT proportionnellement, sans intervention manuelle ensuite.
**Ma recommandation : (a) manuelle.** Plus simple à livrer correctement, plus générale (couvre aussi "l'entreprise paie l'hébergement mais pas les extras", ou une répartition non liée aux nuits), et le geste reste rare/ponctuel à la réception — pas besoin d'automatiser un cas qui arrive occasionnellement. Dis-moi si tu préfères (b).

### CH-049 — Modification de durée de séjour (tranche CH-041, avec l'étude d'impact demandée par le plan)
Couvre les deux cas que tu décris : décision d'une durée plus courte **au moment du check-in**, et raccourcissement/prolongation **en cours de séjour**.

**Conception proposée :**
- `checkinFromReservation` gagne un paramètre optionnel `dateCheckoutPrevue` (si absent : comportement actuel inchangé, reprend la date de la réservation). Si fourni et différent : (1) les `RoomNight` au-delà de la nouvelle date sont libérées immédiatement (redeviennent réservables par quelqu'un d'autre dès le check-in — pas seulement au check-out), (2) le montant HEBERGEMENT de la ligne de folio créée est recalculé sur le nombre de nuits réellement retenu, jamais sur `reservation.prixTotalFinal` tel quel dans ce cas précis.
- Nouvel endpoint `PATCH /checkin/:stayId/dates` (`checkin:write`) pour un séjour `EN_COURS` : change `dateCheckoutPrevue`.
  - **Prolongation** (nouvelle date > actuelle) : vérifie la disponibilité des nuits supplémentaires sur la même chambre (réutilise la même contrainte unique `RoomNight(roomId, date)` déjà éprouvée ailleurs — 409 si la chambre est prise par une autre réservation à cette date, pas de logique nouvelle à inventer). Ajoute une `FolioLine` HEBERGEMENT complémentaire (jamais de recalcul de la ligne existante — cohérent avec "les lignes facturées sont immuables", ADR-002).
  - **Raccourcissement** (nouvelle date < actuelle, séjour encore en cours) : libère les nuits au-delà de la nouvelle date. Le montant déjà facturé sur la ligne HEBERGEMENT d'origine doit être corrigé — nécessite CH-040 (voir ci-dessous) : annuler la ligne d'origine (motif obligatoire, tracé), en recréer une au bon montant pour les nuits réellement conservées.
- **CH-040 (annulation de ligne de folio) devient un prérequis direct de CH-049**, pas un chantier séparé optionnel : `BillingService.cancelFolioLine(folioId, lineId, motif, userId)` pose `annulee=true`/`motifAnnulation`, refuse si une facture `EMISE` existe déjà sur le folio (même garde que `excludeTaxes`), audité (`AuditAction.CANCEL_FOLIO_LINE`, nouvelle valeur d'enum — migration Prisma).

**Question ouverte Q2 — politique de départ anticipé.** Quand un client part plus tôt que prévu, que doit-il payer ?
- **(a) Uniquement les nuits réellement passées**, aucune pénalité automatique — le montant HEBERGEMENT est simplement recalculé au prorata des nuits conservées.
- **(b) Nuits réellement passées + une pénalité** (ex. 1 nuit supplémentaire, ou le barème `CancellationPolicy` déjà construit pour l'annulation/no-show — BR-RES-006 — appliqué aux nuits non honorées).
**Ma recommandation : (a) par défaut, avec la possibilité de rattacher manuellement une pénalité en ajoutant une ligne EXTRA depuis l'écran de facturation si la réception juge que le cas le justifie** (déjà possible dès que CH-050 ci-dessous ajoute le formulaire d'ajout de ligne). Automatiser une pénalité par défaut risquerait de surprendre un client dans un cas où l'hôtel choisirait de ne pas la faire payer (ex. raison valable) — plus sûr de laisser la réception décider au cas par cas plutôt que coder une règle rigide que je devrais deviner. Dis-moi si tu préfères imposer une pénalité automatique (et laquelle).

### CH-050 — Diffusion de facture (PDF, email, WhatsApp) + UI d'ajout de charge extra — ✅ Terminé
Complète CH-042 (déjà livré pour l'aperçu/impression navigateur) avec les canaux réels demandés, et comble le seul vrai trou frontend identifié pour les extras. Détail complet (fichiers, tests, vérification navigateur réelle) : fiche CH-050 de `docs/governance/REGISTRE_CHANTIERS.md`.

**Conception livrée :**
- `BillingService.generateInvoicePdf()` (pdfkit, même bibliothèque que le registre de police F1) — `GET /invoices/:id/pdf` (`billing:read`), aucun stockage disque, régénéré à la demande.
- Email : `MailerService.send()` accepte désormais des `attachments` (nodemailer natif) ; la facture part en pièce jointe directe.
- WhatsApp (Q3 tranchée) : plutôt qu'un simple lien texte, **pièce jointe native** via le paramètre `mediaUrl` de Twilio — Twilio récupère lui-même le PDF sur `GET /invoices/download/:token` (`@Public()`, jeton `InvoiceDownloadToken` à durée limitée, même famille que `SelfCheckinToken`) et l'attache réellement dans la conversation, au lieu d'un simple lien à cliquer. Le coût d'ingénierie du lien à token étant identique dans les deux cas, autant offrir la meilleure expérience.
- `BillingService.requestDelivery()` (émet `facture.envoi-demande`) → `FactureEnvoiDemandeListener` (nouveau, module `notifications`, façade `BillingService`) → `NotificationsService.notify()` (options génériques `emailAttachment`/`whatsappMediaUrl`, réutilisables par n'importe quel futur évènement, pas seulement les factures) → jobs BullMQ étendus → `MailerService`/`TwilioService`. `POST /invoices/:id/envoyer` (`billing:write`), 2 templates de seed (EMAIL + WHATSAPP).
- Frontend : formulaire "Ajouter une charge" (`AddFolioLineDialog.tsx`, type figé `EXTRA`), bouton "Télécharger PDF", bouton "Envoyer par email/WhatsApp" (toast de confirmation, résultat réel consultable dans le journal de notifications existant) — tous dans `BillingTabContent.tsx`.

---

## 2. Ordre d'exécution proposé et dépendances

```
CH-040 (annulation de ligne) ──┐
                                ├──> CH-049 (durée de séjour)
CH-048 (Folio.companyId) ──────┘

CH-050 (PDF/email/WhatsApp/UI extra) — ✅ terminé, était indépendant de CH-048/049
```

**Blocage de migration résolu** (§2ter de `docs/execution/PLAN_MISE_EN_PRODUCTION_BETA.md`) : CH-040/CH-048/CH-049 ne sont plus retenus par la base de données — seules les décisions produit Q1/Q2 ci-dessous restent nécessaires avant de coder.

---

## 3. Questions ouvertes — récapitulatif

| # | Question | Ma recommandation | Statut |
|---|---|---|---|
| Q1 | Répartition entreprise/client automatique ou manuelle ? | Manuelle (transfert de ligne), plus simple et plus générale | En attente |
| Q2 | Politique de départ anticipé (pénalité automatique ou non) ? | Aucune pénalité automatique par défaut — ligne EXTRA manuelle si besoin au cas par cas | En attente |
| Q3 | WhatsApp : pièce jointe native vs lien texte ? | Pièce jointe native (`mediaUrl` Twilio) | **Tranchée et livrée (CH-050)** |

Dès que tu réponds à Q1/Q2 (ou indiques tes préférences), CH-048/CH-049 peuvent démarrer — plus aucun blocage technique, documentation d'abord comme demandé, rien n'est codé avant ta validation.
