import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { validateEnvironment } from '../config/env';
import {
  IMPORT_READ_ROLES,
  IMPORT_WRITE_ROLES,
} from '../auth/access-policy';
import { Roles } from '../auth/roles.decorator';
import { CurrentUserParam } from '../auth/current-user.decorator';
import type { AuthenticatedRequest, CurrentUser } from '../auth/auth.types';
import { getRequestContext } from '../auth/request-context';
import { ImportUploadDto } from './dto/import-upload.dto';
import { ListImportRowsQueryDto } from './dto/list-import-rows-query.dto';
import { ListImportsQueryDto } from './dto/list-imports-query.dto';
import { UpdateImportMappingsDto } from './dto/update-import-mappings.dto';
import { ImportsService } from './imports.service';

@Controller('imports')
@Roles(...IMPORT_READ_ROLES)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('upload')
  @Roles(...IMPORT_WRITE_ROLES)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: validateEnvironment().maxImportFileSizeBytes },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportUploadDto,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importsService.upload({
      file,
      importType: dto.importType,
      maxFileSizeBytes: validateEnvironment().maxImportFileSizeBytes,
      audit: { actor, context: getRequestContext(request) },
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
  @Roles(...IMPORT_WRITE_ROLES)
  mappings(
    @Param('id') id: string,
    @Body() dto: UpdateImportMappingsDto,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importsService.updateMappings(id, dto, {
      actor,
      context: getRequestContext(request),
    });
  }

  @Post(':id/validate')
  @Roles(...IMPORT_WRITE_ROLES)
  validate(
    @Param('id') id: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importsService.validate(id, {
      actor,
      context: getRequestContext(request),
    });
  }

  @Post(':id/commit')
  @Roles(...IMPORT_WRITE_ROLES)
  commit(
    @Param('id') id: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importsService.commit(id, {
      actor,
      context: getRequestContext(request),
    });
  }

  @Post(':id/cancel')
  @Roles(...IMPORT_WRITE_ROLES)
  cancel(
    @Param('id') id: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importsService.cancel(id, {
      actor,
      context: getRequestContext(request),
    });
  }
}
