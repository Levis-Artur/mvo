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
import {
  ACCOUNTING_CARD_READ_ROLES,
  REFERENCE_DATA_READ_ROLES,
  TRANSFER_TARGET_READ_ROLES,
} from '../auth/access-policy';
import { CreateResponsiblePersonDto } from './dto/create-responsible-person.dto';
import { ListResponsiblePersonsQueryDto } from './dto/list-responsible-persons-query.dto';
import { UpdateResponsiblePersonDto } from './dto/update-responsible-person.dto';
import { ResponsiblePersonsService } from './responsible-persons.service';
import { ListStockBalancesQueryDto } from '../stock/dto/list-stock-balances-query.dto';
import { ListStockTransactionsQueryDto } from '../stock/dto/list-stock-transactions-query.dto';
import { StockService } from '../stock/stock.service';

@Controller('responsible-persons')
@Roles(...REFERENCE_DATA_READ_ROLES)
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

  @Get('transfer-targets')
  @Roles(...TRANSFER_TARGET_READ_ROLES)
  transferTargets(
    @Query() query: ListResponsiblePersonsQueryDto,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.responsiblePersonsService.transferTargets(query, user);
  }

  @Get(':id')
  @Roles(...ACCOUNTING_CARD_READ_ROLES)
  findOne(@Param('id') id: string, @CurrentUserParam() user: CurrentUser) {
    return this.responsiblePersonsService.findOne(id, user);
  }

  @Get(':id/accounting-card')
  @Roles(...ACCOUNTING_CARD_READ_ROLES)
  async accountingCard(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ) {
    await this.responsiblePersonsService.findOne(id, user);
    return this.stockService.responsiblePersonAccountingCard(id, user);
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
  @Roles(...ACCOUNTING_CARD_READ_ROLES)
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
  @Roles(...ACCOUNTING_CARD_READ_ROLES)
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
