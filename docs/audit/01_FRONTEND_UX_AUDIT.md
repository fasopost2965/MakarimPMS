# Audit UX et fonctionnel du frontend

**Projet :** Makarim PMS
**Document :** Audit UX et fonctionnel du frontend
**Version :** 0.2
**Statut :** En revue
**Nature du document :** Audit et orientations produit
**Autorité d’exécution :** Aucune recommandation de ce document ne constitue à elle seule une autorisation d’implémentation.
**Date de création :** 1er août 2026
**Référence Git auditée :** à confirmer au moment de la consolidation finale
**Document de référence architecture :** `03_ARCHITECTURE_DESIGN.md`
**Document de référence backend :** `33_BACKEND_ARCHITECTURE.md`

---
## Règle d’interprétation

Les éléments de ce document sont classés selon quatre niveaux :

- **Constat d’audit** : observation factuelle sur l’état actuel ;
- **Recommandation** : amélioration proposée, non encore autorisée ;
- **Décision validée** : orientation métier ou architecturale approuvée ;
- **Évolution autorisée** : tâche explicitement validée pour implémentation dans un sprint.

Une décision validée ne vaut pas automatiquement autorisation de développement.

Toute implémentation nécessite une demande explicite du Product Owner, une analyse d’impact et, lorsque nécessaire, une validation de l’Architecte.
---

## Historique du document

| Version | Date | Auteur | Description |
|---|---|---|---|
| 0.1 | 01/08/2026 | Équipe projet Makarim PMS | Création du document maître d’audit frontend |
| 0.2 | 01/08/2026 | Équipe projet Makarim PMS | Clarification du statut des recommandations et consolidation éditoriale du document |

---

# 1. Présentation

## 1.1 Contexte

Makarim PMS est un système de gestion hôtelière développé pour répondre aux besoins opérationnels d’un établissement réel.

Le projet couvre progressivement les principaux processus de l’exploitation hôtelière :

- gestion des réservations ;
- gestion des chambres ;
- gestion des clients et des entreprises ;
- check-in et check-out ;
- gestion des folios ;
- facturation et paiements ;
- housekeeping ;
- maintenance ;
- restauration ;
- gestion des stocks ;
- achats fournisseurs ;
- ressources humaines ;
- reporting ;
- notifications ;
- paramètres de l’établissement ;
- journal d’audit.

Le produit repose sur une architecture moderne composée notamment de :

- React ;
- Vite ;
- TypeScript ;
- NestJS ;
- Prisma ;
- MySQL ;
- Redis ;
- Docker ;
- Nginx ;
- un déploiement sur VPS Linux.

L’objectif du projet n’est pas uniquement de fournir une application fonctionnelle. Makarim PMS doit devenir une plateforme stable, cohérente, maintenable et adaptée aux contraintes réelles de l’Hôtel Makarim.

---

## 1.2 Objectif de l’audit

Le présent document constitue le rapport maître de l’audit UX, fonctionnel et métier du frontend de Makarim PMS.

L’audit poursuit les objectifs suivants :

- évaluer la qualité fonctionnelle de chaque écran ;
- vérifier la cohérence de l’expérience utilisateur ;
- comparer l’interface avec les processus réels d’un hôtel ;
- identifier les écarts entre le frontend et les capacités du backend ;
- détecter les anomalies techniques visibles depuis l’interface ;
- examiner la qualité du responsive desktop et mobile ;
- relever les dettes UX et métier ;
- constituer un backlog d’améliorations priorisé ;
- préparer les futurs cycles de développement sans remettre en cause l’architecture existante.

L’audit ne constitue pas une demande de refonte globale.

Il doit permettre une évolution incrémentale, sûre et maîtrisée du produit.

---

## 1.3 Périmètre de l’audit

L’audit couvre les principaux écrans et parcours accessibles dans la version déployée du frontend.

Les modules examinés comprennent notamment :

- Authentification ;
- Dashboard ;
- Clients ;
- Entreprises ;
- Réservations ;
- Chambres ;
- Check-in ;
- Housekeeping ;
- Maintenance ;
- Restaurant ;
- Stock ;
- Bons de commande fournisseurs ;
- Ressources humaines ;
- Notifications ;
- Paramètres ;
- Reporting ;
- Audit.

Chaque module est évalué selon plusieurs axes :

- cohérence métier ;
- couverture fonctionnelle ;
- ergonomie ;
- lisibilité ;
- cohérence graphique ;
- responsive ;
- gestion des états vides ;
- gestion des erreurs ;
- sécurité des actions sensibles ;
- cohérence avec les API et le backend.

---

## 1.4 Méthodologie

L’audit a été réalisé selon une approche progressive, module par module.

### 1.4.1 Analyse documentaire

Les documents disponibles dans le dépôt ont été examinés afin d’identifier :

- les spécifications fonctionnelles ;
- les règles métier ;
- les décisions d’architecture ;
- les design handoffs ;
- les objectifs de chaque écran ;
- les contraintes de déploiement.

Les principales sources examinées comprennent notamment :

- les documents du dossier `docs` ;
- les documents d’architecture ;
- les registres de décisions ;
- les documents d’exécution ;
- les maquettes au format `.dc.html` ;
- les README associés aux lots de design.

### 1.4.2 Analyse du code

L’analyse a porté sur :

- les composants React ;
- les pages fonctionnelles ;
- les composants UI partagés ;
- les appels API ;
- les types TypeScript ;
- les contrôleurs backend ;
- les services backend ;
- les DTO ;
- les modèles Prisma ;
- les migrations pertinentes ;
- les permissions RBAC ;
- les tests existants.

### 1.4.3 Vérification fonctionnelle

Les parcours ont été vérifiés sur l’environnement déployé :

- authentification ;
- navigation ;
- affichage des listes ;
- ouverture des dialogues ;
- formulaires ;
- états vides ;
- erreurs HTTP ;
- permissions ;
- comportements desktop ;
- comportements mobile.

### 1.4.4 Audit visuel automatisé

Des runners Playwright ont été créés afin de produire, pour chaque module :

- des captures desktop ;
- des captures mobile ;
- un rapport JSON ;
- les erreurs de console ;
- les erreurs JavaScript ;
- les requêtes échouées ;
- les réponses HTTP en erreur.

Ces campagnes ont permis d’obtenir une base factuelle pour l’évaluation UX et responsive.

### 1.4.5 Validation métier

Les écrans n’ont pas été évalués uniquement selon leur apparence.

Ils ont été comparés aux besoins opérationnels réels de l’Hôtel Makarim, notamment pour :

- la réception ;
- les réservations ;
- les séjours ;
- le ménage ;
- la maintenance ;
- l’économat ;
- les achats ;
- la restauration ;
- les ressources humaines ;
- la direction.

---

## 1.5 Environnement audité

### Frontend

- React ;
- TypeScript ;
- Vite ;
- composants UI réutilisables ;
- Vitest ;
- Testing Library ;
- Playwright pour les campagnes d’audit visuel.

### Backend

- NestJS ;
- Prisma ORM ;
- MySQL ;
- Redis ;
- authentification JWT ;
- cookies HttpOnly ;
- protection CSRF ;
- RBAC ;
- journal d’audit.

### Infrastructure

- Ubuntu 24.04 LTS ;
- Docker Compose ;
- Nginx ;
- Certbot ;
- VPS Hostinger ;
- HTTPS actif.

### Adresses fonctionnelles

- Frontend PMS : `https://pms.hotelmakarim.cloud`
- API : `https://api.hotelmakarim.cloud`
- Domaine principal : `https://hotelmakarim.cloud`

---

## 1.6 Version auditée

L’audit a été réalisé sur la branche principale du dépôt :

```text
main
```

# 2. Vision produit

## 2.1 Finalité de Makarim PMS

Makarim PMS est conçu comme le système central de gestion opérationnelle de l’Hôtel Makarim.

Sa finalité est de regrouper, dans une interface cohérente et sécurisée, les processus nécessaires au fonctionnement quotidien de l’établissement :

- commercialisation et gestion des chambres ;
- gestion des réservations ;
- accueil et suivi des clients ;
- check-in et check-out ;
- facturation et encaissement ;
- housekeeping ;
- maintenance ;
- restauration imputée aux séjours ;
- gestion de l’économat et des stocks ;
- achats fournisseurs ;
- ressources humaines ;
- reporting opérationnel et financier ;
- paramétrage de l’établissement ;
- audit et traçabilité.

Le produit ne doit pas être réduit à une juxtaposition d’écrans administratifs. Il doit accompagner les équipes dans leurs tâches quotidiennes, limiter les erreurs et fournir à la direction une information fiable.

---

## 2.2 Positionnement du produit

Makarim PMS est actuellement un PMS hôtelier mono-établissement, développé pour répondre en priorité aux besoins réels de l’Hôtel Makarim à Tétouan.

Le produit doit rester :

- adapté aux pratiques locales ;
- compatible avec la fiscalité et les documents administratifs marocains ;
- utilisable par des équipes aux profils techniques variés ;
- suffisamment simple pour les opérations courantes ;
- suffisamment rigoureux pour la comptabilité, l’audit et la direction ;
- évolutif vers de futurs outils spécialisés.

Le domaine principal `hotelmakarim.cloud` pourra servir de portail vers plusieurs applications complémentaires.

L’organisation cible peut notamment comprendre :

- `pms.hotelmakarim.cloud` pour le PMS ;
- `api.hotelmakarim.cloud` pour l’API ;
- ultérieurement `pos.hotelmakarim.cloud` pour un POS restaurant autonome ;
- d’autres sous-domaines pour de futurs outils métier.

---

## 2.3 Principes fonctionnels

### Source de vérité unique

Les informations structurantes doivent être maintenues dans un référentiel unique.

Cela concerne notamment :

- les clients ;
- les entreprises ;
- les chambres ;
- les types de chambre ;
- les réservations ;
- les séjours ;
- les folios ;
- les factures ;
- les paiements ;
- les employés ;
- les articles de stock ;
- les fournisseurs.

