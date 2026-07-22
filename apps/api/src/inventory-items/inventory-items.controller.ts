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
import { InventoryItemsService } from './inventory-items.service';

@Controller('inventory-items')
@Roles(...REFERENCE_DATA_READ_ROLES)
export class InventoryItemsController {
  constructor(private readonly inventoryItemsService: InventoryItemsService) {}

  @Get()
  findAll(@Query() query: ListInventoryItemsQueryDto) {
    return this.inventoryItemsService.findAll(query);
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
