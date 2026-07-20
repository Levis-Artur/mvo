import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { StockDocumentsController } from './stock-documents.controller';
import { StockDocumentsService } from './stock-documents.service';
import { StockDocumentAttachmentStorageService } from './stock-document-attachment-storage.service';
import { StockDocumentAttachmentsService } from './stock-document-attachments.service';

@Module({
  imports: [StockModule],
  controllers: [StockDocumentsController],
  providers: [
    StockDocumentsService,
    StockDocumentAttachmentStorageService,
    StockDocumentAttachmentsService,
  ],
})
export class StockDocumentsModule {}