Une donnée métier ne doit pas être dupliquée uniquement pour simplifier un écran.

### Cohérence entre les modules

Les modules doivent partager les mêmes données et respecter leurs responsabilités respectives.

Exemples :

- Réservations détermine l’occupation future ;
- Check-in transforme une réservation en séjour ;
- Housekeeping gère les états de propreté ;
- Maintenance bloque une chambre lorsqu’une intervention l’exige ;
- Restaurant impute des consommations au folio ;
- Stock trace les mouvements physiques ;
- Achats prépare l’approvisionnement ;
- Facturation consolide les sommes dues.

### Protection des opérations sensibles

Les opérations ayant un impact financier, juridique ou opérationnel doivent être sécurisées.

Cela concerne notamment :

- annulation ;
- suppression ;
- correction ;
- changement de catégorie client ;
- blacklist ;
- check-out forcé ;
- correction de folio ;
- validation de paie ;
- validation ou annulation d’un bon de commande ;
- ajustement rétroactif du pointage.

Ces opérations doivent utiliser, selon le contexte :

- une permission dédiée ;
- une confirmation explicite ;
- un motif obligatoire ;
- une trace d’audit ;
- une transaction atomique côté backend.

---

## 2.4 Principes d’expérience utilisateur

### Priorité au métier

L’interface doit refléter le vocabulaire et les processus des utilisateurs réels :

- réceptionniste ;
- gouvernante ;
- personnel de chambre ;
- technicien ;
- magasinier ;
- restaurateur ;
- comptable ;
- responsable RH ;
- direction.

Les identifiants techniques, valeurs d’énumération et concepts internes ne doivent pas être exposés lorsqu’un libellé métier compréhensible existe.

### Réduction des erreurs

L’interface doit prévenir les erreurs plutôt que les signaler uniquement après l’envoi au serveur.

Elle doit notamment :

- filtrer les choix impossibles ;
- afficher les disponibilités réelles ;
- calculer les montants automatiquement ;
- présenter les conséquences d’une action ;
- confirmer les opérations sensibles ;
- guider l’utilisateur vers la résolution d’un blocage.

Le backend reste néanmoins l’autorité finale pour la validation des règles métier.

### Rapidité d’exécution

Les tâches récurrentes doivent pouvoir être réalisées avec un nombre limité d’actions.

Cette exigence est particulièrement importante pour :

- création d’une réservation ;
- check-in ;
- check-out ;
- encaissement ;
- changement d’état d’une chambre ;
- création d’un ticket de maintenance ;
- sortie de stock ;
- imputation d’une consommation ;
- pointage.

### États explicites

Chaque écran doit gérer clairement :

- chargement ;
- absence de données ;
- erreur ;
- succès ;
- action interdite ;
- conflit métier ;
- indisponibilité temporaire.

Les états vides doivent expliquer la situation et proposer une action utile lorsque cela est pertinent.

---

## 2.5 Principes visuels

L’interface doit conserver une identité cohérente sur l’ensemble du PMS.

Les composants partagés doivent être privilégiés pour :

- boutons ;
- champs ;
- sélecteurs ;
- tableaux ;
- cartes ;
- badges ;
- dialogues ;
- onglets ;
- notifications ;
- formulaires ;
- états vides ;
- chargements.

Les couleurs doivent transmettre une information stable :

- vert : état normal, disponible ou validé ;
- orange : attention ou attente ;
- rouge : erreur, blocage, urgence ou action destructive ;
- bleu ou couleur primaire : navigation et action principale ;
- gris : information secondaire ou état inactif.

La couleur ne doit jamais être le seul moyen de transmettre une information.

---

## 2.6 Responsive et mobilité

Le frontend doit être utilisable sur ordinateur, tablette et mobile.

Le responsive ne doit pas se limiter à réduire la largeur des composants desktop.

Les usages mobiles doivent tenir compte du contexte terrain :

- housekeeping dans les étages ;
- maintenance dans les chambres et zones communes ;
- consultation rapide des clients ;
- changement de statut ;
- recherche de chambre ;
- consultation d’une réservation ;
- pointage du personnel.

Sur mobile, les tableaux larges doivent être remplacés, lorsque nécessaire, par :

- cartes ;
- listes synthétiques ;
- groupes repliables ;
- actions tactiles ;
- filtres persistants ;
- formulaires plein écran.

---

## 2.7 Accessibilité

Les évolutions doivent préserver et améliorer :

- navigation au clavier ;
- focus visible ;
- structure sémantique ;
- libellés de formulaire ;
- contraste ;
- messages d’erreur associés aux champs ;
- dialogues accessibles ;
- taille des zones tactiles ;
- compatibilité avec les technologies d’assistance.

L’accessibilité est une exigence de qualité, et non une finition optionnelle.

---

## 2.8 Règles métier validées pour l’Hôtel Makarim

### Informations de l’établissement

Les informations actuellement communiquées sont :

- **Adresse :** Quartier Al Wiqaya, BP 93020, Tétouan, Maroc ;
- **Téléphones :** +212 539 969 602 / +212 539 713 469 ;
- **E-mail :** contact@hotel-makarim-tetouan.com ;
- **Site web :** www.hotel-makarim-tetouan.com ;
- **RC :** 25149 ;
- **ICE :** 00227002000083 ;
- **CNSS :** 1322850.

Ces informations doivent rester modifiables depuis la configuration de l’établissement et ne doivent pas être codées en dur dans les composants.

### Tarification

Les règles validées sont les suivantes :

- les tarifs affichés au client sont TTC ;
- le petit-déjeuner est compris dans le tarif de la chambre ;
- le petit-déjeuner ne doit pas être présenté comme une option ajoutée automatiquement ;
- deux grilles tarifaires ou périodes saisonnières doivent pouvoir être appliquées ;
- la ventilation interne du tarif doit rester disponible pour la facturation et le reporting.

Exemple communiqué pour un tarif TTC de 400 MAD :

| Composante | Montant |
|---|---:|
| Hébergement | 350,70 MAD |
| Petit-déjeuner | 45,00 MAD |
| TPT | 1,00 MAD |
| Taxe de séjour | 3,30 MAD |
| **Total TTC** | **400,00 MAD** |

Cette ventilation constitue un exemple métier validé. Sa généralisation technique doit être vérifiée avec la configuration fiscale, les types de chambre et les périodes tarifaires.

---

## 2.9 Architecture produit cible

Makarim PMS doit rester modulaire.

Le PMS central conserve la responsabilité de :

- la chambre ;
- la réservation ;
- le séjour ;
- le client ;
- le folio ;
- la facture ;
- le paiement ;
- la disponibilité ;
- les paramètres de l’hôtel.

Les outils spécialisés pourront évoluer séparément lorsqu’un périmètre devient suffisamment complexe.

Le futur POS Restaurant, par exemple, pourra gérer :

- produits ;
- tables ;
- commandes ;
- cuisine ;
- bar ;
- serveurs ;
- paiements directs ;
- recettes et consommation de stock.

Le PMS recevra alors uniquement les données nécessaires à l’exploitation hôtelière :

- imputation sur une chambre ;
- règlement ;
- rapprochement ;
- facture consolidée ;
- reporting.

Cette séparation évite de transformer le PMS en application monolithique difficile à maintenir.

---

## 2.10 Stratégie d’évolution

L’évolution du produit doit suivre quatre niveaux.

### Niveau 1 — Stabilisation

- corriger les anomalies ;
- supprimer les appels API invalides ;
- fiabiliser les règles de prix ;
- compléter les contrôles ;
- renforcer les tests.

### Niveau 2 — Amélioration UX

- simplifier les parcours ;
- enrichir les états ;
- améliorer le mobile ;
- harmoniser les composants ;
- rendre les écrans plus opérationnels.

### Niveau 3 — Enrichissement métier

- affectations housekeeping ;
- workflow maintenance ;
- réception fournisseur ;
- inventaires ;
- dossiers employés ;
- catalogue restaurant ;
- reporting enrichi.

### Niveau 4 — Extensions spécialisées

- POS autonome ;
- channel manager avancé ;
- revenue management ;
- CRM étendu ;
- multi-établissement ;
- business intelligence ;
- applications terrain dédiées.

Chaque niveau doit être engagé uniquement lorsque le niveau précédent est suffisamment stable.

---

## 2.11 Gouvernance des évolutions

Toute évolution doit suivre le cycle suivant :

1. identification du besoin ;
2. validation métier ;
3. analyse d’impact ;
4. décision d’architecture si nécessaire ;
5. implémentation sur une branche dédiée ;
6. tests ;
7. revue de code ;
8. validation fonctionnelle ;
9. mise à jour documentaire ;
10. déploiement contrôlé.

L’objectif n’est pas d’empêcher l’évolution du produit, mais de la rendre prévisible, testable et traçable.

# 3. Résumé exécutif

## 3.1 Objet de l'audit

Le présent audit a pour objectif d'évaluer le niveau de maturité du frontend de Makarim PMS avant la poursuite du développement fonctionnel.

L'analyse a porté sur :

- l'ergonomie des interfaces ;
- la cohérence fonctionnelle ;
- l'adéquation avec les processus réels d'un établissement hôtelier ;
- la cohérence entre le frontend et le backend ;
- la qualité des composants ;
- le responsive desktop et mobile ;
- la couverture fonctionnelle des principaux modules ;
- les risques techniques susceptibles d'affecter les prochaines évolutions.

L'audit a été réalisé sur l'application déployée ainsi que sur le code source du projet.

---

## 3.2 Synthèse générale

L'audit met en évidence un projet présentant une base technique solide et une architecture cohérente.

Le backend constitue aujourd'hui un socle robuste reposant sur NestJS, Prisma, MySQL et une architecture modulaire bien structurée.

Le frontend présente un niveau de qualité satisfaisant mais demeure en phase de maturation.

Les principaux modules sont présents et opérationnels, mais plusieurs écrans restent à enrichir afin d'atteindre le niveau attendu pour une exploitation quotidienne dans un hôtel réel.

L'approche retenue consiste à privilégier une amélioration incrémentale plutôt qu'une refonte globale.

