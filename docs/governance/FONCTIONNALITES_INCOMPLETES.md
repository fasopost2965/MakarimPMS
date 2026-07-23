# Registre des fonctionnalités incomplètes — Makarim PMS v1

Distinct de `DETTE_TECHNIQUE.md` (comment le code est construit) : ce document liste ce que le produit **promet** — par son schéma de données, ses commentaires de code, ou sa documentation — sans le tenir intégralement. Chaque ligne est une fonctionnalité **commencée** (au moins une trace dans le schéma ou le code), pas une fonctionnalité jamais entamée.

C'est le motif transversal le plus significatif identifié par l'audit (Phase 9 §4, Phase 10) : le code du projet laisse systématiquement une trace explicite de ses intentions inachevées plutôt que de les cacher — ce registre rend cette trace consultable en un seul endroit.

| Fonctionnalité | Trace de l'intention | État réel | Chantier |
|---|---|---|---|
| ~~Correction de facture par avoir~~ | Modèle `CreditNote` en schéma, relation incluse dans les lectures, `StatutFacture.ANNULEE_PAR_AVOIR`, 2 commentaires de code y renvoyant explicitement | **Résolu (CH-001, session courante)** — `BillingService.createCreditNote()` écrit désormais `CreditNote` et `Invoice.statut = ANNULEE_PAR_AVOIR` (avoir total, voir RD-005), et permet la régénération d'une facture corrigée sur le même folio. Retiré des fonctionnalités incomplètes. | CH-001 (terminé) |
| ~~Réinitialisation de mot de passe par email~~ | Commentaire explicite dans `auth.service.ts` : « un e-mail réel remplacera cette exposition directe quand le module notifications sera livré » | **Résolu (CH-002, session courante)** — `forgotPassword()` envoie désormais l'email via `MailerService` (pas `NotificationsService.notify()`, structurellement scopé à `Guest` — voir RD-004). Retiré des fonctionnalités incomplètes. | CH-002 (terminé) |
| Registre de police alimenté en continu | Route backend `POST /police/:stayId` fonctionnelle, export CSV fonctionnel côté reporting | Aucune saisie possible depuis l'interface — le registre reste vide en usage normal | CH-003 |
| Chiffrement au repos des données d'identité | `docs/execution/GO_LIVE_CHECKLIST.md` exige `ENCRYPTION_KEY` ; commentaire dans `police-report.service.ts` reconnaissant l'absence | Aucune implémentation, variable absente de tout le code | CH-004 |
| Séjour annulé (`StatutSejour.ANNULE`) | Valeur d'enum présente dans le schéma | Jamais écrite par aucun chemin de code | CH-013 |
| Multi-folio par séjour (ADR-002) | Schéma modélise `Stay.folios: Folio[]` en 1:N, ADR-002 l'affirme explicitement | Un seul site de code crée des folios (`createFolioPrincipal`), jamais plus d'un par séjour en pratique | À trancher (voir `REGISTRE_DECISIONS.md`) |
| Facturation entreprise / city ledger | Modèle `Company` avec `plafondCredit`, `conditionsPaiement` | Zéro FK vers `Reservation`/`Stay`/`Folio`/`Invoice` ; `plafondCredit` jamais vérifié | CH-021 |
| Historique consultable des transitions de chambre | `RoomStatusLog` alimenté à chaque transition | Jamais lu par aucune route | CH-014 |
| Journal d'audit transverse consultable côté interface | Module `audit` fonctionnel côté backend | Aucune UI de consultation | CH-015 |
| Remboursement d'un acompte déjà imputé à un folio | Le code de `DepositsService.rembourser` référence explicitement « une note de crédit sur la facture » comme voie de recours | Cette voie existe désormais (`BillingService.createCreditNote()`, CH-001 terminé) mais n'est pas encore branchée dans `DepositsService.rembourser` — l'acompte reste bloqué jusqu'à l'implémentation de CH-012 | CH-012 (dépendance CH-001 levée, non démarré) |
| Recouvrement tracé de la pénalité d'annulation/no-show | `Reservation.montantPenalite` calculé et figé | Jamais matérialisé en écriture financière, recouvrement entièrement hors système | CH-023 |

## Ce que ce registre implique pour la suite du développement

Avant d'ajouter une nouvelle fonctionnalité au projet, vérifier si une trace similaire (commentaire renvoyant à un mécanisme « à venir », enum ou modèle posé en avance de son usage) existe déjà pour elle dans le code — c'est le signal caractéristique identifié par l'audit qu'une fonctionnalité a été commencée puis mise en pause. Ce registre doit être complété à chaque fois qu'une telle trace est découverte, même en dehors d'un audit formel.
