import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { StockDocumentsController } from './stock-documents.controller';
import { StockDocumentsService } from './stock-documents.service';

@Module({
  imports: [StockModule],
  controllers: [StockDocumentsController],
  providers: [StockDocumentsService],
})
export class StockDocumentsModule {}
