import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { PrismaService } from './prisma/prisma.service';

type HealthResponse = {
  status: 'ok';
  service: 'mvo-inventory-api';
};

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  async health(): Promise<HealthResponse> {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      service: 'mvo-inventory-api',
    };
  }
}
