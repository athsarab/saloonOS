import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({ jsonTransport: true });
  }

  async sendVerification(email: string, token: string) {
    return this.send(email, 'Verify your SalonOS email', `Verify your account: ${this.url(`/verify-email?token=${token}`)}`);
  }

  async sendPasswordReset(email: string, token: string) {
    return this.send(email, 'Reset your SalonOS password', `Reset your password: ${this.url(`/reset-password?token=${token}`)}`);
  }

  private async send(to: string, subject: string, text: string) {
    const info = await this.transporter.sendMail({ from: this.config.getOrThrow<string>('EMAIL_FROM'), to, subject, text });
    this.logger.log(`Development email queued for ${to}: ${JSON.stringify(info.message)}`);
  }

  private url(path: string) {
    return `${this.config.getOrThrow<string>('APP_BASE_URL')}${path}`;
  }
}
