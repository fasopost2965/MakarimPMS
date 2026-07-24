# Spécification Technique — Module Registre de Police (police.md)

*Créé lors de CH-018 (`docs/governance/REGISTRE_CHANTIERS.md`) — spec explicitement demandée par la fiche d'origine, ce module ayant été livré (CH-003) sans jamais recevoir de document dédié.*

---

## 1. Objectif du module

Le module **Registre de police** tient le registre légal des personnes hébergées, obligation réglementaire marocaine (DGSN — Direction Générale de la Sûreté Nationale) pour tout établissement hôtelier, et en permet l'export sous forme de fiche PDF individuelle.

---

## 2. Responsabilités

Le module est seul responsable de :
* La saisie et la mise à jour de la fiche de police d'un séjour (`PoliceRecord`) : pièce d'identité, nationalité, provenance/destination.
* La génération d'une fiche de police au format PDF, imprimable pour remise aux autorités si demandé.

---

## 3. Hors périmètre

Le module n'intervient jamais dans :
* La création ou la clôture du séjour lui-même (confié au module `stay`) — `PoliceRecord` référence un `Stay` déjà existant, jamais l'inverse.
* L'export consolidé et périodique du registre pour déclaration statistique/DGSN (confié au module `reporting`, `GET /reporting/police-register`) — ce module ne produit qu'une fiche individuelle par séjour, pas un registre agrégé.
* La modification des informations d'identité générales du client (`Guest.nom`/`prenom`/`nationalite`/`pieceIdentite`) — confiée au module `guests` (`GuestsService.update()`), y compris lorsque ces informations proviennent d'un self check-in (F6) ou d'un scan OCR (F5).

---

## 4. Entités manipulées

Ce module manipule et gère directement l'entité suivante du `DATA_DICTIONARY.md` :
* `PoliceRecord` (upsert par `stayId` — une fiche par séjour, jamais dupliquée)

`Stay`, `Guest` et `HotelConfig` (en-tête de la fiche PDF) sont lus exclusivement via les façades `StayService.findOne()` et `ParametersService.getHotelConfig()` — jamais de lecture Prisma directe sur ces tables, conformément à la frontière de module documentée dans `CLAUDE.md`.

---

## 5. BUSINESS_RULES concernées

Aucune règle `BR-XXX` dédiée dans `BUSINESS_RULES.md` — l'obligation de registre de police est une exigence réglementaire externe (DGSN), pas une règle métier interne au sens de ce document. `BUSINESS_RULES.md` la référence indirectement via l'impact de BR-CLI-003 (« Reporting hôtelier (Fiche de police) ») sur le reporting consolidé.

---

## 6. ADR concernées

