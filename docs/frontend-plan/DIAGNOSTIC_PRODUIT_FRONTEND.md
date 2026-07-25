# Diagnostic Produit Frontend — PMS Hôtel Makarim

## 1. Vue d'Ensemble du Diagnostic

Le frontend actuel du PMS Hôtel Makarim repose sur une base technique saine (React 19, Vite 8, TypeScript 6, Tailwind CSS v4, composants UI accessibles Shadcn/Radix/Base-UI). La couverture fonctionnelle des modules métier (18 modules) est large et directement connectée aux API réelles NestJS.

Cependant, le diagnostic produit révèle plusieurs zones de friction ergonomique, de dispersion de navigation et d'insuffisance d'interactivité au niveau du poste de travail de réception.

---

## 2. Synthèse A / B / C / D / E

```text
+---------------------------------------------------------------------------------+
|                              DIAGNOSTIC PRODUIT                                 |
+------------------------------------+--------------------------------------------+
| A. À CONSERVER                     | B. À AMÉLIORER                             |
| - Stack React + Vite + TS + Tailwind| - Ergonomie & validation des formulaires  |
| - Binding API réel (zéro mock)     | - Dashboard dynamique (Front Desk vivant)  |
| - Charte "Ardoise & Laiton"        | - Traitement des erreurs et messages UI    |
| - Authentification HTTP-Only / CSRF| - Visualisations de données réelles        |
+------------------------------------+--------------------------------------------+
| C. À RESTRUCTURER                  | D. FRONTEND UNIQUEMENT (Périmètre court)   |
| - Ordre de la navigation (Paramètres| - Layouts, modales, masques de saisie      |
|   positionné systématiquement en   | - Regroupement du menu & breadcrumbs       |
|   dernier)                         | - Graphiques Recharts sur endpoints existants|
| - Regroupement fonctionnel des     | - Composants de raccourcis d'actions       |
|   modules                          +--------------------------------------------+
|                                    | E. DÉPENDANCES BACKEND FUTURES (Incertitudes)|
|                                    | - Nouveaux endpoints d'agrégation KPI poussés|
|                                    | - WebSocket / SSE pour Push temps réel     |
|                                    | - Traitement par lots (Batch Check-in)     |
+------------------------------------+--------------------------------------------+
```

---

## 3. Analyse Détaillée par Catégorie

### A. À CONSERVER (Les Acquis Précieux)
1. **Architecture de Données & Client API** :
   - Traitement direct des requêtes HTTP via `lib/api-client.ts`.
   - Intercepteur de rafraîchissement de token JWT (`/auth/refresh`) et gestion des cookies sécurisés `SameSite=None` / `HttpOnly` avec token CSRF.
2. **Couverture des Domaines Métier** :
   - Intégration complète des vues : Réservations, Check-in/Check-out, Housekeeping, Maintenance, Clients, Entreprises, RH, Stock, Reporting, Registre de Police, Notifications, OCR et Self-checkin.
3. **Charte Visuelle & Design System** :
   - Palettes de couleurs neutres soignées (`bg-background`, `bg-card`, `text-foreground`, accents `primary`).
   - Typographie Plus Jakarta Sans + Geist, composants modaux et badges Shadcn UI.
4. **Discipline de Sécurité & RBAC** :
   - Gating d'accès aux onglets de navigation basé sur les permissions réelles de l'utilisateur (`NAV_ITEMS` filtré selon `auth/me`).

---

### B. À AMÉLIORER (Les Axes de Progrès Prioritaires)
1. **Dashboard / Front Desk Opérationnel** :
   - *Constat* : Le tableau de bord actuel se limite à 5 cartes de texte et un bouton de rafraîchissement.
   - *Amélioration* : Transformer cette page en **Poste de Commande Réception** :
     - Section d'actions rapides (Walk-In instantané, Recherche réservation, Scan CIN/Passeport).
     - File des Arrivées et Départs du jour avec badges de statut direct.
     - Grille synoptique rapide du statut physique des chambres (Disponible, Occupée, Sale, Hors service).
     - Graphique en courbes de tendance du taux d'occupation et du chiffre d'affaires sur 7/30 jours avec Recharts.

