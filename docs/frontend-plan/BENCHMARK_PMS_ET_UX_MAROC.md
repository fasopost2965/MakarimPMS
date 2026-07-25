# Benchmark PMS de Référence et Standards UX Hôtellerie Maroc — Makarim PMS

## 1. Objectif du Benchmark

Ce benchmark raisonné compare les pratiques d'interface du frontend **Makarim PMS** à trois systèmes de gestion hôtelière (PMS) leaders sur le marché mondial (**Oracle OPERA Cloud**, **Cloudbeds**, **Mews**) ainsi qu'aux contraintes opérationnelles spécifiques aux établissements hôteliers au Maroc (3 étoiles, 24 chambres).

L'objectif n'est pas de copier un logiciel tiers, mais d'en dériver des principes d'ergonomie, de rapidité de saisie et de clarté visuelle applicables au poste de travail de l'Hôtel Makarim.

---

## 2. Matrice Comparative des Standards PMS

| Dimension UX / Fonctionnelle | Oracle OPERA Cloud | Cloudbeds | Mews Commander | Makarim PMS (Actuel) | Standard Cible Makarim |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Front Desk / Dashboard** | Vue d'ensemble opérationnelle avec compteurs cliquables, arrivées du jour, départs, et accès rapide aux profils. | Queue d'arrivées/départs interactive avec barre de recherche globale et statut de paiement visuel. | Timeline/Planning des chambres interactif direct, cartes d'action rapides et flux d'enregistrement par étape. | Grille de 5 cartes KPI textuelles statiques, sans liste d'action ni statut direct des chambres. | **Poste de commande dynamique** : KPI réels + file d'arrivées/départs du jour + mini-rack des chambres + raccourcis Walk-In/Check-In. |
| **Formulaires de Saisie** | Formulaires denses, à onglets et raccourcis clavier, orientés saisie rapide par code. | Formulaires guidés étape par étape (Step Wizards) avec auto-complétion et validation immédiate. | Formulaires modernes à champs auto-sauvegardés, scanner de document intégré, recherche instantanée. | Formulaires modals standard sans masques de saisie ni guidage fort de validation. | **Formulaires professionnels** : validation explicite, masques de saisie (téléphone/CIN/Passeport), aides contextuelles, retour d'erreur ciblé. |
| **Gestion du Housekeeping** | Grille d'état des chambres avec filtres par étage, type et statut d'inspection. | Matrice visuelle par blocs de couleur (Propre/Sale/Occupée/Libre) modifiable en un clic. | Task manager pour gouvernante, assignation d'agents et synchronisation temps réel. | Tableau de cartes de chambres avec filtres et changement de statut via boutons. | **Rack interactif des chambres** : vue synoptique par étage/type, badges de couleur normalisés, bascule de statut fluide. |
| **Organisation du Menu** | Barre latérale avec sous-menus profonds hiérarchisés par département. | Menu latéral rétractable épuré : Dashboard, Calendrier, Réservations, Guests, Reports, Settings. | Navigation par domaines opérationnels (Stay, Finance, Space, Space category, Settings). | Menu latéral mélangeant exploitation, RH, stock, OCR et paramètres au milieu du tableau. | **Ordre opérationnel logique** : Tableau de bord → Réservations → Check-in/Séjours → Housekeeping → Maintenance → Clients → Entreprises → RH → Stock → Reporting → Audit → **Paramètres (en dernier)**. |
| **Saisie Pièce d'Identité & Fiche Police** | Saisie manuelle structurée + intégration scanner passeport optique. | Téléchargement de document + saisie guidée des informations de séjour. | Scan QR/OCR sur smartphone du client ou tablette de réception. | Module OCR de pièces d'identité + modal de registre de police dédié (DGSN). | **Flux intégré de réception** : Scan OCR pré-remplissant la fiche client + vérification rapide du Registre de Police obligatoire. |

---

## 3. Spécificités & Standards UX de l'Hôtellerie au Maroc

L'exploitation d'un hôtel 3 étoiles à Tétouan impose des contraintes ergonomiques et réglementaires bien particulières :

1. **Obligation Légale de la Fiche de Police (DGSN / Ministère de l'Intérieur)** :
   - Tout client hébergé (national ou étranger) doit être enregistré avec des informations d'identité précises (CIN pour les Marocains, Passeport + Visa pour les étrangers, date de naissance, profession, provenance, destination).
   - *Impact UX* : Le bouton et le statut d'enregistrement du Registre de Police doivent être visibles immédiatement lors du Check-in et sur la fiche de séjour.

2. **Flux d'Arrivée Directe (Walk-In) & Rapidité en Réception** :
   - Les clients se présentant sans réservation préalable représentent une part significative des nuitées.
   - *Impact UX* : Le bouton "Nouveau Walk-In" doit être accessible en un clic depuis le Dashboard principal, ouvrant un formulaire fluide (Sélection chambre → Tarif → Création/Sélection client → Encaissement acompte → Check-in immédiat).

3. **Format Monétaire et Règlements de Caisse** :
   - Monnaie locale : **Dirham Marocain (MAD / DH)**.
   - Les paiements s'effectuent fréquemment en espèces (fond de caisse), TPE monétique (Carte bancaire CMI/Visa/Mastercard) ou virement/chèque d'entreprise (City Ledger).
   - *Impact UX* : Séparation explicite du mode de règlement lors des encaissements d'acomptes et clôtures de folio avec calcul automatique du rendu de monnaie.

4. **Multi-Tarification & Exonérations de Taxes** :
   - Application de la Taxe de Séjour / Taxe de Promotion Touristique (TPT) selon les arrêtés municipaux.
   - *Impact UX* : Clarté dans le calcul du folio avec détail du tarif nuitée HT, TVA, TPT et acomptes déjà versés.

---

## 4. Synthèse des Principes Dérivés pour Makarim PMS

1. **Principes Visuels & Ergonomiques** :
   - Adopter un système de carte/pannel avec une hiérarchie typographique forte.
   - Préférer la densité d'information utile à l'espacement excessif sur les postes de travail fixe de réception.
   - Utiliser des codes couleur normalisés pour le statut des chambres :
     - 🟢 **Propre / Disponible** (`bg-emerald-500/10 text-emerald-600 border-emerald-500/20`)
     - 🔴 **Occupée / Non disponible** (`bg-rose-500/10 text-rose-600 border-rose-500/20`)
     - 🟡 **Sale / À nettoyer** (`bg-amber-500/10 text-amber-600 border-amber-500/20`)
     - 🔵 **Inspectée / Validée** (`bg-sky-500/10 text-sky-600 border-sky-500/20`)
     - ⚪ **Hors service / Maintenance** (`bg-slate-500/10 text-slate-600 border-slate-500/20`)

2. **Principes d'Interaction** :
   - **Zero-Dead-End** : Tout indicateur ou carte KPI du Dashboard doit permettre de naviguer vers la liste filtrée correspondante ou d'ouvrir le détail par un clic.
   - **Retour d'État Instantané** : Toute action mutante (check-in, nettoyage, enregistrement police) doit afficher une confirmation Toast claire et mettre à jour le composant sans rechargement complet de la page.
