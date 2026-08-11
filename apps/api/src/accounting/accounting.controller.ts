import { Controller, Get, Param, Query, Req, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import {
  ACCOUNTING_TRANSFER_EXPORT_ROLES,
  ACCOUNTING_TRANSFER_READ_ROLES,
  ACCOUNTING_ANALYTICS_READ_ROLES,
} from '../auth/access-policy';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, CurrentUser } from '../auth/auth.types';
import { getRequestContext } from '../auth/request-context';
import { AccountingService } from './accounting.service';
import { AccountingOverviewService } from './accounting-overview.service';
import { AccountingMovementsService } from './accounting-movements.service';
import { IssueHistoryService } from '../stock-documents/issue-history.service';
import { IssueHistoryFiltersDto } from '../stock-documents/dto/issue-history-query.dto';
import {
  AccountingMovementFiltersDto,
  ListAccountingMovementsQueryDto,
} from './dto/accounting-movement-query.dto';
import {
  AccountingTransferFiltersDto,
  ListAccountingExportBatchesQueryDto,
  ListAccountingTransfersQueryDto,
} from './dto/accounting-transfer-query.dto';

@Controller('accounting')
@Roles(...ACCOUNTING_TRANSFER_READ_ROLES)
export class AccountingController {
  constructor(
    private readonly service: AccountingService,
    private readonly overviewService: AccountingOverviewService,
    private readonly movementsService: AccountingMovementsService,
    private readonly issueHistoryService: IssueHistoryService,
  ) {}

  @Get('overview')
  @Roles(...ACCOUNTING_ANALYTICS_READ_ROLES)
  overview() {
    return this.overviewService.overview();
  }

  @Get('movements')
  @Roles(...ACCOUNTING_ANALYTICS_READ_ROLES)
  movements(@Query() query: ListAccountingMovementsQueryDto) {
    return this.movementsService.list(query);
  }

  @Get('movements/export.csv')
  @Roles(...ACCOUNTING_ANALYTICS_READ_ROLES)
  async exportMovements(
    @Query() query: AccountingMovementFiltersDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const exported = await this.movementsService.exportCsv(query);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(Buffer.from(exported.csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${exported.filename}"`,
    });
  }

  @Get('movements/:id')
  @Roles(...ACCOUNTING_ANALYTICS_READ_ROLES)
  movementDetails(@Param('id') id: string) {
    return this.movementsService.details(id);
  }

  @Get('documents/:id')
  documentDetails(@Param('id') id: string) {
    return this.movementsService.detailsByDocumentId(id);
  }

  @Get('mvo-transfers')
  list(@Query() query: ListAccountingTransfersQueryDto) {
    return this.service.listTransfers(query);
  }

  @Get('issues/export.csv')
  @Roles(...ACCOUNTING_TRANSFER_READ_ROLES)
  async exportIssues(
    @Query() query: IssueHistoryFiltersDto,
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

  @Get('mvo-transfers/export.csv')
  @Roles(...ACCOUNTING_TRANSFER_EXPORT_ROLES)
  async export(
    @Query() query: AccountingTransferFiltersDto,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const exported = await this.service.exportTransfers(query, actor, getRequestContext(request));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Export-Batch-ID', exported.batchId);
    return new StreamableFile(Buffer.from(exported.csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${exported.filename}"`,
    });
  }

  @Get('mvo-transfer-exports')
  batches(@Query() query: ListAccountingExportBatchesQueryDto) {
    return this.service.listExportBatches(query);
  }

  @Get('mvo-transfer-exports/:id/download')
  async downloadBatch(
    @Param('id') id: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const exported = await this.service.downloadExportBatch(
      id,
      actor,
      getRequestContext(request),
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Export-Batch-ID', exported.batchId);
    return new StreamableFile(Buffer.from(exported.csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${exported.filename}"`,
    });
  }
}
