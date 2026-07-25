<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

Copie `.env.example` en `.env` et ajuste au besoin (voir les commentaires du
fichier pour le détail de chaque variable) :

```bash
$ cp .env.example .env
```

- `DATABASE_URL` — MySQL (via `docker compose up -d mysql`, port hôte 3307).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — valeurs de dev fournies dans
  `.env.example` en local uniquement. **En `NODE_ENV=production`, le
  bootstrap refuse de démarrer si l'une des deux vaut encore sa valeur par
  défaut** (`src/common/config/assert-strong-secrets.ts`) — génère un secret
  aléatoire (`openssl rand -base64 48`) avant tout déploiement.
- `FRONTEND_URL` — seule origine autorisée par CORS (`credentials: true`,
  jamais de wildcard).
- `REDIS_HOST` / `REDIS_PORT` — file BullMQ pour les exports lourds du
  module `reporting` (via `docker compose up -d redis`, port hôte 6380).
  Sans Redis disponible, l'application ne démarre pas (`BullModule.forRoot`
  échoue à se connecter).
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` /
  `SMTP_FROM` — envoi des emails du module `notifications` (F7 :
  confirmation de réservation, rappel J-1, post-séjour). Toutes optionnelles
  — sans `SMTP_HOST`, `MailerService` journalise l'email au lieu de l'envoyer
  (aucun serveur SMTP requis en dev/CI).
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_SMS_FROM` /
  `TWILIO_WHATSAPP_FROM` — canaux SMS/WhatsApp du module `notifications`
  (F7 suite). Toutes optionnelles, même dégradation gracieuse que SMTP —
  sans `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`, `TwilioService` journalise
  le message au lieu de l'envoyer. Un canal (SMS ou WhatsApp) n'est
  réellement tenté par `NotificationsService.notify()` que si un template
  actif existe pour l'évènement — créer un `NotificationTemplate` avec
  `canal: "SMS"` ou `"WHATSAPP"` via `POST /notifications/templates` pour
  l'activer.
- `MOBILE_JWT_EXPIRES_IN` — durée de validité du jeton mobile housekeeping
  (F9, `POST /mobile/housekeeping/login`). Optionnelle, défaut `8h`. Même
  secret `JWT_ACCESS_SECRET` que le login desktop — pas de secret parallèle
  à générer.
- `CHANNEL_WEBHOOK_SECRET` — secret partagé protégeant les webhooks entrants
  du module `channel-manager` (F10, `POST /channel-manager/:canal/
  reservations|cancellations`, routes publiques puisqu'un OTA n'a pas de
  compte utilisateur PMS). Header attendu : `X-Channel-Webhook-Secret`.
  **Obligatoire** — sans elle, `ChannelWebhookGuard` refuse tout appel
  (fail closed, contrairement à SMTP/Twilio qui se dégradent en simple
  journalisation).

Puis applique les migrations et le seed de démonstration :

```bash
$ npx prisma migrate dev
$ npx prisma db seed
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

Documentation OpenAPI/Swagger interactive disponible sur
[`/api/docs`](http://localhost:3000/api/docs) tant que `NODE_ENV` n'est pas
`production` (désactivée en production, voir `src/main.ts`).

## Sécurité & robustesse (revue externe)

- **CORS** restreint à `FRONTEND_URL` avec `credentials: true` (pas de
  wildcard).
- **Rate limiting** (`@nestjs/throttler`) : 100 req/min/IP par défaut,
  5 req/min/IP sur `/auth/login` et `/auth/refresh` (`@Throttle` dans
  `AuthController`) ; `@SkipThrottle()` sur la route de healthcheck Docker.
- **Gestion d'erreurs** : `AllExceptionsFilter`
  (`src/common/filters/all-exceptions.filter.ts`) traduit les erreurs Prisma
  connues (`P2002`, `P2025`, `P2003`) en réponses HTTP propres (409/404) et
  masque toute stack trace derrière un 500 générique — journalisée
  côté serveur uniquement.
- **Logs structurés** (`nestjs-pino`) : JSON en production, format lisible
  (`pino-pretty`) en développement ; chaque requête HTTP entrante est
  journalisée automatiquement (méthode, chemin, code, durée). Le mot de
  passe, les tokens et l'en-tête `Authorization` sont toujours masqués.
- **File d'attente** (`@nestjs/bullmq` + Redis) : `GET
  /reporting/export/async` met en file un export du grand livre exécuté hors
  du thread principal, `GET /reporting/export/async/:jobId` en récupère le
  statut/résultat — additionnel au endpoint synchrone `GET /reporting/export`
  existant, inchangé.

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
