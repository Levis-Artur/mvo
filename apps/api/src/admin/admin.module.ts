import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StockDocumentsModule } from '../stock-documents/stock-documents.module';
import { StockModule } from '../stock/stock.module';
import { AdminController } from './admin.controller';
import { BusinessDataResetService } from './business-data-reset.service';
import { OwnerDestructiveActionsService } from './owner-destructive-actions.service';

@Module({
  imports: [PrismaModule, StockDocumentsModule, StockModule],
  controllers: [AdminController],
  providers: [BusinessDataResetService, OwnerDestructiveActionsService],
  exports: [OwnerDestructiveActionsService],
})
export class AdminModule {}
