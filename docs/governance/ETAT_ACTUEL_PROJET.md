# État actuel du projet — Makarim PMS v1 (vision post-audit, non commerciale)

*Dernière mise à jour : issue de l'audit technique 10 phases (`docs/audits/`). À maintenir à jour à chaque clôture de chantier significatif.*

## Ce qu'est le projet

PMS interne pour l'Hôtel Makarim (3 étoiles, 24 chambres, Tétouan) — pas de logique SaaS multi-tenant, mono-établissement par conception. Monorepo NestJS + Prisma + MySQL 8 (backend) et React + Vite + TS + Tailwind (frontend), pensé pour un déploiement Docker Compose sur VPS.

## Périmètre réel actuel (backend, 21 modules confirmés par lecture du code)

`auth`, `rooms`, `parameters`, `reservations`, `stay`, `housekeeping`, `maintenance`, `guests` (+ `companies`), `billing`, `payments`, `dashboard`, `audit`, `police`, `notifications`, `self-checkin`, `booking-engine`, `document-ocr`, `reporting`, `hr`, `stock`, `channel-manager`.

*(Note : `docs/modules/MODULES_INDEX.md` en déclare 13-17 selon les documents — désynchronisé du code réel, voir `ECARTS_DOC_VS_CODE.md` et chantier CH-018.)*

## Ce qui est prêt (audité, éprouvé, sans écart critique détecté)

- Chaîne opérationnelle quotidienne : réservation → check-in → séjour → housekeeping → check-out.
- RBAC serveur (vérification fraîche en base à chaque requête, fail-closed par défaut).
- Machine à états des chambres, avec rattrapage automatique à la lecture (pas de cron).
- Paiements et acomptes idempotents, correctement rattachés au folio.
- Écrans desktop principaux : réservations, check-in, housekeeping, maintenance, clients, entreprises, RH, stock, reporting, paramètres.
- Architecture backend (structure modulaire, validation DTO, gestion d'erreurs, transactions systématiques avec audit).

## Ce qui ne l'est pas

- **Correction de facture** : aucun mécanisme d'avoir n'existe. Une facture émise erronée n'est pas corrigible par le système (CH-001).
- **Sécurité de la réinitialisation de mot de passe** : le token est exposé en clair dans la réponse HTTP au lieu d'être envoyé par email (CH-002).
- **Registre légal de police** : l'obligation DGSN d'enregistrement des hébergés n'a aucune interface de saisie (CH-003).
- **Chiffrement des données d'identité** : `Guest.pieceIdentite` en clair, exigence documentée mais jamais implémentée (CH-004).
- **RBAC côté interface** : aucun rôle n'est reflété dans la navigation frontend — tout utilisateur voit tout.
- **Six surfaces backend sans interface** : self-checkin (staff), police, notifications, document-ocr, channel-manager, audit.
- **Blocage de check-out sur solde impayé** : aucune barrière, fuite de revenus possible.
- **Facturation entreprise (city ledger)** : `Company` existe mais est totalement déconnectée du flux transactionnel.

## Risques majeurs (voir `REGISTRE_RISQUES.md` pour le détail)

1. Prise de contrôle de compte via le token de reset exposé.
2. Facture erronée non corrigible.
3. Obligation légale de registre de police non tenable en usage réel du produit.
4. Fuite de revenus par check-out non contrôlé.
5. Contournement du blacklist par duplication de fiche client.
6. Exposition de données d'identité en cas de compromission de la base.

## Conditions minimales pour une mise en production réelle

Voir `CRITERES_GO_LIVE.md` pour la liste complète et vérifiable. En résumé : les 4 chantiers bloquants du registre (CH-001 à CH-004) doivent être soit livrés, soit — pour CH-004 uniquement — formellement acceptés comme risque documenté, avant toute ouverture en production réelle avec des clients payants.

## Priorités de suite

Voir `BACKLOG_PRIORISE.md` pour l'ordre d'exécution recommandé, et `../backend-plan/PLAN_BACKEND_100_REEL.md` / `../frontend-plan/` pour les plans de développement détaillés. Environnement de développement local opérationnel et documenté dans `../planning/ENVIRONNEMENT_LOCAL.md` (backend + frontend vérifiés en fonctionnement dans la session ayant produit cette documentation, connexion réelle testée).

## Note globale issue de l'audit

**7/10** — architecture et discipline d'écriture nettement au-dessus de la moyenne pour un projet de cette taille ; complétude fonctionnelle de la chaîne financière et de la sécurité périphérique en retrait par rapport à cette qualité de base. Voir `docs/audits/PHASE_10_SYNTHESE_ROADMAP.md` pour le détail du raisonnement.
