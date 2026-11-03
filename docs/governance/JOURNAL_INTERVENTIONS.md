# Journal des interventions — MakarimPMS

Ajout seul, jamais réécrit. Une ligne par intervention vérifiée.

| Date | Agent | Branche | Commit | Action | Preuve |
|---|---|---|---|---|---|
| 2026-10-26 | Claude (chat) + Amadou | main (local) | 057112f | Correction backend : pino-pretty déplacé de devDependencies vers dependencies | `docker compose ps` : backend healthy ; `GET /api/health` = 200 ; logs sans erreur pino-pretty |
| 2026-10-26 | Claude (chat) + Amadou | main (local) | 057112f | Validation J1 (parcours locaux) : connexion, réservation, check-in, check-out + paiement, statut ménage, déconnexion | Logs backend : login 201, reservations 201, checkin 201, checkout 409 puis 201 après paiement (blocage solde attendu, CH-005), payments 201, invoices 201, housekeeping assignment 200 / start / complete / validate 201, logout 204 ; aucune réponse 5xx |
| 2026-11-03 | Codex | main (local) | be885d0 | Démarrage local et validation des 6 parcours ; fast-forward, migrations/seed Prisma, rebuild Compose backend/frontend | `docker compose ps` : mysql/redis/backend/frontend healthy ; backend 200, frontend 200 ; login 201, réservation 201, check-in 201, paiement 201, check-out 201, ménage assignment 200 / start / complete / validate 201, logout 204 puis endpoint protégé 401 |
| 2026-11-03 | Codex | be885d0 | J2 | Inventaire VPS et accès corrigé | `makarim-vps` → Ubuntu 24.04, Docker 29.7/Compose 5.3.1, `deploy` dans `docker`, volumes MySQL/Redis persistants ; n8n séparé laissé intact. |
| 2026-11-03 | Codex | be885d0 | J2 | Sauvegarde avant mutation | `backup-mysql.sh` réussi : PMS 336K et audit 24K à `20261103T175814Z`, rétention locale 14 jours. |
| 2026-11-03 | Codex | be885d0 | J2 | Mise à niveau vers main et migrations | Copie de travail `main` à `be885d0` ; builds backend/frontend réussis, frontend construit avec `VITE_API_URL=https://api.hotelmakarim.cloud/api`, migrations Prisma : 50 trouvées, schéma à jour. |
| 2026-11-03 | Codex | be885d0 | J2 | Bascule stable et HTTPS | Images locales `:stable` actives ; health `200` ; DNS pms/api vers `187.127.225.143` ; certificat SAN valide jusqu'au 2026-12-27 ; HSTS et en-têtes de sécurité présents sur les deux domaines. |
| 2026-11-03 | Codex | be885d0 | J2 | Restauration isolée et rollback | Dump restauré dans une base temporaire de contrôle avec 56 tables puis supprimée ; rollback `stable` → `sha-e95bc317` → `stable`, deux états healthy. |
| 2026-11-03 | Codex | be885d0 | J2 | Smoke-test et parcours réel | Smoke-test corrigé pour les paramètres/dates booking : 7 OK / 0 échec ; parcours room 1 : login 201, check-in 201, paiement 400 MAD / 201, check-out 201. |
| 2026-11-03 | Codex | be885d0 | J2 | Limites documentées | `certbot --dry-run` nécessite sudo/root ; rclone est installé mais aucun remote Google Drive/crypt n'est configuré, donc la copie hors VPS reste à activer. |
