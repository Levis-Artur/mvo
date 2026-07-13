import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { ImportParserService } from './import-parser.service';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [StockModule],
  controllers: [ImportsController],
  providers: [ImportsService, ImportParserService],
  exports: [ImportParserService, ImportsService],
})
export class ImportsModule {}
