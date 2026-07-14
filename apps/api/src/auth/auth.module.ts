import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessControlService } from './access-control.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RequireAuthMiddleware } from './require-auth.middleware';
import { RolesGuard } from './roles.guard';
import { WriteAccessGuard } from './write-access.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    RequireAuthMiddleware,
    AccessControlService,
    RolesGuard,
    WriteAccessGuard,
  ],
  exports: [
    AuthService,
    RequireAuthMiddleware,
    AccessControlService,
    RolesGuard,
    WriteAccessGuard,
  ],
})
export class AuthModule {}
