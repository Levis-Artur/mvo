import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { OwnerDestructiveActionsService } from './owner-destructive-actions.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [OwnerDestructiveActionsService],
  exports: [OwnerDestructiveActionsService],
})
export class AdminModule {}
