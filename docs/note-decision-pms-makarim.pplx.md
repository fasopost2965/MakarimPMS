# Note de décision — Poursuivre ou non le développement interne du PMS (Hôtel Makarim)

**Question posée :** faut-il continuer à développer/héberger en interne le PMS propriétaire de l'Hôtel Makarim (24 chambres, Tétouan), ou basculer vers une solution PMS commerciale (SaaS) ?

## Recommandation

**Ne pas poursuivre le développement interne en l'état. Adopter une solution PMS SaaS commerciale** (ex. eZee Absolute, Hotelogix ou Sirvoy Pro — déjà présentes ou compatibles avec le Maroc), sauf si l'un des points de vigilance ci-dessous change la donne.

## Pourquoi

- **Coût comparable, risque inférieur.** Un PMS SaaS complet (réservations, channel manager, booking engine) coûte 6 000 à 36 000 MAD/an pour 24 chambres, contre 40 000 à 150 000 MAD de développement initial + 15-20 %/an de maintenance pour le build interne — sans compter le temps développeur non facturé.
- **Le vrai problème n'est pas le prix, c'est la fonctionnalité manquante.** L'automatisation Gmail + n8n capte les emails Booking.com mais ne renvoie pas disponibilités/tarifs vers les OTA en temps réel. Un channel manager commercial fait cette synchronisation bidirectionnelle et ramène le risque de surbooking à quasi zéro — ce que le build actuel ne résout pas, quel que soit le budget investi dans son amélioration.
- **Gains chiffrés côté « Buy ».** Le modèle de revenus associé projette un bénéfice net supérieur d'environ **900 000 MAD sur 3 ans** pour le scénario Buy par rapport au statu quo, contre environ **35 000 MAD** pour le scénario Build — essentiellement grâce au gain de RevPAR (revenue management) et à la hausse des réservations directes que le build interne ne permet pas de capter.
- **Marché mature et accessible.** Plusieurs éditeurs sont déjà implantés ou distribués au Maroc, avec support en français et mise en service en quelques jours plutôt qu'en semaines.

## Ce qui pourrait changer la conclusion

- Si l'hôtel a une **ambition de commercialiser** ce PMS à d'autres établissements (produit, pas outil interne) — l'équation économique change complètement et justifierait une analyse séparée.
- Si les **coûts d'abonnement réels négociés** avec un éditeur dépassent largement les fourchettes de marché observées (à valider par des devis directs).
- Si des **contraintes de souveraineté des données** ou d'intégration avec des outils propriétaires existants imposent une solution 100 % interne.

## Prochaines étapes suggérées

1. Demander 2-3 devis réels (eZee, Hotelogix, Sirvoy) pour confirmer le coût d'abonnement exact sur 24 chambres.
2. Chiffrer le coût réel déjà englouti dans le PMS actuel, pour éviter le biais des coûts irrécupérables (« sunk cost »).
3. Si le passage à une solution SaaS est validé, prévoir une période de transition courte (import des données, formation du personnel).

*Note basée sur le [rapport d'analyse de marché et de la concurrence](./analyse-marche-concurrence-pms-hotel-makarim.pplx.md) et le [tableau de modélisation des revenus](./modelisation_revenus_pms_makarim.xlsx) associés. Hypothèses modifiables : ADR, taux d'occupation, part des réservations OTA, coûts d'abonnement et de développement — voir onglet Hypothèses du fichier Excel.*