Cette stratégie permet de préserver les investissements déjà réalisés tout en améliorant progressivement l'expérience utilisateur.

---

## 3.3 Points forts

Les principaux points forts identifiés sont les suivants.

### Architecture

- architecture backend modulaire ;
- séparation claire des responsabilités ;
- utilisation de Prisma ;
- logique métier centralisée ;
- authentification sécurisée ;
- RBAC déjà en place ;
- architecture Docker cohérente.

### Frontend

- composants réutilisables ;
- structure React claire ;
- découpage par modules ;
- responsive déjà amorcé ;
- composants de dialogue homogènes ;
- design moderne ;
- base UX cohérente.

### Qualité logicielle

- compilation sans erreur ;
- build frontend validé ;
- tests frontend exécutés avec succès ;
- architecture extensible ;
- dette technique maîtrisée.

### Méthode projet

- audit complet réalisé ;
- documentation en cours de consolidation ;
- gouvernance d'architecture définie ;
- stratégie d'évolution progressive validée.

---

## 3.4 Faiblesses identifiées

Malgré une base saine, plusieurs limites ont été observées.

### Couverture fonctionnelle

Certains modules restent incomplets ou simplifiés.

Les principales limitations concernent :

- les fiches clients ;
- les réservations complexes ;
- le check-in ;
- le restaurant ;
- le stock ;
- les achats ;
- les ressources humaines ;
- certains rapports.

### Expérience utilisateur

Plusieurs écrans présentent :

- peu d'informations contextuelles ;
- peu d'assistance utilisateur ;
- des états vides très basiques ;
- des tableaux nécessitant davantage de filtres ;
- des actions secondaires peu visibles ;
- des parcours encore trop linéaires.

### Cohérence métier

Certaines règles métier validées restent à intégrer dans l'interface.

Par exemple :

- ventilation détaillée du prix TTC ;
- gestion des périodes tarifaires ;
- enrichissement des fiches clients ;
- workflows opérationnels plus complets.

---

## 3.5 Risques identifiés

Les principaux risques concernent davantage l'expérience utilisateur que l'architecture.

Les risques les plus importants sont :

- enrichissement progressif non documenté ;
- divergence éventuelle entre frontend et backend ;
- multiplication de composants similaires ;
- hétérogénéité des écrans si aucune gouvernance UX n'est maintenue ;
- ajout de fonctionnalités sans analyse d'impact.

Aucun élément ne justifie actuellement une refonte complète du frontend.

---

## 3.6 Niveau de maturité par domaine

| Domaine | Niveau |
|----------|--------|
| Architecture backend | Excellent |
| Architecture frontend | Très bon |
| Design system | Bon |
| Responsive | Bon |
| Expérience utilisateur | Bon |
| Couverture métier | Bonne mais incomplète |
| Tests frontend | Très bons |
| Sécurité | Très bonne |
| Documentation | En cours de consolidation |
| Gouvernance | Très bonne |

---

## 3.7 Principales priorités

Les travaux recommandés sont classés selon trois niveaux.

### Priorité 1

Stabilisation.

- suppression des anomalies restantes ;
- harmonisation des composants ;
- amélioration des états vides ;
- enrichissement des formulaires ;
- amélioration du responsive.

### Priorité 2

Enrichissement métier.

- clients ;
- réservations ;
- check-in ;
- housekeeping ;
- maintenance ;
- restaurant ;
- stock ;
- achats.

### Priorité 3

Évolutions avancées.

- POS autonome ;
- reporting enrichi ;
- tableaux de bord décisionnels ;
- fonctionnalités analytiques ;
- futures extensions métier.

---

## 3.8 Décision d'architecture

À l'issue de l'audit, la décision suivante est retenue.

Aucune refonte générale ne sera engagée.

Le développement poursuivra les principes suivants :

- architecture conservée ;
- amélioration incrémentale ;
- documentation systématique ;
- validation métier préalable ;
- analyse d'impact avant chaque évolution ;
- couverture de tests maintenue.

Cette décision garantit la stabilité du projet tout en permettant son enrichissement progressif.

---

## 3.9 Conclusion

L'audit confirme que Makarim PMS dispose aujourd'hui d'une base suffisamment robuste pour poursuivre son développement.

Le backend constitue un socle stable.

Le frontend possède une architecture saine et un design homogène.

Les efforts à venir devront principalement porter sur :

- l'enrichissement fonctionnel ;
- l'amélioration de l'expérience utilisateur ;
- la consolidation de certains workflows métier ;
- la poursuite de la documentation ;
- le maintien de la qualité logicielle.

L'ensemble des recommandations détaillées est présenté dans les chapitres suivants.

# 4. Audit détaillé des modules

## 4.1 Introduction et méthodologie d'évaluation

Le présent chapitre constitue le cœur du rapport d'audit.

Chaque module fonctionnel du frontend a été analysé individuellement selon une méthodologie identique afin de garantir une évaluation homogène de l'ensemble du produit.

L'objectif n'est pas uniquement d'identifier les anomalies, mais également :

- d'évaluer la maturité fonctionnelle ;
- de mesurer la cohérence avec les besoins métier ;
- d'identifier les écarts entre les maquettes, le frontend et le backend ;
- de préparer les prochains cycles de développement.

Les constats présentés ci-après sont issus :

- de l'analyse du code source ;
- de la revue des composants React ;
- de l'analyse des API backend ;
- des documents d'architecture ;
- des Design Handoff ;
- des campagnes de captures Playwright ;
- des tests fonctionnels réalisés sur l'environnement déployé.

Chaque module du frontend a été évalué selon une grille commune permettant de comparer objectivement son niveau de maturité. Les critères retenus sont les suivants :

- adéquation avec les besoins métier ;
- qualité de l'expérience utilisateur ;
- cohérence graphique ;
- ergonomie générale ;
- cohérence avec le backend ;
- couverture fonctionnelle ;
- gestion des erreurs ;
- responsive ;
- extensibilité.

Les recommandations formulées dans ce chapitre ne remettent pas en cause l'architecture actuelle du projet. L'objectif est d'améliorer progressivement Makarim PMS sans introduire de rupture fonctionnelle ou technique.

Chaque module est présenté selon une structure identique afin de faciliter la lecture et le suivi des évolutions.

---

## Structure d'analyse

Chaque module comprend les rubriques suivantes :

### Description

Présentation du rôle du module dans le fonctionnement global du PMS.

### État actuel

Description de l'implémentation observée pendant l'audit.

### Points forts

Éléments déjà conformes aux attentes fonctionnelles ou techniques.

### Anomalies observées

Liste des problèmes détectés durant l'audit.

Les anomalies peuvent être :

- ergonomiques ;
- fonctionnelles ;
- techniques ;
- métier ;
- responsive.

### Améliorations recommandées

Liste des évolutions proposées afin d'améliorer :

- l'expérience utilisateur ;
- la productivité des équipes ;
- la cohérence métier ;
- la qualité globale du produit.

### Priorité

Chaque recommandation reçoit un niveau de priorité :

| Niveau | Signification |
|---------|---------------|
| P1 | À réaliser avant la prochaine version stable |
| P2 | À intégrer dans les prochains sprints |
| P3 | Amélioration de confort ou évolution future |

### Impact

Chaque amélioration est qualifiée selon son impact :

- Faible
- Moyen
- Élevé

Cette qualification permet de préparer les futurs sprints.

---

## Modules audités

Les modules suivants sont couverts par le présent rapport :

1. Dashboard
2. Authentification
3. Clients
4. Entreprises
5. Réservations
6. Chambres
7. Check-in
8. Housekeeping
9. Maintenance
10. Restaurant
11. Stock
12. Bons de commande fournisseurs
13. Ressources humaines
14. Notifications
15. Paramètres
16. Reporting
17. Audit

Les sections suivantes détaillent les résultats de l'analyse pour chacun de ces modules.

---

# 4.2 Dashboard

## Objectif

Le Dashboard constitue le point d'entrée principal du PMS.

Il doit permettre à chaque utilisateur de connaître immédiatement la situation de l'hôtel et les actions prioritaires de la journée.

Le Dashboard ne doit pas uniquement afficher des statistiques mais devenir un véritable outil opérationnel.

---

## Etat actuel

Le Dashboard présente une interface moderne, claire et agréable.

Les widgets actuellement présents sont cohérents et démontrent une bonne maîtrise de React et du découpage des composants.

Le chargement est rapide.

Les tests automatisés sont présents.

Le responsive est satisfaisant.

---

## Points forts

- architecture modulaire ;
- composants réutilisables ;
- design homogène ;
- hiérarchie visuelle claire ;
- bonne lisibilité ;
- base technique solide ;
- intégration correcte avec le backend.

---

## Points faibles

Le Dashboard reste aujourd'hui relativement générique.

Les informations affichées ne sont pas suffisamment orientées métier.

L'utilisateur doit encore naviguer dans plusieurs modules pour obtenir une vision globale de son activité.

Les widgets ne sont pas personnalisés selon le rôle connecté.

Les indicateurs hôteliers restent limités.

---

## Améliorations proposées

### Priorité P1

- personnalisation selon le rôle utilisateur ;
- affichage des arrivées du jour ;
- affichage des départs du jour ;
- chambres à nettoyer ;
- chambres bloquées ;
- interventions urgentes.

### Priorité P2

- chiffre d'affaires journalier ;
- taux d'occupation ;
- ADR ;
- RevPAR ;
- widgets configurables.

### Priorité P3

- tableau de bord personnalisable ;
- glisser-déposer des widgets ;
- indicateurs analytiques.

---

## Décision

Le Dashboard constitue une excellente base.

Aucune refonte n'est recommandée.

Le développement devra porter sur l'enrichissement fonctionnel.

---

# 4.3 Authentification

## Objectif

Le module Authentification contrôle l'accès au PMS.

Il garantit que seuls les utilisateurs autorisés peuvent accéder aux fonctionnalités correspondant à leurs permissions.

Il constitue l'un des composants critiques du système.

---

