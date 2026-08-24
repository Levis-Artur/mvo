import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MyPropertyService } from './my-property.service';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [AuthModule],
  controllers: [StockController],
  providers: [StockService, MyPropertyService],
  exports: [StockService],
})
export class StockModule {}
