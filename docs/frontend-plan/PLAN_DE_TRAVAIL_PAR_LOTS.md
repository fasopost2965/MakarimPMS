# Plan de Travail par Lots — Reprise Frontend PMS Hôtel Makarim

## 1. Structure Globale des Lots

La reprise ergonomique et fonctionnelle du frontend est découpée en **5 lots autonomes et séquentiels**, garantissant une traçabilité totale et l'absence de régression.

```text
+-----------------------------------------------------------------------------------+
|                            FEUILLE DE ROUTE PAR LOTS                              |
+-----------------------------------------------------------------------------------+
|  LOT 1 : Navigation, Menu & Repositionnement de "Paramètres" en Dernier           |
|  LOT 2 : Poste de Commandement Front Desk & Dashboard Réception Dynamique          |
|  LOT 3 : Professionnalisation & Standardisation des Formulaires Métier            |
|  LOT 4 : Vues Opérationnelles Avancées & Graphiques de Reporting                  |
|  LOT 5 : Consolidation, Audit Qualité & Recette Transverse                        |
+-----------------------------------------------------------------------------------+
```

---

## 2. Spécification Détaillée des Lots

### ── LOT 1 : Navigation, Menu & Repositionnement de "Paramètres" en Dernier

#### Objectif
Réorganiser l'arborescence de navigation principale pour refléter le parcours métier naturel de l'hôtel, et repositionner l'onglet **Paramètres** à la **toute dernière position** du menu latéral comme espace de configuration globale.

#### Périmètre
- Repositionnement de l'ordre de `NAV_ITEMS` dans `frontend/src/components/layout/nav-items.ts`.
- Mettre l'onglet **Paramètres** en position finale (derrière Audit/Notifications).
- Regroupement clair de la navigation :
  1. Tableau de bord (Front Desk)
  2. Réservations
  3. Check-in / Séjours
  4. Housekeeping
  5. Maintenance
  6. Clients
  7. Entreprises
  8. Scan pièce d'identité
  9. Registre de police
  10. RH
  11. Stock
  12. Reporting
  13. Notifications
  14. Audit
  15. **Paramètres** (Dernier)
- Clarté de la page `ParametersPage.tsx` organisée en sous-onglets logiques (Configuration Hôtel, Utilisateurs & Rôles, Mappings Channel Manager, Modèles de Notifications).

#### Fichiers ou Zones Impactées
- `frontend/src/components/layout/nav-items.ts`
- `frontend/src/components/layout/AppSidebar.tsx`
- `frontend/src/App.tsx`
- `frontend/src/features/parameters/pages/ParametersPage.tsx`

#### Risques
- *Risque* : Rupture de permission RBAC lors de la réorganisation.
- *Mitigation* : Conserver les clés de permission exactes (`parameters:read`, `reservations:read`, etc.) associées à chaque élément de menu.

#### Critères de Fin
- L'onglet **Paramètres** apparaît systématiquement tout en bas du menu latéral.
- La navigation suit l'ordre métier exact défini dans le périmètre.
- La page Paramètres permet de basculer facilement entre la configuration hôtel, les utilisateurs et le channel manager.

#### Stratégie de Vérification
- Connexion avec un rôle administrateur : vérifier la présence de Paramètres en dernier.
- Connexion avec un rôle réceptionniste (sans droit `parameters:read`) : vérifier que l'onglet Paramètres est correctement masqué sans altérer le reste du menu.
- Linter et build frontend valides (`npm run lint`, `npm run build`).

#### Compte-Rendu Attendu
Note de livraison du Lot 1 confirmant l'ordre exact du menu et la disposition de la page Paramètres.

---

### ── LOT 2 : Poste de Commandement Front Desk & Dashboard Réception Dynamique

#### Objectif
Transformer le tableau de bord statique actuel en un véritable **Poste de Commande Réception**, vivant, interactif et directement exploitable par la réceptionniste.

#### Périmètre
- **Barre d'Actions Rapides Réception** : Boutons d'accès direct à *Nouveau Walk-In*, *Rechercher Réservation*, *Scan Pièce d'Identité*, *Pointer Présence RH*.
- **Baromètre de Caisse & Statuts Clés** : Taux d'occupation, Arrivées attendues, Départs prévus, Chambres à nettoyer, Chambres occupées.
- **Queue des Mouvements du Jour** : Tableau à deux onglets (Arrivées du jour / Départs du jour) avec statut de paiement du folio, badge de Fiche Police et bouton de Check-In/Check-Out direct.
- **Synoptique Rapide des Chambres (Mini-Rack)** : Grille visuelle avec badges de couleur normalisés (Occupée, Propre, Sale, Maintenance).
- **Graphique de Tendance (Recharts)** : Courbe d'évolution du taux d'occupation et du chiffre d'affaires basée sur les données réelles de l'API.

