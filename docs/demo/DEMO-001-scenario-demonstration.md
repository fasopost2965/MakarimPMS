# DEMO-001 — Scénario de démonstration du PMS Hôtel Makarim

**Durée cible : 30 à 45 minutes.** Document uniquement — aucun développement, aucun code modifié. Destiné à préparer une démonstration en direct du système à Hajbrahim, avant la recette formelle (`docs/go-live-book/07-cahier-de-recette-hajbrahim.md`).

## Différence avec la recette (chapitre 07 du Go Live Book)

Cette démonstration n'est **pas** la recette : elle est plus courte, plus guidée, et vise à donner une vue d'ensemble convaincante du système avant que Hajbrahim ne valide chaque scénario en détail lui-même. La recette (chapitre 07) reste l'étape de validation formelle qui conditionne le Go-Live ; cette démo la précède et la prépare.

## Pré-requis avant la démonstration

- Environnement de recette déployé (`docs/go-live-book/03-deploiement.md`), jeu de données rejoué (`npx prisma db seed`)
- Comptes de démonstration disponibles (`docs/go-live-book/06-comptes-utilisateurs.md`) : `admin@makarim.test`, `reception@makarim.test`, `gouvernante@makarim.test`, `comptable@makarim.test`
- Navigateur avec 2 fenêtres/onglets ouverts (permet de montrer le changement de rôle sans déconnexion/reconnexion visible à chaque fois)
- Une chambre explicitement désignée comme « chambre de démo » (ex. chambre Single n°1), pour ne jamais toucher une donnée qui pourrait être confondue avec de l'exploitation réelle
- Vérifier au préalable que la chambre de démo est `LIBRE_PROPRE` et sans réservation existante

---

## Ordre de la démonstration

