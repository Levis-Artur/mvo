import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUserParam } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/auth.types';
import {
  INVENTORY_ITEM_ACCOUNTING_CARD_READ_ROLES,
  REFERENCE_DATA_READ_ROLES,
} from '../auth/access-policy';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import {
  InventoryItemAccountingCardQueryDto,
  InventoryMovementFiltersDto,
} from './dto/inventory-item-accounting-card-query.dto';
import {
  InventoryItemsService,
  type TransferHistoryQuery,
} from './inventory-items.service';

@Controller('inventory-items')
@Roles(...REFERENCE_DATA_READ_ROLES)
export class InventoryItemsController {
  constructor(private readonly inventoryItemsService: InventoryItemsService) {}

  @Get()
  @Roles(...REFERENCE_DATA_READ_ROLES, UserRole.MVO, UserRole.ORG_MANAGER)
  findAll(
    @Query() query: ListInventoryItemsQueryDto,
    @CurrentUserParam() actor: CurrentUser,
  ) {
    return this.inventoryItemsService.findAll(query, actor);
  }

  @Get(':id/my-transfer-history')
  @Roles(UserRole.MVO)
  myTransferHistory(
    @Param('id') id: string,
    @Query() query: TransferHistoryQuery,
    @CurrentUserParam() actor: CurrentUser,
  ) {
    return this.inventoryItemsService.myTransferHistory(id, actor, query);
  }

  @Get(':id/my-movement-history')
  @Roles(UserRole.MVO)
  myMovementHistory(
    @Param('id') id: string,
    @Query() query: TransferHistoryQuery,
    @CurrentUserParam() actor: CurrentUser,
  ) {
    return this.inventoryItemsService.myMovementHistory(id, actor, query);
  }

  @Get(':id/transfer-history')
  @Roles(...INVENTORY_ITEM_ACCOUNTING_CARD_READ_ROLES, UserRole.ORG_MANAGER)
  transferHistory(
    @Param('id') id: string,
    @Query() query: TransferHistoryQuery,
    @CurrentUserParam() actor: CurrentUser,
  ) {
    return this.inventoryItemsService.transferHistory(id, query, actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoryItemsService.findOne(id);
  }

  @Get(':id/accounting-card')
  @Roles(...INVENTORY_ITEM_ACCOUNTING_CARD_READ_ROLES)
  accountingCard(
    @Param('id') id: string,
    @Query() query: InventoryItemAccountingCardQueryDto,
  ) {
    return this.inventoryItemsService.accountingCard(id, query);
  }

  @Get(':id/accounting-card/movements/export.csv')
  @Roles(...INVENTORY_ITEM_ACCOUNTING_CARD_READ_ROLES)
  async exportAccountingCardMovements(
    @Param('id') id: string,
    @Query() query: InventoryMovementFiltersDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const exported =
      await this.inventoryItemsService.exportAccountingCardMovements(
        id,
        query,
      );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(Buffer.from(exported.csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${exported.filename}"`,
    });
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.DPP_ADMIN)
  create(@Body() dto: CreateInventoryItemDto) {
    return this.inventoryItemsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.DPP_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryItemsService.update(id, dto);
  }
}
