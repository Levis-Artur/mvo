import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryItemsService } from './inventory-items.service';

@Controller('inventory-items')
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

  @Post()
  create(@Body() dto: CreateInventoryItemDto) {
    return this.inventoryItemsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryItemsService.update(id, dto);
  }
}