#### Fichiers ou Zones Impactées
- `frontend/src/features/dashboard/pages/DashboardPage.tsx`
- `frontend/src/features/dashboard/api/index.ts`
- `frontend/src/features/dashboard/components/*` (nouveaux sous-composants dédiés)

#### Risques
- *Risque* : Ralentissement du chargement par multiplication de requêtes API parallèles.
- *Mitigation* : Utiliser `Promise.all` sur les endpoints existants (`/dashboard/resume`, `/reservations/arrivals-today`, `/checkin/stays-en-cours`, `/housekeeping/rooms`) avec état de chargement unifié.

#### Critères de Fin
- Le Dashboard affiche le statut réel des chambres, les arrivées/départs du jour et la tendance sans aucune donnée fictive.
- Les clics sur la queue d'arrivées ouvrent directement la modal de check-in ou le détail du séjour.
- Le bouton "Nouveau Walk-In" déclenche la modal de création/check-in direct.

#### Stratégie de Vérification
- Tester le chargement de la page avec et sans réservations au calendrier.
- Tester la redirection depuis les raccourcis d'actions vers les pages dédiées.
- Vérifier la réactivité lors des changements d'état des chambres.

#### Compte-Rendu Attendu
Compte-rendu du Lot 2 décrivant le layout du poste de commande Front Desk, les composants intégrés et les métriques réelles connectées.

---

### ── LOT 3 : Professionnalisation & Standardisation des Formulaires Métier

#### Objectif
Élever la qualité ergonomique et la fiabilité de la saisie sur tous les formulaires clés du PMS en instaurant des règles de validation strictes, des masques de saisie et des retours d'erreur explicites.

#### Périmètre
- **Standardisation des Formulaires** :
  - Formulaire de création de Réservation / Walk-In (`WalkinCheckinDialog.tsx`, `CreateReservationDialog.tsx`).
  - Formulaire de création/édition Client & Fiche Police (`GuestForm.tsx`, `PoliceModal.tsx`).
  - Formulaire de création d'Intervention Maintenance (`CreateInterventionDialog.tsx`).
- **Composants & Helpers de Saisie** :
  - Masque et formatage du numéro de téléphone (international / marocain `+212 ...`).
  - Auto-majuscule sur les numéros de pièce d'identité (CIN / Passeport).
  - Validation automatique de la cohérence des dates (Date départ > Date arrivée).
  - Affichage systématique des astérisques d'obligation (`*`) et aides contextuelles en info-bulle.
- **Gestion des Erreurs Formulaire** :
  - Messages d'erreur ciblés sous le champ concerné au lieu d'une alerte globale confuse.

#### Fichiers ou Zones Impactées
- `frontend/src/features/checkin/components/WalkinCheckinDialog.tsx`
- `frontend/src/features/reservations/components/CreateReservationDialog.tsx`
- `frontend/src/features/guests/components/GuestForm.tsx`
- `frontend/src/features/police/components/PoliceModal.tsx`
- `frontend/src/components/ui/input.tsx` (ou helpers de masques dédiés)

#### Risques
- *Risque* : Blocage indésirable de la soumission si un masque est trop rigide pour les passeports étrangers.
- *Mitigation* : Assurer la tolérance aux formats internationaux tout en forçant la majuscule et la suppression des espaces superflus.

#### Critères de Fin
- Aucun formulaire ne permet de soumettre des dates incohérentes.
- Les champs obligatoires sont clairement identifiés visuellement.
- Les erreurs renvoyées par l'API backend (ex: conflit de surréservation, CIN en double) s'affichent de façon explicite sous le composant.

#### Stratégie de Vérification
- Tenter la soumission de formulaires incomplets ou invalides et vérifier l'affichage des erreurs.
- Effectuer la création complète d'un client et d'un Walk-In pour valider la rapidité de saisie.

#### Compte-Rendu Attendu
Rapport du Lot 3 récapitulant les formulaires mis aux normes et les règles de validation appliquées.

