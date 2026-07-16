import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { DashboardController } from './dashboard.controller';
import { AuthModule } from './auth/auth.module';
import { RequireAuthMiddleware } from './auth/require-auth.middleware';
import { RolesGuard } from './auth/roles.guard';
import { WriteAccessGuard } from './auth/write-access.guard';
import { ImportsModule } from './imports/imports.module';
import { InventoryItemsModule } from './inventory-items/inventory-items.module';
import { ManagementsModule } from './managements/managements.module';
import { PrismaModule } from './prisma/prisma.module';
import { ResponsiblePersonsModule } from './responsible-persons/responsible-persons.module';
import { ServicesModule } from './services/services.module';
import { StockModule } from './stock/stock.module';
import { UnitsModule } from './units/units.module';
import { UsersModule } from './users/users.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AdminModule } from './admin/admin.module';
import { StockDocumentsModule } from './stock-documents/stock-documents.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ManagementsModule,
    ServicesModule,
    UnitsModule,
    ResponsiblePersonsModule,
    InventoryItemsModule,
    StockModule,
    ImportsModule,
    UsersModule,
    AdminModule,
    StockDocumentsModule,
  ],
  controllers: [AppController, DashboardController],
  providers: [
    { provide: APP_GUARD, useClass: WriteAccessGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');

    consumer
      .apply(RequireAuthMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'auth/login', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
