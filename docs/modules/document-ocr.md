# Spécification Technique — Module Scan OCR Pièce d'Identité (document-ocr.md)

*Créé lors de CH-018 (`docs/governance/REGISTRE_CHANTIERS.md`) — spec manquante malgré un module backend complet (F5) déjà largement documenté au fil de l'eau dans `CLAUDE.md`. Aucune interface frontend à ce jour (`CH-022`, à faire).*

---

## 1. Objectif du module

Le module **Scan OCR** extrait, à partir d'une photo de pièce d'identité (CIN ou passeport), les champs de la zone MRZ (Machine Readable Zone, norme ICAO 9303) pour préremplir la fiche client au check-in — de façon purement consultative, sans jamais écrire directement en base.

---

## 2. Responsabilités

Le module est seul responsable de :
* L'extraction OCR de la zone MRZ d'une image de pièce d'identité (CIN biométrique marocaine TD1, passeport TD3).
* Le parsing et la validation ICAO 9303 (chiffres de contrôle) des champs extraits.
* La distinction claire, dans sa réponse, entre un champ correctement lu et un avertissement de checksum invalide — sans jamais bloquer l'extraction des autres champs pour autant.

---

## 3. Hors périmètre

Le module n'intervient jamais dans :
* L'écriture sur `Guest` ou `PoliceRecord` — la réception relit et valide manuellement le résultat avant d'enregistrer via les endpoints existants (`GuestsService.update()`, `POST /police/:stayId`), qui restent les seuls chemins d'écriture.
* La persistance de l'image scannée — aucune écriture disque, aucune table Prisma propre à ce module.
* Toute logique métier de check-in ou de réservation — ce module est strictement consultatif, en amont du geste de saisie humain.

---

## 4. Entités manipulées

Ce module ne possède **aucune table Prisma propre** et ne lit ni n'écrit aucune entité du `DATA_DICTIONARY.md` — module feuille purement consultatif, même famille que `booking-engine` pour l'absence de table, mais sans même de lecture (booking-engine délègue au moins des lectures à `reservations`).

---

## 5. BUSINESS_RULES concernées

Aucune règle `BR-XXX` dédiée — la validation ICAO 9303 (norme internationale des documents de voyage lisibles en machine) est une contrainte technique externe, pas une règle métier interne.

---

## 6. ADR concernées

Aucune ADR dédiée — ce module ne touche à aucune entité soumise à ADR-005 (pas d'écriture, donc pas d'audit à porter) ni à ADR-006 au-delà de la réutilisation standard de `PermissionsGuard`.

---

## 7. Permissions RBAC

* `guests:write` (`POST /document-ocr/scan`) — **pas de clé de permission dédiée**, réutilise la permission du module `guests` : ce scan sert avant tout à préremplir la fiche client au check-in, même convention que `police`/`companies` réutilisant les permissions d'un autre module plutôt que d'en créer une nouvelle pour une fonctionnalité auxiliaire.

---

## 8. Flux entrants

Le module intercepte l'événement et la requête suivants :
* `POST /document-ocr/scan` — upload multipart d'une image (JPEG/PNG/WebP, 8 Mo max, `multer` en `memoryStorage()` — le fichier n'est jamais écrit sur disque ni persisté, traité en mémoire par l'OCR puis rejeté à la fin de la requête).

---

## 9. Flux sortants

Aucun — ce module n'émet aucun événement, n'écrit dans aucune table, et n'appelle aucun autre service métier.

---

## 10. Dépendances autorisées

Ce module n'a **aucune dépendance** — module feuille au sens le plus strict, même famille que `rooms`/`parameters` pour l'absence d'import de module métier, mais sans même de table propre à protéger.

---

## 11. Dépendances interdites

Ce module a l'interdiction stricte de dépendre de :
* Tout module métier — introduire une dépendance transformerait ce module consultatif en un point d'écriture, ce qui contredirait sa nature purement extractive.

---

## 12. Contraintes métier

* **`memoryStorage()` exclusif** : le fichier uploadé n'est jamais écrit sur disque — traité en mémoire par l'OCR puis rejeté à la fin de la requête (aucune trace de la photo de pièce d'identité après la réponse HTTP).
* **Worker Tesseract unique et réutilisé** : un seul worker `tesseract.js` partagé entre requêtes (coût de chargement du modèle de langue) — jamais un worker par appel.
* **Modèle de langue fourni en dépendance npm** (`@tesseract.js-data/eng`), pas téléchargé au runtime depuis le CDN par défaut de `tesseract.js` — évite toute dépendance réseau sortante au démarrage (un VPS peut restreindre l'egress) et rend le comportement reproductible (verrouillé par `package-lock.json`).
* **`cacheMethod: 'none'`** explicitement désactivé — comportement par défaut de `tesseract.js` constaté en le testant : une seconde copie décompressée du modèle de langue (22 Mo) apparaissait à la racine de `backend/`.
* **Un échec de checksum ne bloque jamais l'extraction** : `checksumValide: false` reste un avertissement informatif — une erreur OCR sur un champ ne doit jamais priver la réception des autres champs correctement lus.

---

## 13. Invariants

* **INV-OCR-001 (Aucune persistance)** : ni l'image uploadée ni le résultat de l'extraction ne sont jamais écrits en base ou sur disque par ce module.
* **INV-OCR-002 (Aucune écriture cross-module)** : ce module n'appelle jamais `GuestsService.update()` ni `POST /police/:stayId` lui-même — uniquement la réception, après relecture humaine du résultat retourné.

---

## 14. États manipulés

Ce module ne porte pas de machine à états — chaque appel est une extraction ponctuelle, sans état conservé entre deux requêtes (à l'exception du worker Tesseract partagé, un détail d'implémentation, pas un état métier).

---

## 15. Points sensibles

* **Qualité de l'OCR dépendante de la photo fournie** : angle, luminosité, résolution — aucune validation de qualité d'image en amont au-delà du type MIME et de la taille maximale (8 Mo).
* **Aucune interface frontend** (CH-022, à faire) — le backend est complet et vérifié en live, mais aucun écran ne l'exploite encore ; seule une intégration via un client HTTP direct (Swagger, script) permet de l'utiliser aujourd'hui.

---

## 16. Dette technique connue

* **CH-022** : interface frontend document-ocr (scan pièce d'identité) — backend prêt, aucune UI. Criticité faible (confort, pas une obligation contrairement à `police`/CH-003).

---

## 17. Fonctionnalités prévues ultérieurement

* **CH-022** (voir §16) : écran de scan avec upload + affichage des champs extraits, pré-remplissage assisté du formulaire client/police (jamais automatique, toujours une relecture humaine avant enregistrement, cohérent avec §3).

---

## 18. Checklist de Pull Request

Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Aucune écriture disque n'est introduite pour l'image uploadée (`memoryStorage()` reste exclusif).
* [ ] Aucune écriture directe n'est ajoutée sur `Guest`/`PoliceRecord` — ce module reste strictement consultatif.
* [ ] Un échec de checksum sur un champ ne bloque jamais l'extraction des autres champs.
* [ ] Le worker Tesseract reste unique et partagé entre requêtes, jamais recréé à chaque appel.
