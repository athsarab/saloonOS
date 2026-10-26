import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CheckoutModule } from '../checkout/checkout.module';
import { OfflineService } from './offline.service';
import { OfflineController } from './offline.controller';
@Module({ imports: [DatabaseModule, CheckoutModule], controllers: [OfflineController], providers: [OfflineService] })
export class OfflineModule {}
