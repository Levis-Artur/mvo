import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ListStockBalancesQueryDto } from './dto/list-stock-balances-query.dto';
import { ListStockTransactionsQueryDto } from './dto/list-stock-transactions-query.dto';
import { ManualReceiptDto } from './dto/manual-receipt.dto';
import { StockService } from './stock.service';

@Controller()
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('stock-balances')
  listBalances(@Query() query: ListStockBalancesQueryDto) {
    return this.stockService.listBalances(query);
  }

  @Get('stock-balances/:id')
  findBalance(@Param('id') id: string) {
    return this.stockService.findBalance(id);
  }

  @Get('stock-transactions')
  listTransactions(@Query() query: ListStockTransactionsQueryDto) {
    return this.stockService.listTransactions(query);
  }

  @Get('stock-transactions/:id')
  findTransaction(@Param('id') id: string) {
    return this.stockService.findTransaction(id);
  }

  @Post('stock-transactions/manual-receipt')
  manualReceipt(@Body() dto: ManualReceiptDto) {
    return this.stockService.manualReceipt(dto);
  }
}
