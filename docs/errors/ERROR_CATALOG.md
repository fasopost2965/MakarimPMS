# ERROR_CATALOG.md — Catalogue des Codes d'Erreurs Applicatives

Ce document spécifie le référentiel unique et standardisé des codes d'erreurs fonctionnels et techniques du Property Management System (PMS) de l'Hôtel Makarim. L'ensemble des contrôleurs backend NestJS implémente cette charte de réponses d'erreurs pour garantir une intégration frontend robuste et une maintenance facilitée.

---

## 📋 Table des Matières
1. [Format Standardisé de Réponse d'Erreur](#1-format-standardisé-de-réponse-derreur)
2. [Référentiel des Codes d'Erreurs (PMS-XXX)](#2-référentiel-des-codes-derreurs-pms-xxx)
3. [Exemples d'Implémentation Backend (NestJS)](#3-exemples-dimplémentation-backend-nestjs)

---

## 1. Format Standardisé de Réponse d'Erreur

Lorsqu'un traitement échoue (validation de formulaire, règle métier violée, défaut d'autorisation), le backend retourne un code d'état HTTP approprié et un corps de réponse JSON structuré selon le contrat d'API transversal :

```json
{
  "success": false,
  "error": {
    "code": "PMS-XXX (Code d'erreur fonctionnel)",
    "message": "Explication claire en français compréhensible par l'utilisateur final.",
    "timestamp": "Date ISO-8601 de survenue de l'erreur côté serveur",
    "path": "URI de la route d'API sollicitée",
    "details": "Contexte technique additionnel pour le débogage (optionnel)"
  }
}
```

---

## 2. Référentiel des Codes d'Erreurs (PMS-XXX)

| Code Fonctionnel | Code HTTP | Libellé Technique | Message Utilisateur (Français) | Description & Contexte d'Apparition |
| :--- | :---: | :--- | :--- | :--- |
| **`PMS-001`** | `400` | `SCHEMA_VALIDATION_FAILED` | "Les informations saisies sont incorrectes ou incomplètes." | Données d'entrée non conformes au DTO (champs manquants, mauvais formats). |
| **`PMS-002`** | `403` | `RBAC_FORBIDDEN` | "Vous ne disposez pas des privilèges nécessaires pour effectuer cette action." | L'utilisateur est connecté mais son rôle ne contient pas la permission exigée (`BR-TR-004`). |
| **`PMS-003`** | `401` | `AUTHENTICATION_REQUIRED` | "Votre session a expiré ou est invalide. Veuillez vous reconnecter." | Token JWT manquant, altéré, expiré, ou révoqué suite à une mise à jour de version (`tokenVersion`). |
| **`PMS-004`** | `404` | `RESOURCE_NOT_FOUND` | "La ressource demandée est introuvable." | Identifiant UUID inexistant (ex: chambre, fiche client, facture). |
| **`PMS-005`** | `409` | `DOUBLE_BOOKING_CONFLICT` | "Cette chambre est déjà réservée ou occupée pour les dates sélectionnées." | Violation directe de la règle d'exclusion de double-booking hôtelier (`BR-RES-001`). |
| **`PMS-006`** | `422` | `ROOM_NOT_READY` | "Cette chambre n'est pas disponible pour un check-in immédiat (non propre ou en panne)." | Tentative d'enregistrement de séjour dans une chambre qui n'est pas `LIBRE_PROPRE` ou `RESERVEE` (`BR-CHA-003`). |
| **`PMS-007`** | `422` | `FOLIO_LOCKED` | "Ce dossier financier est clôturé et facturé. Aucune modification n'est permise." | Tentative d'ajout ou de modification d'écriture sur un folio marqué comme `estVerrouille = true` (`BR-FAC-002`). |
| **`PMS-008`** | `422` | `CHECKOUT_BALANCE_NON_ZERO` | "Impossible de valider le départ. Le solde du client doit être de 0.00 MAD." | Tentative de validation de départ (`Check-Out`) sur un dossier client non totalement apuré (`BR-FAC-001`). |
| **`PMS-009`** | `403` | `GUEST_BLACKLISTED` | "Opération refusée. Ce client figure sur la liste noire de l'établissement." | Tentative de création de réservation ou de séjour pour un client signalé comme blacklisté (`BR-CLI-002`). |
| **`PMS-010`** | `409` | `IDEMPOTENCY_KEY_REDUNDANT` | "Cette transaction a déjà été enregistrée par le serveur." | Détection d'une clé d'idempotence (`Idempotency-Key`) déjà présente en base de données (`ADR-004`). |
| **`PMS-011`** | `409` | `ACTIVE_SHIFT_CONFLICT` | "Vous possédez déjà une session de pointage active." | Tentative de Clock-In alors qu'un shift de présence est déjà marqué actif ou en pause (`BR-RH-005`). |
| **`PMS-012`** | `400` | `LOGOUT_BLOCKED_SHIFT_ACTIVE` | "Déconnexion refusée. Veuillez pointer votre fin de service (Clock-Out) avant de vous déconnecter." | Interception d'un logout utilisateur alors qu'un shift de travail est toujours en cours (`BR-RH-004`). |
| **`PMS-013`** | `403` | `AUDIT_LOG_IMMUTABILITY_VIOLATION` | "Action interdite. Les traces de sécurité ne peuvent être modifiées." | Tentative d'exécution d'une requête SQL d'écriture de type `UPDATE` ou `DELETE` sur la table d'audit log (`ADR-005`). |
| **`PMS-014`** | `422` | `IDENTITY_DOCUMENT_REQUIRED` | "Le dossier client exige l'enregistrement complet de sa pièce d'identité." | Tentative de reporting de police ou d'opération sans le type et numéro de pièce d'identité réglementaire (`BR-CLI-003`). |

---

## 3. Exemples d'Implémentation Backend (NestJS)

Pour implémenter de manière propre ce catalogue, le backend utilise des exceptions personnalisées héritant de `HttpException` de NestJS, capturées par un filtre global (`ExceptionFilter`).

### 3.1. Classe d'Exception de Base (`PmsException`)
```typescript
import { HttpException, HttpStatus } from '@nestjs/common';

export class PmsException extends HttpException {
  constructor(
    public readonly pmsCode: string,
    public readonly userMessage: string,
    status: HttpStatus,
    public readonly details?: any
  ) {
    super(userMessage, status);
  }
}
```

### 3.2. Exemple d'Exception Métier : Double Réservation
```typescript
import { HttpStatus } from '@nestjs/common';
import { PmsException } from './pms-exception';

export class DoubleBookingException extends PmsException {
  constructor(roomId: string, date: string) {
    super(
      'PMS-005',
      'Cette chambre est déjà réservée ou occupée pour les dates sélectionnées.',
      HttpStatus.CONFLICT,
      { roomId, dateNuit: date }
    );
  }
}
```

### 3.3. Filtre Global de Capture (`PmsExceptionFilter`)
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';
import { PmsException } from './pms-exception';

@Catch()
export class PmsExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = 500;
    let code = 'PMS-999';
    let message = 'Une erreur interne serveur est survenue.';
    let details = null;

    if (exception instanceof PmsException) {
      status = exception.getStatus();
      code = exception.pmsCode;
      message = exception.userMessage;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = 'PMS-001';
      message = exception.message;
    } else {
      // Log technique interne pour les administrateurs
      console.error('Unhandled System Error:', exception);
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
        ...(details && { details })
      }
    });
  }
}
```
