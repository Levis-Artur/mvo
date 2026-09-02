import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ManagementsController } from './managements.controller';
import { ManagementsService } from './managements.service';

@Module({
  imports: [AuthModule],
  controllers: [ManagementsController],
  providers: [ManagementsService],
})
export class ManagementsModule {}