## Etat actuel

L'authentification repose sur :

- JWT ;
- cookies HttpOnly ;
- protection CSRF ;
- RBAC ;
- gestion des sessions.

Le backend est mature.

Le frontend est simple et efficace.

---

## Points forts

- sécurité élevée ;
- architecture propre ;
- séparation frontend/backend ;
- intégration cohérente ;
- expérience utilisateur simple.

---

## Points faibles

Les fonctionnalités proposées restent volontairement limitées.

Il manque notamment :

- informations sur la dernière connexion ;
- notifications de sécurité ;
- gestion avancée des appareils ;
- historique des connexions.

---

## Améliorations proposées

### Priorité P1

- amélioration des messages d'erreur ;
- retour visuel pendant l'authentification ;
- meilleure gestion des expirations de session.

### Priorité P2

- historique des connexions ;
- appareils autorisés ;
- notification lors d'une connexion inhabituelle.

### Priorité P3

- authentification multifacteur ;
- gestion des sessions multiples.

---

## Décision

Le module est considéré comme stable.

Les évolutions concerneront principalement le confort utilisateur.

---

# 4.4 Clients

## Objectif

Le module Clients représente le référentiel principal des personnes physiques accueillies par l'hôtel.

Il constitue l'une des pierres angulaires du PMS.

Toutes les réservations, séjours, factures et historiques reposent sur cette fiche.

---

## Etat actuel

Le module est fonctionnel.

Les opérations principales sont disponibles :

- création ;
- modification ;
- consultation.

L'interface est claire.

Le backend est robuste.

Les règles de changement de catégorie sont correctement sécurisées.

---

## Points forts

- bonne séparation frontend/backend ;
- architecture saine ;
- règles métier déjà présentes ;
- gestion des catégories ;
- contrôles backend cohérents.

---

## Limites observées

La fiche client reste aujourd'hui relativement minimaliste.

Pour un établissement hôtelier, plusieurs informations importantes sont absentes ou insuffisamment exploitées.

Parmi elles :

- historique complet des séjours ;
- historique des réservations annulées ;
- historique des dépenses ;
- préférences détaillées ;
- habitudes alimentaires ;
- préférences de chambre ;
- langues parlées ;
- anniversaires ;
- documents associés ;
- observations internes ;
- statut VIP enrichi ;
- fidélisation.

---

## Améliorations proposées

### Priorité P1

- fiche client enrichie ;
- historique chronologique complet ;
- indicateurs de fidélité ;
- informations de séjour ;
- meilleure recherche.

### Priorité P2

- documents joints ;
- pièces d'identité numérisées ;
- préférences détaillées ;
- alertes internes.

### Priorité P3

- programme de fidélité ;
- scoring client ;
- recommandations automatiques.

---

## Décision

Le module est suffisamment robuste pour évoluer sans refonte.

Il constitue l'une des principales priorités fonctionnelles de la prochaine version.

---

# 4.5 Entreprises

## Objectif

Le module Entreprises centralise les sociétés travaillant avec l'hôtel.

Il doit permettre la gestion des comptes entreprises, agences, partenaires et clients professionnels.

---

## Etat actuel

Le module est opérationnel.

Les opérations principales sont disponibles.

L'architecture est cohérente avec celle du module Clients.

---

## Points forts

- architecture claire ;
- simplicité d'utilisation ;
- intégration backend satisfaisante ;
- gestion des contacts.

---

## Limites observées

Le module reste volontairement simple.

Plusieurs fonctionnalités attendues dans un contexte hôtelier sont absentes.

Par exemple :

- contrats entreprise ;
- tarifs négociés ;
- historique des séjours entreprise ;
- consommation annuelle ;
- plafond de crédit détaillé ;
- statistiques.

---

## Améliorations proposées

### Priorité P1

- enrichissement de la fiche entreprise ;
- historique complet ;
- tableau des réservations ;
- suivi du chiffre d'affaires.

### Priorité P2

- contrats ;
- pièces jointes ;
- remises négociées ;
- statistiques.

### Priorité P3

- portail entreprise ;
- facturation consolidée ;
- reporting commercial.

---

## Décision

Le module constitue une bonne base.

Les prochaines évolutions devront renforcer sa dimension commerciale sans modifier son architecture actuelle.

# 4.6 Réservations

## Objectif

Le module Réservations constitue le cœur commercial du PMS.

Il permet d'enregistrer, modifier, suivre et transformer une réservation en séjour tout en garantissant la disponibilité des chambres et la cohérence des informations clients.

Il représente le point de départ de la majorité des processus opérationnels de l'hôtel.

---

## Etat actuel

Le module est globalement mature.

Les principales fonctionnalités sont disponibles :

- création d'une réservation ;
- modification ;
- annulation ;
- calendrier ;
- consultation des réservations.

L'intégration avec le backend est satisfaisante.

Le calendrier est clair et constitue un point fort de l'application.

---

## Points forts

- architecture claire ;
- bonne séparation frontend/backend ;
- calendrier lisible ;
- bonne intégration avec les chambres ;
- base solide pour les évolutions futures.

---

## Limites observées

Le parcours de réservation reste relativement simple.

Certaines fonctionnalités attendues dans un PMS professionnel sont absentes.

Parmi les principales observations :

- peu d'assistance lors de la création ;
- recherche client perfectible ;
- peu d'informations financières pendant la réservation ;
- absence d'indicateurs de disponibilité avancés ;
- réservation groupe non prise en charge ;
- peu d'alertes métier.

---

## Améliorations proposées

### Priorité P1

- assistant de création de réservation ;
- disponibilité plus lisible ;
- affichage du prix détaillé ;
- résumé financier immédiat ;
- meilleure recherche client.

### Priorité P2

- réservation groupe ;
- réservation entreprise ;
- réservation multi-chambres ;
- historique des modifications.

### Priorité P3

- revenue management ;
- suggestions automatiques de chambre ;
- optimisation d'occupation.

---

## Règles métier validées

Les règles suivantes devront être intégrées progressivement :

- deux périodes tarifaires configurables ;
- tarifs affichés TTC ;
- ventilation interne du tarif ;
- petit-déjeuner inclus ;
- taxes calculées automatiquement ;
- possibilité d'évolution future vers des politiques tarifaires plus avancées.

---

## Décision

Le module Réservations est considéré comme suffisamment mature.

Les prochaines évolutions porteront principalement sur l'expérience utilisateur et l'enrichissement métier.

---

# 4.7 Chambres

## Objectif

Le module Chambres représente le référentiel physique de l'hôtel.

Il décrit les caractéristiques permanentes des chambres et constitue la base de tous les processus liés à l'hébergement.

---

## Etat actuel

Le découpage réalisé entre référentiel et exploitation constitue un excellent choix architectural.

Les caractéristiques permanentes sont correctement séparées des états opérationnels.

Cette décision facilite les évolutions futures.

---

## Points forts

- excellente architecture métier ;
- séparation structure / exploitation ;
- bonne extensibilité ;
- cohérence avec les réservations ;
- cohérence avec housekeeping.

---

## Limites observées

La fiche chambre pourrait être enrichie.

Certaines informations utiles aux réceptionnistes ou à la gouvernante ne sont pas encore visibles.

Par exemple :

- historique des occupants ;
- historique des incidents ;
- statistiques d'occupation ;
- photos ;
- équipements détaillés ;
- documents techniques.

---

## Améliorations proposées

### Priorité P1

- fiche chambre enrichie ;
- historique d'occupation ;
- visualisation des équipements ;
- accès rapide aux interventions.

### Priorité P2

- galerie photos ;
- historique des nettoyages ;
- statistiques d'utilisation.

### Priorité P3

- maintenance préventive ;
- indicateurs de rentabilité par chambre.

---

## Décision

L'architecture actuelle est excellente.

Aucune modification structurelle n'est recommandée.

---

# 4.8 Check-in

## Objectif

Le Check-in transforme une réservation en séjour actif.

Il constitue l'une des opérations les plus importantes du PMS.

Le parcours doit être rapide, sécurisé et limiter les erreurs.

---

## Etat actuel

Le module est fonctionnel.

Les principaux composants sont présents.

L'architecture est cohérente.

Le backend semble correctement préparé pour les évolutions futures.

---

## Points forts

- bonne organisation générale ;
- architecture claire ;
- workflow compréhensible ;
- intégration correcte avec les réservations.

---

## Limites observées

Le parcours pourrait être davantage orienté réception.

Plusieurs étapes restent très administratives.

Certaines informations importantes devraient être plus visibles.

Par exemple :

- statut du paiement ;
- identité du client ;
- préférences ;
- alertes ;
- disponibilité réelle de la chambre.

---

## Améliorations proposées

### Priorité P1

- assistant de check-in ;
- résumé client ;
- résumé réservation ;
- contrôle des paiements ;
- affichage des documents.

### Priorité P2

- scan automatique des pièces ;
- signature électronique ;
- check-in express.

### Priorité P3

- pré check-in en ligne ;
- intégration mobile.

---

## Décision

Le module constitue une bonne base.

L'effort devra porter principalement sur l'ergonomie et la rapidité du parcours.

---

# 4.9 Housekeeping

## Objectif

Le module Housekeeping permet le suivi opérationnel des chambres.

Il constitue l'outil principal de la gouvernante et des équipes de nettoyage.

---

## Etat actuel

Le module est cohérent.

Les états principaux sont présents.

L'interface est claire.

Les composants sont correctement séparés.

---

## Points forts

- bonne lisibilité ;
- architecture simple ;
- intégration avec les chambres ;
- historique disponible.

---

## Limites observées

Le module reste relativement administratif.

Il manque plusieurs fonctionnalités attendues sur le terrain.

Par exemple :

- affectation des chambres ;
- suivi des agents ;
- temps estimé ;
- progression de la journée ;
- vues mobiles plus adaptées.

---

## Améliorations proposées

### Priorité P1

- affectation des chambres aux femmes de chambre ;
- progression en temps réel ;
- filtres enrichis ;
- indicateurs de charge.

### Priorité P2

