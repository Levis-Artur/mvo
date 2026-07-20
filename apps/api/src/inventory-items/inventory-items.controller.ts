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
import { REFERENCE_DATA_READ_ROLES } from '../auth/access-policy';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryItemsService } from './inventory-items.service';

@Controller('inventory-items')
@Roles(...REFERENCE_DATA_READ_ROLES)
export class InventoryItemsController {
  constructor(private readonly inventoryItemsService: InventoryItemsService) {}

  @Get()
  findAll(
    @Query() query: ListInventoryItemsQueryDto,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.inventoryItemsService.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUserParam() user: CurrentUser) {
    return this.inventoryItemsService.findOne(id, user);
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
