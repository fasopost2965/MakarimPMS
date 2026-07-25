# Audit technique — Makarim PMS v1
## Phase 10 — Conclusion générale et roadmap

Synthèse transversale des Phases 1 à 9. Aucune modification de code, aucun patch. Chaque constat renvoie à un constat déjà établi et sourcé dans une phase précédente.

---

## Synthèse générale

Makarim PMS v1 est un projet dont la **discipline architecturale est nettement supérieure à ce qu'on observe habituellement sur un projet de cette taille** : un seul chemin d'écriture par champ sensible, des transactions Prisma systématiquement couplées à l'audit, des façades inter-modules respectées sans contournement détecté sur 21 modules backend et 14 features frontend, une absence totale de données mockées, et une pratique constante consistant à **documenter ses propres écarts** plutôt qu'à les laisser invisibles.

Ce même projet présente cependant une **chaîne financière incomplète à un point structurel** (aucune correction de facture possible après émission), une **faille de sécurité active et exploitable** (jeton de réinitialisation de mot de passe exposé en clair dans la réponse HTTP), et un **écart fonctionnel légal-critique** (le registre de police, obligation DGSN, n'a aucune interface de saisie). Ces trois éléments ne sont pas des détails de finition : ce sont des points où le produit, tel quel, ne peut pas encaisser l'usage réel d'un hôtel 3 étoiles opérationnel sans qu'un incident concret ne survienne dans les premières semaines.

Le reste du système — chaîne réservation → check-in → séjour → housekeeping → check-out, RBAC serveur, machine à états des chambres, idempotence des paiements — est robuste, cohérent avec le modèle métier, et déjà éprouvé par une suite e2e réelle (19 fichiers, contre une vraie base MySQL, jamais de mock).

---

## Forces majeures

1. **Chemin d'écriture unique par invariant critique**, vérifié à l'échelle du projet entier — `Room.statut`, `Guest.categorie`, lignes créditrices de paiement, `AuditLog`.
2. **Verrou de concurrence réel au niveau base** : `RoomNight.@@unique([roomId, date])`.
3. **RBAC serveur robuste et fail-closed** : `PermissionsGuard` sans cache, `JwtAuthGuard` protège tout par défaut.
4. **Cohérence mono-hôtel totale** : zéro artefact `tenantId`/`hotelId`/`organizationId`.
5. **Idempotence réellement implémentée et testée dans le code** : paiements, acomptes, imports OTA.
6. **Aucune duplication de logique métier substantielle** détectée entre modules.
7. **Zéro donnée mockée dans le frontend**.
8. **Discipline documentaire des écarts** : chaque déviation majeure identifiée dans le code porte elle-même un commentaire l'expliquant.

---

## Faiblesses majeures

1. **Mécanisme d'avoir (`CreditNote`) entièrement absent** malgré sa présence dans le schéma et deux références actives dans le code.
2. **Réinitialisation de mot de passe non sécurisée** : token retourné directement dans la réponse HTTP.
3. **Absence totale de gating RBAC côté client**.
4. **Six modules backend fonctionnels sans aucune interface frontend** : self-checkin, police, notifications, document-ocr, channel-manager, audit.
5. **Filtrage soft-delete non centralisé**.
6. **`checkout()` ne bloque jamais sur un solde impayé**.
7. **`Company` (city ledger) totalement déconnectée du flux transactionnel**.
8. **Traçabilité écrite mais inexploitable** (`RoomStatusLog`).
9. **Zéro test unitaire de service**.
10. **Pas de déduplication de `Guest`**.

---

## Risques critiques

| Risque | Constat source | Impact |
|---|---|---|
| Prise de contrôle de compte via le token de reset exposé en clair | Phase 5 | Sécurité |
| Impossibilité de corriger une facture émise erronée | Phase 6 | Opérationnel |
| Registre de police légal sans moyen de saisie | Phases 6, 8 | Conformité |
| Check-out possible avec solde impayé sans alerte bloquante | Phase 6 | Financier |
| Contournement possible du blacklist via duplication de fiche client | Phase 3 | Métier |
| Absence de chiffrement au repos de la pièce d'identité | Phase 5 | Conformité/sécurité |
| Filtrage soft-delete non garanti structurellement | Phases 3, 4 | Intégrité |

---

## Ce qui est prêt

- La chaîne opérationnelle quotidienne réservation → check-in → séjour → housekeeping → check-out.
- Le RBAC serveur.
- La machine à états des chambres (housekeeping/maintenance).
- Le paiement et l'acompte (hors correction post-facture).
- Les écrans desktop principaux (réservations, check-in, housekeeping, clients, entreprises, RH, stock, reporting, paramètres).
- L'architecture backend (structure modulaire, DTO/validation, gestion d'erreurs, transactions).

