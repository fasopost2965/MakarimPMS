import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Dégradation gracieuse : si SMTP_HOST n'est pas configuré (environnement
// de dev par défaut), les emails ne sont jamais envoyés mais journalisés
// (Logger) — permet au reste du flux (NotificationLog, queue, listeners)
// de fonctionner et d'être testé sans dépendre d'un vrai serveur SMTP.
// Jamais d'exception levée pour une config manquante : seule une panne
// d'envoi réelle (SMTP configuré mais injoignable) doit faire échouer
// NotificationsProcessor.
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: this.config.get<string>('SMTP_USER')
          ? {
              user: this.config.get<string>('SMTP_USER'),
              pass: this.config.get<string>('SMTP_PASS'),
            }
          : undefined,
      });
    }
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[SMTP non configuré — email simulé] à: ${to} | sujet: ${subject}\n${html}`,
      );
      return;
    }

    const from =
      this.config.get<string>('SMTP_FROM') ?? 'no-reply@makarim.test';
    await this.transporter.sendMail({ from, to, subject, html });
  }
}
