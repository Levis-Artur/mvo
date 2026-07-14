import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { CurrentUser } from '../auth/auth.types';
import { CreateResponsiblePersonDto } from './dto/create-responsible-person.dto';
import { ListResponsiblePersonsQueryDto } from './dto/list-responsible-persons-query.dto';
import { UpdateResponsiblePersonDto } from './dto/update-responsible-person.dto';
import { ResponsiblePersonsService } from './responsible-persons.service';
import { ListStockBalancesQueryDto } from '../stock/dto/list-stock-balances-query.dto';
import { ListStockTransactionsQueryDto } from '../stock/dto/list-stock-transactions-query.dto';
import { StockService } from '../stock/stock.service';

@Controller('responsible-persons')
@Roles(UserRole.OWNER, UserRole.AUDITOR, UserRole.DPP_ADMIN, UserRole.MVO)
export class ResponsiblePersonsController {
  constructor(
    private readonly responsiblePersonsService: ResponsiblePersonsService,
    private readonly stockService: StockService,
  ) {}

  @Get()
  findAll(
    @Query() query: ListResponsiblePersonsQueryDto,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.responsiblePersonsService.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUserParam() user: CurrentUser) {
    return this.responsiblePersonsService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.DPP_ADMIN)
  create(@Body() dto: CreateResponsiblePersonDto) {
    return this.responsiblePersonsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.DPP_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateResponsiblePersonDto) {
    return this.responsiblePersonsService.update(id, dto);
  }

  @Get(':id/stock-balances')
  stockBalances(
    @Param('id') id: string,
    @Query() query: ListStockBalancesQueryDto,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.stockService.listBalances({
      ...query,
      responsiblePersonId: id,
    }, user);
  }

  @Get(':id/stock-transactions')
  stockTransactions(
    @Param('id') id: string,
    @Query() query: ListStockTransactionsQueryDto,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.stockService.listTransactions({
      ...query,
      responsiblePersonId: id,
    }, user);
  }
}
