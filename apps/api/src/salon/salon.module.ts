import { Module } from '@nestjs/common';
import { SalonController } from './salon.controller';
import { SalonService } from './salon.service';
import { WhatsappReminderService } from './whatsapp-reminder.service';

@Module({ controllers: [SalonController], providers: [SalonService, WhatsappReminderService] })
export class SalonModule {}