- historique détaillé ;
- commentaires ;
- contrôle qualité ;
- validation gouvernante.

### Priorité P3

- application mobile dédiée ;
- notifications automatiques ;
- optimisation des tournées.

---

## Cohérence métier

Le module respecte les règles fondamentales du housekeeping.

Les prochaines évolutions devront renforcer la gestion opérationnelle sans remettre en cause l'architecture existante.

---

## Décision

Le module est considéré comme stable.

Les améliorations proposées concernent principalement les besoins quotidiens des équipes de nettoyage et de supervision.

# 4.10 Maintenance

## Objectif

Le module Maintenance permet d'assurer le suivi technique des équipements, des chambres et des infrastructures de l'hôtel.

Il garantit la disponibilité des chambres, améliore la qualité de service et contribue à la maîtrise des coûts de maintenance.

Il constitue le lien entre la réception, le housekeeping et les équipes techniques.

---

## Etat actuel

Le module est correctement structuré.

Les tickets de maintenance peuvent être créés et suivis.

L'architecture est cohérente avec le reste du PMS.

Le découpage entre les données métier et les composants React est satisfaisant.

---

## Points forts

- architecture claire ;
- workflow simple ;
- bonne intégration avec les chambres ;
- gestion des priorités ;
- code facilement extensible.

---

## Limites observées

Le module reste centré sur le ticket de maintenance.

Il manque plusieurs fonctionnalités attendues dans un environnement hôtelier professionnel.

Par exemple :

- planning des techniciens ;
- historique complet des interventions ;
- coût des réparations ;
- pièces utilisées ;
- maintenance préventive ;
- statistiques.

---

## Améliorations proposées

### Priorité P1

- enrichissement des fiches d'intervention ;
- historique complet des chambres ;
- filtres avancés ;
- suivi des délais.

### Priorité P2

- planification des techniciens ;
- coût des interventions ;
- consommation de pièces.

### Priorité P3

- maintenance préventive ;
- indicateurs de performance ;
- calendrier technique.

---

## Décision

Le module est suffisamment mature.

Les évolutions devront renforcer son aspect opérationnel sans modifier son architecture.

---

# 4.11 Restaurant

## Objectif

Le module Restaurant permet aujourd'hui d'enregistrer les consommations imputées aux clients hébergés.

Il assure la communication entre la restauration et le PMS.

---

## Etat actuel

Le module est fonctionnel.

Il répond correctement aux besoins d'imputation sur chambre.

Son architecture est simple et propre.

Les tests existants montrent un bon niveau de stabilité.

---

## Points forts

- intégration avec les séjours ;
- intégration avec les folios ;
- interface cohérente ;
- bonne qualité technique.

---

## Limites observées

Le module ne constitue pas un véritable système de caisse.

Il ne couvre pas :

- la gestion des tables ;
- les serveurs ;
- la cuisine ;
- les impressions de production ;
- les encaissements indépendants ;
- les remises restaurant ;
- les paiements partagés.

Ces fonctionnalités dépassent le périmètre naturel d'un PMS.

---

## Orientation stratégique validée

Il est recommandé de conserver dans le PMS uniquement les fonctionnalités nécessaires à l'exploitation hôtelière.

La gestion complète du restaurant devra évoluer vers un POS autonome.

Le PMS conservera uniquement :

- l'imputation sur chambre ;
- la récupération des règlements ;
- la synchronisation des factures ;
- le reporting consolidé.

Cette séparation permettra de limiter la complexité du PMS tout en facilitant les évolutions futures.

---

## Améliorations proposées

### Priorité P1

- amélioration de la saisie des consommations ;
- meilleure consultation des commandes imputées ;
- historique plus riche.

### Priorité P2

- synchronisation avancée avec le futur POS.

### Priorité P3

- suppression progressive des fonctionnalités dupliquées une fois le POS opérationnel.

---

## Décision

Aucune refonte immédiate.

Le module servira de passerelle entre le futur POS Restaurant et le PMS.

---

# 4.12 Stock

## Objectif

Le module Stock assure le suivi des articles utilisés par l'hôtel.

Il permet de tracer les mouvements physiques, les entrées, les sorties et les ajustements.

---

## Etat actuel

Le module est correctement structuré.

Les principaux concepts sont présents.

L'intégration avec le backend est satisfaisante.

---

## Points forts

- architecture saine ;
- séparation des responsabilités ;
- mouvements correctement modélisés ;
- bonne extensibilité.

---

## Limites observées

Plusieurs fonctions importantes restent absentes.

Par exemple :

- inventaires ;
- alertes de seuil ;
- valorisation ;
- historique détaillé ;
- consommation par service ;
- statistiques.

---

## Améliorations proposées

### Priorité P1

- tableau de bord stock ;
- alertes de rupture ;
- historique enrichi ;
- inventaires.

### Priorité P2

- valorisation des stocks ;
- statistiques ;
- consommation par département.

### Priorité P3

- prévisions d'approvisionnement ;
- tableaux analytiques.

---

## Cohérence métier

Le modèle actuel est cohérent.

Les futures évolutions devront privilégier la simplicité d'utilisation pour les magasiniers.

---

## Décision

Le module constitue une bonne base.

Les améliorations porteront principalement sur les outils de pilotage.

---

# 4.13 Bons de commande fournisseurs

## Objectif

Le module Bons de commande permet de préparer les achats auprès des fournisseurs.

Il constitue le point d'entrée du processus d'approvisionnement.

---

## Etat actuel

Le module est présent.

L'interface est cohérente avec le reste du PMS.

Les composants sont correctement organisés.

---

## Points forts

- architecture propre ;
- bonne intégration avec les fournisseurs ;
- workflow clair.

---

## Limites observées

Le processus reste simplifié.

Certaines étapes importantes ne sont pas encore couvertes.

Par exemple :

- validation hiérarchique ;
- réception fournisseur ;
- contrôle des écarts ;
- rapprochement avec les factures ;
- historique complet.

---

## Améliorations proposées

### Priorité P1

- workflow complet de validation ;
- réception des marchandises ;
- contrôle des quantités.

### Priorité P2

- rapprochement facture fournisseur ;
- historique détaillé.

### Priorité P3

- statistiques achats ;
- analyse des fournisseurs ;
- indicateurs budgétaires.

---

## Décision

Le module devra évoluer progressivement vers un véritable processus achats sans remettre en cause l'architecture actuelle.

# 4.14 Ressources humaines

## Objectif

Le module Ressources Humaines (RH) centralise les informations relatives au personnel de l'hôtel.

Il doit permettre la gestion administrative des employés tout en devenant progressivement un véritable outil de pilotage des ressources humaines.

Il constitue également le socle des futurs développements liés aux plannings, aux présences, aux absences et à la paie.

---

## Etat actuel

Le module est présent et correctement intégré à l'architecture générale.

L'interface est cohérente avec le reste de l'application.

Les composants React sont correctement structurés.

Le backend est suffisamment modulaire pour permettre un enrichissement progressif.

---

## Points forts

- architecture claire ;
- bonne organisation du code ;
- intégration homogène avec les autres modules ;
- évolutivité satisfaisante.

---

## Limites observées

Le module reste aujourd'hui principalement orienté gestion administrative.

Les fonctionnalités RH avancées restent à développer.

Les principaux besoins identifiés sont :

- dossier employé enrichi ;
- contrats ;
- historique professionnel ;
- documents RH ;
- planning ;
- pointage ;
- gestion des absences ;
- congés ;
- heures supplémentaires ;
- préparation de la paie.

---

## Améliorations proposées

### Priorité P1

- enrichissement de la fiche employé ;
- historique professionnel ;
- documents administratifs ;
- contrats.

### Priorité P2

- planning des équipes ;
- pointage ;
- gestion des absences ;
- validation hiérarchique.

### Priorité P3

- paie ;
- évaluations ;
- formations ;
- indicateurs RH.

---

## Décision

Le module constitue une excellente base.

Son évolution devra rester progressive afin de ne pas transformer prématurément le PMS en ERP RH complet.

---

# 4.15 Notifications

## Objectif

Le module Notifications informe les utilisateurs des événements nécessitant leur attention.

Il participe à la fluidité des opérations quotidiennes.

---

## Etat actuel

Le module est opérationnel.

L'interface est claire.

Les composants sont cohérents.

---

## Points forts

- intégration homogène ;
- navigation simple ;
- architecture extensible.

---

## Limites observées

Les notifications restent principalement informatives.

Il manque notamment :

- priorités visuelles ;
- catégories ;
- actions rapides ;
- notifications métier.

---

## Améliorations proposées

### Priorité P1

- classification des notifications ;
- filtres ;
- indicateurs de priorité.

### Priorité P2

- notifications temps réel ;
- actions directes.

### Priorité P3

- préférences utilisateur ;
- scénarios automatiques.

---

## Décision

Le module est stable.

Les futures évolutions devront améliorer la pertinence des notifications plutôt que leur quantité.

---

# 4.16 Paramètres

## Objectif

Le module Paramètres centralise la configuration générale de l'établissement.

Il constitue le référentiel principal des données de fonctionnement.

---

## Etat actuel

Le module est riche.

Il couvre déjà plusieurs domaines :

- informations générales ;
- fiscalité ;
- paramètres opérationnels ;
- configuration.

L'organisation générale est satisfaisante.

---

## Points forts

- architecture robuste ;
- bonne extensibilité ;
- cohérence avec le backend.

---

## Limites observées

Le nombre croissant d'options rend la navigation plus complexe.

Certaines sections pourraient être mieux regroupées.

---

## Améliorations proposées

### Priorité P1

- meilleure organisation par catégories ;
- moteur de recherche ;
- navigation latérale.

### Priorité P2

- paramètres avancés ;
- historique des modifications.

### Priorité P3

- assistant de configuration ;
- export / import.

---

## Décision

Le module est considéré comme mature.

Les améliorations porteront principalement sur l'expérience utilisateur.

---

# 4.17 Reporting

## Objectif

Le module Reporting fournit aux responsables les indicateurs nécessaires au pilotage de l'activité.

