import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { ResponsiblePersonsController } from './responsible-persons.controller';
import { ResponsiblePersonsService } from './responsible-persons.service';

@Module({
  imports: [StockModule],
  controllers: [ResponsiblePersonsController],
  providers: [ResponsiblePersonsService],
})
export class ResponsiblePersonsModule {}