---

### ── LOT 4 : Vues Opérationnelles Avancées & Graphiques de Reporting

#### Objectif
Rendre plus visuelles, intuitives et informatives les vues de gestion quotidienne (Housekeeping, Reporting financier, Registre de Police).

#### Périmètre
- **Rack Interactif Housekeeping** :
  - Vue synoptique filtrable par étage (Rez-de-chaussée, 1er, 2ème) et par statut.
  - Bascule rapide d'état d'une chambre (Sale → En nettoyage → Propre → Inspectée) en un clic avec mise à jour immédiate.
- **Visualisations du Module Reporting** :
  - Intégration de graphiques Recharts (Chiffre d'affaires par mode de paiement, Taux d'occupation mensuel, Répartition des types de chambres).
  - Présentation claire des chiffres clés (RevPAR, ADR, Total Encaissé, Solde Folio Ouvert).
- **Optimisation de la Vue Registre de Police** :
  - Indicateur visuel du taux de conformité des fiches de police du jour (ex: "8/10 clients enregistrés DGSN").
  - Filtre rapide "Fiches de police manquantes".

#### Fichiers ou Zones Impactées
- `frontend/src/features/housekeeping/pages/HousekeepingPage.tsx`
- `frontend/src/features/reporting/pages/ReportingPage.tsx`
- `frontend/src/features/police/pages/PolicePage.tsx`

#### Risques
- *Risque* : Surcharge visuelle sur la page Reporting si trop de graphiques sont affichés en même temps.
- *Mitigation* : Structurer le reporting par onglets thématiques (Activité & Occupation, Chiffre d'affaires & Encaissements, Main-d'œuvre & RH).

#### Critères de Fin
- La gouvernante peut changer le statut d'une chambre directement depuis le rack visuel.
- La page Reporting affiche des graphiques clairs et lisibles basés sur les données réelles de l'API.
- Le registre de police met immédiatement en évidence les séjours nécessitant une régularisation DGSN.

#### Stratégie de Vérification
- Changer le statut d'une chambre dans Housekeeping et vérifier sa répercussion instantanée sur le Dashboard.
- Consulter le reporting sur plusieurs plages de dates pour s'assurer de la bonne réactivité des graphiques.

#### Compte-Rendu Attendu
Documentation du Lot 4 décrivant le rack Housekeeping, les graphiques Recharts et l'ergonomie du Registre de Police.

---

### ── LOT 5 : Consolidation, Audit Qualité & Recette Transverse

#### Objectif
Valider la cohérence globale de l'application, l'homogénéité des états d'interface (chargement, erreur, état vide), la conformité aux exigences UX et la robustesse du build avant clôture.

#### Périmètre
- **Vérification Transverse des États UI** :
  - S'assurer que chaque écran possède un indicateur de chargement propre et un état vide explicite.
  - Vérifier l'interception et le traitement d'erreur homogène via les Toasts et Error Boundaries.
- **Contrôle d'Accessibilité & Densité** :
  - Vérifier le comportement responsive sur écran fixe de réception (1920x1080) et ordinateur portable (1366x768).
  - Valider la lisibilité des contrastes selon la charte « Ardoise & Laiton ».
- **Validation Technique & Compilation** :
  - Validation du linter (`npm run lint`).
  - Validation de la compilation sans erreur (`npm run build`).
  - Redémarrage et test du dev server.

#### Fichiers ou Zones Impactées
- L'ensemble du répertoire `frontend/src/`.

#### Risques
- *Risque* : Présence de régressions ou d'avertissements TypeScript / Linter non détectés.
- *Mitigation* : Exécution systématique des commandes de contrôle du monorepo (`npm run lint` et `npm run build`).

#### Critères de Fin
- 0 erreur linter.
- 0 erreur de compilation TypeScript/Vite.
- Application fluide et réactive sur tous les modules.

#### Stratégie de Vérification
- Audit complet avec les scripts du projet : `npm run lint` (linter backend & frontend) et `npm run build` (builds TypeScript & Vite frontend/backend).
- Parcours utilisateur complet : Authentification → Dashboard → Réservation → Walk-In → Check-in → Housekeeping → Police → Reporting → Paramètres.

#### Compte-Rendu Attendu
Compte-rendu final de synthèse confirmant la validation de l'ensemble de la feuille de route frontend.
