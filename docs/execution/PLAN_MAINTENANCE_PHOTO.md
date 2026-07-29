# PLAN_MAINTENANCE_PHOTO.md — CH-055, upload photo réel des tickets de maintenance

**Origine** : contrairement aux chantiers CH-051 à CH-054 (déclenchés par l'audit comparatif `main` vs `v2`), ce gap n'a pas été trouvé dans `v2` — il est explicitement documenté dans **le propre code de `main`**, `frontend/src/features/maintenance/pages/MaintenancePage.tsx` ligne 51 :

> « Pas d'upload de photo réel dans cette itération — photoUrl est un simple champ texte. »

**Vérifié dans le code, pas supposé** :
- `backend/prisma/schema.prisma` (`MaintenanceTicket.photoUrl`, ligne 825) : `String?` — sans annotation `@db.*`, Prisma génère une colonne MySQL `VARCHAR(191)`. Insuffisant pour un data URI base64 d'image (plusieurs dizaines à centaines de Ko).
- `backend/src/modules/maintenance/dto/create-maintenance-ticket.dto.ts` : `photoUrl?: string` avec seulement `@IsOptional() @IsString()` — aucune contrainte de longueur ni de format aujourd'hui.
- `frontend/src/features/maintenance/pages/MaintenancePage.tsx` (lignes 211/229/305-308) : un simple `<Input>` texte où l'utilisateur devrait coller une URL — aucun mécanisme d'upload réel.
- `docs/modules/maintenance.md` §16 (Dette technique connue) : « Aucune dette technique identifiée à ce stade » — ce gap n'y est pas encore consigné, à corriger dans ce chantier.
- Le composant partagé `frontend/src/components/ui/file-upload.tsx` (`FileUpload`, Lot B4) existe déjà et est utilisé par `DocumentOcrPage` — mais via `multipart/form-data` (upload d'un `File` brut vers un endpoint `multer`), pas via une conversion base64. Son API (`value: File | null`, `onChange`, `accept`, `hint`) reste réutilisable telle quelle pour la sélection du fichier ; seule la conversion en sortie diffère.

## Décision d'approche

Deux approches étaient possibles : (a) stockage disque réel (`multer.diskStorage` + route de service statique + volume Docker dédié), ou (b) data URI base64 stocké directement dans la colonne `photoUrl`. Retenu : **(b)**, pour des raisons explicites :

1. **Cohérence avec un précédent déjà établi dans ce projet** : `document-ocr` (F5) utilise déjà `multer` en `memoryStorage()` et documente explicitement le choix de **ne jamais persister l'image sur disque** (`document-ocr.controller.ts`) pour éviter toute dépendance à un volume/chemin d'egress supplémentaire sur le VPS. Un stockage disque introduirait ici la première exception à cette convention, pour un besoin (une photo de panne, taille modeste, volumétrie faible — 24 chambres) qui ne le justifie pas.
2. **Aucune infrastructure nouvelle** : pas de volume Docker Compose dédié, pas de route de service statique Nginx à sécuriser, pas de nettoyage de fichiers orphelins à prévoir — un vrai gain de simplicité pour un projet à cette échelle.
3. **Compromis assumé et documenté** (pas un oubli) : une colonne `LongText` grossit la ligne MySQL et n'a pas de miniature pré-calculée — acceptable ici vu le volume de tickets attendu (hôtel de 24 chambres), mais **plafonné explicitement** côté DTO pour ne jamais laisser un flux illimité (voir plus bas).

## Portée retenue

1. **Migration Prisma** : `MaintenanceTicket.photoUrl String? @db.LongText` (au lieu de `VARCHAR(191)`), migration nommée `ch055_maintenance_photo_longtext`.
2. **Validation DTO** (`CreateMaintenanceTicketDto.photoUrl`) : `@Matches(/^data:image\/(jpeg|png|webp);base64,/)` (rejette toute valeur qui n'est pas un data URI image reconnu) + `@MaxLength(7_000_000)` (~5 Mo de fichier original avant l'inflation ~1,37× du base64 — cohérent avec le plafond 8 Mo déjà utilisé par `document-ocr` pour une image de pièce d'identité, légèrement réduit ici car une photo de panne n'a pas besoin de la même résolution).
3. **Frontend** : remplacer l'`<Input>` texte par `<FileUpload accept="image/jpeg,image/png,image/webp" ... />` dans `CreateTicketForm` ; conversion `File → data URI` via `FileReader.readAsDataURL` côté client, avec un contrôle de taille (5 Mo) avant même l'appel réseau pour un retour immédiat.
4. **Affichage** : dans la liste des tickets, une miniature cliquable (`<img>` `h-10 w-10 rounded object-cover`) apparaît si `ticket.photoUrl` est renseigné ; un clic ouvre l'image en plein format dans un `Dialog` existant (même composant que partout ailleurs dans l'appli, pas de nouveau composant de lightbox).

**Hors périmètre** (non lié à ce gap précis, à ne pas ajouter par glissement de portée) : édition/réouverture de ticket, `EN_COURS`/`ANNULE` (les 2 états documentés dans `maintenance.md` §14 mais jamais implémentés côté service — dette pré-existante, distincte de celle-ci) — non touchés ici.

## Tests prévus

- Backend (`maintenance.e2e-spec.ts`) : rejet 400 d'un `photoUrl` qui n'est pas un data URI image valide, rejet 400 au-delà du plafond de taille, acceptation d'un data URI valide de petite taille.
- Frontend (Vitest) : sélection d'un fichier via `FileUpload` déclenche bien la conversion et l'inclusion dans le payload de création ; le contrôle de taille côté client bloque un fichier trop lourd avec un message clair.
- Vérification navigateur réelle (Playwright) : création d'un ticket avec une vraie image de test, miniature affichée dans la liste, ouverture en plein format via le `Dialog`, nettoyage du ticket de test après vérification.
- `npm run build`/`lint`/`test` (backend + frontend) clean, aucune régression sur le reste du module maintenance.
