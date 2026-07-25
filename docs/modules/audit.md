# Spécification Technique — Module Audit & Sécurité (audit.md)

---

## 1. Objectif du module
Le module **Audit & Sécurité** fournit un dispositif de traçabilité immuable, indépendant et inviolable de l'ensemble des activités sensibles et anomalies d'exploitation au sein de l'Hôtel Makarim. Il assure la conformité légale hôtelière en protégeant les historiques d'audits contre toute altération et permet à la direction de déceler instantanément d'éventuelles tentatives de fraudes ou d'intrusions.

---

## 2. Responsabilités
Le module est seul responsable de :
* L'interception et l'écriture synchrone et transactionnelle de chaque trace d'action sensible dans la table `AuditLog`.
* La consignation obligatoire des justifications de corrections d'heures de pointage et de modifications rétroactives d'extras.
* La journalisation détaillée et immédiate de toute tentative d'accès non autorisée décelée par les gardes RBAC.
* La publication sécurisée du registre d'audit global à l'attention exclusive de l'Administrateur de la plateforme.
* La garantie de non-suppression et d'immutabilité absolue des journaux d'audits stockés.

---

## 3. Hors périmètre
Le module n'intervient jamais dans :
* La journalisation de télémétries techniques fictives ou d'état de ressources système du serveur (anti-ai-slop).
* L'exécution opérationnelle de tâches de ménage ou de maintenance physique.
* Le blocage actif de transactions financières (le module d'audit écoute et consigne, il ne prend pas de décision métier directe de blocage financier).

---

## 4. Entités manipulées
Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `AuditLog` (Enregistrement immuable de l'événement de sécurité)
* `User` (Association obligatoire de l'auteur de l'action auditée)

---

## 5. BUSINESS_RULES concernées
Les règles métiers applicables à ce module sont :
* **BR-AUD-001 (Audit d'ajustement d'heures) :** Tracement synchrone et obligatoire des motifs de corrections de shifts de présence d'un collaborateur.
* **BR-AUD-002 (Audit d'anomalies de facturation) :** Historisation et documentation obligatoire de toute réduction, remise de tarif de nuitée ou soft-delete d'extras.
* **BR-AUD-003 (Registre immuable d'audit) :** Caractère inviolable et indélébile du journal de sécurité central.

---

## 6. ADR concernées
Les décisions d'architecture impactant ce module sont :
* **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md) :** Cœur de conception de la persistance immuable, de la règle d'interdiction de suppression physique et de l'interception systématique des anomalies d'exploitation.
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md) :** Droits de lecture exclusifs du registre d'audit.
* **[ADR-007 (Time Shift & Attendance State Machine)](/docs/ADR-007-Time-Shift-Attendance.md) :** Tracement obligatoire des corrections de shifts par les RH.

---

## 7. Permissions RBAC
Les habilitations requises pour interagir avec ce module sont :
* `audit:read` : Autorisé exclusivement pour `ADMINISTRATEUR`.
* `audit:write` (Écriture de log) : Réservé à l'exécution automatique et interne du serveur de production. Aucun utilisateur de l'application PMS ne peut écrire manuellement ou forcer la saisie d'un log d'audit de sécurité arbitraire en production.
* *Note :* Aucun rôle d'exploitation (Réception, Comptable, Ménage, Technique, RH) n'a d'accès de lecture sur le journal de sécurité central.

---

## 8. Flux entrants
Le module intercepte les événements de sécurité et requêtes de traçabilité suivants :
* Demande d'ajustement d'heures d'employé par un manager RH (intercepte l'événement d'écriture d'audit).
* Demande de soft-delete ou d'annulation de ligne de folio par un Comptable.
* Tentative de connexion infructueuse ou de violation d'accès de route protégée par un utilisateur (levé par les gardes RBAC).
* Modification d'un tarif négocié de nuitée hôtelière de séjour de client.

---

## 9. Flux sortants
Le module produit et diffuse les événements suivants :
* `LOG_D_AUDIT_ENREGISTRE` : Trace de sécurité scellée en base.
* `ALERTE_INCIDENT_SECURITE` : Alerte de haute priorité émise vers l'administrateur en cas de violations répétées des barrières RBAC ou de modifications suspectes de tarifs hôteliers.

---

## 10. Dépendances autorisées
Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `auth` : Pour récupérer de manière étanche et certifiée par le serveur l'identité (`User.id`) de l'utilisateur de la session JWT à l'origine de l'action sensible auditée.

---

## 11. Dépendances interdites
Ce module a l'interdiction stricte de dépendre de :
* `billing` / `payments` / `housekeeping` / `maintenance` / `guests` / `reservations` / `hr` : Pour écarter tout risque de couplage circulaire avec les modules opérationnels du système hôtelier. Le module d'audit capte des signaux passifs d'activités, mais ne doit jamais interroger ou dépendre de la logique fonctionnelle ou de la persistance de ces derniers pour fonctionner. *Justification : Préservation absolue de la résilience d'exécution de la brique de traçabilité.*

---

## 12. Contraintes métier
* **Format Étanchéifié d'Événement :** Chaque ligne d'enregistrement dans la table `AuditLog` doit impérativement consigner de manière synchrone :
  * Un horodatage précis et incontestable généré par le serveur (`timestamp`).
  * L'adresse IP réseau de l'appareil client émetteur de la requête.
  * L'identifiant physique de l'utilisateur auteur de l'action (`userId`).
  * Le nom de l'action ou de l'endpoint d'API ciblé.
  * Le type d'opération technique réalisée (CREATE, UPDATE, DELETE).
  * L'ancienne valeur de l'attribut modifié (`oldValue` au format JSON).
  * La nouvelle valeur de l'attribut modifié (`newValue` au format JSON).
  * Un motif textuel explicatif de la modification d'au moins **10 caractères** rédigé par l'auteur de l'action.

---

## 13. Invariants
* **INV-AUD-001 (Registre Append-Only de Sécurité) :** La table `AuditLog` est strictement **en insertion seule (Append-Only)**. Aucune route d'API, aucun service d'écriture, ni aucun contrôleur ne doit exposer d'opération de mise à jour (`update`) ou de suppression physique (`delete`) sur les traces d'audit de sécurité.
* **INV-AUD-002 (Non-Modifiabilité physique) :** Le schéma relationnel MySQL de production interdit toute opération de mise à jour ou suppression physique sur la table pivot d'audit log via des déclencheurs SQL restrictifs (Triggers).

---

## 14. États manipulés
Le registre d'audit n'implémente pas de machine à états ; il s'agit d'un flux de traces chronologiques linéaires successives indélébiles.

---

## 15. Points sensibles
* **La taille de la base de données d'audits :** Risque de saturation de la base de données hôtelière en production en cas de journalisation de volume extrême d'activités triviales.
  * *Résolution :* Sélection rigoureuse des événements d'audits d'exploitation sensibles (changements de prix, annulations de séjours, modifications de plannings et de fiches salariés, violations d'accès) et exclusion des logs triviaux d'ergonomie frontend (ex: *Clics de navigation, simple consultation de fiches*).

---

## 16. Dette technique connue
* *Aucune dette technique identifiée à ce stade.*

---

## 17. Fonctionnalités prévues ultérieurement
* **Phase 4 :** Système d'alerte SMS immédiat vers le directeur de l'hôtel en cas de modifications anormales et répétées de tarifs ou d'annulations de factures en pleine nuit.

---

## 18. Checklist de Pull Request
Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Le contrôleur d'API de consultation des audits de sécurité exige de manière étanche la permission exclusive de rôle `ADMINISTRATEUR`.
* [ ] Aucun endpoint de mise à jour (`update`) ou de suppression physique (`delete`) n'est implémenté ou exposé dans l'application pour la table `AuditLog`.
* [ ] L'écriture d'un log d'audit s'accompagne obligatoirement de la validation de la longueur minimale de 10 caractères du motif explicatif textuel.
* [ ] L'extraction de l'identité de l'auteur de l'action auditée provient exclusivement de la session JWT authentifiée par le serveur, éliminant tout paramètre client manipulable.
