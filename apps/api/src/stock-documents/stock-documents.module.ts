import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StockModule } from '../stock/stock.module';
import { StockDocumentsController } from './stock-documents.controller';
import { StockDocumentsService } from './stock-documents.service';
import { StockDocumentAttachmentStorageService } from './stock-document-attachment-storage.service';
import { StockDocumentAttachmentsService } from './stock-document-attachments.service';
import { IssueHistoryService } from './issue-history.service';
import { IssueRealizationsService } from './issue-realizations.service';

@Module({
  imports: [AuthModule, StockModule],
  controllers: [StockDocumentsController],
  providers: [
    StockDocumentsService,
    StockDocumentAttachmentStorageService,
    StockDocumentAttachmentsService,
    IssueHistoryService,
    IssueRealizationsService,
  ],
  exports: [
    StockDocumentsService,
    StockDocumentAttachmentStorageService,
    IssueHistoryService,
  ],
})
export class StockDocumentsModule {}
