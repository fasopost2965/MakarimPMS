# RELEASE_CHECKLIST.md — Protocole de Validation & Liste de Contrôle de Release

Ce document formalise les étapes obligatoires à exécuter, valider et signer par l'équipe d'ingénierie avant d'autoriser la livraison et la mise en production d'une nouvelle version du Property Management System (PMS) de l'Hôtel Makarim.

---

## 📅 Grille de Validation de Release

Toutes les étapes doivent être marquées **[OK]** avant le tag officiel de la version.

| Étape de Contrôle | Commande / Action | Statut | Responsable |
| :--- | :--- | :---: | :--- |
| **1. Compilation Générale** | `npm run build` (Sans erreur ni avertissement) | `[ ]` | Lead Developer |
| **2. Validation du Linter** | `npm run lint` (Zéro avertissement ou erreur) | `[ ]` | Équipe QA |
| **3. Tests Automatiques** | `npm run test` (100% de réussite de la suite) | `[ ]` | Lead Developer |
| **4. Couverture Globale** | `npm run test:cov` (Couverture locale > 85%) | `[ ]` | Équipe QA |
| **5. Migration Base de Données** | `npx prisma migrate status` / Migration staging | `[ ]` | Administrateur BD |
| **6. Scénario de Rollback** | Test d'application et d'annulation de migration SQL | `[ ]` | Administrateur BD |
| **7. Audit de Sécurité** | `npm audit` / Scan des dépendances tiers au vert | `[ ]` | Responsable Sécurité |
| **8. Performance & Latence** | Contrôle de latence des requêtes API d'écriture (< 150ms) | `[ ]` | Lead Developer |
| **9. Alignement Doc & ADR** | Répertoire `/docs` mis à jour avec les nouveaux endpoints | `[ ]` | Architecte |
| **10. Journal des Changements**| Rédaction et validation du fichier `CHANGELOG.md` | `[ ]` | Product Owner |
| **11. Alignement SemVer** | Incrémentation formelle du numéro de version (`package.json`) | `[ ]` | Lead Developer |
| **12. Tag de Version Git** | `git tag -a vX.Y.Z -m "Release description"` | `[ ]` | Lead Developer |

---

## 🛠️ Description Détaillée des Processus

### 1. Compilation & Linter (DoD Étape 1 & 2)
*   **Action :** Exécuter localement et sur le serveur de CI la compilation complète de l'application NestJS/React.
*   **Vigilance :** Aucun avertissement (Warning) sur des variables non utilisées ou des importations obsolètes n'est toléré pour la livraison.

### 2. Couverture de Code & Tests
*   **Action :** Générer le rapport de couverture et s'assurer que les branches d'écriture critiques (calculs fiscaux, transactions financières de paiement, guards de sécurité RBAC) affichent **100%** de couverture de test.

### 3. Sûreté des Données & Rollback SQL
*   **Action :** Simuler sur l'environnement de développement ou d'intégration l'application de la nouvelle migration Prisma SQL (`prisma migrate deploy`) puis simuler sa restauration descendante (Rollback) pour garantir la reprise d'activité sans perte de données en cas d'erreur lors du déploiement réel.

### 4. Audit de Sécurité Transverse
*   **Action :** Exécuter un audit de sécurité sur le code source et vérifier qu'aucune vulnérabilité de haute priorité n'est présente dans l'arbre des modules d'exécution installés (`node_modules`).

### 5. Journalisation des Changements (Changelog)
*   Le document `CHANGELOG.md` doit documenter :
    *   Les nouvelles fonctionnalités ajoutées.
    *   Les correctifs de bugs appliqués.
    *   La liste des éventuels changements de structures physiques (Prisma schemas).