---

## Etat actuel

Les premiers rapports sont présents.

L'architecture est cohérente.

Les composants sont correctement structurés.

---

## Points forts

- bonne base technique ;
- architecture extensible ;
- intégration correcte.

---

## Limites observées

Les possibilités d'analyse restent limitées.

Il manque notamment :

- tableaux de bord décisionnels ;
- indicateurs financiers détaillés ;
- comparatifs temporels ;
- exports avancés.

---

## Améliorations proposées

### Priorité P1

- nouveaux rapports opérationnels ;
- export Excel ;
- filtres avancés.

### Priorité P2

- tableaux croisés ;
- graphiques ;
- indicateurs financiers.

### Priorité P3

- Business Intelligence ;
- tableaux de bord direction.

---

## Décision

Le Reporting devra évoluer progressivement jusqu'à devenir un véritable outil d'aide à la décision.

---

# 4.18 Audit

## Objectif

Le module Audit assure la traçabilité des actions réalisées dans le PMS.

Il constitue un élément essentiel pour la sécurité, la conformité et le diagnostic des incidents.

---

## Etat actuel

Le module est présent.

L'intégration avec le backend est satisfaisante.

L'architecture est propre.

---

## Points forts

- journalisation cohérente ;
- bonne séparation des responsabilités ;
- architecture extensible.

---

## Limites observées

Les possibilités de consultation restent limitées.

Il manque :

- filtres avancés ;
- recherche ;
- export ;
- comparaison d'événements.

---

## Améliorations proposées

### Priorité P1

- recherche avancée ;
- filtres multicritères ;
- export.

### Priorité P2

- visualisation chronologique ;
- rapprochement d'événements.

### Priorité P3

- tableaux d'analyse ;
- statistiques de sécurité.

---

## Décision

Le module constitue une excellente base de traçabilité.

Son évolution devra accompagner la montée en puissance du PMS.

---

# 4.19 Synthèse du chapitre

L'analyse détaillée des différents modules montre une situation globalement très satisfaisante.

L'architecture du frontend est homogène.

La qualité technique est élevée.

Les composants sont correctement factorisés.

Le découpage par fonctionnalités est cohérent.

Les principaux travaux à réaliser concernent désormais l'enrichissement fonctionnel plutôt que la reconstruction technique.

Les priorités identifiées pendant l'audit peuvent être résumées ainsi :

## Priorité 1

- enrichissement des parcours utilisateurs ;
- amélioration des fiches métier ;
- assistance aux opérations quotidiennes ;
- optimisation du responsive.

## Priorité 2

- enrichissement des workflows ;
- tableaux de bord ;
- statistiques ;
- historiques.

## Priorité 3

- fonctionnalités avancées ;
- automatisations ;
- analyses décisionnelles ;
- intégration de futurs modules spécialisés.

La conclusion générale de ce chapitre confirme que le frontend de Makarim PMS dispose aujourd'hui d'une base suffisamment robuste pour poursuivre son évolution sans refonte globale.

La stratégie retenue consiste à privilégier une amélioration incrémentale, pilotée par les besoins métier, tout en conservant les fondations techniques existantes.

# 5. Anomalies transverses

## 5.1 Objectif

Les anomalies présentées dans ce chapitre ne concernent pas un module particulier.

Elles impactent plusieurs écrans, plusieurs workflows ou l'ensemble de l'expérience utilisateur.

Leur résolution permettra d'améliorer la qualité globale du PMS sans remettre en cause son architecture.

---

# 5.2 Cohérence de l'expérience utilisateur

## Constat

L'interface est globalement homogène.

Cependant, certaines différences apparaissent selon les modules :

- organisation variable des formulaires ;
- emplacement différent des boutons d'action ;
- comportements parfois différents des tableaux ;
- styles de filtres non totalement harmonisés ;
- dialogues présentant des comportements légèrement différents.

Ces différences restent limitées mais nuisent à la sensation d'un produit totalement uniforme.

---

## Recommandations

### Priorité P1

- harmoniser tous les formulaires ;
- normaliser les boutons d'action ;
- uniformiser les tableaux ;
- uniformiser les dialogues.

### Impact

Faible.

---

# 5.3 Gestion des états

## Constat

Tous les modules ne gèrent pas de manière identique :

- les chargements ;
- les états vides ;
- les erreurs ;
- les succès.

Certaines pages présentent encore des tableaux vides sans véritable message explicatif.

---

## Recommandations

Chaque écran devrait disposer systématiquement des états suivants :

- Chargement
- Aucun résultat
- Erreur
- Succès
- Action impossible
- Permissions insuffisantes

Les états vides devraient toujours proposer une action.

Exemple :

> Aucun client trouvé.
>
> Créer un nouveau client.

---

# 5.4 Navigation

## Constat

La navigation générale est satisfaisante.

Cependant certains parcours nécessitent encore plusieurs clics inutiles.

Exemples :

- retour vers une fiche ;
- accès aux informations associées ;
- consultation de l'historique.

---

## Recommandations

Développer progressivement :

- actions rapides ;
- liens contextuels ;
- navigation croisée entre modules.

---

# 5.5 Recherche

## Constat

Plusieurs modules disposent de leur propre moteur de recherche.

Le comportement n'est pas toujours identique.

Les critères disponibles varient fortement.

---

## Recommandations

Créer progressivement une logique commune.

Toutes les recherches devraient proposer selon le contexte :

- recherche libre ;
- filtres ;
- tri ;
- pagination ;
- sauvegarde des filtres.

---

# 5.6 Tableaux

## Constat

Les tableaux constituent le principal composant métier.

Ils sont globalement de bonne qualité.

Cependant plusieurs améliorations sont souhaitables.

---

## Recommandations

Ajouter progressivement :

- colonnes configurables ;
- export ;
- tri multiple ;
- pagination configurable ;
- actions de masse.

---

# 5.7 Formulaires

## Constat

Les formulaires sont correctement réalisés.

Les validations backend sont solides.

Certaines validations frontend pourraient néanmoins être renforcées.

---

## Recommandations

Développer progressivement :

- validation immédiate ;
- aides contextuelles ;
- exemples de saisie ;
- autocomplétion ;
- raccourcis clavier.

---

# 5.8 Responsive

## Constat

Le responsive est satisfaisant.

Les captures Playwright montrent un bon comportement général.

Cependant certains écrans restent très orientés desktop.

---

## Recommandations

Optimiser :

- tableaux ;
- filtres ;
- dialogues ;
- listes longues.

Développer davantage de composants spécifiquement pensés pour le mobile.

---

# 5.9 Performances

## Constat

Les performances générales sont bonnes.

Les tests réalisés montrent un frontend réactif.

La structure React permet une évolution sereine.

---

## Recommandations

Surveiller particulièrement :

- chargement des listes importantes ;
- pagination ;
- lazy loading ;
- virtualisation des tableaux lorsque cela deviendra nécessaire.

---

# 5.10 Accessibilité

## Constat

L'accessibilité est globalement correcte.

Les composants communs facilitent le maintien d'un comportement homogène.

Quelques améliorations restent possibles.

---

## Recommandations

Renforcer progressivement :

- navigation clavier ;
- focus visible ;
- contrastes ;
- messages d'erreur accessibles ;
- compatibilité lecteurs d'écran.

---

# 5.11 Messages utilisateur

## Constat

Les messages sont généralement clairs.

Cependant certains messages techniques apparaissent encore.

---

## Recommandations

Tous les messages visibles doivent être rédigés avec un vocabulaire métier.

Les détails techniques doivent rester réservés aux journaux d'audit.

---

# 5.12 Sécurité des actions sensibles

## Constat

Le backend protège correctement les opérations critiques.

Le frontend pourrait mieux accompagner l'utilisateur.

---

## Recommandations

Pour toutes les opérations sensibles :

- confirmation explicite ;
- affichage des conséquences ;
- demande de justification lorsque nécessaire ;
- retour visuel après exécution.

---

# 5.13 Journalisation

## Constat

Le backend possède déjà un système d'audit robuste.

Le frontend pourrait mieux exploiter ces informations.

---

## Recommandations

Afficher davantage :

- historique ;
- auteur ;
- date ;
- motif ;
- action réalisée.

---

# 5.14 Qualité documentaire

## Constat

La documentation technique est de bonne qualité.

L'audit actuel vient compléter la documentation fonctionnelle.

---

## Recommandations

Maintenir systématiquement à jour :

- architecture ;
- documentation API ;
- documentation fonctionnelle ;
- guides utilisateur.

---

# 5.15 Conclusion

Les anomalies transverses identifiées concernent principalement l'expérience utilisateur.

Aucune ne remet en cause les choix d'architecture réalisés.

Leur résolution progressive améliorera fortement la perception globale du produit sans nécessiter de refonte.

L'effort devra porter principalement sur :

- l'harmonisation ;
- la cohérence ;
- la fluidité des parcours ;
- la qualité des interactions.

# 6. Dette UX / UI

## 6.1 Objectif

La dette UX/UI regroupe l'ensemble des améliorations qui ne constituent pas des anomalies fonctionnelles mais dont la mise en œuvre permettra d'améliorer significativement le confort d'utilisation du PMS.

Contrairement aux corrections de bugs, ces évolutions visent principalement :

- la fluidité des parcours utilisateurs ;
- la réduction du nombre de clics ;
- l'amélioration de la lisibilité ;
- l'accélération des opérations quotidiennes ;
- l'harmonisation de l'interface.

Le remboursement progressif de cette dette contribuera directement à l'adoption du logiciel par les équipes.

---

# 6.2 Navigation

## Constat

La navigation actuelle est cohérente.

Cependant, plusieurs parcours nécessitent encore de nombreux clics.

Les utilisateurs passent fréquemment d'un module à un autre pour consulter des informations liées.

---

## Améliorations proposées

### Priorité P1

- liens directs entre modules ;
- navigation contextuelle ;
- retour intelligent vers l'écran précédent.

### Priorité P2

- historique de navigation ;
- favoris utilisateur.