2. **Professionnalisation des Formulaires** :
   - *Constat* : Les formulaires (Walk-In, Création Client, Réservation, Maintenance) manquent de masques de saisie et de guidage visuel.
   - *Amélioration* :
     - Formateurs de champs (Téléphone au format marocain `+212 6...`, CIN/Passeport en majuscules).
     - Indicateurs clairs des champs obligatoires (`*`).
     - Feedback visuel de validation en temps réel avant soumission.
     - Messages d'erreur formulés en langage métier clair et contextualisé.

3. **Incrustation & Graphiques de Reporting** :
   - *Constat* : Les rapports financiers et statistiques RH/Stock affichent des tableaux bruts.
   - *Amélioration* : Ajouter des visuels graphiques clairs (BarChart, PieChart, LineChart) basés sur les données réelles fournies par l'API `GET /reporting/*`.

---

### C. À RESTRUCTURER (Organisation & Navigation)
1. **Positionnement du Menu "Paramètres"** :
   - *Constat actuel* : L'onglet "Paramètres" se situe au milieu du menu principal (entre Scan Identité et RH).
   - *Restructuration* : Déplacer **Paramètres** à la **toute dernière position** du menu latéral, pour consacrer le haut de la navigation aux opérations quotidiennes de réception.

2. **Séquence Logique de Navigation** :
   - Réorganiser `NAV_ITEMS` pour suivre le flux de travail naturel de l'hôtel :
     1. 📊 **Tableau de bord** (Front Desk)
     2. 📅 **Réservations** (Calendrier / Planning)
     3. 🔑 **Check-in / Séjours** (Mouvements clients & Folios)
     4. 🧹 **Housekeeping** (Ménage & Propreté)
     5. 🔧 **Maintenance** (Suivi technique)
     6. 👤 **Clients** (Fiches clients & CRM)
     7. 🏢 **Entreprises** (Comptes sociétés)
     8. 🔍 **Scan pièce d'identité** (Module OCR)
     9. 👮 **Registre de police** (Obligation légale DGSN)
     10. 👥 **RH & Pointage** (Personnel & Présences)
     11. 📦 **Stock** (Inventaire & Consommables)
     12. 📈 **Reporting** (Statistiques & Comptabilité)
     13. 🔔 **Notifications** (Journal des alertes)
     14. 📜 **Audit** (Journal d'audit)
     15. ⚙️ **Paramètres** (Configuration globale hôtel + app — **Position finale**)

3. **Regroupement Ergonomique dans "Paramètres"** :
   - Structurer la page Paramètres sous forme d'onglets internes clairs :
     - *Hôtel & Chambres* (Chambres, Types, Tarifs)
     - *Utilisateurs & Droits* (Comptes, Rôles, Permissions)
     - *Channel Manager & OTA* (Mappings Booking, Airbnb)
     - *Modèles de Notifications* (Templates SMS/Email)

---

### D. À RETRAVAILLER CÔTÉ FRONTEND SEULEMENT (Périmètre Exclusif)
- **Refonte des Layouts & Cartes** : Amélioration de l'espacement, du contraste typographique et des grilles CSS.
- **Raccourcis d'Actions & Dialogues** : Amélioration de la modalité Walk-In, du sélecteur de chambre et des boîtes de dialogue de confirmation.
- **Graphiques & Visualisations** : Exploitation des endpoints backend existants (`/dashboard/resume`, `/reporting/*`, `/reservations/*`) avec Recharts.
- **Navigation & Ordre du Sidebar** : Modification purement frontend dans `nav-items.ts` et `App.tsx`.

---

### E. INCERTITUDES OU DÉPENDANCES BACKEND FUTURES (Propositions Hors Périmètre Immédiat)
Ces éléments nécessiteraient des modifications backend et sont répertoriés à titre de propositions pour des évolutions ultérieures :
1. *Endpoint d'agrégation d'historique de chiffre d'affaires sur 30 jours* : si le frontend a besoin d'une courbe temporelle plus fine que ce que renvoie actuellement `GET /dashboard/resume` ou `GET /reporting/chiffre-affaires`.
2. *Canal WebSocket / Server-Sent Events (SSE)* : pour la mise à jour automatique en temps réel du statut des chambres sans action de rafraîchissement de l'utilisateur.
3. *Opérations par lots (Batch Check-in)* : pour effectuer le check-in simultané de groupes de clients en une seule requête API.
