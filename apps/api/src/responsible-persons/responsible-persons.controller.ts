import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateResponsiblePersonDto } from './dto/create-responsible-person.dto';
import { ListResponsiblePersonsQueryDto } from './dto/list-responsible-persons-query.dto';
import { UpdateResponsiblePersonDto } from './dto/update-responsible-person.dto';
import { ResponsiblePersonsService } from './responsible-persons.service';
import { ListStockBalancesQueryDto } from '../stock/dto/list-stock-balances-query.dto';
import { ListStockTransactionsQueryDto } from '../stock/dto/list-stock-transactions-query.dto';
import { StockService } from '../stock/stock.service';

@Controller('responsible-persons')
export class ResponsiblePersonsController {
  constructor(
    private readonly responsiblePersonsService: ResponsiblePersonsService,
    private readonly stockService: StockService,
  ) {}

  @Get()
  findAll(@Query() query: ListResponsiblePersonsQueryDto) {
    return this.responsiblePersonsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.responsiblePersonsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateResponsiblePersonDto) {
    return this.responsiblePersonsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateResponsiblePersonDto) {
    return this.responsiblePersonsService.update(id, dto);
  }

  @Get(':id/stock-balances')
  stockBalances(
    @Param('id') id: string,
    @Query() query: ListStockBalancesQueryDto,
  ) {
    return this.stockService.listBalances({
      ...query,
      responsiblePersonId: id,
    });
  }

  @Get(':id/stock-transactions')
  stockTransactions(
    @Param('id') id: string,
    @Query() query: ListStockTransactionsQueryDto,
  ) {
    return this.stockService.listTransactions({
      ...query,
      responsiblePersonId: id,
    });
  }
}
