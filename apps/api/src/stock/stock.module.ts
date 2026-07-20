import { Module } from '@nestjs/common';
import { MyPropertyService } from './my-property.service';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  controllers: [StockController],
  providers: [StockService, MyPropertyService],
  exports: [StockService],
})
export class StockModule {}
