import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateManagementDto } from './dto/create-management.dto';
import { UpdateManagementDto } from './dto/update-management.dto';
import { ManagementsService } from './managements.service';

@Controller('managements')
export class ManagementsController {
  constructor(private readonly managementsService: ManagementsService) {}

  @Get()
  findAll() {
    return this.managementsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.managementsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateManagementDto) {
    return this.managementsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateManagementDto) {
    return this.managementsService.update(id, dto);
  }
}
