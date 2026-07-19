# SECURITY_HANDBOOK.md — Manuel de Sécurité, Chiffrement & PCA/PRA

Ce document spécifie la politique de sécurité logique, physique et organisationnelle s'appliquant au Property Management System (PMS) de l'Hôtel Makarim. Il définit les protocoles d'authentification, de contrôle d'accès (RBAC), d'audit, de chiffrement de données, de sauvegarde, ainsi que le plan de continuité et de reprise d'activité (PCA/PRA).

---

## 📋 Table des Matières
1. [Authentification & Sécurisation par Jeton JWT](#1-authentification--sécurisation-par-jeton-jwt)
2. [Middleware de Contrôle d'Accès RBAC](#2-middleware-de-contrôle-daccès-rbac)
3. [Immutabilité de l'Audit & Logs de Sécurité](#3-immutabilité-de-laudit--logs-de-sécurité)
4. [Chiffrement des Données (Transit & Rest)](#4-chiffrement-des-données-transit--rest)
5. [Politique de Sauvegardes & Backups](#5-politique-de-sauvegardes--backups)
6. [Plan de Continuité & de Reprise d'Activité (PCA/PRA)](#6-plan-de-continuité--de-reprise-dactivité-pcapra)

---

## 1. Authentification & Sécurisation par Jeton JWT

La sécurité d'accès au serveur d'API NestJS s'appuie sur le protocole standard OAuth2 / JWT (JSON Web Tokens).

### 1.1. Double Jeton (Access / Refresh Tokens)
*   **Access Token (Jeton d'Accès) :**
    *   *Portée :* Transmis dans l'en-tête HTTP `Authorization: Bearer <TOKEN>`. Contient l'identifiant utilisateur, le nom complet, le rôle d'exploitation de l'hôtel, et la version du jeton (`tokenVersion`).
    *   *Durée de validité :* **15 minutes** (Limite l'exposition en cas de compromission temporaire).
*   **Refresh Token (Jeton de Rafraîchissement) :**
    *   *Portée :* Stocké exclusivement côté navigateur dans un Cookie sécurisé **`HttpOnly`**, **`Secure`**, et **`SameSite=Strict`** pour se prémunir des attaques de type XSS (Cross-Site Scripting) et CSRF (Cross-Site Request Forgery).
    *   *Durée de validité :* **7 jours**.

### 1.2. Mécanisme de Révocation Active (`tokenVersion`)
Pour permettre aux administrateurs de révoquer instantanément la session d'un employé suspect ou de forcer l'application d'un changement de rôle RBAC sans attendre l'expiration naturelle des tokens :
1.  Chaque jeton JWT embarque le champ `tokenVersion` extrait de la table `User` en base de données.
2.  Le middleware d'authentification NestJS interroge de façon optimisée (cache en mémoire / Redis) la version actuelle de l'utilisateur.
3.  Si la colonne `tokenVersion` en base est supérieure à la valeur présente dans le JWT décodé, le jeton est immédiatement déclaré invalide et la requête rejetée avec un code d'erreur `PMS-003` (`401 Unauthorized`).

---

## 2. Middleware de Contrôle d'Accès RBAC

Chaque endpoint de l'API REST subit une validation d'accès stricte côté serveur (`BR-TR-004`).

### 2.1. Interception à Deux Niveaux
*   **Niveau 1 : `JwtAuthGuard`** — Vérifie la signature et la validité du jeton d'accès pour s'assurer que la requête provient d'un collaborateur authentifié.
*   **Niveau 2 : `PermissionsGuard`** — Extrait la liste des permissions associées au rôle de l'utilisateur (via la table pivot `RolePermission`) et vérifie si le code d'accès de l'endpoint est présent.

### 2.2. Exemple d'Annotation Contrôleur (NestJS) :
```typescript
@Controller('api/v1/accounting/expenses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpensesController {
  
  @Post()
  @Permissions('expenses:write') // Vérifie la permission requise dans la matrice RBAC
  async createExpense(@Body() createExpenseDto: CreateExpenseDto) {
    return this.expensesService.registerExpense(createExpenseDto);
  }
}
```

---

## 3. Immutabilité de l'Audit & Logs de Sécurité

La traçabilité complète de l'activité de l'Hôtel Makarim est un impératif d'intégrité comptable (`ADR-005`).

### 3.1. Règle d'Immutabilité Absolue
La table `AuditLog` enregistre toutes les actions hautement sensibles (annulation de charge, blacklist d'un client, pointage horaire). Les privilèges de la base de données SQL pour le compte applicatif standard sont configurés pour **interdire catégoriquement** les instructions `UPDATE` et `DELETE` sur cette table. Toute tentative de modification des traces d'audit déclenche une exception SQL bloquante et lève une alerte critique système.

### 3.2. Traçabilité des Actions
Chaque écriture d'audit capture obligatoirement :
*   L'horodatage précis du serveur (serveur de temps NTP de Tétouan).
*   L'identifiant unique de l'utilisateur auteur de l'acte (`userId`).
*   L'adresse IP source de l'appareil (`userIp`).
*   La référence physique de la ressource impactée (`entityName`, `entityId`).
*   La description détaillée de l'acte et sa justification textuelle obligatoire.

---

## 4. Chiffrement des Données (Transit & Rest)

### 4.1. Données en Transit (In Transit)
*   **Protocole obligatoire :** L'ensemble des flux de données entre l'interface React cliente, le serveur d'API NestJS et la base de données MySQL / PostgreSQL utilise exclusivement le protocole **HTTPS** et des tunnels sécurisés **SSL/TLS 1.3** avec chiffrement fort (AES-256).
*   **Sécurisation Iframe :** Les en-têtes HTTP de sécurité (`Content-Security-Policy`, `X-Frame-Options`) sont configurés pour restreindre l'exécution du PMS aux seuls domaines officiellement approuvés par l'hôtel.

### 4.2. Données au Repos (At Rest)
*   **Hachage des Mots de Passe :** Les mots de passe du personnel sont hachés de manière unidirectionnelle avec l'algorithme **bcrypt** (facteur de coût configuré à 12 salages).
*   **Chiffrement des Fiches Clients (CRM) :** Pour respecter la législation marocaine sur la protection des données personnelles (loi 09-08 de la CNDP), les numéros de pièces d'identité (CIN, Passeport) sont stockés sous forme chiffrée en base de données en utilisant l'algorithme de chiffrement symétrique standard **AES-256-GCM** (clé de chiffrement gérée par un coffre-fort de secrets sécurisé).

---

## 5. Politique de Sauvegardes & Backups

Pour parer à toute perte accidentelle d'historique comptable ou opérationnel, la base de données s'appuie sur une politique de sauvegarde automatisée managée :

1.  **Backups Quotidiens :** Une sauvegarde intégrale (Snapshot) de la base de données est exécutée automatiquement chaque nuit à 03:00 (heure creuse de l'établissement).
2.  **Rétention :** Conservation des sauvegardes quotidiennes sur une durée glissante de **30 jours**. Sauvegarde mensuelle conservée pendant **12 mois** pour les obligations d'audit fiscal.
3.  **Stockage Déporté et Immuable :** Les fichiers de sauvegarde sont copiés et stockés dans un compartiment de stockage cloud (Cloud Storage Bucket) géographiquement distant du serveur de production, configuré en mode d'immutabilité physique (WORM - Write Once Read Many) pour contrer les cyberattaques de type Ransomware.

---

## 6. Plan de Continuité & de Reprise d'Activité (PCA/PRA)

L'Hôtel Makarim est un établissement opérationnel 24h/24 et 7j/7. Le PMS doit afficher un taux de disponibilité minimal de **99.9%**.

### 6.1. Plan de Continuité d'Activité (PCA - Haute Disponibilité)
*   **Infrastructure Sans Serveur (Serverless High-Availability) :** L'application NestJS et le frontend React sont déployés dans des conteneurs managés hautement disponibles (Google Cloud Run / AWS ECS) répartis sur plusieurs zones de disponibilité physique. En cas de panne matérielle d'une zone, le trafic est instantanément redirigé vers une zone saine sans coupure de service pour la Réception.
*   **Mise à l'échelle automatique (Autoscaling) :** Ajustement automatique du nombre d'instances de conteneurs en fonction de l'afflux d'utilisateurs ou des extractions comptables lourdes.

### 6.2. Plan de Reprise d'Activité (PRA - Reprise après Sinistre)
*   **Objectif de Temps de Récupération (RTO) :** Inférieur à **4 heures** en cas de sinistre physique complet du centre de données principal.
*   **Objectif de Point de Récupération (RPO) :** Perte maximale admissible de données fixée à **15 minutes** (assurée par la réplication de base de données synchrone ou asynchrone sur un serveur esclave de secours).
*   **Procédure d'urgence Réception (Mode Hors-Ligne Temporaire) :**
    *   En cas de coupure internet généralisée de la ville de Tétouan, la Réception dispose d'une procédure dégradée : impression automatisée par le PMS chaque matin à 06:00 de la grille d'occupation des chambres de la journée et de la liste des arrivées prévues. Saisie manuelle des fiches d'arrivées papier, puis synchronisation rétroactive dans le PMS dès le retour de la liaison internet.
