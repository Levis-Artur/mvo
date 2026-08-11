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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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
  CreateMvoTransferDto,
  CreateIssueDto,
  CreateStockDocumentDto,
  ListStockDocumentsQueryDto,
  UpdateStockDocumentDto,
} from './dto/stock-document.dto';
import { StockDocumentsService } from './stock-documents.service';
import { StockDocumentAttachmentsService } from './stock-document-attachments.service';
import { ListIssueHistoryQueryDto } from './dto/issue-history-query.dto';
import { IssueHistoryService } from './issue-history.service';
import {
  CreateIssueRealizationDto,
  ListIssueRealizationsQueryDto,
} from './dto/issue-realization.dto';
import { IssueRealizationsService } from './issue-realizations.service';

@Controller('stock-documents')
@Roles(...STOCK_DOCUMENT_READ_ROLES)
export class StockDocumentsController {
  constructor(
    private readonly service: StockDocumentsService,
    private readonly attachmentsService: StockDocumentAttachmentsService,
    private readonly issueHistoryService: IssueHistoryService,
    private readonly issueRealizationsService: IssueRealizationsService,
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

  @Get('issues')
  issueHistory(
    @Query() query: ListIssueHistoryQueryDto,
    @CurrentUserParam() actor: CurrentUser,
  ) {
    return this.issueHistoryService.list(query, actor);
  }

  @Get('issues/export.csv')
  async exportIssueHistory(
    @Query() query: ListIssueHistoryQueryDto,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const exported = await this.issueHistoryService.exportCsv(
      query,
      actor,
      getRequestContext(request),
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(Buffer.from(exported.csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${exported.filename}"`,
    });
  }

  @Post('mvo-transfer')
  @Roles(UserRole.MVO)
  createAndPostMvoTransfer(
    @Body() dto: CreateMvoTransferDto,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createAndPostMvoTransfer(
      dto,
      actor,
      getRequestContext(request),
    );
  }

  @Post('issue')
  @Roles(UserRole.MVO)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: attachmentFileSizeLimitBytes() },
    }),
  )
  createAndPostIssue(
    @Body() dto: CreateIssueDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createAndPostIssue(
      dto,
      files ?? [],
      actor,
      getRequestContext(request),
    );
  }

  @Post(':id/realizations')
  @Roles(UserRole.MVO)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: attachmentFileSizeLimitBytes() },
    }),
  )
  createIssueRealization(
    @Param('id') id: string,
    @Body() dto: CreateIssueRealizationDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.issueRealizationsService.create(
      id,
      dto,
      files ?? [],
      actor,
      getRequestContext(request),
    );
  }

  @Get(':id/realizations')
  @Roles(UserRole.OWNER, UserRole.MVO)
  issueRealizations(
    @Param('id') id: string,
    @Query() query: ListIssueRealizationsQueryDto,
    @CurrentUserParam() actor: CurrentUser,
  ) {
    return this.issueRealizationsService.list(id, query, actor);
  }

  @Get(':id/realizations/:realizationId')
  @Roles(UserRole.OWNER, UserRole.MVO)
  issueRealization(
    @Param('id') id: string,
    @Param('realizationId') realizationId: string,
    @CurrentUserParam() actor: CurrentUser,
  ) {
    return this.issueRealizationsService.findOne(id, realizationId, actor);
  }

  @Post(':id/realizations/:realizationId/cancel')
  @Roles(UserRole.MVO)
  cancelIssueRealization(
    @Param('id') id: string,
    @Param('realizationId') realizationId: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.issueRealizationsService.cancel(
      id,
      realizationId,
      actor,
      getRequestContext(request),
    );
  }

  @Get(':id/realizations/:realizationId/attachments/:attachmentId/download')
  @Roles(UserRole.OWNER, UserRole.MVO)
  async downloadIssueRealizationAttachment(
    @Param('id') id: string,
    @Param('realizationId') realizationId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const download = await this.issueRealizationsService.attachment(
      id,
      realizationId,
      attachmentId,
      actor,
      getRequestContext(request),
      'DOWNLOAD',
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(download.stream, {
      type: download.metadata.mimeType,
      length: download.metadata.sizeBytes,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(download.metadata.originalFileName)}`,
    });
  }

  @Get(':id/realizations/:realizationId/attachments/:attachmentId/preview')
  @Roles(UserRole.OWNER, UserRole.MVO)
  async previewIssueRealizationAttachment(
    @Param('id') id: string,
    @Param('realizationId') realizationId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const preview = await this.issueRealizationsService.attachment(
      id,
      realizationId,
      attachmentId,
      actor,
      getRequestContext(request),
      'PREVIEW',
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(preview.stream, {
      type: preview.metadata.mimeType,
      length: preview.metadata.sizeBytes,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(preview.metadata.originalFileName)}`,
    });
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
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attachmentsService.upload(
      id,
      file,
      actor,
      getRequestContext(request),
    );
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
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const download = await this.attachmentsService.download(
      id,
      attachmentId,
      actor,
      getRequestContext(request),
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(download.stream, {
      type: download.metadata.mimeType,
      length: download.metadata.sizeBytes,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(download.metadata.originalFileName)}`,
    });
  }

  @Get(':id/attachments/:attachmentId/preview')
  async previewAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const preview = await this.attachmentsService.preview(
      id,
      attachmentId,
      actor,
      getRequestContext(request),
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(preview.stream, {
      type: preview.metadata.mimeType,
      length: preview.metadata.sizeBytes,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(preview.metadata.originalFileName)}`,
    });
  }

  @Delete(':id/attachments/:attachmentId')
  @Roles(...STOCK_DOCUMENT_WRITE_ROLES)
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attachmentsService.remove(
      id,
      attachmentId,
      actor,
      getRequestContext(request),
    );
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
