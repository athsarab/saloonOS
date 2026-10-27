import { PosService } from './pos.service';
import { PosController } from './pos.controller';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({ imports: [DatabaseModule], controllers: [CheckoutController, PosController], providers: [CheckoutService, PosService], exports: [CheckoutService] })
export class CheckoutModule {}
