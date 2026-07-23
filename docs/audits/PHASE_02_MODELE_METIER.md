> **Statut de la source** : document **reconstitué à partir du résumé de session (compaction)**, comme la Phase 1 — voir l'avertissement en tête de `PHASE_01_ARCHITECTURE_GENERALE.md`. Le résumé de conversation ne conservait pas de note globale unique explicitement chiffrée pour cette phase (elle a été rendue par domaine) ; aucune note globale n'est donc affirmée ici au-delà des constats transversaux.

# Audit technique — Makarim PMS v1
## Phase 2 — Modèle métier

**Périmètre analysé** : chambres, réservations, clients, séjours, housekeeping, maintenance, paiements, facturation, reporting, et vérification de l'absence/présence d'un module restaurant/POS. Analyse transversale de la chaîne réservation → check-in → séjour → check-out, du lien réservation/disponibilité, de la gestion client individuel/entreprise, de la chaîne séjour-folio-facture-paiement, de l'impact du housekeeping sur le statut chambre, de l'impact de la maintenance sur l'occupation, et de la duplication éventuelle de logique métier entre modules.

---

### Constats transversaux

- **Chaîne réservation → check-in → séjour → check-out** cohérente avec ADR-001 (séjour comme objet central, décorrélé de la réservation) : `Stay.reservationId` optionnel, deux chemins de check-in (depuis réservation, walk-in).
- **Discipline « un seul chemin d'écriture par champ sensible »** confirmée par recherche exhaustive dans le code sur les quatre invariants les plus critiques : `Room.statut` (`RoomsService.transitionRoom` uniquement), `Guest.categorie` (`GuestsService.updateCategorie` uniquement), lignes créditrices de folio (`BillingService.creditFolioLine` uniquement), journal d'audit (`AuditService.writeLog`, `tx` obligatoire). Aucune duplication de ces écritures détectée ailleurs dans le code à ce stade.
- **Folio/Facture/Paiement** : le schéma modélise `Stay.folios: Folio[]` (1:N, conforme à ADR-002 « un séjour peut avoir plusieurs folios »), mais en pratique un seul site de code crée des folios (`StayService.createFolioPrincipal`) et aucune route `POST /folios` n'existe — le système fonctionne donc strictement en 1 séjour : 1 folio : ≤1 facture, malgré ce que le schéma autoriserait. *(Approfondi et confirmé en Phase 3 et Phase 6.)*
- **Client individuel vs entreprise** : `CreateReservationDto`/`WalkinCheckinDto` acceptent un `guestId` existant (déclenchant `assertNotBlacklisted`) ou un objet `guest` pour en créer un nouveau — jamais `BLACKLIST` par défaut. `Company` existe comme modèle mais sans aucune connexion transactionnelle (détail en Phase 3).
- **Housekeeping/maintenance et occupation** : `checkout.effectue` (événement attendu, `emitAsync`) déclenche le passage de la chambre en `A_NETTOYER` ; `nettoyage.valide` (fire-and-forget, `emit`) déclenche le décompte de stock — deux patrons de découplage événementiel distincts et documentés comme tels. *(Approfondi en Phase 7.)*
- **Enum mort identifié** : `StatutSejour.ANNULE` existe dans le schéma mais n'est écrit nulle part dans le code (confirmé par recherche exhaustive). *(Confirmé de nouveau en Phase 3.)*
- **PII en clair** : `Guest.pieceIdentite` stocké sans chiffrement — `PoliceReportService` contient un commentaire reconnaissant explicitement l'absence de chiffrement au repos malgré une exigence documentée dans `GO_LIVE_CHECKLIST.md`. *(Confirmé de nouveau en Phase 5.)*
- **Absence de module restaurant/POS** : confirmée sur les 43 modèles Prisma — seul `FormuleHebergement` (tarification des formules repas) et une ligne `FolioLine` de type `EXTRA` par séjour représentent la « restauration ».

### Points forts

- Zéro duplication détectée des écritures de champs métier sensibles à travers tout le modèle métier inspecté.
- Séparation nette entre réservation (prospective) et séjour (opérationnel), cohérente avec ADR-001.
- Règle de blocage blacklist (`assertNotBlacklisted`) correctement centralisée et identifiée comme la seule règle bloquante liée à `CategorieClient`.

### Points faibles

- Écart entre la promesse du schéma (multi-folio) et l'usage réel (folio unique) — ambiguïté sur la source de vérité entre modèle de données et comportement applicatif.
- `Company` (city ledger) sans aucune connexion aux tables transactionnelles.
- `StatutSejour.ANNULE` modélisé mais jamais utilisé.
- `Guest.pieceIdentite` en clair malgré une exigence de chiffrement déjà documentée ailleurs dans le projet.
- Aucun module restaurant/POS, alors qu'un PMS hôtelier 3 étoiles complet en intègre généralement un — écart vis-à-vis d'une couverture fonctionnelle standard du secteur (le cahier des charges ne semble pas l'exiger explicitement — *à confirmer*).

### Risques

- L'ambiguïté schéma/service sur la multiplicité des folios pourrait induire en erreur un futur développeur qui s'appuierait sur le schéma (ou sur ADR-002) sans vérifier le comportement réel du service.
- La déconnexion de `Company` signifie qu'aucune facturation entreprise (paiement différé, plafond de crédit) n'est réellement opérationnelle malgré la présence du modèle en base — risque de fausse impression de fonctionnalité disponible.

### Questions ouvertes

- Le multi-folio (ADR-002) est-il une intention future réelle à préserver dans le schéma, ou une simplification à acter formellement vers 1:1 ? *(reprise en Phase 3 et Phase 10)*
- L'absence de module restaurant/POS est-elle un choix de périmètre assumé du cahier des charges, ou un manque à traiter ? *(à confirmer auprès du cahier des charges d'origine)*

### Notes par domaine

Le résumé de session conserve la structure de notation par domaine (chambres, réservations, clients, séjours, housekeeping, maintenance, paiements, facturation, reporting) mais pas les valeurs chiffrées individuelles de chaque domaine. **Ces notes par domaine sont marquées comme non disponibles dans ce document reconstitué — à confirmer auprès de la transcription de session d'origine si nécessaire.** Aucune note globale unique n'est donc affirmée pour la Phase 2 ; les phases suivantes (notamment Phase 3, Base de données, et Phase 6, Finance) reprennent et approfondissent chacun des constats transversaux ci-dessus avec des notes chiffrées propres.
