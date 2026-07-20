import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  REFERENCE_DATA_READ_ROLES,
  REFERENCE_DATA_WRITE_ROLES,
} from '../auth/access-policy';
import { Roles } from '../auth/roles.decorator';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@Controller('services')
@Roles(...REFERENCE_DATA_READ_ROLES)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  findAll(@Query() query: ListServicesQueryDto) {
    return this.servicesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Post()
  @Roles(...REFERENCE_DATA_WRITE_ROLES)
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Patch(':id')
  @Roles(...REFERENCE_DATA_WRITE_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }
}