## Ce qui manque

- Un mécanisme de correction de facture (avoir).
- Un flux de réinitialisation de mot de passe réellement sécurisé.
- Une interface de saisie du registre de police.
- Une interface staff pour le self-checkin, les notifications et le channel-manager.
- Un modèle de permission côté client.
- Un chiffrement au repos des données d'identité sensibles.
- Une garantie structurelle du soft-delete.
- Une règle de blocage du check-out sur solde impayé.
- Une couverture de test unitaire de la couche service.

---

## Priorités de suite

### Bloquant (avant toute mise en production réelle)

1. Implémenter le mécanisme d'avoir (`CreditNote`) — Phase 6.
2. Sécuriser la réinitialisation de mot de passe — Phase 5.
3. Fournir une interface de saisie du registre de police — Phases 6/8.
4. Trancher la question du chiffrement au repos de `Guest.pieceIdentite` — Phase 5.

### Important (non bloquant pour un lancement contrôlé)

5. Bloquer ou alerter explicitement sur un check-out à solde impayé — Phase 6.
6. Centraliser le filtrage soft-delete — Phases 3/4/9.
7. Livrer les interfaces frontend manquantes pour self-checkin, notifications, channel-manager — Phase 8.
8. Introduire une contrainte de déduplication client — Phase 3.
9. Ajouter un gating RBAC minimal côté frontend — Phases 5/8.

### Secondaire (dette technique, sans impact fonctionnel immédiat)

10. Nettoyer ou implémenter réellement les enums morts (`StatutSejour.ANNULE`, `StatutFacture.ANNULEE_PAR_AVOIR`).
11. Exposer une route de consultation de `RoomStatusLog` / `AuditLog`.
12. Réévaluer le découpage de `ReservationsService`.
13. Étendre la couverture de tests unitaires à la couche service.
14. Resynchroniser la documentation (17 vs 21 modules).
15. Clarifier la collision de nom `room-transitions.ts`.
16. Revoir la numérotation de facture si une remise à zéro mensuelle réelle est attendue.

---

## Recommandation finale

Le projet **n'est pas prêt pour une mise en production autonome en l'état** — non pas parce que son architecture serait fragile, mais parce que quatre écarts précis (correction de facture, sécurité de la réinitialisation de mot de passe, saisie du registre de police, chiffrement des données d'identité) touchent des usages que l'exploitation réelle d'un hôtel rencontrera nécessairement dans ses premières semaines. Ce sont des chantiers circonscrits et directement actionnables, pas une remise en cause de la conception d'ensemble.

La base technique — conventions d'écriture, séparation des responsabilités, discipline transactionnelle, absence de duplication, documentation honnête de ses propres écarts — est d'une qualité suffisante pour justifier de poursuivre le développement sur ces fondations plutôt que d'envisager une reprise structurelle.

### Note globale — Makarim PMS v1 : **7/10**

*(Moyenne des notes globales des phases chiffrées — Architecture 7, Backend 7,5, Base de données 7, Sécurité 6,5, Finance 6, Housekeeping/Maintenance 7,5, Frontend 6,5, Qualité du code 7,5 — arrondie et pondérée par la gravité des écarts bloquants identifiés en Finance et Sécurité.)*
