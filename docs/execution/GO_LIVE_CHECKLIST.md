# GO_LIVE_CHECKLIST.md — Protocole de Mise en Production & Go-Live de l'Établissement

Ce document répertorie l'ensemble des contrôles critiques d'exploitation technique, de sécurité et d'infrastructure système à valider avant d'activer le Property Management System (PMS) de l'Hôtel Makarim en environnement de production réelle.

---

## 🚀 Grille de Contrôle de Mise en Production (Go-Live)

Toutes les étapes doivent être marquées **[OK]** avant le lancement officiel en direct.

| Périmètre de Contrôle | Action / Vérification Physique | Statut | Responsable |
| :--- | :--- | :---: | :--- |
| **1. Sauvegarde d'Origine** | Sauvegarde à froid complète de la base de données existante | `[ ]` | Admin BD |
| **2. Clés & Secrets d'Env** | Configuration de `.env` en production (Aucun secret par défaut) | `[ ]` | DevOps |
| **3. JWT Security** | Définition d'une clé secrète JWT complexe (`JWT_SECRET` > 32 char) | `[ ]` | DevOps |
| **4. Cryptographie CRM** | Clé de chiffrement AES-256 (`ENCRYPTION_KEY`) CRM valide | `[ ]` | DevOps |
| **5. Sécurisation HTTPS** | Certificat SSL/TLS Let's Encrypt actif et valide sur le domaine | `[ ]` | DevOps |
| **6. Serveur Web Reverse Proxy**| Configuration Nginx optimisée avec en-têtes de sécurité (CORS/HSTS) | `[ ]` | DevOps |
| **7. Cloud SQL Production** | Instance Cloud SQL dimensionnée avec réplication Multi-Zone active | `[ ]` | DevOps / Admin BD |
| **8. Journalisation des Logs** | Collecte centralisée des logs applicatifs (Winston / Cloud Logging) | `[ ]` | DevOps |
| **9. Monitoring de l'Hôte** | Métriques système actives (Mémoire, CPU, taux d'occupation disque) | `[ ]` | DevOps |
| **10. Alertes Système** | Configuration d'alertes en cas d'erreurs 5xx ou de saturation | `[ ]` | DevOps |
| **11. Plan de Backups Automatiques**| Activation des sauvegardes quotidiennes avec rétention de 30 jours | `[ ]` | DevOps / Admin BD |
| **12. Plan de Reprise (Rollback)** | Documentation et validation de la procédure d'interruption Go-Live | `[ ]` | Équipe Ops |
| **13. Smoke Tests** | Tests de connectivité et de parcours de base en production | `[ ]` | Lead Developer / QA |
| **14. Approbation Métier** | Signature de conformité des fonctionnalités par le Product Owner | `[ ]` | Product Owner |
| **15. Accord Direction** | Autorisation officielle de bascule par la direction de l'hôtel | `[ ]` | Direction Générale |

---

## 📝 Guide Technique de Déploiement & Sécurisation

### 1. Variables d'Environnement & Chiffrement
*   **Alerte de Sécurité :** Toutes les variables d'environnement de production doivent être injectées via la console d'orchestration ou un gestionnaire de secrets sécurisé (Google Secret Manager).
*   **Validation :** Exécuter une commande de contrôle de configuration pour confirmer qu'aucun identifiant de pré-production ou de test n'est injecté.

### 2. reverse Proxy Nginx & HTTPS
*   Nginx doit rediriger de manière stricte le trafic HTTP vers HTTPS (Port 443).
*   Ajout obligatoire des en-têtes de sécurité pour neutraliser les injections de scripts ou le clickjacking :
    *   `Strict-Transport-Security: max-age=31536000; includeSubDomains`
    *   `X-Frame-Options: SAMEORIGIN`
    *   `X-Content-Type-Options: nosniff`

### 3. Monitoring & Planification de Reprise d'Activité (PRA)
*   **Alertes de Seuils :** Configurer une alerte sur Slack ou par SMS si la consommation CPU dépasse **80%** pendant plus de 5 minutes ou si le taux d'erreurs HTTP 500 dépasse 1% du trafic global.
*   **Plan de Secours (Rollback) :** En cas d'anomalie critique découverte au cours des 2 premières heures de mise en service :
    1.  Activation de la page de maintenance statique externe.
    2.  Restauration de la sauvegarde de la base de données d'origine.
    3.  Bascule du trafic DNS vers l'ancienne version stable ou plateforme temporaire.
    4.  Analyse post-mortem dans un environnement isolé.
