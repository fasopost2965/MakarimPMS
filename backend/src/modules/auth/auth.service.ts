import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailerService } from '../notifications/mailer.service';
import { LoginDto } from './dto/login.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const RESET_TOKEN_TTL_MINUTES = 30;
const BCRYPT_SALT_ROUNDS = 10;
// CH-026(c) — verrouillage de compte : réutilise LoginLog (aucune migration,
// la table existait déjà pour l'audit succès/échec, CLAUDE.md règle 4) plutôt
// qu'un champ dédié type `lockedUntil`. Verrouillé si les LOCKOUT_THRESHOLD
// tentatives les plus récentes dans la fenêtre glissante sont TOUTES des
// échecs — un succès (ou une fenêtre qui expire) débloque naturellement,
// sans tâche de fond ni cron (cohérent avec l'absence de cron dans ce
// projet, CLAUDE.md). Compromis assumé (documenté en RD) : un verrouillage
// révèle qu'un compte existe (message distinct de « identifiants
// invalides ») — tradeoff connu et accepté de tout mécanisme de
// verrouillage de compte (OWASP), impact limité pour un effectif de
// quelques employés.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mailerService: MailerService,
  ) {}

  // Vérifie le mot de passe (bcrypt, jamais en clair) et journalise la
  // tentative (succès ou échec — CLAUDE.md règle 4, trace d'audit) via
  // LoginLog — partagé par login() (jeton desktop complet) et
  // loginMobile() (F9, jeton mobile à portée réduite) : un seul chemin de
  // vérification des identifiants, jamais dupliqué.
  private async authenticateCredentials(dto: LoginDto, ip: string | undefined) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });

    if (user && (await this.isLockedOut(user.id))) {
      // Tentative comptée comme un échec supplémentaire : un attaquant qui
      // continue d'essayer pendant le verrouillage reste verrouillé en
      // continu plutôt que de voir la fenêtre glissante expirer sous lui.
      await this.prisma.loginLog.create({
        data: { userId: user.id, succes: false, ip },
      });
      throw new UnauthorizedException(
        `Compte temporairement verrouillé après ${LOCKOUT_THRESHOLD} échecs de connexion. Réessayez dans quelques minutes.`,
      );
    }

    const passwordValid = user
      ? await bcrypt.compare(dto.motDePasse, user.motDePasseHash)
      : false;

    if (!user || !passwordValid || !user.actif) {
      if (user) {
        await this.prisma.loginLog.create({
          data: { userId: user.id, succes: false, ip },
        });
      }
      throw new UnauthorizedException('Identifiants invalides.');
    }

    await this.prisma.loginLog.create({
      data: { userId: user.id, succes: true, ip },
    });

    return user;
  }

  // Verrouillé si les LOCKOUT_THRESHOLD tentatives les plus récentes (dans
  // la fenêtre glissante) sont toutes des échecs. Moins de THRESHOLD lignes
  // dans la fenêtre, ou un succès parmi elles => pas verrouillé.
  private async isLockedOut(userId: number): Promise<boolean> {
    const windowStart = new Date(
      Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000,
    );
    const recentLogs = await this.prisma.loginLog.findMany({
      where: { userId, createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'desc' },
      take: LOCKOUT_THRESHOLD,
      select: { succes: true },
    });
    return (
      recentLogs.length === LOCKOUT_THRESHOLD &&
      recentLogs.every((log) => !log.succes)
    );
  }

  // Connexion desktop : émet une paire access/refresh token complète.
  async login(dto: LoginDto, ip: string | undefined) {
    const user = await this.authenticateCredentials(dto, ip);

    return this.issueTokens({
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.nom,
    });
  }

  // F9 — connexion mobile housekeeping : mêmes identifiants/mot de passe
  // que le desktop (un seul compte User par employé, pas de second
  // référentiel), mais un unique jeton à portée réduite (scope
  // "mobile-housekeeping") et TTL bien plus court que l'access token
  // desktop — jamais de refresh token mobile (ré-authentification
  // périodique volontairement simple plutôt qu'un second flux de refresh à
  // sécuriser). Même secret JWT_ACCESS_SECRET (déjà validé par
  // assertStrongSecrets) — pas de secret parallèle à gérer.
  async loginMobile(dto: LoginDto, ip: string | undefined) {
    const user = await this.authenticateCredentials(dto, ip);

    const expiresIn = this.config.get<string>(
      'MOBILE_JWT_EXPIRES_IN',
      '8h',
    ) as unknown as number;

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        roleId: user.roleId,
        roleName: user.role.nom,
        scope: 'mobile-housekeeping',
      } satisfies AuthenticatedUser,
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn,
      },
    );

    return { accessToken };
  }

  // CH-026(f) — rotation à usage unique : un refresh token n'est valide que
  // pour un seul appel, révoqué ici avant d'en émettre un nouveau. Un jeton
  // volé et rejoué après que le titulaire légitime a déjà rafraîchi échoue
  // désormais (auparavant, un JWT stateless restait valable jusqu'à
  // expiration naturelle quel que soit le nombre de réutilisations).
  async refresh(refreshToken: string) {
    let payload: AuthenticatedUser;
    try {
      payload = await this.jwt.verifyAsync<AuthenticatedUser>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }

    // Filet de sécurité : un jeton signé avant le déploiement de CH-026(f)
    // (donc sans jti) reste cryptographiquement valide jusqu'à son
    // expiration naturelle mais n'a pas de ligne RefreshToken associée —
    // rejeté explicitement plutôt que de planter sur `payload.jti: undefined`.
    const stored = payload.jti
      ? await this.prisma.refreshToken.findUnique({
          where: { jti: payload.jti },
        })
      : null;
    if (!stored || stored.revokedAt) {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!user || !user.actif) {
      throw new UnauthorizedException('Utilisateur introuvable ou inactif.');
    }

    await this.prisma.refreshToken.update({
      where: { jti: stored.jti },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens({
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.nom,
    });
  }

  // Révocation explicite à la déconnexion — idempotent et tolérant (jeton
  // déjà expiré/invalide/absent de la table) : un logout doit toujours
  // réussir du point de vue de l'utilisateur, jamais bloquer sur un état de
  // jeton déjà incohérent (updateMany plutôt que update : 0 ligne modifiée
  // ne lève aucune erreur, contrairement à un update sur un jti inconnu).
  async logout(refreshToken: string): Promise<void> {
    let payload: AuthenticatedUser;
    try {
      payload = await this.jwt.verifyAsync<AuthenticatedUser>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      return;
    }
    if (!payload.jti) return;
    await this.prisma.refreshToken.updateMany({
      where: { jti: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // Génère un jeton de réinitialisation à usage unique, expirant après 30
  // minutes, et l'envoie exclusivement par email (CH-002,
  // docs/governance/REGISTRE_CHANTIERS.md — corrige l'exposition directe du
  // jeton dans la réponse HTTP qui permettait une prise de contrôle de
  // compte en un seul appel non authentifié, sans jamais avoir accès à la
  // boîte mail de la victime). Le contrat de réponse est désormais
  // strictement identique que le compte existe ou non — ni le jeton ni un
  // champ optionnel distinctif ne doivent permettre de déduire l'existence
  // d'un compte via la forme de la réponse (pas seulement via son contenu).
  async forgotPassword(email: string) {
    const message = 'Si ce compte existe, un lien a été envoyé par email.';
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
    );

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    // Dégradation gracieuse déjà portée par MailerService (SMTP_HOST absent
    // => journalisé, jamais d'exception) — cohérent avec le reste du
    // module notifications, aucune logique de repli à dupliquer ici.
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const resetLink = frontendUrl
      ? `${frontendUrl}/?resetToken=${token}`
      : null;
    await this.mailerService.send(
      user.email,
      'Réinitialisation de votre mot de passe — PMS Hôtel Makarim',
      `<p>Une réinitialisation de mot de passe a été demandée pour ce compte.</p>
<p>Code de réinitialisation (valable ${RESET_TOKEN_TTL_MINUTES} minutes) : <strong>${token}</strong></p>
${resetLink ? `<p>Ou cliquez sur ce lien pour préremplir le code : <a href="${resetLink}">${resetLink}</a></p>` : ''}
<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
    );

    return { message };
  }

  async resetPassword(token: string, nouveauMotDePasse: string) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (
      !resetToken ||
      resetToken.utiliseAt !== null ||
      resetToken.expiresAt < new Date()
    ) {
      throw new BadRequestException(
        'Lien de réinitialisation invalide ou expiré.',
      );
    }

    const motDePasseHash = await bcrypt.hash(
      nouveauMotDePasse,
      BCRYPT_SALT_ROUNDS,
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { motDePasseHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { utiliseAt: new Date() },
      }),
    ]);

    return { message: 'Mot de passe mis à jour.' };
  }

  // CH-011 — alimente le gating RBAC frontend : identité + permissions
  // effectives de l'utilisateur courant, recalculées à chaque appel (même
  // requête fraîche que PermissionsGuard, jamais mises en cache dans le
  // JWT — retirer une permission à un rôle doit se refléter immédiatement
  // ici aussi, pas seulement côté serveur). `sub`/`roleId`/`roleName`
  // proviennent du payload JWT déjà décodé (CurrentUser) — seules les
  // permissions nécessitent une lecture base.
  async me(user: AuthenticatedUser) {
    const permissions = await this.prisma.permission.findMany({
      where: { roles: { some: { roleId: user.roleId } } },
      select: { module: true, action: true },
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    return {
      id: user.sub,
      email: user.email,
      roleId: user.roleId,
      roleName: user.roleName,
      permissions: permissions.map((p) => `${p.module}:${p.action}`),
    };
  }

  // Rôles considérés "actifs" pour la landing page : ceux ayant au moins une
  // permission accordée. Maintenance/RH existent déjà en base (seed) mais
  // n'apparaissent pas tant qu'aucune permission ne leur est attribuée —
  // évite d'afficher un profil de connexion pour un module qui n'existe pas
  // encore côté métier.
  async rolesActifs() {
    const roles = await this.prisma.role.findMany({
      where: { permissions: { some: {} } },
      select: { id: true, nom: true },
      orderBy: { nom: 'asc' },
    });
    return roles;
  }

  private async issueTokens(payload: AuthenticatedUser) {
    // Cast via `unknown` : @nestjs/jwt type expiresIn en littéral template
    // ("15m", "7d"...) alors que ConfigService.get renvoie un `string`
    // générique — la valeur reste une chaîne de durée valide au runtime
    // (parsée par la lib `ms`), seul le typage statique est contourné ici.
    const accessExpiresIn = this.config.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    ) as unknown as number;
    const refreshExpiresIn = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    ) as unknown as number;

    // jti uniquement sur le refresh token (CH-026(f)) — l'access token
    // reste stateless, aucune ligne à créer pour lui.
    const jti = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiresIn,
      }),
      this.jwt.signAsync({ ...payload, jti } satisfies AuthenticatedUser, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    const { exp } = this.jwt.decode<{ exp: number }>(refreshToken);
    await this.prisma.refreshToken.create({
      data: { jti, userId: payload.sub, expiresAt: new Date(exp * 1000) },
    });

    return { accessToken, refreshToken };
  }
}
