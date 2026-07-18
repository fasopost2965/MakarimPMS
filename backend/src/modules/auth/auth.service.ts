import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const RESET_TOKEN_TTL_MINUTES = 30;
const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Connexion : vérifie le mot de passe (bcrypt, jamais en clair), journalise
  // la tentative (succès ou échec — CLAUDE.md règle 4, trace d'audit) via
  // LoginLog, puis émet une paire access/refresh token.
  async login(dto: LoginDto, ip: string | undefined) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });

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

    return this.issueTokens({
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.nom,
    });
  }

  async refresh(refreshToken: string) {
    let payload: AuthenticatedUser;
    try {
      payload = await this.jwt.verifyAsync<AuthenticatedUser>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!user || !user.actif) {
      throw new UnauthorizedException('Utilisateur introuvable ou inactif.');
    }

    return this.issueTokens({
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.nom,
    });
  }

  // Génère un jeton de réinitialisation à usage unique, expirant après 30
  // minutes. Pas d'envoi d'email réel à ce stade (cahier des charges,
  // itération actuelle) : le jeton est renvoyé directement dans la réponse
  // pour permettre au flux frontend de fonctionner de bout en bout — un
  // e-mail réel remplacera cette exposition directe quand le module
  // notifications sera livré, sans changer le contrat de reset-password.
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Réponse identique que l'utilisateur existe ou non, pour ne pas
    // divulguer quels emails sont enregistrés.
    if (!user) {
      return { message: 'Si ce compte existe, un lien a été généré.' };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
    );

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    return {
      message: 'Si ce compte existe, un lien a été généré.',
      resetToken: token,
      expiresAt,
    };
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

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiresIn,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
