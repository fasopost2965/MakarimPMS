# Cartographie des écrans — Makarim PMS v1

Déduite du backend réel (21 modules, `docs/audits/PHASE_04_BACKEND.md`), croisée avec l'existant frontend (`docs/audits/PHASE_08_FRONTEND.md`) et les rôles/permissions réels du seed (`backend/prisma/seed.ts`, pas une supposition — 6 rôles : Administrateur, Réception, Gouvernante, Comptable, Maintenance, RH ; 14 modules de permission `read/write/delete/export` + `guests:blacklist` + `payments:refund`).

**But de ce document** : avant tout développement frontend, savoir précisément quels écrans doivent exister, pour qui, avec quelles règles — pas seulement « il manque une page ». Sert de contrat pour le développement (Phase E) et de critère de recette écran par écran.

**Statut d'un écran** : ✅ existe et fonctionnel · 🟡 existe partiellement (fonctionnalité intégrée ailleurs) · 🔴 n'existe pas.

---

## Écrans existants (état résumé — le détail complet a déjà été audité, Phase 8)

| Écran | Module backend | Rôles avec accès (lecture) | Statut |
|---|---|---|---|
| Tableau de bord | `dashboard` | Tous (dashboard:read : Réception, Comptable ; Administrateur toujours) | ✅ |
| Réservations (calendrier) | `reservations` | Réception, Administrateur | ✅ |
| Check-in / Séjours (inclut billing/payments embarqués) | `stay`, `billing`, `payments` | Réception, Administrateur | ✅ |
| Housekeeping | `housekeeping`, `rooms` | Réception, Gouvernante, Administrateur | ✅ |
| Maintenance | `maintenance` | Gouvernante (lecture), Maintenance, Administrateur | ✅ |
| Clients | `guests` | Réception, Comptable (lecture), Administrateur | ✅ |
| Entreprises | `guests` (companies) | Réception, Comptable (lecture), Administrateur | ✅ |
| Paramètres | `parameters` | Administrateur (écriture) ; lecture large (Réception, Comptable) | ✅ |
| RH | `hr` | RH, Administrateur | ✅ |
| Stock | `stock` | Gouvernante, Administrateur | ✅ |
| Reporting | `reporting` | Comptable, Administrateur | ✅ |

*(Écran de connexion/mot de passe oublié couvert par `auth`, hors tableau car sans permission dédiée — accessible à tous.)*

---

## Écrans manquants (à créer)

### É-01 — Registre de police (saisie) ✅ — **CH-003 terminé (session courante)**

**Résolu** : livré comme un troisième onglet « Police » dans `StayDetailsDialog.tsx` (`frontend/src/features/police/`), aux côtés de « Détails »/« Facturation » — pas un écran séparé, exactement le critère UX ci-dessous. Pré-remplissage self-checkin fonctionnel (`GET /reservations/:id/self-checkin-pending`), export PDF (F1) accessible directement depuis l'onglet une fois la fiche enregistrée. Badge d'avertissement (⚠) ajouté dans les listes de séjours et sur l'onglet lui-même quand la fiche manque — non explicitement demandé ci-dessous mais nécessaire pour rendre visible la contrainte légale sans ouvrir chaque séjour. Vérifié en navigateur réel (Chromium piloté par Playwright), pas de suite e2e frontend dans ce projet. Voir `docs/governance/REGISTRE_CHANTIERS.md` (CH-003) pour le détail complet.

*Spécification d'origine conservée ci-dessous pour référence :*