### Priorité P3

- navigation entièrement personnalisable.

---

# 6.3 Tableau de bord

## Constat

Le Dashboard constitue une bonne base.

Il peut cependant devenir un véritable poste de pilotage.

---

## Evolutions souhaitées

- widgets configurables ;
- tableau de bord par rôle ;
- indicateurs personnalisés ;
- alertes prioritaires ;
- raccourcis métiers.

---

# 6.4 Formulaires

## Constat

Les formulaires sont homogènes.

Ils peuvent néanmoins être simplifiés.

---

## Evolutions proposées

- regroupement logique des champs ;
- assistants de saisie ;
- autocomplétion ;
- validation immédiate ;
- aide contextuelle.

---

# 6.5 Tableaux

## Constat

Les tableaux sont largement utilisés dans l'ensemble du PMS.

Ils constituent l'élément principal de consultation.

---

## Evolutions proposées

### Priorité P1

- colonnes configurables ;
- largeur mémorisée ;
- filtres avancés.

### Priorité P2

- export personnalisé ;
- actions de masse ;
- tris multiples.

### Priorité P3

- vues enregistrées.

---

# 6.6 Responsive

## Constat

Le responsive est satisfaisant.

Les futurs développements devront néanmoins privilégier une véritable approche mobile.

---

## Evolutions proposées

- cartes métier ;
- actions tactiles ;
- formulaires plein écran ;
- filtres mobiles.

---

# 6.7 Dialogues

## Constat

Les dialogues sont nombreux.

Ils sont globalement homogènes.

---

## Evolutions proposées

- taille adaptée au contenu ;
- raccourcis clavier ;
- confirmation homogène ;
- boutons toujours positionnés de manière identique.

---

# 6.8 Etats de chargement

## Constat

Les écrans affichent correctement les temps de chargement.

Des améliorations restent possibles.

---

## Evolutions proposées

- skeleton loaders homogènes ;
- indicateurs de progression ;
- messages explicites.

---

# 6.9 Etats vides

## Constat

Les états vides restent très simples.

---

## Evolutions proposées

Chaque état vide devra proposer :

- une explication ;
- une illustration ;
- une action principale.

Exemple :

Aucun fournisseur enregistré.

→ Créer un fournisseur.

---

# 6.10 Recherche

## Objectif

Uniformiser les recherches dans tout le PMS.

---

## Evolutions proposées

- comportement identique ;
- filtres persistants ;
- recherche instantanée ;
- suggestions.

---

# 6.11 Notifications utilisateur

## Evolutions proposées

- messages plus explicites ;
- codes couleur homogènes ;
- notifications persistantes lorsque nécessaire ;
- accès rapide à l'élément concerné.

---

# 6.12 Expérience mobile

Les modules suivants devront bénéficier d'un travail spécifique :

- Housekeeping ;
- Maintenance ;
- Check-in ;
- Stock.

L'objectif est de permettre leur utilisation sur smartphone dans les conditions réelles d'exploitation.

---

# 6.13 Accessibilité

Les évolutions UX devront préserver :

- navigation clavier ;
- lecteurs d'écran ;
- contraste ;
- taille des zones tactiles ;
- messages d'erreur accessibles.

---

# 6.14 Design System

Le Design System devra progressivement devenir la référence unique.

Tous les nouveaux développements devront réutiliser les composants existants.

Les composants dupliqués devront être supprimés progressivement.

---

# 6.15 Priorisation

## Priorité P1

- harmonisation des formulaires ;
- états vides ;
- responsive ;
- tableaux ;
- navigation.

## Priorité P2

- widgets ;
- personnalisation ;
- raccourcis ;
- historique.

## Priorité P3

- personnalisation avancée ;
- vues enregistrées ;
- préférences utilisateur.

---

# 6.16 Conclusion

La dette UX identifiée ne remet pas en cause la qualité générale du frontend.

Elle traduit principalement l'évolution naturelle d'un produit en croissance.

Sa réduction progressive permettra :

- une meilleure adoption par les utilisateurs ;
- une diminution des erreurs de manipulation ;
- une amélioration de la productivité des équipes ;
- une homogénéité renforcée de l'ensemble du PMS.

Les évolutions proposées pourront être intégrées progressivement sans modifier l'architecture existante.

# 7. Dette fonctionnelle et métier

## 7.1 Objectif

Contrairement à la dette technique ou à la dette UX, la dette fonctionnelle représente l'ensemble des fonctionnalités métier qui ne sont pas encore couvertes par Makarim PMS.

Ces fonctionnalités ne constituent pas des anomalies.

Elles correspondent aux évolutions naturelles attendues d'un PMS professionnel destiné à une exploitation hôtelière réelle.

Leur implémentation devra rester progressive et respecter les principes suivants :

- préserver l'architecture existante ;
- éviter toute régression fonctionnelle ;
- privilégier les évolutions incrémentales ;
- maintenir une forte couverture de tests.

---

# 7.2 Réception

## Etat actuel

Les principales opérations sont disponibles.

La réception peut gérer :

- les clients ;
- les réservations ;
- le check-in ;
- le check-out ;
- les paiements.

Le socle est considéré comme robuste.

---

## Evolutions attendues

### Priorité P1

- recherche globale instantanée ;
- historique complet du séjour ;
- visualisation de toutes les chambres disponibles ;
- alertes clients importantes.

### Priorité P2

- gestion avancée des groupes ;
- réservations liées ;
- surclassements ;
- transferts de chambre.

### Priorité P3

- check-in mobile ;
- check-in autonome ;
- bornes libre-service.

---

# 7.3 Gestion des clients

Le client doit devenir un véritable dossier hôtelier.

La fiche devra progressivement intégrer :

- historique complet ;
- préférences ;
- habitudes ;
- langues ;
- documents ;
- fidélité ;
- historique financier ;
- incidents ;
- commentaires internes.

---

# 7.4 Gestion commerciale

Les entreprises devront évoluer vers un véritable CRM hôtelier.

Les fonctionnalités attendues comprennent :

- contrats ;
- tarifs négociés ;
- comptes entreprises ;
- agences ;
- sociétés ;
- historique commercial ;
- statistiques.

---

# 7.5 Gestion tarifaire

Le moteur tarifaire constitue aujourd'hui l'un des principaux axes d'évolution.

Les fonctionnalités attendues sont :

### Priorité P1

- plusieurs saisons ;
- plusieurs grilles tarifaires ;
- ventilation interne du prix ;
- taxes configurables.

### Priorité P2

- promotions ;
- packages ;
- tarifs entreprises.

### Priorité P3

- Yield Management ;
- Revenue Management.

---

# 7.6 Exploitation des chambres

Le référentiel est satisfaisant.

Les évolutions concerneront principalement :

- historique ;
- statistiques ;
- indicateurs d'occupation ;
- rentabilité ;
- maintenance préventive.

---

# 7.7 Housekeeping

Le module devra évoluer vers un véritable outil terrain.

Les besoins identifiés sont :

- affectation automatique ;
- optimisation des tournées ;
- contrôle qualité ;
- suivi mobile ;
- statistiques.

---

# 7.8 Maintenance

Les prochaines évolutions porteront sur :

- maintenance préventive ;
- calendrier ;
- coûts ;
- techniciens ;
- pièces détachées ;
- contrats de maintenance.

---

# 7.9 Restaurant

Le périmètre du PMS restera volontairement limité.

La stratégie validée consiste à développer un POS autonome.

Le PMS conservera uniquement :

- l'imputation sur chambre ;
- les règlements ;
- les écritures comptables ;
- les statistiques consolidées.

Cette décision limite fortement la complexité du PMS.

---

# 7.10 Gestion des stocks

Les principales évolutions attendues sont :

- inventaires ;
- valorisation ;
- statistiques ;
- alertes ;
- consommation par département ;
- mouvements analytiques.

---

# 7.11 Achats

Le processus Achats devra progressivement couvrir :

- demande d'achat ;
- validation ;
- bon de commande ;
- réception ;
- facture fournisseur ;
- rapprochement.

---

# 7.12 Ressources humaines

Le futur module RH devra progressivement intégrer :

- planning ;
- pointage ;
- congés ;
- absences ;
- heures supplémentaires ;
- paie ;
- documents ;
- évaluations ;
- formations.

Le développement devra rester indépendant des autres modules afin de limiter les impacts.

---

# 7.13 Reporting

Les rapports devront évoluer selon trois niveaux.

## Niveau opérationnel

- activité quotidienne ;
- chambres ;
- réception ;
- housekeeping.

## Niveau financier

- chiffre d'affaires ;
- TVA ;
- paiements ;
- créances.

## Niveau décisionnel

- KPI ;
- tendances ;
- comparatifs ;
- tableaux de bord.

---

# 7.14 Administration

Le module Paramètres devra progressivement intégrer :

- configuration avancée ;
- historique ;
- sauvegarde ;
- import/export.

---

# 7.15 Audit

Le journal d'audit devra évoluer vers un véritable outil de traçabilité.

Les fonctionnalités attendues sont :

- recherche ;
- export ;
- statistiques ;
- rapprochement d'événements ;
- suivi des actions sensibles.

---

# 7.16 Interopérabilité

L'architecture devra faciliter les futures intégrations.

Les principales cibles sont :

- POS Restaurant ;
- Comptabilité ;
- Paiement électronique ;
- Channel Manager ;
- OTA ;
- Business Intelligence.

Toutes ces intégrations devront respecter le principe suivant :

Le PMS reste la source de vérité des données hôtelières.

---

# 7.17 Contraintes d'évolution

Toutes les futures fonctionnalités devront respecter les décisions suivantes.

## Architecture

- aucune refonte générale ;
- architecture modulaire conservée ;
- séparation frontend/backend.

## Base de données

- migrations maîtrisées ;
- compatibilité ascendante ;
- intégrité référentielle.

## Frontend

- réutilisation maximale des composants ;
- responsive obligatoire ;
- accessibilité maintenue.

## Backend

- API versionnées ;
- transactions atomiques ;
- RBAC ;
- journalisation.

