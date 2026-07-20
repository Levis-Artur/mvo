import { Body, Controller, Get, Param, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { CurrentUser } from '../auth/auth.types';
import { STOCK_READ_ROLES } from '../auth/access-policy';
import { ListStockBalancesQueryDto } from './dto/list-stock-balances-query.dto';
import { ListStockTransactionsQueryDto } from './dto/list-stock-transactions-query.dto';
import { ManualReceiptDto } from './dto/manual-receipt.dto';
import {
  ExportMyPropertyQueryDto,
  ListMyPropertyQueryDto,
} from './dto/my-property-query.dto';
import { MyPropertyService } from './my-property.service';
import { StockService } from './stock.service';

@Controller()
@Roles(...STOCK_READ_ROLES)
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly myPropertyService: MyPropertyService,
  ) {}

  @Get('stock-balances')
  listBalances(
    @Query() query: ListStockBalancesQueryDto,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.stockService.listBalances(query, user);
  }

  @Get('stock/available-to-me')
  @Roles(UserRole.MVO)
  availableToMe(@CurrentUserParam() user: CurrentUser) {
    return this.stockService.availableToMe(user);
  }

  @Get('stock/my-property')
  @Roles(...STOCK_READ_ROLES)
  myProperty(
    @Query() query: ListMyPropertyQueryDto,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.myPropertyService.list(query, user);
  }

  @Get('stock/my-property/export.csv')
  @Roles(...STOCK_READ_ROLES)
  async exportMyProperty(
    @Query() query: ExportMyPropertyQueryDto,
    @CurrentUserParam() user: CurrentUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const exported = await this.myPropertyService.exportCsv(query, user);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(exported.stream, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${exported.filename}"`,
    });
  }

  @Get('stock-balances/:id')
  findBalance(@Param('id') id: string, @CurrentUserParam() user: CurrentUser) {
    return this.stockService.findBalance(id, user);
  }

  @Get('stock-transactions')
  listTransactions(
    @Query() query: ListStockTransactionsQueryDto,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.stockService.listTransactions(query, user);
  }

  @Get('stock-transactions/:id')
  findTransaction(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.stockService.findTransaction(id, user);
  }

  @Post('stock-transactions/manual-receipt')
  @Roles(UserRole.OWNER, UserRole.DPP_ADMIN)
  manualReceipt(@Body() dto: ManualReceiptDto) {
    return this.stockService.manualReceipt(dto);
  }
}
