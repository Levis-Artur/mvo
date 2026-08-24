import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StockModule } from '../stock/stock.module';
import { ResponsiblePersonsController } from './responsible-persons.controller';
import { ResponsiblePersonsService } from './responsible-persons.service';

@Module({
  imports: [AuthModule, StockModule],
  controllers: [ResponsiblePersonsController],
  providers: [ResponsiblePersonsService],
})
export class ResponsiblePersonsModule {}
