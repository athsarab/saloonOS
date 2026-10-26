import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({ imports: [DatabaseModule], controllers: [CheckoutController], providers: [CheckoutService], exports: [CheckoutService] })
export class CheckoutModule {}
