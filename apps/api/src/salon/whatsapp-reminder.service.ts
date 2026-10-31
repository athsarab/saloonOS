import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppointmentStatus } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

const REMINDER_WINDOW_MINUTES = 30;

@Injectable()
export class WhatsappReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappReminderService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly db: DatabaseService, private readonly config: ConfigService) {}

  onModuleInit() {
    const interval = this.config.get<number>('WHATSAPP_REMINDER_INTERVAL_MS') ?? 60_000;
    this.timer = setInterval(() => void this.processReminders(), interval);
    void this.processReminders();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async processReminders() {
    if (this.running || !this.isConfigured()) return;
    this.running = true;
    try {
      const now = new Date();
      const from = new Date(now.getTime() + (REMINDER_WINDOW_MINUTES - 1) * 60_000);
      const to = new Date(now.getTime() + (REMINDER_WINDOW_MINUTES + 1) * 60_000);
      const appointments = await this.db.appointment.findMany({
        where: {
          startsAt: { gte: from, lt: to },
          status: { in: [AppointmentStatus.BOOKED, AppointmentStatus.CONFIRMED] },
          whatsappReminderSentAt: null,
          tenant: { whatsappRemindersEnabled: true },
          customer: { phone: { not: null } },
        },
        include: { customer: true, service: true, branch: true },
      });

      for (const appointment of appointments) {
        if (!appointment.customer.phone) continue;
        try {
          await this.sendReminder(appointment.customer.phone, {
            customerName: [appointment.customer.firstName, appointment.customer.lastName].filter(Boolean).join(' '),
            appointmentTime: appointment.startsAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: appointment.branch.timezone }),
            serviceName: appointment.service?.name ?? 'your appointment',
          });
          await this.db.appointment.updateMany({ where: { id: appointment.id, whatsappReminderSentAt: null }, data: { whatsappReminderSentAt: new Date() } });
        } catch {
          this.logger.error(`WhatsApp reminder failed for appointment ${appointment.id}. It will be retried.`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private isConfigured() {
    return Boolean(this.config.get<string>('WHATSAPP_ACCESS_TOKEN') && this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID'));
  }

  private async sendReminder(to: string, values: { customerName: string; appointmentTime: string; serviceName: string }) {
    const token = this.config.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
    const recipient = to.replace(/[^\d]/g, '');
    if (recipient.length < 8) throw new ServiceUnavailableException('Customer phone number is not in international format');

    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: this.config.getOrThrow<string>('WHATSAPP_REMINDER_TEMPLATE'),
          language: { code: this.config.getOrThrow<string>('WHATSAPP_TEMPLATE_LANGUAGE') },
          components: [{ type: 'body', parameters: [
            { type: 'text', text: values.customerName },
            { type: 'text', text: values.appointmentTime },
            { type: 'text', text: values.serviceName },
          ] }],
        },
      }),
    });
    if (!response.ok) throw new ServiceUnavailableException(`WhatsApp provider returned HTTP ${response.status}`);
  }
}
