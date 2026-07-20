import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import {
  STOCK_DOCUMENT_READ_ROLES,
  STOCK_DOCUMENT_WRITE_ROLES,
} from '../auth/access-policy';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, CurrentUser } from '../auth/auth.types';
import { getRequestContext } from '../auth/request-context';
import { attachmentFileSizeLimitBytes } from '../config/env';
import {
  CreateStockDocumentDto,
  ListStockDocumentsQueryDto,
  UpdateStockDocumentDto,
} from './dto/stock-document.dto';
import { StockDocumentsService } from './stock-documents.service';
import { StockDocumentAttachmentsService } from './stock-document-attachments.service';

@Controller('stock-documents')
@Roles(...STOCK_DOCUMENT_READ_ROLES)
export class StockDocumentsController {
  constructor(
    private readonly service: StockDocumentsService,
    private readonly attachmentsService: StockDocumentAttachmentsService,
  ) {}

  @Get()
  list(
    @Query() query: ListStockDocumentsQueryDto,
    @CurrentUserParam() actor: CurrentUser,
  ) {
    return this.service.list(query, actor);
  }

  @Get('maintenance/attachment-orphans')
  @Roles(UserRole.OWNER)
  attachmentOrphans() {
    return this.attachmentsService.findOrphans();
  }

  @Post(':id/attachments')
  @Roles(...STOCK_DOCUMENT_WRITE_ROLES)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: attachmentFileSizeLimitBytes() },
    }),
  )
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUserParam() actor: CurrentUser,
  ) {
    return this.attachmentsService.upload(id, file, actor);
  }

  @Get(':id/attachments')
  attachments(
    @Param('id') id: string,
    @CurrentUserParam() actor: CurrentUser,
  ) {
    return this.attachmentsService.list(id, actor);
  }

  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUserParam() actor: CurrentUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const download = await this.attachmentsService.download(
      id,
      attachmentId,
      actor,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(download.stream, {
      type: download.metadata.mimeType,
      length: download.metadata.sizeBytes,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(download.metadata.originalFileName)}`,
    });
  }

  @Delete(':id/attachments/:attachmentId')
  @Roles(...STOCK_DOCUMENT_WRITE_ROLES)
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUserParam() actor: CurrentUser,
  ) {
    return this.attachmentsService.remove(id, attachmentId, actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUserParam() actor: CurrentUser) {
    return this.service.findOne(id, actor);
  }

  @Post()
  @Roles(...STOCK_DOCUMENT_WRITE_ROLES)
  create(
    @Body() dto: CreateStockDocumentDto,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.create(dto, actor, getRequestContext(request));
  }

  @Patch(':id')
  @Roles(...STOCK_DOCUMENT_WRITE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStockDocumentDto,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, actor, getRequestContext(request));
  }

  @Delete(':id')
  @Roles(...STOCK_DOCUMENT_WRITE_ROLES)
  remove(
    @Param('id') id: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.remove(id, actor, getRequestContext(request));
  }

  @Post(':id/post')
  @Roles(...STOCK_DOCUMENT_WRITE_ROLES)
  post(
    @Param('id') id: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.post(id, actor, getRequestContext(request));
  }

  @Post(':id/cancel')
  @Roles(...STOCK_DOCUMENT_WRITE_ROLES)
  cancel(
    @Param('id') id: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.cancel(id, actor, getRequestContext(request));
  }
}
