# DECISIONS_ARCHITECTURE

Version : 1.1\
Date : 02 août 2026\
Statut : Référence officielle des décisions d'architecture

------------------------------------------------------------------------

# Objet

Ce document centralise les décisions d'architecture **validées** pour
MakarimPMS. Il ne décrit pas les idées, mais uniquement les règles
approuvées qui doivent être respectées par le code, les revues et les
futures Pull Requests.

------------------------------------------------------------------------

# Principes de gouvernance

## ADR-0001 --- Évolution incrémentale

Le projet ne sera jamais réécrit. Toute évolution part de l'existant.

## ADR-0002 --- Une mission = une branche = une Pull Request

Chaque évolution possède : - une branche dédiée ; - une PR dédiée ; -
une revue ; - une fusion uniquement après validation.

## ADR-0003 --- Documentation synchronisée

Toute évolution importante doit mettre à jour la documentation de
gouvernance lorsqu'elle impacte l'architecture ou les décisions.

------------------------------------------------------------------------

# Architecture applicative

## ADR-0010 --- Le backend est la source de vérité

Aucune règle métier critique ne doit exister uniquement dans le
frontend.

## ADR-0011 --- RoomsService est propriétaire des chambres

Les transitions de statut et leur cohérence sont centralisées dans
RoomsService.

## ADR-0012 --- ReservationsService est propriétaire de la disponibilité

La disponibilité ne doit jamais être recalculée dans un autre module.

## ADR-0013 --- StayService pilote le cycle de séjour

Check-in, séjour et check-out passent par StayService.

## ADR-0014 --- BillingService est propriétaire des écritures financières

Les écritures Folio, Invoice et Credit Note ne sont pas créées
directement par d'autres modules.

## ADR-0015 --- PaymentsService gère les paiements

Les paiements n'écrivent pas directement les écritures comptables.

## ADR-0016 --- GuestsService pilote les données client

Catégories, identité et blacklist sont centralisées.

## ADR-0017 --- MaintenanceService pilote les immobilisations

Les indisponibilités liées à la maintenance passent par
MaintenanceService.

## ADR-0018 --- HousekeepingTaskService

La fondation est validée. Le service deviendra l'autorité des tâches de
ménage lorsque les lots HK-P1-03B et suivants seront fusionnés.

------------------------------------------------------------------------

# Qualité et sécurité

## ADR-0020 --- Les migrations Prisma sont immuables

Une migration appliquée n'est jamais modifiée.

## ADR-0021 --- Les règles métier ne sont jamais dupliquées

Une règle métier doit avoir un propriétaire unique.

## ADR-0022 --- Les modules communiquent via leurs services

Aucun accès direct aux données internes d'un autre module.

## ADR-0023 --- Les services critiques ne sont pas contournés

Les services propriétaires restent les seuls points d'écriture.

------------------------------------------------------------------------

# Gouvernance IA

## ADR-0030 --- Rôle de Codex

Codex implémente les missions validées, réalise les tests, produit les
rapports et n'effectue jamais de fusion.

## ADR-0031 --- Rôle de ChatGPT

ChatGPT assure l'architecture, le Product Ownership, les audits, les
revues et les décisions.

## ADR-0032 --- Rôle de Google AI Studio

Google AI Studio est réservé aux travaux UX/UI, responsive,
accessibilité et Design System. Il ne modifie pas les règles métier, les
API, Prisma ou les contrats backend.

------------------------------------------------------------------------

# Historique

  -----------------------------------------------------------------------
  Version                Date            Description
  ---------------------- --------------- --------------------------------
  1.0                    02/08/2026      Première consolidation

  1.1                    02/08/2026      Alignement avec la gouvernance
                                         et les décisions validées
  -----------------------------------------------------------------------