Aucune ADR dédiée — ce module suit les conventions transverses déjà actées ailleurs (ADR-005, non-suppression physique — une fiche de police n'est de toute façon jamais supprimée, seulement mise à jour ; ADR-006, RBAC).

---

## 7. Permissions RBAC

Les habilitations requises pour interagir avec ce module sont :
* `checkin:read` (`GET /police/:stayId`, `GET /police/:stayId/pdf`) — **pas de clé de permission dédiée** : ce module réutilise les permissions `checkin:*` du module `stay` (RBAC_MATRIX.md n'a aucune ligne `police`), même convention que `companies` réutilisant `guests:*`. Justification : la fiche de police fait partie du même geste opérationnel que le check-in, saisie par les mêmes rôles (Réception, Administrateur).
* `checkin:write` (`POST /police/:stayId`) — création/mise à jour de la fiche.

---

## 8. Flux entrants

Le module intercepte les événements et requêtes suivants :
* `POST /police/:stayId` — saisie ou mise à jour de la fiche de police (upsert).
* `GET /police/:stayId` — consultation de la fiche existante.
* `GET /police/:stayId/pdf` — génération et téléchargement de la fiche au format PDF (F1). Route distincte plutôt qu'un paramètre sur `GET /police/:stayId` : `CLAUDE.md` interdit de toucher aux routes `stay`/`checkin` hors PR dédiée, et ce endpoint appartient pleinement à ce module.

Aucune route n'est `@Public()`.

---

## 9. Flux sortants

Le module n'émet aucun événement inter-module. La saisie d'une fiche écrit un `AuditLog` (motif auto-généré — saisie légale obligatoire de routine, pas une dérogation métier discrétionnaire nécessitant un motif humain, même logique que `AttendanceService.clorerShiftsOrphelins`) dans la même transaction que l'écriture `PoliceRecord` (ADR-005).

---

## 10. Dépendances autorisées

Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `stay` : façade `StayService.findOne()` uniquement, pour résoudre le séjour et préremplir les dates d'arrivée/départ par défaut (`Stay.dateCheckin`/`dateCheckoutReelle ?? dateCheckoutPrevue`) si non fournies dans le corps de la requête.
* `parameters` : façade `ParametersService.getHotelConfig()`, pour l'en-tête de l'export PDF (coordonnées légales de l'hôtel).
* `audit` : `AuditService.writeLog()`, dans la même transaction que l'upsert.

---

## 11. Dépendances interdites

Ce module a l'interdiction stricte de dépendre de :
* Toute lecture Prisma directe sur `Stay`/`Guest`/`HotelConfig` — passer systématiquement par les façades des modules propriétaires (`stay`, `guests`, `parameters`).

---

## 12. Contraintes métier

* **Une fiche par séjour** : `PoliceRecord` est toujours résolue par `upsert({ where: { stayId } })` — jamais deux fiches pour le même séjour.
* **Génération PDF en lecture seule** : `generatePdf()` n'écrit jamais d'`AuditLog` (même convention que `reporting/police-report.service.ts` — un export n'est pas une mutation).
* **Réponse PDF en flux direct** (`res.send()`, pas `@Res({ passthrough: true })`) : le mode passthrough sérialiserait le `Buffer` en JSON plutôt que de l'envoyer comme flux binaire.

---

## 13. Invariants

* **INV-POL-001 (Unicité par séjour)** : `PoliceRecord.stayId` est unique — un `upsert` ne peut jamais créer de doublon pour le même séjour.
* **INV-POL-002 (Aucune écriture en dehors des façades)** : aucun champ de `Stay`/`Guest` n'est jamais modifié par ce module — seule la fiche `PoliceRecord` elle-même est écrite ici.

---

## 14. États manipulés

Ce module ne porte pas de machine à états — `PoliceRecord` est une fiche descriptive sans statut propre, présente ou absente pour un séjour donné.

---

## 15. Points sensibles

* **Fiche potentiellement absente à l'arrivée** : le check-in n'exige pas la présence d'une fiche de police (avertissement non bloquant affiché côté frontend si manquante, CH-003) — un séjour peut donc légalement exister sans fiche de police tant que la réception ne l'a pas saisie. Ce n'est pas un bug, mais un point d'attention opérationnel (obligation réglementaire humaine, pas techniquement forcée par le système).
* **Données personnelles sensibles** (pièce d'identité, nationalité, provenance) : transitent par ce module sans chiffrement dédié — seul `Guest.pieceIdentite` (CH-004) est chiffré au repos ; les champs propres à `PoliceRecord` (`numeroPiece`, etc.) ne le sont pas actuellement.

---

## 16. Dette technique connue

* **Absence de chiffrement dédié sur `PoliceRecord`** : contrairement à `Guest.pieceIdentite` (CH-004, AES-256-GCM), les champs d'identité propres à `PoliceRecord` ne bénéficient pas du même chiffrement — écart non traité par CH-004 (hors périmètre de cette fiche à l'époque), non réévalué depuis.

---

## 17. Fonctionnalités prévues ultérieurement

Aucune extension prévue formellement — le périmètre réglementaire couvert (saisie + export PDF individuel) est jugé complet pour cette version.

---

## 18. Checklist de Pull Request

Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Toute lecture de `Stay`/`Guest`/`HotelConfig` passe par la façade du module propriétaire, jamais par une requête Prisma directe.
* [ ] `POST /police/:stayId` reste un `upsert` par `stayId` — jamais un `create` qui pourrait dupliquer une fiche existante.
* [ ] L'écriture de la fiche reste accompagnée d'un `AuditLog` dans la même transaction (ADR-005).
* [ ] `GET /police/:stayId/pdf` reste strictement en lecture seule (aucun `AuditLog`, aucune mutation).
