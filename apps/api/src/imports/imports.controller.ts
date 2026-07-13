import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { validateEnvironment } from '../config/env';
import { ImportUploadDto } from './dto/import-upload.dto';
import { ListImportRowsQueryDto } from './dto/list-import-rows-query.dto';
import { ListImportsQueryDto } from './dto/list-imports-query.dto';
import { UpdateImportMappingsDto } from './dto/update-import-mappings.dto';
import { ImportsService } from './imports.service';

@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: validateEnvironment().maxImportFileSizeBytes },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportUploadDto,
  ) {
    return this.importsService.upload({
      file,
      importType: dto.importType,
      maxFileSizeBytes: validateEnvironment().maxImportFileSizeBytes,
    });
  }

  @Get()
  findAll(@Query() query: ListImportsQueryDto) {
    return this.importsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.importsService.findOne(id);
  }

  @Get(':id/rows')
  rows(@Param('id') id: string, @Query() query: ListImportRowsQueryDto) {
    return this.importsService.rows(id, query);
  }

  @Patch(':id/mappings')
  mappings(@Param('id') id: string, @Body() dto: UpdateImportMappingsDto) {
    return this.importsService.updateMappings(id, dto);
  }

  @Post(':id/validate')
  validate(@Param('id') id: string) {
    return this.importsService.validate(id);
  }

  @Post(':id/commit')
  commit(@Param('id') id: string) {
    return this.importsService.commit(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.importsService.cancel(id);
  }
}
