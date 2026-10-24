import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter?: Transporter;
  private readonly preview: boolean;

  constructor(private readonly config: ConfigService) {
    this.preview = config.get<string>('EMAIL_TRANSPORT') === 'json' && config.get<string>('NODE_ENV') !== 'production';
    if (this.preview) {
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
    } else if (config.get<string>('SMTP_HOST') && config.get<string>('SMTP_USER') && config.get<string>('SMTP_PASSWORD')) {
      const port = config.get<number>('SMTP_PORT') ?? 465;
      this.transporter = nodemailer.createTransport({
        host: config.getOrThrow<string>('SMTP_HOST'), port, secure: port === 465, requireTLS: true,
        auth: { user: config.getOrThrow<string>('SMTP_USER'), pass: config.getOrThrow<string>('SMTP_PASSWORD') },
        connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 20000,
      });
    }
  }

  assertConfigured() {
    if (!this.transporter || (!this.preview && this.config.getOrThrow<string>('EMAIL_FROM').endsWith('.local'))) {
      this.logger.error('Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and EMAIL_FROM in the API environment.');
      throw new ServiceUnavailableException('Email delivery is unavailable. Please try again later.');
    }
  }

  async sendVerification(email: string, code: string) {
    return this.send(email, 'Your SalonOS verification code', `Your SalonOS verification code is: ${code}\n\nEnter this code in the app to verify ${email}. It expires in 15 minutes and can only be used once.\n\nIf you did not create an account, ignore this email.`);
  }

  async sendPasswordReset(email: string, token: string) {
    return this.send(email, 'Reset your SalonOS password', `Reset your password: ${this.url(`/reset-password?token=${encodeURIComponent(token)}`)}\n\nOr paste this reset token into the app: ${token}\n\nThis token expires in 30 minutes.`);
  }

  private async send(to: string, subject: string, text: string) {
    this.assertConfigured();
    try {
      const info = await this.transporter!.sendMail({ from: this.config.getOrThrow<string>('EMAIL_FROM'), to, subject, text });
      if (this.preview) {
        this.logger.log(`Development email preview (not delivered): ${JSON.stringify(info.message)}`);
      } else {
        if (!info.accepted?.includes(to)) throw new Error('Recipient was not accepted');
        this.logger.log('Email accepted by the SMTP provider.');
      }
    } catch {
      this.logger.error('Email delivery failed. Check the SMTP credentials and provider connection.');
      throw new ServiceUnavailableException('Email could not be sent. Please try again later.');
    }
  }

  private url(path: string) {
    return `${this.config.getOrThrow<string>('APP_BASE_URL')}${path}`;
  }
}