---

# 7.18 Synthèse

L'analyse fonctionnelle montre que Makarim PMS possède aujourd'hui un excellent socle technique.

Les développements futurs devront porter essentiellement sur :

- l'enrichissement métier ;
- les workflows opérationnels ;
- les indicateurs décisionnels ;
- les outils de pilotage.

La stratégie retenue consiste à construire progressivement un PMS complet sans remettre en cause les choix d'architecture déjà validés.

# 8. Roadmap stratégique de Makarim PMS

## 8.1 Objectif

Cette feuille de route définit les grandes orientations d'évolution de Makarim PMS à l'issue de l'audit fonctionnel et technique.

Elle constitue la référence officielle pour la planification des futurs développements.

Les évolutions sont organisées selon quatre principes :

- priorité métier ;
- impact utilisateur ;
- complexité technique ;
- dépendances entre modules.

Toutes les évolutions devront respecter les décisions d'architecture validées dans le présent document.

---

# 8.2 Principes directeurs

Les développements futurs devront systématiquement respecter les règles suivantes :

- aucune refonte générale ;
- architecture existante conservée ;
- évolutions incrémentales ;
- compatibilité ascendante ;
- couverture de tests obligatoire ;
- documentation mise à jour à chaque évolution ;
- analyse d'impact avant toute implémentation.

---

# 8.3 Vision cible

À terme, Makarim PMS devra constituer une plateforme complète de gestion hôtelière articulée autour de plusieurs applications spécialisées.

L'architecture cible est la suivante :

```

hotelmakarim.cloud

│

├── PMS (cœur métier)

├── API

├── POS Restaurant

├── Business Intelligence

├── CRM

├── Portail Clients

└── Applications mobiles

```

Le PMS restera la source unique des données hôtelières.

---

# 8.4 Epic 1 — Stabilisation

## Objectif

Finaliser les fondations techniques.

### Contenu

- correction des anomalies restantes ;
- harmonisation des composants ;
- amélioration des états ;
- amélioration du responsive ;
- optimisation des performances.

### Priorité

Très élevée.

---

# 8.5 Epic 2 — Réception

## Objectif

Faire de la réception un véritable poste de pilotage.

### Evolutions

- recherche globale ;
- fiche client enrichie ;
- historique complet ;
- check-in assisté ;
- check-out enrichi ;
- alertes.

---

# 8.6 Epic 3 — Réservations

## Objectif

Renforcer le moteur de réservation.

### Evolutions

- groupes ;
- entreprises ;
- plusieurs chambres ;
- surclassement ;
- disponibilité enrichie ;
- workflow visuel.

---

# 8.7 Epic 4 — Chambres

## Evolutions

- historique ;
- statistiques ;
- équipements ;
- galerie ;
- incidents ;
- indicateurs.

---

# 8.8 Epic 5 — Exploitation

Modules concernés :

- Housekeeping ;
- Maintenance.

### Evolutions

- affectation ;
- planning ;
- suivi mobile ;
- contrôle qualité ;
- maintenance préventive.

---

# 8.9 Epic 6 — Gestion commerciale

Modules :

- Entreprises ;
- Tarification.

### Evolutions

- contrats ;
- tarifs négociés ;
- sociétés ;
- statistiques commerciales.

---

# 8.10 Epic 7 — Gestion financière

Modules :

- Paiements ;
- Facturation.

### Evolutions

- ventilation avancée ;
- rapprochements ;
- statistiques ;
- contrôle des règlements.

---

# 8.11 Epic 8 — Stock & Achats

Modules :

- Stock ;
- Bons de commande.

### Evolutions

- inventaires ;
- réception ;
- fournisseurs ;
- valorisation ;
- alertes.

---

# 8.12 Epic 9 — Ressources Humaines

Objectif :

Faire évoluer progressivement le module RH.

### Evolutions

- planning ;
- pointage ;
- absences ;
- congés ;
- contrats ;
- paie.

---

# 8.13 Epic 10 — Reporting

Objectif :

Transformer le reporting en véritable outil décisionnel.

### Evolutions

- KPI ;
- graphiques ;
- tableaux de bord ;
- comparatifs ;
- exports.

---

# 8.14 Epic 11 — POS Restaurant

Décision stratégique.

Le restaurant deviendra progressivement une application autonome.

Le PMS conservera uniquement :

- les chambres ;
- les imputations ;
- les règlements ;
- la facturation consolidée.

Cette décision réduit fortement la complexité du PMS.

---

# 8.15 Priorités

## Priorité P1

Stabilisation.

Modules :

- Dashboard ;
- Clients ;
- Réservations ;
- Check-in ;
- Housekeeping.

---

## Priorité P2

Enrichissement métier.

Modules :

- Stock ;
- Achats ;
- RH ;
- Reporting.

---

## Priorité P3

Applications spécialisées.

Modules :

- POS ;
- BI ;
- CRM ;
- Mobile.

---

# 8.16 Gouvernance

Chaque évolution devra suivre le cycle suivant :

1. Expression du besoin.
2. Validation métier.
3. Analyse d'impact.
4. Validation d'architecture.
5. Développement.
6. Tests.
7. Revue de code.
8. Validation fonctionnelle.
9. Mise à jour documentaire.
10. Déploiement.

---

# 8.17 Définition de terminé (Definition of Done)

Une fonctionnalité est considérée comme terminée uniquement si :

- le développement est terminé ;
- les tests passent ;
- les revues sont validées ;
- la documentation est mise à jour ;
- les captures d'écran sont actualisées si nécessaire ;
- les impacts ont été analysés ;
- aucune régression n'est détectée.

---

# 8.18 Conclusion de la roadmap

L'objectif n'est pas d'ajouter un grand nombre de fonctionnalités dans un délai court.

La stratégie retenue privilégie :

- la stabilité ;
- la cohérence ;
- la qualité ;
- l'évolutivité.

Cette feuille de route constitue désormais le plan directeur des futures versions de Makarim PMS.

Toutes les évolutions devront s'y référer afin de préserver la cohérence du produit et la qualité de son architecture.

# 9. Conclusion générale

## 9.1 Synthèse de l'audit

L'audit réalisé sur le frontend de Makarim PMS met en évidence un projet présentant un niveau de maturité supérieur à celui généralement observé pour un développement de cette taille.

L'analyse conjointe du code source, de l'architecture, des interfaces, des workflows métier et des tests confirme que les fondations techniques sont solides.

Le projet repose sur une architecture moderne, modulaire et évolutive, adaptée à une montée en puissance progressive.

Les choix réalisés concernant :

- NestJS ;
- Prisma ;
- React ;
- TypeScript ;
- Docker ;
- RBAC ;
- séparation frontend/backend ;

constituent une base robuste pour les prochaines années.

---

## 9.2 Etat de maturité

A l'issue de cet audit, le niveau de maturité estimé est le suivant.

| Domaine | Niveau |
|----------|---------|
| Architecture | Excellent |
| Backend | Excellent |
| Frontend | Très bon |
| UX | Bon |
| Responsive | Bon |
| Sécurité | Très bon |
| Documentation | Très bon |
| Tests | Très bon |
| Couverture métier | Bonne |
| Evolutivité | Excellente |

---

## 9.3 Principaux constats

Les principales conclusions sont les suivantes.

### Architecture

L'architecture actuelle ne nécessite pas de refonte.

Elle est suffisamment modulaire pour absorber les évolutions prévues.

---

### Backend

Le backend est considéré comme stable.

Les principaux travaux futurs concerneront davantage l'enrichissement fonctionnel que la restructuration technique.

---

### Frontend

Le frontend présente une excellente homogénéité.

Les améliorations identifiées concernent principalement :

- l'expérience utilisateur ;
- les parcours métier ;
- les tableaux de bord ;
- les fiches détaillées.

---

### Fonctionnel

Le PMS couvre déjà les principaux processus opérationnels.

Les futurs développements viseront principalement :

- l'enrichissement des workflows ;
- les fonctionnalités avancées ;
- les outils décisionnels.

---

## 9.4 Décisions validées

Au terme de l'audit, les décisions suivantes sont retenues.

### Architecture

Aucune refonte générale.

---

### Développement

Les évolutions seront exclusivement incrémentales.

---

### Documentation

Toute évolution devra être documentée.

---

### Tests

Aucune fonctionnalité ne sera considérée comme terminée sans tests adaptés.

---

### Gouvernance

Toute évolution importante devra faire l'objet :

- d'une analyse d'impact ;
- d'une validation fonctionnelle ;
- d'une validation d'architecture.

---

## 9.5 Vision

L'objectif n'est pas simplement de développer un logiciel.

La vision consiste à construire progressivement une plateforme hôtelière moderne, robuste, documentée et durable.

Le PMS constituera le cœur de cette plateforme.

Autour de lui pourront évoluer progressivement :

- POS Restaurant ;
- CRM ;
- BI ;
- applications mobiles ;
- portail client ;
- connecteurs externes.

Le PMS restera la source de vérité des données métier.

---

## 9.6 Stratégie retenue

Les prochaines versions respecteront les principes suivants.

### Priorité 1

Stabiliser.

### Priorité 2

Enrichir.

### Priorité 3

Industrialiser.

Cette stratégie permettra d'assurer une croissance maîtrisée du produit.

---

## 9.7 Recommandation finale

L'audit confirme que Makarim PMS possède aujourd'hui toutes les qualités nécessaires pour poursuivre son développement.

Les prochaines étapes devront privilégier :

- la qualité ;
- la cohérence ;
- la documentation ;
- les tests ;
- l'expérience utilisateur.

Les améliorations proposées dans ce document constituent la feuille de route officielle des prochaines évolutions du produit.

---

## 9.8 Validation

Le présent document constitue la référence fonctionnelle du frontend de Makarim PMS.

Il devra être mis à jour :

- à chaque évolution majeure ;
- à chaque nouveau module ;
- lors de toute modification importante de l'expérience utilisateur ;
- à chaque révision de la feuille de route.

La version initiale de ce document est validée comme base de travail pour les futurs développements.
