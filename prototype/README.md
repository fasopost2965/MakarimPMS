# Prototype fonctionnel — PMS Hôtel Makarim 3★

Application **cliquable et fonctionnelle** de la refonte décrite dans
[`docs/audits/AUDIT_REFONTE_3_ETOILES_30_CHAMBRES.md`](../docs/audits/AUDIT_REFONTE_3_ETOILES_30_CHAMBRES.md).

> ⚠️ Ce dossier n'est **pas** un incrément de production : aucune connexion à
> l'API NestJS, aucune authentification, données locales persistées dans le
> navigateur (`localStorage`). Il sert à valider l'ergonomie, les parcours et
> les règles métier avant tout portage dans `frontend/`.

## Lancer

```bash
cd prototype
npm install
npm run dev      # http://localhost:5173
```

Le bouton ↺ de la barre supérieure (ou `⌘K` → « Réinitialiser ») remet la
démonstration dans son état initial.

## Parcours réellement fonctionnels

Les actions modifient tout le reste de l'application (plan de chambres, folios,
caisse, KPI, journal d'audit) et survivent à un rechargement de page.

| Parcours | Démonstration |
|---|---|
| **Réservation** | Nouvelle réservation → disponibilité + prix calculés en direct → bloc ajouté au planning |
| **Check-in** | Depuis le tableau de bord, le planning ou la fiche chambre → chambre occupée, folio créé (hébergement + taxe de séjour) |
| **Restaurant** | Table → carte → panier → **envoi en chambre** (écriture au folio) ou **encaissement** (espèces / carte / virement) |
| **Check-out** | Caisse → folio → encaissement → check-out débloqué à solde nul → facture émise, chambre en « à nettoyer » |
| **Housekeeping** | Valider propre, déclarer hors service, remettre en service |
| **Séminaire** | Devis (participants, format, prestations) → HT / TVA 20 % / TTC / acompte 30 % → confirmation → événement planifié + facture d'acompte |
| **Clôture de journée** | Contrôles → J+1, non-présentations enregistrées, journal remis à zéro |
| **Recherche** | Palette `⌘K` / `Ctrl+K` (navigation + actions), fermeture par `Échap` |
| **Profils RBAC** | Sélecteur en haut à droite : 6 profils, navigation filtrée, montants masqués pour la Gouvernante et la Maintenance |

## Écrans

**Tableau de bord** · KPI d'exploitation (occupation, ADR, RevPAR, CA par
activité), prévision 14 jours calculée sur les réservations réelles, plan des 30
chambres, alertes actionnables, arrivées/départs traitables en un clic, journal.

**Chambres** · plan par étage, filtres d'état, panneau de chambre (séjour, folio,
actions housekeeping).

**Réservations** · planning 14 jours × 30 chambres, filtrage par canal, création
de réservation avec contrôle de disponibilité, détail et annulation.

**Restaurant** · plan de salle, carte avec ruptures, prise de commande, envoi en
chambre, encaissement, petit-déjeuner (couverts et pensions), rapport du jour.

**Salle de conférence** · planning 7 jours × 3 créneaux, constructeur de devis,
confirmation et facturation d'acompte.

**Caisse & factures** · folios, lignes détaillées (hébergement / restaurant /
taxe), **répartition de facturation par ligne** (part entreprise / part client),
prolongation d'une nuit au compte du client, émission de deux factures
distinctes, encaissements, check-out, **régie restaurant** (ce que l'hôtel
encaisse pour le restaurant et doit lui reverser).

**Tarifs & paramètres** · **grille éditable puis publiée** (versionnée et
journalisée), coefficients de saison, forfait demi-journée, **logo et nom de
l'établissement**, **modules activables**, fiscalité et politique d'annulation.

**Connexion** · portail d'entrée : un compte par agent, rôle porté par le compte,
déconnexion depuis le menu de profil.

