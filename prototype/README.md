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
taxe), encaissements, émission de facture, check-out.

**Tarifs & paramètres** · grille 30 chambres, formules, saisons, fiscalité
(10 % hébergement et pensions, 20 % annexes), politique d'annulation.

## Profils et droits (RBAC)

Le menu de profil de la barre supérieure applique la matrice corrigée
(`docs/RBAC_MATRIX.md`, révision 2026-11) :

| Profil | Écrans | Montants | Ce que ça démontre |
|---|---|:--:|---|
| Direction | tous | oui | Supervision, clôture, tarifs |
| Réception | tableau de bord, chambres, réservations, caisse, restaurant | oui | Encaisse et fait les départs (correction R1) |
| Gouvernante | chambres | **non** | Aucune donnée de facturation (BR-HK-004) |
| Restaurateur | restaurant | oui | Rôle créé pour L3 |
| Comptable | tableau de bord, caisse, tarifs | oui | Facturation et avoirs, sans réservations |
| Maintenance | chambres | **non** | Vue technique, hors-sujet financier |

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
| Prototype rendu **fonctionnel** | état persisté (`makarim-prototype-v3`), parcours chaînés : réservation → check-in → folio → restaurant → encaissement → check-out ; clôture de journée ; housekeeping |
| **5 écrans réécrits** | Dashboard, Chambres, Réservations, Restaurant, Conférence, Caisse, Tarifs — tous alimentés par le store, aucun chiffre figé |
| **Sélecteur de profil RBAC** | 6 profils, navigation filtrée, montants masqués pour Gouvernante et Maintenance (miroir de la matrice révisée) |
| **Canaux alignés** | suppression d'« Expedia » : walk-in / direct / Booking.com, conformément au mix cible du cahier des charges |
| **Mix par canal** au tableau de bord | CA ferme par canal + comparaison à la cible 70/20/10 (BR-REP-002) |
| **Commentaires d'en-tête** | chaque fichier de `src/` documente son rôle et les règles métier (`BR-*`) qu'il matérialise |
| Fermeture des panneaux par `Échap`, toasts repositionnés | conformité aux habitudes d'un logiciel de réception |
| **Décisions de design** (RD-030) : échelle typographique à 4 paliers, piège de focus dans les modales, `aria-current` mobile | mise en œuvre de l'arbitrage rendu sur l'audit |
| **Audit de design** (voir `docs/audits/AUDIT_DESIGN_PROTOTYPE_2026-11.md`) | contrastes WCAG corrigés (6 paires), échelle typographique ramenée de 12 à 8 tailles, 3 rayons et 2 ombres tokenisés, labels associés, toasts annoncés, lien d'évitement, cibles tactiles à 36 px, capacité de salle lue dans le référentiel |

## Vérification

Build de production et parcours testés automatiquement (esbuild + jsdom) :
dashboard, check-in, housekeeping, envoi en chambre, confirmation de séminaire,
encaissement, palette ⌘K, clôture de journée — **0 erreur console**.
