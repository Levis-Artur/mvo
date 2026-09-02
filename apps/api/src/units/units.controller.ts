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
import type { CurrentUser } from '../auth/auth.types';
import {
  REFERENCE_DATA_READ_ROLES,
  REFERENCE_DATA_WRITE_ROLES,
} from '../auth/access-policy';
import { Roles } from '../auth/roles.decorator';
import { CreateUnitDto } from './dto/create-unit.dto';
import { ListUnitsQueryDto } from './dto/list-units-query.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

@Controller('units')
@Roles(...REFERENCE_DATA_READ_ROLES)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  @Roles(...REFERENCE_DATA_READ_ROLES, UserRole.MVO, UserRole.ORG_MANAGER)
  findAll(
    @Query() query: ListUnitsQueryDto,
    @CurrentUserParam() actor: CurrentUser,
  ) {
    return this.unitsService.findAll(query, actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.unitsService.findOne(id);
  }

  @Post()
  @Roles(...REFERENCE_DATA_WRITE_ROLES)
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto);
  }

  @Patch(':id')
  @Roles(...REFERENCE_DATA_WRITE_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.unitsService.update(id, dto);
  }
}
