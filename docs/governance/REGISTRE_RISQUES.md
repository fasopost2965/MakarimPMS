# Registre des risques — Makarim PMS v1

Chaque risque cite sa source d'audit, sa probabilité d'occurrence en usage réel (jugement qualitatif, pas un calcul statistique — **à confirmer/affiner par le métier si besoin**), son impact, et le chantier qui l'adresse.

| ID | Risque | Source | Probabilité en usage réel | Impact | Chantier | Statut |
|---|---|---|---|---|---|---|
| R-01 | Prise de contrôle de compte via le token de reset password exposé en clair | Phase 5 §1, §4 | Élevée (exploitable dès qu'un attaquant connaît un email + a accès à l'API) | Critique | CH-002 | **Fermé** — CH-002 terminé (session courante) : le token n'est plus jamais retourné dans la réponse HTTP, envoyé exclusivement à l'adresse email du compte via `MailerService`. Vérifié par test e2e (absence du champ dans les deux branches de réponse + preuve que l'email est réellement envoyé). |
| R-02 | Facture émise erronée non corrigible par le système | Phase 6 §3, §7 | Élevée (une erreur de facturation survient nécessairement sur la durée) | Critique | CH-001 | **Fermé** — CH-001 terminé (session courante) : `POST /invoices/:id/credit-notes` permet d'annuler une facture émise (avoir total, motif obligatoire) puis d'en régénérer une corrigée sur le même folio sans jamais rejouer les lignes de taxe déjà matérialisées. Vérifié par test e2e (immuabilité de la facture d'origine, blocage du double-avoir, absence de doublon de taxe à la régénération). |
| R-03 | Registre de police légal non tenu en usage réel (absence de saisie UI) | Phases 6, 8 | Élevée (si aucun canal alternatif de saisie n'existe) | Critique (conformité DGSN) | CH-003 | Ouvert |
| R-04 | Check-out avec solde impayé non tracé/bloqué | Phase 6 §5 | Modérée à élevée selon discipline de caisse de la réception | Élevé (financier) | CH-005 | Ouvert |
| R-05 | Contournement du blacklist par recréation de fiche client | Phase 3 §5.5 | Faible à modérée (nécessite une intention du client ou une erreur de saisie) | Modéré (métier) | CH-010 | Ouvert |
| R-06 | Exposition des données d'identité en cas de compromission de la base | Phase 5 §3 | Faible (nécessite une compromission préalable) mais impact fort si elle survient | Critique (conditionnel) | CH-004 | Ouvert |
| R-07 | Résurgence de données soft-deleted par oubli du filtre manuel dans un futur développement | Phases 3, 4, 9 | Modérée (dépend de la vigilance des futurs développeurs) | Modéré | CH-006 | Ouvert |
| R-08 | Acompte imputé sans chemin de remboursement fonctionnel | Phase 6 §4 | Modérée (cas réel mais pas quotidien) | Modéré | CH-012 (dépendance CH-001 levée, chantier non démarré) | Ouvert |
| R-09 | Personnel voit des fonctionnalités hors de son rôle réel (UX trompeuse, pas une faille technique) | Phases 5, 8 | Élevée (visible en permanence) | Faible à modéré (perception, pas une brèche de sécurité en soi) | CH-011 | Ouvert |
| R-10 | Fonctionnalités backend livrées (F5, F6, F7 gestion, F10) inutilisables faute d'UI | Phase 8 §2 | Certaine (déjà vérifiée) | Modéré (valeur déjà développée non exploitée) | CH-007, CH-008, CH-009, CH-022 | Ouvert |
| R-11 | Absence de verrouillage de compte après échecs de connexion répétés | Phase 5 §3 | Faible dans un contexte de réseau hôtelier fermé, plus élevée si l'API est exposée publiquement | Modéré | CH-026(c) | Ouvert |
| R-12 | Régression silencieuse sur une règle métier fine faute de tests unitaires de service | Phase 4 §4, §6 | Modérée et croissante avec le volume de futurs développements | Modéré à élevé selon la règle touchée | CH-017 | Ouvert (structurel, continu) |

## Risques déjà couverts (pour référence — ne pas re-traiter)

- **R-01** (prise de contrôle de compte via token de reset exposé) — fermé, CH-002 terminé. Le mécanisme de fuite n'existe plus : la réponse HTTP de `POST /auth/forgot-password` ne contient jamais de jeton, dans aucune branche. Vérifié par test e2e (assertion négative sur les deux cas, plus une assertion positive que l'email est réellement transmis).
- **R-02** (facture émise erronée non corrigible) — fermé, CH-001 terminé. `BillingService.createCreditNote()` permet l'avoir total et la régénération d'une facture corrigée sur le même folio. Vérifié par test e2e (immuabilité de la facture d'origine, blocage du double-avoir, absence de doublon de taxe à la régénération, preuve sabotage/restore pour la garde anti-double-taxe).

## Méthode de mise à jour

Quand un chantier passe à `terminé` dans `REGISTRE_CHANTIERS.md`, le risque correspondant ici doit être requalifié : soit `Fermé` (le mécanisme technique élimine le risque), soit `Réduit` (le risque persiste mais avec une probabilité/impact revus à la baisse — préciser pourquoi), jamais silencieusement retiré du tableau. Un historique des risques fermés reste utile pour la transmissibilité à 3-5 ans.
