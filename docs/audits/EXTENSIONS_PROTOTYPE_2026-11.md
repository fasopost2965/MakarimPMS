# Extensions du prototype — novembre 2026

**Date :** 2026-11-06 · **Périmètre :** `prototype/` uniquement (aucune
modification de `backend/` ni `frontend/`)
**Origine :** retour d'exploitation du propriétaire — six manques fonctionnels
constatés par rapport au PMS existant, plus l'application du design system aux
nouveaux écrans.

---

## 1. Ce qui a été ajouté

| # | Demande | Livré | Écran |
|---|---|---|---|
| 1 | Fiche de police | Registre d'hébergement complet, contrôle des champs obligatoires, édition et impression A4 | **Fiches de police** |
| 2 | Voir les PDF | Bibliothèque de documents imprimables : factures, notes d'hôtel, fiches de police, rapports de tournée, relevé de régie — aperçu A4 | **Documents & PDF** |
| 3 | Le directeur paramètre les rôles | Matrice 6 rôles × 11 écrans, modifiable et appliquée immédiatement | **Rôles & permissions** |
| 4 | Restaurant : en chambre ou encaissé par l'hôtel, puis reversé au restaurant | Deux circuits explicites + relevé de régie dans la Caisse | **Restaurant**, **Caisse** |
| 5 | Tours de quart | Trois shifts de 8 h, checklist, main courante, consignes, comptage, rapport signé | **Tours de quart** |
| 6 | Particuliers vs entreprises | Typologie de client, fiche société (ICE, conditions de règlement) | **Réservations**, **Fiches de police** |
| 7 | Séjour payé par l'entreprise + nuit au compte du client | Payeur ligne par ligne, prolongation, deux factures distinctes | **Caisse** |

Le prototype passe de **7 à 11 écrans**, tous alimentés par le même store
persisté (`makarim-prototype-v4`, migration automatique depuis v3).

---

## 2. Détail par fonctionnalité

### 2.1 Fiche de police

Champs : nom, prénom, date et lieu de naissance, nationalité, profession,
domicile, ville, téléphone, nature et numéro de pièce, date de délivrance,
occupants, arrivée et départ prévus, signatures.

Une fiche est **complète** quand nom, date de naissance, nationalité et numéro
de pièce sont renseignés. Sinon elle s'affiche en rouge et le document imprimé
liste explicitement les champs manquants.

