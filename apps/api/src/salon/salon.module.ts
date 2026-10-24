import { Module } from '@nestjs/common';
import { SalonController } from './salon.controller';
import { SalonService } from './salon.service';

@Module({ controllers: [SalonController], providers: [SalonService] })
export class SalonModule {}