- **Doit exister pour** : la Réception, au moment du check-in.
- **Rôles** : Réception, Administrateur (mêmes permissions que `checkin:write`/`checkin:read` — le module `police` réutilise ces clés, pas de permission dédiée, confirmé `CLAUDE.md`).
- **Actions** : saisir/modifier un `PoliceRecord` (numéro pièce, type, nationalité, date de naissance, provenance, destination) rattaché à un `stayId`.
- **Règles métier** : un `PoliceRecord` par séjour (`stayId @unique`) ; les champs déjà soumis via self-checkin (`GET /reservations/:id/self-checkin-pending`) doivent pré-remplir le formulaire ; `dateArrivee`/`dateDepart` du `PoliceRecord` sont distincts des dates de la réservation (à clarifier au design — champs légaux propres, à confirmer avec le métier si redondants ou à saisir manuellement).
- **Dépendances API** : `POST /police/:stayId`, `GET /reservations/:id/self-checkin-pending`.
- **États** : *vide* — aucun `PoliceRecord` encore saisi pour ce séjour, formulaire vierge (ou pré-rempli si self-checkin en attente) ; *erreur* — soumission incomplète (champs requis manquants côté DTO backend) ; *chargement* — lors de la récupération des données self-checkin en attente.
- **Cas limites** : séjour walk-in (aucune donnée self-checkin à pré-remplir) ; type de pièce `AUTRE` (champs moins structurés) ; groupe/famille partageant une chambre (le schéma ne modélise qu'un `guestId` par `PoliceRecord` — voir `docs/audits/PHASE_03_BASE_DE_DONNEES.md` §7, limite déjà identifiée, **hors périmètre de ce chantier**, à documenter comme limite connue si non traitée).
- **Critères UX** : doit être accessible directement depuis l'écran de détail de séjour (`StayDetailsDialog` ou équivalent), pas une navigation séparée — la saisie doit s'intégrer dans le geste naturel du check-in, pas être un pas administratif détaché.
- **Contraintes légales** : obligation DGSN — c'est la raison d'être de ce chantier, la seule fonctionnalité de cette cartographie directement liée à une obligation réglementaire externe.
- **Composants transverses requis** : formulaire structuré (nouveau `Select`/`RadioGroup` pour `TypePiece`, champ date) — aucun composant `form` générique n'existe actuellement dans `components/ui/` (voir `COMPOSANTS_PARTAGES_MANQUANTS.md`).
- **Parcours utilisateur** : check-in (réservation ou walk-in) → détail du séjour → onglet/section "Police" → saisie ou relecture du pré-rempli → validation.
- **Critère de validation fonctionnelle** : un check-in complet permet une saisie de `PoliceRecord` sans quitter l'écran de détail de séjour ; les données apparaissent dans l'export CSV existant (`ReportingPage.tsx`) sans modification de ce dernier.

### É-02 — Self check-in (staff) 🔴 — **Priorité : Importante (CH-007)**

- **Doit exister pour** : la Réception, avant l'arrivée d'un client.
- **Rôles** : Réception, Administrateur (`reservations:write` pour générer, `reservations:read` pour consulter le statut).
- **Actions** : générer/régénérer un lien de self-check-in pour une réservation ; consulter si le client l'a déjà rempli (`self-checkin-pending`).
- **Règles métier** : un seul lien actif par réservation (régénérer réécrit la même ligne, l'ancien lien cesse de fonctionner — confirmé schéma `SelfCheckinToken.reservationId @unique`).
- **Dépendances API** : `POST /reservations/:id/self-checkin-link`, `GET /reservations/:id/self-checkin-pending`.
- **États** : *vide* — aucun lien généré ; *généré, non utilisé* ; *généré, soumis* (données en attente de relecture, alimente É-01) ; *erreur* — échec d'envoi email (dégradation gracieuse déjà gérée côté backend par `MailerService`, l'UI doit refléter un échec sans bloquer la génération du lien lui-même).
- **Cas limites** : régénération d'un lien déjà soumis (écrase les données en attente ? — **à confirmer côté comportement backend exact avant de figer l'UX**) ; réservation sans email client (le lien ne peut pas être envoyé — l'UI doit le signaler clairement).
- **Critères UX** : bouton visible depuis le détail de réservation, statut du lien affiché sans nécessiter un appel séparé.
- **Composants transverses requis** : indicateur de statut (badge), déjà disponible (`components/ui/badge.tsx`).
- **Parcours utilisateur** : détail de réservation → « Générer le lien self check-in » → (client remplit hors application) → retour à l'écran → badge « Données en attente » → ouverture du check-in → pré-remplissage (lien avec É-01).
- **Critère de validation** : un lien généré est fonctionnel (le résumé public existant, déjà backend-only, doit être accessible via le token) et son statut de soumission est visible sans rafraîchissement manuel de page.

### É-03 — Gestion des notifications (templates + journal) 🔴 — **Priorité : Importante (CH-008)**

- **Doit exister pour** : l'Administrateur uniquement (écriture) ; Réception en lecture seule (confirmé seed : `notifications:read` accordé à Réception, `notifications:write` réservé à l'Administrateur — même logique que `parameters:write`).
- **Actions** : lister/éditer les `NotificationTemplate` par (événement, canal) ; consulter les `NotificationLog` récents (statut envoyé/échec/ignoré, destinataire).
- **Règles métier** : modification de template auditée (motif ≥10 caractères, cohérent avec le reste de `parameters`) — **à confirmer si `notifications` suit exactement la même discipline d'audit que `parameters`, non vérifié explicitement pendant l'audit backend**.
- **Dépendances API** : CRUD `NotificationTemplate` (route exacte à confirmer dans `notifications.controller.ts`), lecture `NotificationLog`.
- **États** : *vide* — aucun log pour la période sélectionnée ; *échec d'envoi* — statut `ECHEC` à distinguer visuellement de `IGNORE` (opt-out client, pas une panne — distinction déjà faite côté backend, doit être reflétée dans l'UI, pas fusionnée).
- **Cas limites** : template désactivé (`actif: false`) — ne doit jamais être supprimable si historique de logs y référant, à vérifier côté FK.
- **Critères UX** : les deux sous-écrans (templates / journal) doivent être clairement séparés (édition de contenu vs consultation d'historique — deux intentions différentes).
- **Parcours utilisateur** : Paramètres (ou nouvel onglet dédié, à trancher — voir §Composants) → Notifications → liste des templates par événement → édition → aperçu du journal filtrable par événement/canal/statut.
- **Critère de validation** : une modification de template est effective sur le prochain envoi réel (déjà garanti côté backend, l'UI doit juste confirmer visuellement l'enregistrement).

### É-04 — Configuration Channel Manager (mappings OTA) 🔴 — **Priorité : Importante, conditionnelle (CH-009)**

- **Doit exister pour** : l'Administrateur (réutilise `parameters:write`/`read`, confirmé `CLAUDE.md`).
- **Actions** : CRUD `ChannelRoomTypeMapping` (canal, code externe, type de chambre interne).
- **Règles métier** : sans mapping, un import OTA échoue explicitement (404) — l'écran doit rendre visible qu'un canal actif sans mapping est un état incomplet/à risque.
- **Dépendances API** : `POST/GET/DELETE /channel-manager/mappings`.
- **États** : *vide* — aucun mapping configuré pour un canal ; le cas « canal actif mais 0 mapping » devrait être signalé visuellement (avertissement) plutôt que silencieux.
- **Cas limites** : un `RoomType` supprimé/renommé après qu'un mapping y référence (à vérifier le comportement FK — probablement `RESTRICT`, empêchant la suppression du type de chambre tant qu'un mapping existe, **à confirmer**).
- **Prérequis produit** : **à confirmer si un canal OTA réel est déjà branché en production** — si aucun canal n'est utilisé, ce chantier peut légitimement être reporté (candidat à `ECARTS_ASSUMES.md`).
- **Parcours utilisateur** : Paramètres → Channel Manager → liste par canal → ajout/suppression de mapping.
- **Critère de validation** : un mapping créé permet un import test (webhook) sans erreur 404.

