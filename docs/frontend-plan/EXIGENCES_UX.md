# Exigences UX/UI — Makarim PMS v1

Principes contraignants pour tout développement frontend futur, dérivés des constats d'audit (Phase 8) et des objectifs explicites du pilotage projet (clarté métier, rapidité d'usage, peu d'erreurs humaines, cohérence visuelle, sobriété, fiabilité, qualité perçue durable). Ce document n'est pas une charte graphique (le système « Ardoise & Laiton » existant, `index.css`, reste la référence visuelle) — c'est un ensemble de règles de comportement et de contenu à respecter écran par écran.

## Règles transverses obligatoires

1. **Aucune donnée simulée, jamais.** Confirmé comme pratique constante du projet (Phase 8) — tout nouvel écran doit être développé contre l'API réelle dès le premier commit, jamais contre un jeu de données statique « en attendant le backend ».
2. **Pattern chargement/erreur homogène.** Chaque nouvel écran doit suivre le patron déjà établi (`loading`, `error: string | null`, affichage inline) tant que `error-boundary`/`toast` (voir `COMPOSANTS_PARTAGES_MANQUANTS.md`) ne sont pas généralisés — ne pas introduire un troisième pattern différent en parallèle.
3. **Un contrôle dit ce qu'il fait, une confirmation dit ce qui s'est passé.** Un bouton « Générer le lien » ne doit jamais s'appeler « Envoyer » s'il ne fait qu'un `POST` sans garantie de livraison email — nommer les actions par ce qu'elles déclenchent réellement côté système, pas par l'intention idéale.
4. **Aucune action destructive ou financière sans confirmation explicite.** Cohérent avec la discipline déjà présente côté backend (motif ≥10 caractères pour les opérations sensibles) — un avoir (CH-001), une exclusion de taxe, un remboursement doivent avoir une étape de confirmation visible côté UI, pas un simple clic silencieux.
5. **Aucun écran ne doit prétendre à des droits que l'utilisateur n'a pas.** **CH-011 livré (session courante) avec une portée réduite par arbitrage produit** (RD-009, `docs/governance/REGISTRE_DECISIONS.md`) : un onglet entier non autorisé est désormais masqué (granularité onglet). Le masquage d'un bouton d'action précis à l'intérieur d'un écran partagé reste **hors périmètre** — un tel bouton, s'il existe un jour dans un écran visible par plusieurs rôles aux droits différents, resterait affiché puis potentiellement rejeté par un 403 tant qu'un futur chantier dédié à la granularité fine n'est pas tranché.

## États obligatoires par écran (rappel systématique, déjà implicite dans `CARTOGRAPHIE_ECRANS.md` mais à vérifier explicitement à la recette de chaque nouvel écran)

- **État vide** : jamais un écran blanc — toujours un message contextualisé (« Aucune réservation ce jour », pas juste une liste vide sans explication).
- **État de chargement** : jamais un flash de contenu vide avant les données — indicateur de chargement explicite, cohérent avec le pattern `loading` déjà en place.
- **État d'erreur** : le message d'erreur backend (déjà propre grâce à `AllExceptionsFilter`, Phase 4/5) doit être affiché tel quel ou reformulé de façon actionnable, jamais un message générique du type « Une erreur est survenue » qui masquerait une information utile déjà fournie par l'API.
- **Cas limites métier** : chaque écran de `CARTOGRAPHIE_ECRANS.md` liste ses cas limites propres — ils font partie du critère de recette, pas une amélioration ultérieure optionnelle.

## Exigences de sobriété et de fiabilité perçue (horizon 3-5 ans)

- **Pas d'animation ou d'effet décoratif qui ne sert pas la compréhension** — cohérent avec la nature du produit (outil de travail quotidien pour une petite équipe, pas une vitrine commerciale).
- **Densité d'information adaptée à un usage répété** — une réceptionniste qui utilise l'écran des dizaines de fois par jour a besoin de rapidité de lecture, pas de superflu visuel ; privilégier une hiérarchie typographique claire à des ornements.
- **Cohérence terminologique stricte avec le vocabulaire métier déjà établi côté backend** (français, termes déjà fixés : « séjour », « folio », « acompte », « avoir », « check-out » — ne jamais introduire un synonyme différent côté UI pour un concept déjà nommé ailleurs dans le système, source de confusion pour l'utilisateur qui verrait deux mots pour la même chose entre un écran et un document imprimé/exporté).
- **Aucun texte d'aide qui décrit un comportement technique plutôt que métier** — ex. ne jamais écrire « échec P2002 » côté utilisateur (déjà évité côté backend par `AllExceptionsFilter`, à ne pas réintroduire côté frontend par accident lors d'un affichage brut d'erreur).

## Exigences légales/opérationnelles spécifiques identifiées par l'audit

- **É-01 (police)** : le formulaire doit rendre visible, sans ambiguïté, qu'il s'agit d'une obligation légale et non d'un champ optionnel — cohérent avec le fait que c'est la seule fonctionnalité de la cartographie directement liée à une exigence réglementaire externe (DGSN).
- **É-05 (document-ocr)** : toute donnée extraite doit être présentée comme une proposition modifiable, jamais comme une vérité déjà validée — cohérent avec la posture strictement consultative du backend (confirmé Phase 2 : « jamais d'écriture directe sur Guest/PoliceRecord »).
- **Tout écran manipulant `Guest.pieceIdentite`** (É-01, É-05, fiche client existante) doit être conçu en anticipant que ce champ pourrait devenir chiffré au repos (CH-004) — ne pas construire d'affichage qui suppose une lecture en clair systématique sans passer par l'API (ex. pas de cache local du champ en dehors du cycle de vie normal du composant).

## Critère de validation UX transverse

Un nouvel écran n'est prêt pour recette que si, cumulativement : (1) il respecte le pattern chargement/erreur homogène ; (2) ses états vide/erreur/chargement sont explicitement vérifiés, pas seulement le cas nominal ; (3) sa terminologie est cohérente avec le vocabulaire déjà fixé ailleurs dans le produit (backend et autres écrans) ; (4) l'écran lui-même (l'onglet) n'est pas accessible à un rôle qui n'a pas la permission `:read` réelle sur le module — CH-011 livré, mais à la granularité onglet entier uniquement (RD-009) : ce critère ne garantit rien sur une action précise à l'intérieur d'un écran par ailleurs visible.
