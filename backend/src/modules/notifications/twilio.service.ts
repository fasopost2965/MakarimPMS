import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

// F7 (suite) — SMS + WhatsApp via un unique client Twilio (les deux canaux
// partagent la même API, seul le préfixe `whatsapp:` sur from/to change —
// pas de second fournisseur à intégrer). Dégradation gracieuse identique à
// MailerService : credentials absentes = jamais d'exception, seule une
// panne d'envoi réelle (Twilio configuré mais échoue) fait échouer
// NotificationsProcessor (retry BullMQ).
@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly client: Twilio | null = null;
  private readonly smsFrom?: string;
  private readonly whatsappFrom?: string;

  constructor(private readonly config: ConfigService) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    if (accountSid && authToken) {
      this.client = new Twilio(accountSid, authToken);
    }
    this.smsFrom = this.config.get<string>('TWILIO_SMS_FROM');
    this.whatsappFrom = this.config.get<string>('TWILIO_WHATSAPP_FROM');
  }

  get isSmsConfigured(): boolean {
    return this.client !== null && !!this.smsFrom;
  }

  get isWhatsappConfigured(): boolean {
    return this.client !== null && !!this.whatsappFrom;
  }

  async sendSms(to: string, body: string): Promise<void> {
    if (!this.client || !this.smsFrom) {
      this.logger.log(`[Twilio SMS non configuré — simulé] à: ${to}\n${body}`);
      return;
    }
    await this.client.messages.create({ from: this.smsFrom, to, body });
  }

  async sendWhatsapp(to: string, body: string): Promise<void> {
    if (!this.client || !this.whatsappFrom) {
      this.logger.log(
        `[Twilio WhatsApp non configuré — simulé] à: ${to}\n${body}`,
      );
      return;
    }
    await this.client.messages.create({
      from: `whatsapp:${this.whatsappFrom}`,
      to: `whatsapp:${to}`,
      body,
    });
  }
}
