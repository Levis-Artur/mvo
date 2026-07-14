import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { CurrentUser } from '../auth/auth.types';
import { ListStockBalancesQueryDto } from './dto/list-stock-balances-query.dto';
import { ListStockTransactionsQueryDto } from './dto/list-stock-transactions-query.dto';
import { ManualReceiptDto } from './dto/manual-receipt.dto';
import { StockService } from './stock.service';

@Controller()
@Roles(UserRole.OWNER, UserRole.AUDITOR, UserRole.DPP_ADMIN, UserRole.MVO)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('stock-balances')
  listBalances(
    @Query() query: ListStockBalancesQueryDto,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.stockService.listBalances(query, user);
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
