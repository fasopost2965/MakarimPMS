# Revue de cohérence — règles métier vs implémentation & chantier 2026-11

**Objet.** Vérifier que le référentiel `BUSINESS_RULES.md` (60 règles), la matrice
RBAC et les ADR sont **compatibles avec ce que le code fait déjà** et avec **ce que
les lots L0→L4 vont changer**, puis corriger les écarts.

**Périmètre lu :** `docs/BUSINESS_RULES.md` (60 BR), `docs/RBAC_MATRIX.md`,
`docs/ADR-001` à `ADR-008`, cahier des charges, `backend/prisma/schema.prisma`,
`backend/src/modules/*`, prototype (`prototype/src`).

> **Correction du 2026-11-06 (2ᵉ passe, vérification systématique des enums et des services).**
> Trois verdicts de la première version étaient trop sévères : **BR-RES-006**
> (politiques d'annulation), **BR-FAC-005** (registre de dépôts) et **BR-RES-007**
> (no-show) sont **partiellement ou totalement implémentés** dans le code. Les
> verdicts de l'annexe §9 ont été corrigés en conséquence, et deux écarts
> supplémentaires ont été identifiés (ADR-006, canaux). Cette revue est elle-même
> un document de référence : elle doit être aussi vérifiée que ce qu'elle vérifie.

**Verdict en une phrase.** Le référentiel est solide sur le socle (réservation,
séjour, folio, chambres, maintenance) mais il **décrit un hôtel qui n'est pas
celui-ci** sur quatre points structurants : les rôles, la facturation au
comptoir, le mode d'imputation des nuitées et les prestations annexes. Sans
correction, les lots L1 (rôles), L3 (restaurant) et L4 (événementiel) se
heurteront à des règles qui les interdisent.

---

## 0. Ce qu'il faut retenir

| # | Constat | Conséquence si non corrigé | Traitement |
|---|---|---|---|
| **C1** | La matrice RBAC interdit `billing` à la Réception, alors que la réception **encaisse et fait les check-out** (BR-SEJ-004 exige un solde à 0) | À 24 chambres, chaque départ attend le comptable — ou se fait sans encaissement | Réception = encaissement + facture simple ; Comptable = avoirs, annulations, exports |
| **C2** | La documentation (RBAC, ADR-006) décrit **6 rôles** ; le code en seed **7** (dont `RESTAURATEUR`, créé par F11/CH-056 et jamais documenté), et l'**Équipier de ménage** exigé par BR-HK-004 n'existe toujours pas | Un rôle réel n'est documenté nulle part ; l'override de BR-CLI-005 n'a pas de titulaire nommé | Matrice alignée sur 7 rôles + 1 à créer (§3) ; **ADR-006 à réviser** (C8) |
| **C3** | BR-TR-005 impose l'**imputation de la nuitée au night audit** ; le code **pré-facture tout le séjour au check-in** et le module `night-audit` ne reposte rien (« posting foundation ») | CA du jour faux, no-show non facturé, écart définitif entre règle et code | Décision D1 : cible = une ligne `HEBERGEMENT` **par nuit datée** ; le pré-chargement devient une dérogation à résorber en L0 |
| **C4** | BR-FAC-002 ignore `RESTAURANT` et range `PAIEMENT` parmi les charges, alors que l'ADR-008 §4.7 fixe `HEBERGEMENT / EXTRA / RESTAURANT / TAXE_SEJOUR / PAIEMENT` + `nature` analytique | Le module restaurant écrirait un type non prévu par la règle → contrôle fiscal impossible à auditer | Types + `nature` alignés sur ADR-008 |
| **C5** | BR-PAI-002 liste `ACOMPTE` comme **moyen de paiement**, en contradiction avec BR-FAC-005 (registre de dépôts) | L'acompte serait encaissé deux fois ou perdu au check-in | `ACOMPTE` retiré, `CHEQUE` ajouté, dépôt = entité séparée |
| **C6** | Le **restaurant et l'événementiel n'ont aucune règle métier** (0 BR) alors que L3/L4 les financent | Le développement écrira ces règles dans le code, sans référentiel → dérive | Nouvelles sections §15 et §16 (11 règles) |
| **C7** | Le statut `OPTION` (BR-RES-005) **est absent** de l'énumération, et le no-show (BR-RES-007) n'est **pas déclenché automatiquement** à la clôture | Les options ne se libèrent jamais seules ; une arrivée non honorée reste `CONFIRMEE` si personne ne la marque | Schéma + job en L0 (la politique d'annulation, elle, **est déjà implémentée**, contrairement à ce que disait la 1ʳᵉ version) |
| **C8** | **ADR-006** (validée) déclare « les 6 rôles sont codés de manière immuable, aucune suppression tolérée » alors que la base en contient 7 et que BR-HK-004 en exige un 8ᵉ | Toute création de rôle devient une violation d'ADR | Révision d'ADR-006 (ou ADR-009 « extension du modèle de rôles ») |
| **C9** | `CanalReservation` contient **5 valeurs** (`WALK_IN`, `DIRECT`, `BOOKING_COM`, `EXPEDIA`, `AIRBNB`) alors que BR-RES-003 n'en autorise **3** | Tout import Expedia/Airbnb est « hors règle » | Règle élargie aux canaux réellement paramétrés (le cahier des charges ne fixe que le mix cible) |

---

## 1. Méthode

1. **Inventaire** : 60 règles extraites, classées par domaine et par objet (invariant technique / règle de gestion / obligation légale).
2. **Confrontation à trois sources** : le code (présence de l'entité, du champ, du contrôle), les ADR validées, et la documentation client.
3. **Test de cohérence interne** : chaque règle contre les autres règles du même objet (conflit, doublon, silence).
4. **Test de faisabilité** : chaque règle doit avoir un lot, un test et un écran (ou être explicitement hors périmètre).
5. **Correction** : les écarts sans arbitrage nécessaire ont été corrigés directement dans `BUSINESS_RULES.md` (v1.1, changelog en tête du document) ; ceux qui changent une décision de gestion sont listés en §6 pour votre arbitrage.

---

## 2. Matrice de couverture (synthèse)

Légende : ✅ conforme et vérifié dans le code · 🟡 présent mais incomplet ou à vérifier · ⚠️ règle à réécrire · ❌ absent · ⛔ hors périmètre des 5 lots (dette assumée).

| Domaine | Règles | ✅ | 🟡 | ⚠️ | ❌ | ⛔ | Lot de résorption |
|---|---:|:--:|:--:|:--:|:--:|:--:|---|
| Fondations (TR) | 5 | 3 | 1 | 1 | — | — | L0, L1 |
| Réservations (RES) | 6 | 2 | 1 | 1 | 2 | — | L0 |
| Séjours (SEJ) | 5 | 5 | — | — | — | — | — |
| Clients (CLI) | 7 | 3 | 2 | — | 1 | 1 | L0, L2 |
| Chambres (CHA) | 5 | 2 | 1 | 1 | 1 | — | L0 |
| Housekeeping (HK) | 5 | 1 | 2 | 1 | 1 | — | L0, L2 |
| Facturation (FAC) | 6 | 2 | 1 | 1 | 2 | — | L0, L3 |
| Paiements (PAI) | 3 | 1 | — | 1 | 1 | — | L0, L3 |
| Comptabilité (COM) | 2 | 1 | 1 | — | — | — | L0 |
| RH (RH) | 5 | — | 2 | — | — | 3 | hors lots |
| Stocks (STK) | 2 | — | 1 | — | — | 1 | hors lots |
| Maintenance (MNT) | 4 | 3 | 1 | — | — | — | déjà livré |
| Reporting (REP) | 2 | — | 1 | 1 | — | — | L2 |
| Audit (AUD) | 3 | 2 | 1 | — | — | — | L0 |

**Vingt règles** sont proposées (§5) et **déjà intégrées** au référentiel v1.1 (80 au total) (restaurant 5, événementiel 6, no-show, départ anticipé, prolongation, taxe de séjour, TPT, recouche, cut-off, imputation par nuit).

---

## 3. Les six contradictions bloquantes

### C1 — La réception ne peut pas encaisser (RBAC vs BR-SEJ-004)

`RBAC_MATRIX.md`, ligne *billing*, rôle Réception :

> « **billing** `read` / `write` — **NON** […] *La réception peut voir l'état des soldes durant le checkout pour s'assurer qu'il est à 0 MAD, mais sans droits de write comptables.* »

Or BR-SEJ-004 interdit le check-out tant que le solde n'est pas à 0. À 24 chambres avec 70 % de walk-in, **le client paie au comptoir, à 22 h, le week-end**. La matrice impose aujourd'hui de ne pas encaisser.

**Correction (appliquée à la matrice) :**

| Rôle | `billing` | `payments` | `invoices` |
|---|---|---|---|
| Réception | R | **W (encaissement)** | R + émission du reçu/folio simple |
| Comptable | R / W | R / W | **W (facture, avoir, annulation)** |
| Administrateur | R / W / D / E | R / W | R / W / E |

Ce qui reste **exclusivement comptable** : l'avoir, l'annulation d'un encaissement, la réouverture d'une facture, les exports fiscaux. C'est la frontière qui protège l'intégrité financière (BR-TR-002) sans bloquer l'exploitation.

### C2 — Des rôles réels non documentés, un rôle documenté inexistant

**Ce que contient réellement la base** (`backend/prisma/seed.ts`, l. 604-805) : `Administrateur`, `Réception`, `Gouvernante`, `Comptable`, `Maintenance`, `RH`, **`RESTAURATEUR`** — soit **7 rôles**, et non 6.

| Règle / document | Rôle cité | Réalité | Correction |
|---|---|---|---|
| RBAC_MATRIX, ADR-006 | « six rôles » | 7 en base depuis F11/CH-056 | Documenter le 7ᵉ |
| BR-CLI-002 (blacklist) | « mot de passe d'administrateur » | Administrateur existe | Parler de **permission** `guests:override`, pas de mot de passe partagé |
| BR-CLI-005 (pièce expirée) | « rôle habilité (Directeur) » | ❌ aucun rôle Direction | Rattacher l'override à **Administrateur** |
| BR-HK-004 (écran ménage) | « équipier de ménage » | ❌ inexistant | **Créer** le rôle (accès mobile restreint) |
| Lot L3 (restaurant) | aucun | `RESTAURATEUR` existe déjà | Le documenter et le cadrer (§7 de la matrice) |

**Matrice cible : 8 rôles** = les 7 seedés + **Équipier de ménage**. Le prototype démontre **6 profils** (Direction, Réception, Gouvernante, Restaurateur, Comptable, Maintenance) ; il nomme « Direction » le profil administrateur pour rester lisible côté démonstration.

**Conséquence de gouvernance** : ADR-006 étant « validée » avec une énumération de 6 rôles immuables, l'ajout du 8ᵉ rôle **exige une révision d'ADR** (voir C8).

### C3 — Le mode d'imputation des nuitées (le plus structurant)

- **La règle** (BR-TR-005) : « *l'imputation automatique de la nuitée du jour sur les folios des séjours en cours* ».
- **Le code** : `stay.service.ts` crée à l'arrivée une ligne `HEBERGEMENT` couvrant **toutes les nuits**, plus la formule et la taxe de séjour ; un module `night-audit` existe (precheck → posting → reconcile) mais son étape *posting* déclare explicitement **« aucune nuitée repostée »**.
- **Le prototype** fait la même chose (pré-chargement du séjour).

Trois conséquences concrètes : le **CA du jour** est faux (tout le séjour est compté le jour de l'arrivée), un **no-show** ne peut pas être facturé proprement, et un **départ anticipé** exige le réajustement complexe déjà présent dans `stay.service.ts` (l. ~900).

**Décision D1 (recommandée)** : cible = **une ligne `HEBERGEMENT` datée par nuit**, postée au night audit, avec la taxe de séjour de la nuit. Le pré-chargement actuel devient une dérogation documentée, résorbée en L0 (le module `night-audit` a déjà la structure d'étapes). Bénéfices : CA/ADR/RevPAR exacts, no-show facturable, départ anticipé sans reclassement, clôture journalière réelle.

À défaut, il faut **réécrire BR-TR-005** pour entériner la pré-facturation — mais alors il faut aussi réécrire BR-COM-002 et le reporting, et accepter un CA décalé.

### C4 — La typologie des charges est périmée

BR-FAC-002 liste `HEBERGEMENT`, `EXTRA`, `TAXE_SEJOUR`, `PAIEMENT` et **ignore `RESTAURANT`**, alors que :
- `TypeLigneFolio.RESTAURANT` **existe dans le code** ;
- l'ADR-008 §4.7 définit la liste officielle : `HEBERGEMENT / EXTRA / RESTAURANT / TAXE_SEJOUR / PAIEMENT` + un axe analytique `nature` (`RESTAURANT`, `PETIT_DEJEUNER`, `SALLE_REUNION`, `SPA`…).

Sans correction, le module restaurant (L3) écrirait un type que le référentiel ne connaît pas — exactement le type d'écart que l'audit fiscal a déjà relevé. **Corrigé** en v1.1.

### C5 — `ACOMPTE` n'est pas un moyen de paiement

BR-PAI-002 énumère `ESPECES`, `CARTE`, `VIREMENT`, **`ACOMPTE`**. Un acompte est un **objet comptable** (BR-FAC-005 : registre de dépôts, transféré au folio au check-in), pas un mode de règlement. Confondre les deux conduit soit à compter deux fois l'argent, soit à perdre la trace du dépôt.

**Correction** : `ESPECES`, `CARTE`, `VIREMENT`, `CHEQUE` (nécessaire à la caution BR-FAC-006), `A_COMPTER`. L'acompte est une `Deposit`, jamais un `Payment`. **Corrigé** en v1.1.

### C6 — Restaurant et événementiel sans référentiel

Aucune règle ne couvre : la note par table et par service, l'envoi en chambre, le petit-déjeuner inclus non facturé (ADR-008 §4.5), la rupture de carte, l'encaissement direct, la disponibilité de la salle, le devis, l'acompte de 30 %, la facturation entreprise, la TVA 20 % des prestations.

**Onze règles créées** (§15 et §16 du référentiel), directement dérivées du prototype fonctionnel et du cahier des charges.

---

## 4. Règles réécrites (appliquées en v1.1)

| Règle | Avant | Après | Motif |
|---|---|---|---|
| BR-FAC-002 | 4 types, `PAIEMENT` mélangé aux charges | 5 types + `nature` analytique | ADR-008 §4.7 + module restaurant |
| BR-PAI-002 | `ACOMPTE` comme moyen | `ESPECES / CARTE / VIREMENT / CHEQUE / A_COMPTER` | C5 |
| BR-PAI-003 | Rédigée comme une question ouverte | Règle tranchée : alerte bloquante > 10 000 MAD, dérogation motivée + audit | Décision D4 |
| BR-COM-002 | CA sur facture, TVA « Extras 20 % » | CA sur charges postées TTC, ventilation par type + TPT | ADR-008 |
| BR-REP-002 | Occupation, arrivées/départs, CA par canal | + **ADR, RevPAR, CA par activité** | CDC §5.15 |
| BR-CHA-003 | `LIBRE_PROPRE` uniquement | `LIBRE_PROPRE` **ou `RESERVEE`** (aligné sur INV-CHA-001) | contradiction interne |
| BR-HK-002 | 3 transitions | + `CONTROLEE → A_REFAIRE` et `TERMINEE` laisse la chambre en `A_NETTOYER` | BR-HK-003 / ADR-003 |
| BR-TR-005 | Night audit générique | Étapes, verrou, rapport Z, et dérogation de pré-facturation identifiée | C3 |

---

## 5. Règles manquantes (créées en v1.1)

| ID | Règle | Pourquoi elle est indispensable |
|---|---|---|
| BR-RES-007 | **No-show** : à la clôture, arrivée non enregistrée → statut `NO_SHOW`, première nuit facturée, chambre libérée | Sans elle, 70 % de walk-in = arrivées non honorées jamais facturées |
| BR-SEJ-006 | **Départ anticipé** : nuits non consommées, taxe de séjour au réel, avoir si déjà payé | Le code gère déjà le réajustement ; la règle doit exister |
| BR-SEJ-007 | **Prolongation** : contrôle de disponibilité, avenant, tarif du jour | Cas quotidien en 3★ (clients qui restent) |
| BR-FAC-007 | **Taxe de séjour : assiette et exonérations** (par personne majeure et par nuit, exonérations à paramétrer) | Aujourd'hui elle est comptée sur tous les occupants, sans exonération |
| BR-FAC-008 | **TPT** (taxe de promotion touristique) : composante distincte, configurable | Présente dans l'exemple de l'ADR-008, absente de `TaxRateConfig` |
| BR-HK-006 | **Recouche** (stayover) et priorité départ > arrivée | Le housekeeping quotidien n'est pas seulement post-check-out |
| BR-RST-001 → 005 | **Restaurant** : note par table/service, envoi en chambre, petit-déjeuner inclus non facturé, rupture de carte, encaissement direct et annulation | Aucune règle n'existe (C6) |
| BR-EVT-001 → 006 | **Événementiel** : disponibilité de salle, devis valable, acompte 30 %, annulation, facturation entreprise, TVA 20 % | Idem |
| BR-TR-006 | **Cut-off d'exploitation** : la journée bascule à l'heure paramétrée, jamais à l'horloge | BR-TR-005 ne dit pas *quand* |

> Les règles **hors périmètre** (RH, stocks) restent valides mais n'ont aucun lot : c'est une dette assumée, pas un oubli. Elle doit être inscrite telle quelle dans le backlog.

---

## 6. Décisions à votre arbitrage

Les quatre premières sont **corrigées dans le référentiel avec la valeur recommandée** ; dites-moi si vous voulez l'autre option et je change.

| # | Question | Recommandation retenue | Impact si vous choisissez l'autre option |
|---|---|---|---|
| **D1** | Imputation : une nuit = une ligne (night audit) ou séjour entier au check-in ? | **Nuit par nuit** | Garder le pré-chargement = réécrire BR-TR-005, BR-COM-002 et le dashboard ; KPI décalés |
| **D2** | Contrôle gouvernante obligatoire avant remise en vente (BR-HK-003) ? | **Oui**, avec possibilité pour la Gouvernante de faire le ménage et le contrôle (petite équipe) | Autoriser l'auto-contrôle = affaiblir l'invariant INV-CHA-002 de l'ADR-003 |
| **D3** | Taxe de séjour : qui paie ? | **Par adulte et par nuit**, exonération des mineurs **paramétrable** (montant communal à saisir) | Assiette « par occupant » = écart avec ADR-002 |
| **D4** | Espèces > 10 000 MAD | **Blocage + dérogation motivée journalisée** | Alerte simple = risque de conformité (loi 43-05) |
| **D5** | Rôles : 6 ou 8 ? | **8** (ajout Direction, Équipier de ménage, Restaurateur) | Rester à 6 = overrides et module resto sans titulaire |

---

## 7. Ce que j'ai aligné dans le prototype ce jour

Le prototype matérialise désormais les règles corrigées :

| Alignement | Règle | Effet visible |
|---|---|---|
| **Sélecteur de profil** (6 profils, menu en haut à droite) | BR-TR-004, BR-HK-004, D5 | La navigation se réduit aux écrans autorisés ; la Gouvernante n'a que « Chambres », sans aucun montant ni bouton de check-in ; le Restaurateur n'a que le restaurant ; le Comptable n'a ni réservations ni tarifs hôteliers |
| **Canaux ramenés aux 3 du cahier des charges** | BR-RES-003 (C9) | La démo illustre le mix cible walk-in / direct / Booking.com ; la règle, elle, autorise les 5 canaux réellement paramétrés |
| **Carte « Mix par canal »** sur le tableau de bord | BR-REP-002 | CA ferme par canal et comparaison à la cible 70/20/10 du cahier des charges |
| **Fermeture des panneaux par `Échap`**, toasts repositionnés | ergonomie | Conforme aux habitudes d'un logiciel de réception |

Non simulé volontairement (documenté) : multi-folios, dépôts, avoirs, recouche, maintenance, TPT. Ces objets existent dans le code de production ou sont planifiés en L0.

---

## 8. Plan de mise en cohérence

| Lot | Corrections de règles à porter | Tests de recette associés |
|---|---|---|
| **L0** | C3 (imputation par nuit), C5 (dépôts), D3 (taxe de séjour), D4 (espèces), BR-RES-005/006 (option + politique), BR-FAC-007/008 | Facturation d'un no-show ; départ anticipé avec avoir ; nuit postée une seule fois ; exonération mineur ; blocage espèces |
| **L1** | C1 (encaissement réception), C2/D5 (8 rôles), BR-HK-004 (écran ménage) | Un réceptionniste encaisse et clôture ; il ne peut pas émettre d'avoir ; un équipier ne voit aucun montant |
| **L2** | BR-REP-002 (ADR/RevPAR/canaux), BR-CHA-005 (OOO/OOS) | ADR et RevPAR recalculés à la main sur une journée test |
| **L3** | C6 + BR-RST-001→005, BR-FAC-002 (type `RESTAURANT`), BR-COM-002 | Envoi en chambre = une ligne, TVA 20 % ; petit-déjeuner inclus non refacturé ; rupture respectée |
| **L4** | C6 + BR-EVT-001→006 | Double réservation de salle refusée ; devis → acompte 30 % → facture ; TVA 20 % |

**Gouvernance.** `BUSINESS_RULES.md` passe en **v1.1** avec changelog ; `RBAC_MATRIX.md` reçoit une section de révision. Toute règle modifiée cite sa source (cahier des charges, ADR, ou décision propriétaire) — sans quoi elle redeviendra un vœu.

---

## 9. Annexe — matrice détaillée (60 règles d'origine)

### Fondations

| Règle | Statut | Constat / action |
|---|:--:|---|
| BR-TR-001 Pivot séjour | ✅ | `stay.service.ts` est bien le pivot ; folios rattachés au séjour |
| BR-TR-002 Immutabilité fiscale | ✅ | Facture non modifiable, avoir obligatoire |
| BR-TR-003 Pas de taux en dur | 🟡 | `TaxRateConfig` utilisé, mais couplage `RESTAURANT = EXTRA` à expliciter (L3) |
| BR-TR-004 RBAC serveur | 🟡 | Permission décorateur présent ; **matrice incomplète** (C1, C2) |
| BR-TR-005 Night audit | ⚠️ | Module existant mais *posting* vide → décision D1 |

### Réservations

| Règle | Statut | Constat / action |
|---|:--:|---|
| BR-RES-001 Anti double-booking | ✅ | Contrôle de chevauchement + contraintes |
| BR-RES-002 Cycle de vie | 🟡 | `CONFIRMEE / ANNULEE / NO_SHOW / TRANSFORMEE_EN_SEJOUR` : conforme hors `OPTION` (BR-RES-005) |
| BR-RES-003 Canal obligatoire | ⚠️ | Règle : 3 canaux ; enum : 5 (`+ EXPEDIA`, `+ AIRBNB`) → écart à trancher (C9) |
| BR-RES-004 Rate limiting widget | 🟡 | Module `booking-engine` présent ; limiteur à vérifier avant mise en service |
| BR-RES-005 Option + expiration | ❌ | Statut + job à créer (L0) |
| BR-RES-006 Politique d'annulation | ✅ | `CancellationPolicy` seedée (Flexible / Modérée / Non remboursable) + `computeCancellationPenalty()` — **correction de la 1ʳᵉ passe** |
| BR-RES-007 No-show *(nouveau)* | 🟡 | `markNoShow()` + `AuditAction.MARK_NO_SHOW` existent ; **déclenchement automatique** à la clôture et facturation à généraliser (L0) |

### Séjours

| Règle | Statut | Constat / action |
|---|:--:|---|
| BR-SEJ-001 Liaison unique | ✅ | 1 réservation → 1 séjour |
| BR-SEJ-002 Check-in | ✅ | Séjour + folio + chambre occupée |
| BR-SEJ-003 Walk-in | ✅ | Fiche client créée à la volée — parcours n°1 (70 %) |
| BR-SEJ-004 Solde à 0 | ✅ | Blocage effectif (prototype identique) |
| BR-SEJ-005 Libération chambre | ✅ | Passage en `A_NETTOYER` + tâche HK |
| BR-SEJ-006 Départ anticipé *(nouveau)* | ➕ | Créé : réajustement + avoir |
| BR-SEJ-007 Prolongation *(nouveau)* | ➕ | Créé : disponibilité + avenant |

### Clients

| Règle | Statut | Constat / action |
|---|:--:|---|
| BR-CLI-001 Typologie | ✅ | `STANDARD / VIP / ENTREPRISE / AGENCE / BLACKLIST` |
| BR-CLI-002 Blacklist | 🟡 | Contrôle serveur ; override à définir par **permission** (C2) |
| BR-CLI-003 Pièce d'identité | 🟡 | Champ présent ; obligation à durcir au check-in (fiche de police) |
| BR-CLI-004 Plafond crédit société | 🟡 | À vérifier au branchement du city ledger (L0) |
| BR-CLI-005 Validité pièce | 🟡 | Rôle « Directeur » inexistant → rattacher à **Administrateur** (C2) |
| BR-CLI-006 Mentions légales | ✅ | ICE / RC / IF sur `Company` |
| BR-CLI-007 Anonymisation | ❌⛔ | Aucun job ; hors lots — dette légale à planifier |

### Chambres & housekeeping

| Règle | Statut | Constat / action |
|---|:--:|---|
| BR-CHA-001 Unicité numéro | ✅ | Contrainte base |
| BR-CHA-002 Invariant des états | ✅ | 7 états conformes à l'ADR-003 ; le prototype en montre 4 (mapping documenté) |
| BR-CHA-003 Vente hors propre | ⚠️ | Texte plus strict que l'ADR → **corrigé** (`RESERVEE` autorisée) |
| BR-CHA-004 RoomStatusLog | ✅ | Journalisation présente |
| BR-CHA-005 OOO / OOS | ❌ | Sous-catégorie absente → RevPAR faussé (L2) |
| BR-HK-001 Déclenchement checkout | ✅ | Tâche créée automatiquement |
| BR-HK-002 Transitions tâches | ⚠️ | Manquait `CONTROLEE → A_REFAIRE` et l'état chambre à `TERMINEE` → **corrigé** |
| BR-HK-003 Contrôle gouvernante | ✅ | Règle claire et implémentable (D2) |
| BR-HK-004 Écran ménage | 🟡 | Rôle Équipier à créer dans une énumération de 7 (C2, C8) |
| BR-HK-005 Écart chambre | ❌ | À créer (L2), utile en 3★ (chambre occupée déclarée libre) |
| BR-HK-006 Recouche *(nouveau)* | ➕ | Créé |

### Facturation, paiements, comptabilité

| Règle | Statut | Constat / action |
|---|:--:|---|
| BR-FAC-001 Multi-folios | ✅ | Modèle conforme à l'ADR-002 |
| BR-FAC-002 Typologie | ⚠️ | **Corrigé** : l'enum réel compte **7** types (`+ RESTAURANT`, `AJUSTEMENT_HAUSSE`, `AJUSTEMENT_BAISSE`) + `nature` |
| BR-FAC-003 Pas de suppression | ✅ | Annulation logique + audit |
| BR-FAC-004 Transfert de charges | 🟡 | À instrumenter en audit si absent |
| BR-FAC-005 Registre de dépôts | ✅ | `ReservationDeposit` + transfert au folio au check-in (`stay.service.ts` l. 505-522) — **correction de la 1ʳᵉ passe** |
| BR-FAC-006 Caution | ❌ | Non implémenté (L0, avec `CHEQUE`) |
| BR-FAC-007 Taxe de séjour *(nouveau)* | ➕ | Créé : assiette et exonérations paramétrables |
| BR-FAC-008 TPT *(nouveau)* | ➕ | Créé : composante distincte à configurer |
| BR-PAI-001 Idempotence | ✅ | Clé d'idempotence présente |
| BR-PAI-002 Modes de paiement | ⚠️ | **Corrigé** : `ACOMPTE` retiré, `CHEQUE` ajouté |
| BR-PAI-003 Plafond espèces | ⚠️→✅ | Décision D4 intégrée : blocage + dérogation |
| BR-COM-001 Catégories de dépenses | ✅ | Énumération fermée |
| BR-COM-002 Imputation fiscale | ⚠️ | **Corrigé** : TTC posté, ventilation par type, TPT |

### Hors périmètre de la refonte

| Règle | Statut | Constat |
|---|:--:|---|
| BR-RH-001 → 005 | 🟡 / ⛔ | Pointage et paie hors lots ; règles maintenues, aucune évolution prévue |
| BR-STK-001 → 002 | 🟡 / ⛔ | Décrément automatique à vérifier ; stock non inclus dans la refonte |
| BR-MNT-001 → 004 | ✅ | Conforme à l'ADR-003, déjà livré |
| BR-REP-001 Exports | 🟡 | Formats PDF/XLSX/CSV à confirmer écran par écran |
| BR-REP-002 KPI dashboard | ⚠️ | **Corrigé** : ADR, RevPAR, canaux, activité |
| BR-AUD-001 Soft delete | ✅ | 29 champs `deletedAt` dans le schéma |
| BR-AUD-002 Journalisation | ✅ | `AuditLog` + décorateur de permission sensible |
| BR-AUD-003 Expiration des jetons | 🟡 | À vérifier (30 min) |