Règles : **BR-CLI-003** (enregistrement obligatoire des pièces d'identité),
**BR-CLI-005** (validité de la pièce au check-in), **BR-SEJ-002** (fiche établie
à l'arrivée).

> Écart assumé : la conservation « six mois » affichée sur le document est la
> pratique hôtelière marocaine ; le référentiel (BR-CLI-007) parle
> d'anonymisation après péremption légale sans fixer la durée. À trancher.

### 2.2 Documents imprimables

Quatre gabarits A4, produits en HTML imprimable (impression navigateur →
« Enregistrer au format PDF ») :

- **Facture / note d'hôtel** — mentions légales de l'établissement (ICE, RC, IF,
  patente, CNSS), détail des lignes, **ventilation TVA par taux** (10 %
  hébergement et pensions, 20 % restauration et annexes, taxe de séjour hors
  TVA), total HT / TVA / TTC.
- **Fiche de police** — formulaire administratif avec zones de signature et de
  cachet.
- **Rapport de tournée** — contrôles, main courante, remarques, consignes,
  double signature (agent sortant / agent entrant).
- **Relevé de régie restaurant** — ce que l'hôtel a encaissé pour le restaurant
  et ce qu'il doit lui reverser, avec détail par moyen de paiement.

Règles : **BR-CLI-006** (mentions obligatoires de la facture entreprise),
**BR-FAC-002** (typologie des charges), **BR-REP-001** (export imprimable).

> Les mentions légales sont **fictives** (démonstration) et signalées comme
> telles sur le document. Elles devront être remplacées par les identifiants
> réels avant toute présentation client.

### 2.3 Rôles paramétrables

La matrice documentée (`docs/RBAC_MATRIX.md`) devient une **valeur par défaut** :
la Direction coche ou décoche chaque écran pour chaque rôle, et bascule la
visibilité des montants. La navigation se recalcule immédiatement.

Garde-fous implémentés :

1. **Un rôle doit conserver au moins un écran** — un rôle vide est un compte
   inutilisable, pas un compte restreint.
2. **Verrou anti-lockout** : la Direction ne peut pas se retirer l'accès à
   l'écran des rôles.
3. Chaque enregistrement est journalisé (**BR-AUD-002**).

Règle : **BR-TR-004** — l'écran prépare la décision, le serveur reste seul juge.

### 2.4 Restaurant : deux circuits d'encaissement

| Circuit | Qui encaisse | Où va l'argent |
|---|---|---|
| **Encaissé sur place** | Le restaurant (sa propre caisse) | Reste au restaurant |
| **Envoyé en chambre** | La réception, au départ | L'hôtel encaisse, puis **reverse au restaurant** |

Le relevé de régie arrête, en fin de journée : notes portées en chambre, tables
réglées directement, total encaissé par l'hôtel, montant à reverser, détail par
moyen de paiement.

Règles : **BR-RST-002** (envoi en chambre et imputation au folio),
**BR-RST-005** (encaissement direct, TVA).

### 2.5 Tours de quart et cahier de transmission

Trois shifts : **06:00–14:00**, **14:00–22:00**, **22:00–06:00**, un agent par
shift, avec :

- une **checklist de contrôles** propre au shift (ronde et compteurs la nuit,
  petit-déjeuner et point ménage le matin, réservations du lendemain et point
  restaurant l'après-midi) ;
- une **main courante** horodatée automatiquement ;
- les **remarques** de l'agent sortant et les **consignes** pour l'agent entrant,
  affichées en tête d'écran du shift suivant ;
- le **comptage de caisse** avec le fond de caisse ;
- une **clôture signée** qui produit le rapport imprimable.

Règles : **BR-RH-003** (horodatage), **BR-RH-004** (pas de sortie de shift sans
clôture), **BR-RH-005** (pointage concurrent interdit), **BR-AUD-002**.

> La checklist peut être clôturée avec des contrôles non faits : le rapport
> l'indique alors explicitement plutôt que de le masquer. À trancher : blocage
> strict (BR-RH-004 au sens fort) ou clôture avec écart déclaré — le prototype
> retient la seconde option, plus proche de la réalité d'un hôtel 3★.

### 2.6 Particuliers et entreprises

Un client est **particulier** ou **entreprise**. L'entreprise porte une raison
sociale, un ICE, une adresse, un contact et des **conditions de règlement**
(facture mensuelle 30 jours, virement 15 jours, comptant). Les séjours rattachés
héritent du payeur par défaut.

Règles : **BR-CLI-001** (typologie), **BR-CLI-004** (plafond de crédit
entreprise — non implémenté, voir §4), **BR-CLI-006** (mentions).

### 2.7 Facturation séparée (le cas du séjour prolongé)

Cas visé : *un client a deux nuits payées par son entreprise ; il décide d'une
nuit supplémentaire pour son propre compte.*

Le folio porte un **payeur par ligne** :

1. à la création du séjour, les nuits et la taxe sont affectées à l'entreprise
   si le client en dépend, le restaurant et les extras au client ;
2. chaque ligne peut être basculée **Client ⇄ Entreprise** en un clic ;
3. « Ajouter une nuit au compte du client » crée la nuit supplémentaire et sa
   taxe de séjour, **affectées au client** ;
4. « Émettre les factures » produit **deux documents distincts** : facture
   société et note client, chacune avec son détail et sa ventilation TVA.

Règles : **BR-FAC-001** (capacité multi-folios), **BR-SEJ-007** (prolongation de
séjour), **BR-FAC-002** (typologie des charges).

---

## 3. Design

Les nouveaux écrans réutilisent **exclusivement** le design system du prototype
(tokens `sand / ink / maj / terra / saffron / jade / crimson`, rayons `xl / lg /
full`, ombres `card / pop`) et l'échelle typographique arbitrée en **RD-030**
(14 / 12 / 11 / 10 px). Aucun composant parallèle n'a été introduit : les
nouveaux écrans se composent de `Card`, `CardHeader`, `Button`, `Pill`, `Stat`,
`Modal` et `Drawer` existants.

Les documents A4 ont leur propre échelle (corps 11 px, mentions 10 px) : c'est
une contrainte d'impression, pas une dérive — une facture tient sur une page.

---

## 4. Ce qui reste à faire pour porter dans l'application réelle

| Sujet | État prototype | Nécessaire côté `backend/` |
|---|---|---|
| Fiche de police | simulée dans le store | modèle `fiche_police` (1-1 séjour, occupants), obligation de complétude au check-in, export |
| Documents PDF | HTML imprimable | génération serveur (PDF/A pour l'archivage), numérotation séquentielle transactionnelle |
| Rôles paramétrables | matrice en état local | table `role_permission`, endpoints d'administration, invalidation du cache d'autorisation |
| Régie restaurant | calculée à l'affichage | écritures comptables de reversement, rapprochement avec la caisse restaurant |
| Tours de quart | checklist en état local | `shift`, `shift_checklist`, `handover_report`, horodatage serveur (BR-RH-003) |
| Typologie client | champ `type` + `societeId` | `Client.type`, `Entreprise` (ICE, conditions), lien city ledger |
| Facturation séparée | payeur par ligne | `folio_line.payer`, split-invoice, séquence de numérotation par payeur |
| BR-CLI-004 (plafond crédit entreprise) | **non implémenté** | blocage du check-in au-delà de l'encours autorisé |

Ces écarts sont à porter au registre (`docs/governance/ECARTS_DOC_VS_CODE.md`)
au moment du portage, pas avant : le prototype ne fait pas foi sur le modèle de
données.

---

## 5. Passe 2 — paramétrage, distribution et connexion

Deuxième série de demandes d'exploitation. Le prototype compte désormais
**13 écrans** et un portail de connexion.

### 5.1 Publication de la grille tarifaire (correctif)

La « publication » ne faisait que lever une notification : les prix n'étaient ni
enregistrés ni appliqués. Désormais :

1. la grille est **éditable** (prix par type de chambre, coefficients de saison,
   forfait demi-journée) ;
2. tant qu'elle n'est pas publiée, les parcours continuent d'utiliser la version
   en vigueur — un bandeau « modifications non publiées » le signale ;
3. la publication **valide** (prix > 0, coefficients entre 0,5 et 3, forfait
   renseigné) puis **incrémente la version**, horodate et journalise l'auteur ;
4. les prix publiés alimentent la tarification réelle : réservation, check-in,
   prolongation, no-show, prévision de recette, poussée vers les canaux.

Règle : **BR-TR-003** (aucun tarif codé en dur), **BR-AUD-002** (journalisation).

### 5.2 Séjour à la demi-journée

Forfait **200 MAD** (paramétrable), matinée ou après-midi : pas de nuitée, donc
**pas de taxe de séjour**, et la chambre redevient vendable le soir. Le créneau
remplace les nuitées dans le formulaire de réservation et apparaît comme tel sur
le planning et le folio.

### 5.3 Prévision d'occupation intelligente

Le graphique est recalculé à chaque mouvement, sur 14 jours :

- chambres **réellement occupées** chaque jour (séjours chevauchants +
  réservations fermes, chambres actives seulement) ;
- distinction visuelle **jour passé / jour en cours / prévision** ;
- **ligne d'objectif** au taux cible de 63 % ;
- au survol : chambres vendues, arrivées, départs, **recette estimée** à la
  grille publiée × coefficient de saison.

En production, la même série sort d'une vue d'occupation par date recalculée à
chaque écriture — le composant ne change pas.

### 5.4 No-show et prolongation

- **No-show** : bouton « Non présenté » sur une réservation confirmée ; la
  réservation passe en `no_show` (sans suppression) et la **première nuit est
  facturée** (facture émise avec le prix de la grille). **BR-RES-007**.
- **Prolongation** : action « Ajouter une nuit au compte du client » dans la
  Caisse ; la nuit supplémentaire naît au nom du client, jamais de l'entreprise.
  **BR-SEJ-007**.

### 5.5 Bulles d'aide

Composant `InfoBulle` accessible (bouton focusable, `aria-describedby`, aide
visible au survol **et** au clavier), posé sur les notions non évidentes : no-show,
prolongation, répartition société/client, régie restaurant, demi-journée,
publication de grille, sortie de stock, channel manager, calcul de la prévision.

### 5.6 Chronomètre de shift

Trois shifts de 8 h. Chaque agent voit **temps écoulé / temps restant** avec une
barre de progression ; la **Direction** voit les trois shifts en direct sur le
tableau de bord. L'heure de début est celle du shift ; en production, ce sera
l'horodatage serveur de la connexion (**BR-RH-003**).

### 5.7 Stock et minibar lié aux chambres

- inventaire par catégorie, **seuils critiques** avec alerte ;
- mouvements d'entrée / sortie tracés (article, quantité, motif, heure) ;
- **minibar lié aux chambres** : sur une chambre dont l'option est activée, la
  déclaration de consommation décrémente le stock **et** porte la ligne au folio
  du client dans le même geste ;
- le module entier est **activable** dans les paramètres.

Règles : **BR-STK-001**, **BR-STK-002**, **BR-RST-002**.

### 5.8 Channel manager

Connexions (Booking.com, direct, Expedia, Airbnb), état de connexion,
synchronisation, **mapping des 4 types de chambre**, et **poussée des tarifs
publiés** avec le coefficient de saison appliqué. Simulation assumée : aucune
requête réseau, le sens de circulation est celui d'un vrai channel manager.

### 5.9 Chambres et identité de l'établissement

- **création de chambre** (numéro, étage, type, minibar) réservée à la Direction,
  avec contrôle d'unicité — la chambre créée est immédiatement vendable ;
- option **minibar** par chambre ;
- **nom et logo** de l'établissement paramétrables (téléversement PNG/JPG/SVG,
  400 Ko max), utilisés sur la page de connexion et dans la barre latérale.

### 5.10 Page de connexion et comptes agents

Portail de connexion moderne (panneau d'identité + formulaire), avec **un compte
par agent** : le rôle est porté par le compte, pas choisi par l'utilisateur.
Déconnexion depuis le menu de profil ; la session est journalisée.

> Démonstration : mot de passe commun `makarim2026`, affiché à l'écran. En
> production : mot de passe individuel, verrouillage après échecs, second facteur
> pour la Direction, et lien avec `RH-003` (présence horodatée).

---

## 6. Limites connues de cette passe

| Sujet | Limite | Suite |
|---|---|---|
| Demi-journée | la chambre reste « occupée » jusqu'au départ manuel le jour même | automatiser la libération à 13 h / 19 h |
| Channel manager | simulation, aucun appel réseau | connecter un vrai CM (API + webhooks) |
| Stock | pas de lien fournisseur ni de commande d'achat | module achats (hors périmètre 3★) |
| Création de chambre | pas de suppression (volontaire : soft delete, BR-AUD-001) | statut « inactive » à la place |
| Logo | stocké en `localStorage` (démonstration) | stockage objet côté serveur |
| Connexion | comptes de démonstration en dur | table utilisateurs, hachage, MFA direction |

---

## 7. Passe 3 — paramétrage fin, rapports exportables et réception

Troisième série de demandes. Le prototype reste à **13 écrans**, mais presque tout ce qui
était figé dans le code devient un paramètre, et chaque rapport sort en PDF, CSV et Excel.

### 7.1 Carte du restaurant paramétrable

La carte n'est plus une constante : la Direction ajoute un plat, change son prix, le déplace
de catégorie, le retire. Les articles retirés restent en base (les notes déjà émises gardent
leur libellé et leur prix) mais disparaissent de la vente. Chaque modification est journalisée.

### 7.2 Prestations de la salle paramétrables

Libellé, prix, unité (par personne / forfait) et activation se règlent dans « Gérer ».
Le devis séminaire et le formulaire de créneau se recalculent immédiatement. Une prestation
désactivée disparaît des nouveaux devis sans réécrire les anciens.

### 7.3 Planning de la salle cliquable

Un clic sur un **créneau libre** ouvre une prise de réservation pré-remplie (date, créneau,
location, prestations, TTC). Un clic sur un **créneau occupé** ouvre le dossier de l'événement
avec deux actions : confirmer (acompte calculé) ou annuler (créneau libéré, historique
conservé).

### 7.4 Fiche de police : pays, ville et registre imprimable

- **Pays d'origine** et **ville** deviennent des données déclarées ;
- la liste des pays est **filtrable par saisie**, puis la liste des villes se réduit au pays
  choisi et reste **filtrable** elle aussi ;
- une ville hors référentiel reste saisissable (l'obligation légale prime sur la liste) ;
- le **PDF de la fiche** est refait : blocs identité / origine / pièce / séjour, mentions
  légales, trois zones de signature (client, cachet, visa réception) ;
- un **registre imprimable** (toutes les fiches du jour) accompagne la fiche individuelle,
  c'est souvent le registre que demande le contrôle.

### 7.5 Création d'utilisateurs et de rôles

« Rôles & permissions » gère désormais les **comptes nominatifs** : nom, identifiant, e-mail,
rôle, activation. Un compte créé est immédiatement utilisable au portail de connexion ; un
compte désactivé en disparaît. Le rôle porté par le compte reste modifiable et s'applique à la
connexion suivante.

### 7.6 Prix de base, verrou tarifaire et confirmation

Le prix de base par type est éditable, mais la grille est **verrouillée par défaut** :
déverrouillage par code pour la session, puis **récapitulatif des écarts** (avant → après) avant
publication. Rien ne s'écrit en un seul clic.

### 7.7 Fiscalité paramétrable

TVA hébergement, TVA annexes, TVA salle, taxe de séjour et plafond d'espèces sont éditables,
avec confirmation obligatoire et journalisation. Les taux alimentent désormais réellement :
taxe de séjour au check-in, TVA des factures, ventilation TVA des documents, plafond de caisse,
TVA affichée au restaurant et dans le devis séminaire.

### 7.8 Changement de chambre motivé et historisé

Le changement de chambre est un **événement de séjour**, pas une correction de saisie :

- motif obligatoire, avec **origine** (client ou hôtel) ;
- commentaire obligatoire dès que l'origine est le client ;
- destination limitée au **standing égal ou supérieur** (BR-SEJ-008) ;
- chambre d'accueil vérifiée libre sur les mêmes dates ;
- supplément imputé selon l'origine du motif (hôtel / gratuit / client) ;
- trace complète : de → vers, date, heure, agent, motif, commentaire.

### 7.9 Historique client

Un panneau « dossier client » rassemble séjours, réservations, factures et changements de
chambre sous le même nom — la mémoire que la réception perd aujourd'hui entre deux saisons.

### 7.10 Check-in et check-out visibles

Un bloc « Réception du jour » affiche en permanence les arrivées à enregistrer et les départs
à libérer, avec le bouton d'action dans la ligne. Le check-out est bloqué si le folio n'est pas
soldé, avec le montant dû affiché. Les mêmes actions restent disponibles dans le détail d'un
séjour.

### 7.11 Exports PDF, CSV et Excel sur tous les rapports

Un composant unique (`Exports`) reçoit **une seule fois** les colonnes et les lignes, et les
distribue aux trois formats :

| Format | Mise en œuvre |
|---|---|
| PDF | aperçu A4 (`ApercuDocument`) + impression navigateur |
| CSV | séparateur `;`, BOM UTF-8, guillemets échappés |
| Excel | classeur SpreadsheetML 2003 (`.xls`), en-tête coloré, nombres typés |

Écrans couverts : restaurant (par article), caisse (folios et soldes), fiches de police
(+ registre), tours de quart, stock, événements de la salle, réception du jour, bibliothèque de
documents.

### 7.12 Routes

Audit exécuté et documenté dans `docs/audits/ROUTES_2026-11.md` : 13 routes, 13 entrées de
menu, 13 permissions, aucune orpheline. L'écran courant est désormais dans l'URL (`#/stock`) —
lien direct, rafraîchissement et bouton retour fonctionnent.

---

## 8. Limites ajoutées par cette passe

| Sujet | Limite | Suite |
|---|---|---|
| Exports | `.xls` en SpreadsheetML (pas `.xlsx` OOXML) | passer à une vraie librairie serveur pour les gros volumes |
| Carte restaurant | pas de gestion des allergènes ni des menus enfants | hors périmètre 3★ |
| Changement de chambre | le supplément est calculé et tracé, pas encore répercuté sur le folio | écriture de ligne folio à brancher |
| Comptes | pas de réinitialisation de mot de passe en libre-service | parcours RH / IT |
| Référentiel pays/villes | 29 pays, villes principales seulement | référentiel complet si l'activité internationale se développe |
| Verrou tarifaire | code d'exploitation partagé en démonstration | second facteur nominatif en production |
