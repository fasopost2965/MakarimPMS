# RELEASE_CHECKLIST.md

Version : 1.0
Statut : Document de gouvernance

---

# Objectif

Cette checklist est obligatoire avant toute mise en production de MakarimPMS.

Aucun déploiement ne doit être réalisé tant que tous les points ne sont pas validés.

---

# 1. Git

- [ ] Toutes les PR prévues sont fusionnées.
- [ ] Aucun conflit ouvert.
- [ ] `main` synchronisé avec `origin/main`.
- [ ] Aucun commit local.
- [ ] Aucun fichier non suivi (hors exceptions documentées).

---

# 2. CI

- [ ] Lint frontend.
- [ ] Lint backend.
- [ ] Build frontend.
- [ ] Build backend.
- [ ] Tests unitaires.
- [ ] Tests E2E.
- [ ] Workflow GitHub entièrement vert.

---

# 3. Base de données

- [ ] Migrations validées.
- [ ] Seed vérifié.
- [ ] Sauvegarde réalisée avant migration.
- [ ] Procédure de rollback disponible.

---

# 4. Infrastructure

- [ ] Docker opérationnel.
- [ ] MySQL sain.
- [ ] Redis sain.
- [ ] Backend sain.
- [ ] Frontend sain.
- [ ] Nginx sain.
- [ ] HTTPS valide.

---

# 5. Fonctionnel

- [ ] Connexion.
- [ ] Réservations.
- [ ] Check-in.
- [ ] Check-out.
- [ ] Paiements.
- [ ] Facturation.
- [ ] Housekeeping.
- [ ] Maintenance.
- [ ] Restaurant.
- [ ] Stock.

---

# 6. Sécurité

- [ ] RBAC vérifié.
- [ ] JWT valide.
- [ ] Secrets présents.
- [ ] Variables d'environnement contrôlées.
- [ ] Aucun secret dans Git.

---

# 7. Sauvegardes

- [ ] Base sauvegardée.
- [ ] Fichiers sauvegardés.
- [ ] Procédure de restauration testée.

---

# 8. Validation

| Domaine | Validation |
|----------|------------|
| Architecture | ☐ |
| QA | ☐ |
| Product Owner | ☐ |
| Go Live | ☐ |

---

# Historique

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 02/08/2026 | Création |
