# Journal des interventions — MakarimPMS

Ajout seul, jamais réécrit. Une ligne par intervention vérifiée.

| Date | Agent | Branche | Commit | Action | Preuve |
|---|---|---|---|---|---|
| 2026-10-26 | Claude (chat) + Amadou | main (local) | 057112f | Correction backend : pino-pretty déplacé de devDependencies vers dependencies | `docker compose ps` : backend healthy ; `GET /api/health` = 200 ; logs sans erreur pino-pretty |
| 2026-10-26 | Claude (chat) + Amadou | main (local) | 057112f | Validation J1 (parcours locaux) : connexion, réservation, check-in, check-out + paiement, statut ménage, déconnexion | Logs backend : login 201, reservations 201, checkin 201, checkout 409 puis 201 après paiement (blocage solde attendu, CH-005), payments 201, invoices 201, housekeeping assignment 200 / start / complete / validate 201, logout 204 ; aucune réponse 5xx |
| 2026-10-26 | Claude (chat) + Amadou + agent VPS | main | be885d0 | Go-live étape 1 — sauvegarde MySQL : PR #126 mergée (`--no-tablespaces` + dump séparé de `pms_makarim_audit` avec `--databases`). Dépôt VPS mis à jour sur be885d0 (fast-forward, correctif de la modification locale non commitée repris par la PR). Tâche cron 03:00 de `deploy` vérifiée | Sauvegardes produites : `pms_makarim_*.sql.gz` (341 369 o, gzip OK) et `pms_makarim_audit_*.sql.gz` (24 303 o, gzip OK) ; `CREATE DATABASE`/`USE pms_makarim_audit` présents aux lignes 22/24 du dump audit. Restauration testée dans conteneur mysql:8 jetable, sans volume : six tables comptées identiques à la production (Room 24, Reservation 15, Folio 24, FolioLine 143, Guest 28, AuditLog 93), même dernière migration ; conteneur et volume anonyme supprimés, volumes de production inchangés |
| 2026-10-26 | Claude (chat) + agent VPS | — | — | Traefik (`/docker/traefik-jzil`, projet hPanel) arrêté et supprimé : il ne servait aucun domaine et redémarrait en boucle (conflit de port 80 avec Nginx hôte, 12 775 redémarrages). Volume `traefik-jzil_traefik-letsencrypt` conservé. Le projet doit aussi être retiré côté panneau Hostinger pour ne pas être recréé — à vérifier | `docker ps -a` : Traefik absent, 6 autres conteneurs « Up » ; `ss` : seul Nginx sur 80/443 ; `curl` pms.hotelmakarim.cloud et workflow.hotelmakarim.cloud → 200 ; surveillance de 3 min sans réapparition |
| 2026-10-26 | Claude (chat) | feat/offsite-backup-rclone | 5f21475 | Script de copie hors VPS `infra/scripts/offsite-backup.sh` (rclone crypt, vérification par `rclone check`) — poussé sur la branche, sans PR, non installé sur le VPS | `bash -n` OK ; aucune exécution sur le VPS à ce stade |

**Points ouverts au 2026-10-26 (fin de session)**
- Copie hors VPS (checklist point 11) : bloquante. Choix retenu : Google Drive (scope `drive.file`) chiffré par rclone crypt, en attente de la configuration sur le VPS. Côté transfert hors Maroc : à vérifier (loi 09-08, CNDP).
- Clé Backblaze B2 exposée dans une conversation : à révoquer dans la console. Ne pas la réutiliser.
- Version à déployer : serveur à be885d0, conteneurs encore sur les images e95bc31. Décision à prendre (reconstruire depuis main, ou garder e95bc31).
- Droits des fichiers : les fichiers ajoutés par le pull sont en root dans un arbre appartenant à `deploy`. Un `git pull` en `deploy` échouera. À harmoniser avant le déploiement automatique.
- Domaines : `www.hotelmakarim.cloud` sans certificat ; `makarimpms.cloud` sans DNS (bloc Nginx mort).
- Emails, SMS, WhatsApp : variables SMTP et Twilio vides en production, rien n'est envoyé réellement.
- Base `pms_makarim_audit` : désormais sauvegardée ; valeur légale à confirmer.
