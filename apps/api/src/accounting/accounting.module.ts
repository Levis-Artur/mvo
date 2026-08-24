import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AccountingOverviewService } from './accounting-overview.service';
import { AccountingMovementsService } from './accounting-movements.service';
import { StockDocumentsModule } from '../stock-documents/stock-documents.module';

@Module({
  imports: [AuthModule, StockDocumentsModule],
  controllers: [AccountingController],
  providers: [
    AccountingService,
    AccountingOverviewService,
    AccountingMovementsService,
  ],
})
export class AccountingModule {}
