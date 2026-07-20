import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  STOCK_DOCUMENT_READ_ROLES,
  STOCK_DOCUMENT_WRITE_ROLES,
} from '../auth/access-policy';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, CurrentUser } from '../auth/auth.types';
import { getRequestContext } from '../auth/request-context';
import {
  CreateStockDocumentDto,
  ListStockDocumentsQueryDto,
  UpdateStockDocumentDto,
} from './dto/stock-document.dto';
import { StockDocumentsService } from './stock-documents.service';

@Controller('stock-documents')
@Roles(...STOCK_DOCUMENT_READ_ROLES)
export class StockDocumentsController {
  constructor(private readonly service: StockDocumentsService) {}

  @Get()
  list(
    @Query() query: ListStockDocumentsQueryDto,
    @CurrentUserParam() actor: CurrentUser,
  ) {
    return this.service.list(query, actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUserParam() actor: CurrentUser) {
    return this.service.findOne(id, actor);
  }

  @Post()
  @Roles(...STOCK_DOCUMENT_WRITE_ROLES)
  create(
    @Body() dto: CreateStockDocumentDto,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.create(dto, actor, getRequestContext(request));
  }

  @Patch(':id')
  @Roles(...STOCK_DOCUMENT_WRITE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStockDocumentDto,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, actor, getRequestContext(request));
  }

  @Delete(':id')
  @Roles(...STOCK_DOCUMENT_WRITE_ROLES)
  remove(
    @Param('id') id: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.remove(id, actor, getRequestContext(request));
  }

  @Post(':id/post')
  @Roles(...STOCK_DOCUMENT_WRITE_ROLES)
  post(
    @Param('id') id: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.post(id, actor, getRequestContext(request));
  }

  @Post(':id/cancel')
  @Roles(...STOCK_DOCUMENT_WRITE_ROLES)
  cancel(
    @Param('id') id: string,
    @CurrentUserParam() actor: CurrentUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.cancel(id, actor, getRequestContext(request));
  }
}
