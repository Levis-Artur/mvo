import { Module } from '@nestjs/common';
import { ManagementsController } from './managements.controller';
import { ManagementsService } from './managements.service';

@Module({
  controllers: [ManagementsController],
  providers: [ManagementsService],
})
export class ManagementsModule {}
