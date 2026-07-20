import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  REFERENCE_DATA_READ_ROLES,
  REFERENCE_DATA_WRITE_ROLES,
} from '../auth/access-policy';
import { Roles } from '../auth/roles.decorator';
import { CreateManagementDto } from './dto/create-management.dto';
import { UpdateManagementDto } from './dto/update-management.dto';
import { ManagementsService } from './managements.service';

@Controller('managements')
@Roles(...REFERENCE_DATA_READ_ROLES)
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
  @Roles(...REFERENCE_DATA_WRITE_ROLES)
  create(@Body() dto: CreateManagementDto) {
    return this.managementsService.create(dto);
  }

  @Patch(':id')
  @Roles(...REFERENCE_DATA_WRITE_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateManagementDto) {
    return this.managementsService.update(id, dto);
  }
}
