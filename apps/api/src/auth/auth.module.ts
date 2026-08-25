import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessControlService } from './access-control.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PreAuthChallengeService } from './pre-auth-challenge.service';
import { RequireAuthMiddleware } from './require-auth.middleware';
import { RolesGuard } from './roles.guard';
import { UserAccessScopesService } from './user-access-scopes.service';
import { TwoFactorService } from './two-factor/two-factor.service';
import { WriteAccessGuard } from './write-access.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PreAuthChallengeService,
    RequireAuthMiddleware,
    AccessControlService,
    UserAccessScopesService,
    TwoFactorService,
    RolesGuard,
    WriteAccessGuard,
  ],
  exports: [
    AuthService,
    PreAuthChallengeService,
    RequireAuthMiddleware,
    AccessControlService,
    UserAccessScopesService,
    TwoFactorService,
    RolesGuard,
    WriteAccessGuard,
  ],
})
export class AuthModule {}
