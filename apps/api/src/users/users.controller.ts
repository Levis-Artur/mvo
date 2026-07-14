import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, CurrentUser } from '../auth/auth.types';
import { getRequestContext } from '../auth/request-context';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@Roles(UserRole.OWNER, UserRole.DPP_ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentUserParam() actor: CurrentUser) {
    return this.usersService.findAll(actor);
  }

  @Get(':id')
  findOne(@CurrentUserParam() actor: CurrentUser, @Param('id') id: string) {
    return this.usersService.findOne(actor, id);
  }

  @Post()
  create(
    @CurrentUserParam() actor: CurrentUser,
    @Body() dto: CreateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.create(actor, dto, getRequestContext(request));
  }

  @Patch(':id')
  update(
    @CurrentUserParam() actor: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.update(actor, id, dto, getRequestContext(request));
  }

  @Post(':id/reset-password')
  resetPassword(
    @CurrentUserParam() actor: CurrentUser,
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.resetPassword(
      actor,
      id,
      getRequestContext(request),
    );
  }

  @Post(':id/block')
  block(
    @CurrentUserParam() actor: CurrentUser,
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.block(actor, id, getRequestContext(request));
  }

  @Post(':id/unblock')
  unblock(
    @CurrentUserParam() actor: CurrentUser,
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.unblock(actor, id, getRequestContext(request));
  }

  @Post(':id/revoke-sessions')
  revokeSessions(
    @CurrentUserParam() actor: CurrentUser,
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.revokeSessions(
      actor,
      id,
      getRequestContext(request),
    );
  }

  @Post(':id/deactivate')
  deactivate(
    @CurrentUserParam() actor: CurrentUser,
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.deactivate(actor, id, getRequestContext(request));
  }

  @Post(':id/activate')
  activate(
    @CurrentUserParam() actor: CurrentUser,
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.activate(actor, id, getRequestContext(request));
  }
}

