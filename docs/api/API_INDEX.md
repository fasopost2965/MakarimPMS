# API_INDEX.md — Répertoire Officiel des Contrats d'API (REST / OpenAPI First)

Ce document constitue la table des matières officielle et le guide d'intégration technique de référence de l'ensemble des interfaces REST du **Property Management System (PMS) de l'Hôtel Makarim**. Il liste tous les contrats d'API et définit les standards techniques transversaux s'appliquant à l'ensemble des contrôleurs backend développés par Claude Code.

---

## 📋 1. Répertoire des Contrats de Modules

| Module PMS | Spécification Technique | Description | Rôle Minimum | Version |
| :--- | :--- | :--- | :--- | :--- |
| **01. Réservations** | [`reservations-api.md`](./reservations-api.md) | Enregistrement, planification et cycle de vie des arrivées. | Réception | `v1` |
| **02. Séjours** | [`stay-api.md`](./stay-api.md) | Enregistrement d'arrivée (Check-in), Walk-in et départs. | Réception | `v1` |
| **03. Clients** | [`guests-api.md`](./guests-api.md) | CRM hôtelier, identification nationale et liste noire. | Réception | `v1` |
| **04. Chambres** | [`rooms-api.md`](./rooms-api.md) | Inventaire et machine à états commerciale de disponibilité. | Réception | `v1` |
| **05. Housekeeping** | [`housekeeping-api.md`](./housekeeping-api.md) | Planification d'entretien et déstockage des produits d'accueil. | Gouvernante | `v1` |
| **06. Maintenance** | [`maintenance-api.md`](./maintenance-api.md) | Tickets d'intervention et blocage technique des chambres. | Maintenance | `v1` |
| **07. Facturation** | [`billing-api.md`](./billing-api.md) | Multi-folios, émission de factures et d'avoirs immuables. | Comptable | `v1` |
| **08. Paiements** | [`payments-api.md`](./payments-api.md) | Enregistrement des règlements et protection double paiement. | Comptable | `v1` |
| **09. Comptabilité** | [`accounting-api.md`](./accounting-api.md) | Validation fiscale du CA, TVA et déclaration des charges. | Comptable | `v1` |
| **10. RH & Pointage** | [`hr-api.md`](./hr-api.md) | Planning de shifts, pointage inviolable et paie CNSS. | RH | `v1` |
| **11. Stocks** | [`stock-api.md`](./stock-api.md) | Gestion des fournisseurs et seuils d'alertes matières. | Gouvernante | `v1` |
| **12. Reporting** | [`reporting-api.md`](./reporting-api.md) | Dashboards d'exploitation et fichiers de police nationaux. | Réception | `v1` |
| **13. Audit** | [`audit-api.md`](./audit-api.md) | Journalisation immuable d'opérations et de sécurité. | Administrateur | `v1` |

---

## ⚙️ 2. Standards Techniques Communs

L'ensemble des APIs développées respecte rigoureusement la charte d'ingénierie technique suivante :

### 2.1. Format d'Échange de Données
*   **Contenu :** Les requêtes (`body`) et les réponses sont impérativement formatées en **JSON** (`Content-Type: application/json`).
*   **Format d'écriture :** Utilisation stricte du format **camelCase** pour les clés JSON (ex. `guestId`, `checkIn`, `quantitePhysique`).
*   **Précision Décimale :** Tous les montants financiers (prix, taxes, montants HT/TTC, totaux de folios) sont encodés et transmis sous forme de valeurs numériques précises ou chaînes de caractères représentant des décimaux (pas d'arrondi binaire flottant).

### 2.2. En-têtes HTTP Transversaux

Chaque requête adressée aux contrôleurs applicatifs doit intégrer les en-têtes suivants :
*   **`Authorization: Bearer <JWT_TOKEN>`** : Requis pour tous les endpoints sécurisés. Transmet l'identité et les rôles de l'utilisateur.
*   **`Idempotency-Key: <UUIDv4>`** : Obligatoire pour toutes les requêtes d'écriture ou de modification majeure (`POST /api/...`, `PATCH /api/.../status`) afin de se prémunir des doubles traitements liés aux congestions réseau.
*   **`Accept-Language: fr`** : Requis pour orienter les messages de validation et d'erreurs en langue française.

---

## 🚫 3. Enveloppe Globale de Gestion d'Erreurs

En cas d'échec de traitement ou de non-respect d'un invariant de sécurité, le serveur retourne systématiquement un code HTTP d'erreur accompagné d'une enveloppe JSON standardisée :

```json
{
  "success": false,
  "error": {
    "code": "string (Code technique unique, ex: 'DOUBLE_BOOKING_CONFLIT')",
    "message": "string (Explication claire en français, ex: 'Cette chambre est occupée ou réservée sur la période spécifiée.')",
    "timestamp": "string (ISO-8601 YYYY-MM-DDTHH:mm:ssZ)",
    "path": "string (URI appelée, ex: '/api/v1/reservations')",
    "details": "object ou array (Informations de débogage complémentaires ou liste de champs non validés, optionnel)"
  }
}
```

### Codes Techniques Standard d'Erreur :
*   `VALIDATION_SCHEMA_ECHEC` : Données d'entrée invalides (champs manquants, types incorrects, etc.).
*   `ACCESS_DENIED_RBAC` : Rôle d'utilisateur insuffisant pour exécuter l'action demandée.
*   `RESOURCE_NOT_FOUND` : Identifiant ou référence inexistant en base de données.
*   `IDEMPOTENCY_KEY_REDUNDANT` : Tentative de ré-exécution d'une transaction déjà validée avec la même clé.
*   `BUSINESS_RULE_VIOLATION` : Violation directe d'une règle métier (ex: solde de checkout différent de 0 MAD).

---

## 🔒 4. Directives de Sécurité Transverses

1.  **Vérification RBAC Systématique (Côté Serveur) :**
    *   Tout endpoint d'écriture ou de lecture doit faire l'objet d'une interception par le middleware d'autorisation. Aucune route ne doit être laissée accessible sans vérification explicite des droits.
2.  **Immutabilité des Écritures d'Audit :**
    *   Toute écriture dans la table `AuditLog` est définitive. Le code applicatif ne doit exposer aucun contrôleur ni méthode d'accès SQL permettant les commandes `UPDATE` ou `DELETE` sur cette table.
3.  **Soft Delete Invariant :**
    *   L'effacement d'entités sensibles (Réservations, Séjours, Clients) s'effectue exclusivement par des mises à jour logiques (`deletedAt`). L'utilisation de commandes SQL de destruction physique (`DELETE`) est rigoureusement interdite en production.
