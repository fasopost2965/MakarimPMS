# Logo officiel Hôtel Makarim Tétouan

`logo-makarim-source.jpg` est le fichier officiel fourni par l'utilisateur
le 2 août 2026 (1280×848, fond blanc). Il est conservé sans retouche afin de
préserver fidèlement le dessin et les couleurs de l'hôtel.

Usages actifs :

- repli visuel de la connexion, du mot de passe oublié et de la sidebar quand
  aucun logo personnalisé n'est enregistré dans `HotelConfig.logoUrl` ;
- favicon dynamique de repli après le chargement du frontend.

Le logo administrable depuis Paramètres reste prioritaire. Les documents PDF
continuent volontairement d'utiliser `HotelConfig.logoUrl` : cette source
configurable est leur contrat existant et ne doit pas être contournée par un
chemin de fichier frontend inaccessible au backend.
