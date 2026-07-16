import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, CurrentUser } from '../auth/auth.types';
import { getRequestContext } from '../auth/request-context';
import {
  DestructiveActionDto,
  ResetTestDataDto,
} from './dto/destructive-action.dto';
import { OwnerDestructiveActionsService } from './owner-destructive-actions.service';

@Controller('admin')
@Roles(UserRole.OWNER)
export class AdminController {
  constructor(
    private readonly destructiveActions: OwnerDestructiveActionsService,
  ) {}

  @Get('deletion-preview/:entityType/:id')
  preview(
    @CurrentUserParam() actor: CurrentUser,
    @Param('entityType') entityType: string,
    @Param('id') id: string,
  ) {
    return this.destructiveActions.deletionPreview(actor, entityType, id);
  }

  @Delete(':entityType/:id')
  delete(
    @CurrentUserParam() actor: CurrentUser,
    @Param('entityType') entityType: string,
    @Param('id') id: string,
    @Body() dto: DestructiveActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.destructiveActions.delete(
      actor,
      entityType,
      id,
      dto,
      getRequestContext(request),
    );
  }

  @Post('imports/:id/rollback')
  rollbackImport(
    @CurrentUserParam() actor: CurrentUser,
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.destructiveActions.rollbackImport(
      actor,
      id,
      getRequestContext(request),
    );
  }

  @Post('test-data/reset')
  reset(
    @CurrentUserParam() actor: CurrentUser,
    @Body() _dto: ResetTestDataDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.destructiveActions.resetTestData(
      actor,
      getRequestContext(request),
    );
  }
}