| # | Module | Durée | Compte utilisé |
|---|---|---:|---|
| 1 | Introduction & connexion | 3 min | `admin@makarim.test` |
| 2 | Planning des chambres (vue d'ensemble) | 4 min | `admin@makarim.test` |
| 3 | Création d'une réservation | 5 min | `reception@makarim.test` |
| 4 | Check-in (walk-in + à partir d'une réservation) | 5 min | `reception@makarim.test` |
| 5 | Facturation & encaissement (folio) | 6 min | `reception@makarim.test` |
| 6 | Prolongation de séjour (GL-003) | 4 min | `reception@makarim.test` |
| 7 | Check-out (avec blocage sur solde positif) | 4 min | `reception@makarim.test` |
| 8 | Ménage (housekeeping) | 3 min | `gouvernante@makarim.test` |
| 9 | Rôles & permissions (RBAC) | 3 min | plusieurs comptes |
| 10 | Registre de police & reporting | 4 min | `admin@makarim.test` |
| 11 | Questions ouvertes & synthèse | 4 min | — |

Total : ~45 min (borne haute). Les modules 6, 9 et 10 sont les premiers à raccourcir si le temps manque — voir « Marge de sécurité » en fin de document.

---

## 1. Introduction & connexion (3 min)

**Données nécessaires** : compte `admin@makarim.test`.

**Points clés à montrer** :
- Écran de connexion, authentification JWT (juste mentionner la sécurité, ne pas s'attarder techniquement)
- Vue d'ensemble du tableau de bord (dashboard) après connexion

**Questions à poser à Hajbrahim** :
- Quelles informations voulez-vous voir en premier en arrivant le matin sur cet écran ?
- Le niveau de détail affiché ici correspond-il à ce qu'un directeur d'hôtel consulte quotidiennement ?

---

## 2. Planning des chambres (4 min)

**Données nécessaires** : jeu de données seed (24 chambres, 5 types).

**Points clés à montrer** :
- Vue planning global des 24 chambres sur plusieurs jours
- Code couleur par statut de chambre (libre/occupée/à nettoyer/en maintenance)
- Glisser-déposer d'une réservation existante vers une autre date/chambre (F8) — **uniquement si une réservation de démo existe déjà**, sinon reporter cette démonstration après l'étape 3

**Questions à poser à Hajbrahim** :
- Ce niveau de lisibilité est-il suffisant pour la réception en heure de pointe ?
- Le déplacement d'une réservation par glisser-déposer correspond-il à votre usage réel, ou préférez-vous un autre geste ?

---

## 3. Création d'une réservation (5 min)

**Données nécessaires** : chambre de démo libre, client fictif clairement identifié (ex. « Client Démo »).

**Points clés à montrer** :
- Vérification de disponibilité avant réservation
- Sélection du type de chambre et des dates
- Calcul automatique du prix (tarification saisonnière)
- Confirmation de la réservation

**Questions à poser à Hajbrahim** :
- Les informations demandées au client à la réservation correspondent-elles à vos besoins actuels ?
- Manque-t-il un champ que vous utilisez aujourd'hui (papier ou autre outil) ?

---

## 4. Check-in — walk-in et depuis réservation (5 min)

**Données nécessaires** : la réservation créée à l'étape 3 + une seconde chambre de démo libre pour le walk-in.

**Points clés à montrer** :
- Check-in à partir de la réservation existante (bascule automatique du statut de la chambre)
- Check-in walk-in (client sans réservation préalable) sur la seconde chambre de démo
- Saisie de la pièce d'identité (lien avec le registre de police, module 10)

**Questions à poser à Hajbrahim** :
- Le temps de saisie au comptoir vous paraît-il acceptable comparé à votre pratique actuelle ?
- Le scan OCR de pièce d'identité (si démontré) simplifie-t-il réellement la saisie pour votre équipe ?

---

## 5. Facturation & encaissement — folio (6 min)

**Données nécessaires** : le séjour en cours créé à l'étape 4.

**Points clés à montrer** :
- Structure du folio (lignes hébergement + une charge extra ajoutée en direct, ex. restauration)
- Encaissement d'un paiement partiel
- Visualisation du solde restant dû en temps réel
- Émission d'une facture et son caractère immuable une fois émise

**Questions à poser à Hajbrahim** :
- Cette répartition des charges (hébergement/extras) correspond-elle à votre comptabilité actuelle ?
- Les moyens de paiement proposés couvrent-ils tous les cas réels de votre réception ?

---

## 6. Prolongation de séjour — GL-003 (4 min)

**Données nécessaires** : le même séjour en cours (module 5), avec un solde à jour.

**Points clés à montrer** :
- Demande de prolongation d'une nuit supplémentaire sur la même chambre
- Recalcul automatique du prix (tarification saisonnière, formule)
- Cas d'indisponibilité : proposition d'une chambre alternative si la chambre actuelle n'est plus libre pour la nuit ajoutée (à préparer en amont si l'on veut le démontrer, sinon l'expliquer verbalement)

**Questions à poser à Hajbrahim** :
- Cette fonctionnalité correspond-elle à une situation fréquente pour vous (client souhaitant rester une nuit de plus) ?
- Le paiement immédiat obligatoire pour la nuit ajoutée doit-il être activé dès l'ouverture, ou laissé optionnel dans un premier temps ?

---

## 7. Check-out — avec blocage sur solde positif (4 min)

**Données nécessaires** : le séjour du module 6.

**Points clés à montrer** :
- Tentative de check-out avec un solde encore positif volontairement laissé impayé → blocage explicite par le système
- Encaissement du solde restant, puis check-out réussi
- Bascule automatique de la chambre vers le statut « à nettoyer »

**Questions à poser à Hajbrahim** :
- Ce blocage sur solde impayé correspond-il à votre politique actuelle, ou existe-t-il des cas où un départ doit être autorisé malgré un solde dû ?
- (Si la réponse indique un besoin d'exception) — préciser que ce cas existe déjà sous forme de check-out forcé réservé à l'Administrateur, avec motif obligatoire et traçabilité complète.

---

## 8. Ménage — housekeeping (3 min)

**Données nécessaires** : la chambre passée « à nettoyer » à l'étape 7.

**Points clés à montrer** :
- Connexion avec le compte `gouvernante@makarim.test`
- Liste des chambres à nettoyer
- Validation du nettoyage → retour de la chambre en disponibilité commerciale

**Questions à poser à Hajbrahim** :
- Ce parcours correspond-il à l'organisation réelle de votre équipe d'étage ?
- L'application mobile dédiée au ménage (si démontrée séparément) sera-t-elle utilisable sur les appareils dont dispose votre personnel ?

---

## 9. Rôles & permissions — RBAC (3 min)

**Données nécessaires** : plusieurs comptes de démonstration déjà créés.

**Points clés à montrer** :
- Basculer sur un compte Gouvernante et montrer qu'il ne peut pas accéder à l'encaissement
- Basculer sur un compte Comptable et montrer l'accès aux exports financiers sans accès à la configuration des chambres

**Questions à poser à Hajbrahim** :
- Cette répartition des droits correspond-elle à l'organisation réelle de vos équipes ?
- Un rôle supplémentaire ou une restriction différente est-elle nécessaire pour un poste spécifique chez vous ?

---

## 10. Registre de police & reporting (4 min)

**Données nécessaires** : la pièce d'identité saisie à l'étape 4.

**Points clés à montrer** :
- Registre de police (obligation légale DGSN) — export sur une période
- Tableau de bord de reporting (taux d'occupation, indicateurs de base)

**Questions à poser à Hajbrahim** :
- Le format d'export du registre de police correspond-il à ce qui est exigé par les autorités locales ?
- Quels indicateurs supplémentaires souhaitez-vous voir apparaître dans le reporting quotidien ?

---

## 11. Questions ouvertes & synthèse (4 min)

**Points clés à montrer** : aucun — temps réservé aux retours de Hajbrahim.

**Questions à poser** :
- Y a-t-il un parcours métier essentiel de votre exploitation quotidienne qui n'a pas été montré aujourd'hui ?
- Sur l'ensemble de la démonstration, quels points vous semblent prioritaires à ajuster avant la recette formelle (chapitre 07 du Go Live Book) ?
- Êtes-vous prêt à démarrer la recette formelle sur la base de ce qui vient d'être montré, ou souhaitez-vous une seconde démonstration après ajustements ?

---

## Marge de sécurité (si dépassement du temps)

Ordre de réduction recommandé si la démonstration prend du retard, du moins critique au plus critique pour l'adhésion métier :
1. Réduire le module 9 (RBAC) à une seule bascule de compte au lieu de deux.
2. Réduire le module 10 (reporting) à l'export du registre de police seul, sans le tableau de bord.
3. Ne pas raccourcir les modules 3 à 7 (cycle réservation → check-out) — c'est le cœur de l'exploitation quotidienne et le point de jugement principal de Hajbrahim.

## Après la démonstration

Les retours de Hajbrahim (module 11) doivent être consignés — proposition : les reporter dans `docs/go-live-book/08-journal-des-anomalies.md` uniquement s'ils révèlent une anomalie fonctionnelle réelle ; les demandes d'évolution ou de clarification restent une décision produit séparée, à tracer dans `docs/governance/REGISTRE_DECISIONS.md` si elles sont retenues.