### É-05 — Scan de pièce d'identité (document-ocr) 🔴 — **Priorité : Secondaire (CH-022)**

- **Doit exister pour** : la Réception, au moment de la création/mise à jour d'une fiche client.
- **Actions** : upload d'une image (JPEG/PNG/WebP, 8 Mo max), affichage des champs extraits (MRZ) pour préremplissage manuel de la fiche `Guest` — jamais d'écriture automatique (confirmé backend, posture consultative).
- **Règles métier** : `checksumValide: false` doit être affiché comme avertissement, jamais bloquant.
- **Dépendances API** : `POST /document-ocr/scan` (réutilise `guests:write`).
- **États** : *chargement* — traitement OCR (peut prendre quelques secondes, `tesseract.js`) ; *erreur* — image illisible, format non supporté, taille dépassée ; *partiel* — certains champs extraits, d'autres non (ne doit jamais bloquer l'affichage des champs correctement lus).
- **Critères UX** : le scan doit rester une **assistance à la saisie**, jamais un remplacement du contrôle humain — chaque champ extrait doit être présenté comme éditable avant validation, pas auto-appliqué.
- **Parcours utilisateur** : création/édition fiche client → « Scanner une pièce » → upload → relecture des champs proposés → validation manuelle → écriture dans `Guest` via le flux existant.
- **Critère de validation** : un scan réussi propose des champs pré-remplis modifiables ; un scan en échec n'empêche jamais la saisie manuelle classique.

### É-06 — Consultation du journal d'audit 🔴 — **Priorité : Secondaire (CH-015)**

- **Doit exister pour** : l'Administrateur uniquement (`audit:read`).
- **Actions** : consulter `AuditLog` filtrable par entité cible, utilisateur, plage de dates.
- **Dépendances API** : route de lecture du module `audit` (backend fonctionnel confirmé, route exacte à reconfirmer).
- **États** : *vide* — aucun log pour les filtres choisis.
- **Critères UX** : table dense, filtrage en tête, `oldValue`/`newValue` affichés en diff lisible (pas un JSON brut) — nécessite un composant table performant (voir composants manquants).
- **Parcours utilisateur** : nouvel écran autonome, probablement accessible uniquement à l'Administrateur, pas intégré à un autre flux.
- **Critère de validation** : une action sensible connue (ex. changement de catégorie client vers BLACKLIST) est retrouvable en moins de 3 filtres.

### É-07 — Historique des statuts de chambre 🔴 — **Priorité : Secondaire (CH-014)**

- **Doit exister pour** : Gouvernante, Réception, Administrateur.
- **Actions** : consulter `RoomStatusLog` d'une chambre donnée.
- **Dépendances API** : nouvelle route backend requise (`GET /rooms/:id/historique-statuts`, cf. plan backend).
- **Parcours utilisateur** : accessible depuis la fiche chambre dans l'écran Housekeeping existant (pas un écran séparé — un panneau/onglet additionnel).
- **Critère de validation** : les 5 dernières transitions d'une chambre sont visibles sans quitter l'écran Housekeeping.

---

## Écran transverse requis (indépendant d'un module métier) : gating RBAC

**É-08 — Contexte d'identité et permissions (invisible, pas un écran mais un prérequis structurel)** 🔴 — **CH-011**

Ce n'est pas un écran au sens de cette cartographie, mais un prérequis technique sans lequel aucun des masquages par rôle décrits ci-dessus (colonne « Rôles » de chaque écran) ne peut être réellement appliqué côté client. Voir `docs/frontend-plan/PLAN_DEVELOPPEMENT_FRONTEND.md` §RBAC pour le détail de mise en œuvre.