**Fiches de police** · registre d'hébergement : une fiche par séjour, contrôle
des champs obligatoires (pièce d'identité, naissance, nationalité), édition et
impression A4. Une fiche incomplète est signalée en rouge.

**Tours de quart** · les trois shifts de 8 h (06–14, 14–22, 22–06) : checklist
de contrôles, main courante horodatée, remarques et consignes, comptage de
caisse, clôture signée et rapport imprimable (cahier de transmission).

**Rôles & permissions** · matrice rôles × écrans paramétrable par la Direction,
avec verrous anti-lockout, aperçu de la navigation résultante et journalisation.

**Stock & minibar** · inventaire, seuils critiques, mouvements d'entrée/sortie et
consommation minibar déclarée depuis la chambre (ligne portée au folio).

**Channel manager** · connexions aux plateformes, mapping des types de chambre,
synchronisation et poussée des tarifs publiés (simulation).

**Documents & PDF** · bibliothèque des pièces imprimables du jour : factures et
notes d'hôtel (ventilation TVA), fiches de police, rapports de tournée, relevé de
régie restaurant. Aperçu A4 puis impression navigateur (« Enregistrer en PDF »).

## Profils et droits (RBAC)

Le menu de profil de la barre supérieure applique la matrice corrigée
(`docs/RBAC_MATRIX.md`, révision 2026-11) :

| Profil | Écrans | Montants | Ce que ça démontre |
|---|---|:--:|---|
| Direction | tous (13 écrans) | oui | Supervision, clôture, tarifs, **paramétrage des rôles**, stock, distribution |
| Réception | tableau de bord, chambres, réservations, caisse, restaurant, fiches de police, tours de quart, documents | oui | Encaisse et fait les départs (correction R1) |
| Gouvernante | chambres, tours de quart | **non** | Aucune donnée de facturation (BR-HK-004) |
| Restaurateur | restaurant, tours de quart | oui | Rôle créé pour L3 |
| Comptable | tableau de bord, caisse, documents, tarifs | oui | Facturation et avoirs, sans réservations |
| Maintenance | chambres, tours de quart | **non** | Vue technique, hors-sujet financier |

Ces valeurs sont désormais **paramétrables** dans l'écran « Rôles &
permissions » : le tableau ci-dessus est la matrice documentée par défaut, la
Direction peut l'ajuster (le serveur reste seul juge en production, BR-TR-004).

## Choix techniques

- React 19 + Vite + Tailwind 4, sans routeur (navigation par état, comme dans
  `frontend/src/App.tsx`).
- État applicatif centralisé (`src/store.jsx`, `useReducer`) et persisté ;
  selecteurs dérivés (`kpiDuJour`, `chambresDisponibles`, `arriveesDuJour`…).
- Design tokens dans `src/index.css` (`@theme`) : sable, bleu majorelle, terre
  cuite, safran, jade. Aucune couleur Tailwind brute dans les écrans.
- Typographies locales (`@fontsource`) : Geist pour l'interface, Marcellus pour
  les titres.
- Accessibilité : focus visible, états jamais portés par la couleur seule,
  fermeture des panneaux par `Échap`, `prefers-reduced-motion` respecté.

## Journal des changements de cette version

| Changement | Détail |
|---|---|
| Prototype rendu **fonctionnel** | état persisté (`makarim-prototype-v4`, migration depuis v3), parcours chaînés : réservation → check-in → folio → restaurant → encaissement → check-out ; clôture de journée ; housekeeping |
| **5 écrans réécrits** | Dashboard, Chambres, Réservations, Restaurant, Conférence, Caisse, Tarifs — tous alimentés par le store, aucun chiffre figé |
| **Sélecteur de profil RBAC** | 6 profils, navigation filtrée, montants masqués pour Gouvernante et Maintenance (miroir de la matrice révisée) |
| **Canaux alignés** | suppression d'« Expedia » : walk-in / direct / Booking.com, conformément au mix cible du cahier des charges |
| **Mix par canal** au tableau de bord | CA ferme par canal + comparaison à la cible 70/20/10 (BR-REP-002) |
| **Commentaires d'en-tête** | chaque fichier de `src/` documente son rôle et les règles métier (`BR-*`) qu'il matérialise |
| Fermeture des panneaux par `Échap`, toasts repositionnés | conformité aux habitudes d'un logiciel de réception |
| **Décisions de design** (RD-030) : échelle typographique à 4 paliers, piège de focus dans les modales, `aria-current` mobile | mise en œuvre de l'arbitrage rendu sur l'audit |
| **Fiche de police** | registre d'hébergement complet (identité, pièce, séjour), contrôle des champs obligatoires, édition et impression A4 (BR-CLI-003, BR-CLI-005) |
| **Documents & PDF** | factures ventilées par taux de TVA, fiches de police, rapports de tournée, relevé de régie — aperçu A4 et impression navigateur (BR-CLI-006, BR-REP-001) |
| **Rôles paramétrables** | matrice 6 rôles × 11 écrans modifiable par la Direction, verrou anti-lockout, navigation recalculée (BR-TR-004, BR-AUD-002) |
| **Tours de quart** | 3 shifts de 8 h, checklist, main courante, consignes, comptage de caisse, rapport signé (BR-RH-003/004/005) |
| **Particuliers / entreprises** | typologie de client, fiche société (ICE, conditions), incidence sur la facturation (BR-CLI-001/006) |
| **Facturation séparée** | payeur ligne par ligne, nuit supplémentaire au compte du client, deux factures société + client (BR-FAC-001, BR-SEJ-007) |
| **Régie restaurant** | notes en chambre vs encaissement direct, relevé de ce que l'hôtel doit reverser au restaurant (BR-RST-002/005) |
| **Publication de la grille** | prix éditables puis **publiés** (validation, version, journal) ; correction d'une publication qui ne s'appliquait pas (BR-TR-003) |
| **Saisons & forfaits** | coefficients éditables par saison, forfait demi-journée paramétrable |
| **Demi-journée** | matinée ou après-midi à 200 MAD, sans taxe de séjour, chambre revendable le soir |
| **No-show suivi** | bouton « Non présenté » ou clôture de journée : statut, **nuit facturée**, et **dossier de suivi** (étape, note, auteur, historique) exportable et visible dans le dossier client (BR-RES-007, RD-033) |
| **Prévision intelligente** | 14 jours recalculés sur les réservations réelles, objectif 63 %, recette estimée au survol |
| **Chronomètre de shift** | temps écoulé/restant par agent, vue globale des trois shifts pour la Direction (BR-RH-003) |
| **Stock & minibar** | inventaire, seuils, mouvements ; consommation minibar liée à la chambre et portée au folio (BR-STK-001/002) |
| **Channel manager** | connexion, mapping, synchronisation et push des tarifs (simulation) |
| **Chambres paramétrables** | création de chambre (numéro, étage, type, minibar) avec contrôle d'unicité |
| **Identité & connexion** | logo et nom de l'hôtel paramétrables, portail de connexion, **un compte par agent** |
| **Bulles d'aide** | composant accessible posé sur les notions non évidentes (no-show, régie, répartition, publication…) |
| **Carte du restaurant** | ajout, modification de prix, changement de catégorie et retrait d'un plat par la Direction ; les notes passées gardent leur libellé (journalisé) |
| **Prestations de la salle** | libellé, prix, unité et activation ; devis et formulaire de créneau se recalculent |
| **Planning de salle cliquable** | créneau libre → prise de réservation pré-remplie ; créneau occupé → confirmer ou annuler (créneau libéré) |
| **Fiche de police** | pays d'origine et ville, listes **filtrées en cascade**, risque de saisie libre ; fiche et **registre imprimables** refaits |
| **Comptes agents** | création d'un utilisateur avec rôle, activation/désactivation, changement de rôle — utilisable au portail immédiatement |
| **Prix de base verrouillés** | grille verrouillée par défaut, déverrouillage par code, **récapitulatif des écarts** avant publication |
| **Fiscalité paramétrable** | TVA hébergement / annexes / salle, taxe de séjour, plafond espèces — avec double confirmation et journalisation |
| **Changement de chambre** | motif et origine (client / hôtel), standing égal ou supérieur, chambre vérifiée libre, supplément imputé, trace complète |
| **Historique client** | dossier client : séjours, réservations, factures, changements de chambre |
| **Check-in / check-out visibles** | bloc « Réception du jour » (arrivées et départs), check-out bloqué si folio non soldé |
| **Exports PDF / CSV / Excel** | un composant unique pour tous les rapports : aperçu A4, CSV point-virgule UTF-8, classeur Excel (.xls) |
| **Routes** | l'écran courant est dans l'URL (`#/stock`), lien direct, rafraîchissement et retour navigateur — audit dans `docs/audits/ROUTES_2026-11.md` |
| **Design system Apple** (v7, `docs/audits/DESIGN_SYSTEM_APPLE_2026-11.md`) | palette sable supprimée, accent unique `#0066cc`, navigation noire, typographie SF Pro, trois rayons, une seule ombre, `scale(0.95)` au press, tirets cadratins bannis |
| **Audit de design** (voir `docs/audits/AUDIT_DESIGN_PROTOTYPE_2026-11.md`) | contrastes WCAG corrigés (6 paires), échelle typographique ramenée de 12 à 8 tailles, 3 rayons et 2 ombres tokenisés, labels associés, toasts annoncés, lien d'évitement, cibles tactiles à 36 px, capacité de salle lue dans le référentiel |

## Vérification

Build de production et parcours testés automatiquement (esbuild + jsdom) :
13 routes + portail de connexion, testées en jsdom : connexion/déconnexion, lien
profond (`#/stock`), check-in et check-out depuis la réception du jour, changement
de chambre motivé, ajout d'un plat à la carte, exports CSV et Excel, PDF du rapport
restaurant, créneau de salle réservé au clic, filtre pays → villes de la fiche de
police, déverrouillage tarifaire, publication confirmée, fiscalité enregistrée,
création d'un compte agent — **0 erreur applicative**.
