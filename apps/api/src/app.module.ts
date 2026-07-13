import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DashboardController } from './dashboard.controller';
import { ImportsModule } from './imports/imports.module';
import { InventoryItemsModule } from './inventory-items/inventory-items.module';
import { ManagementsModule } from './managements/managements.module';
import { PrismaModule } from './prisma/prisma.module';
import { ResponsiblePersonsModule } from './responsible-persons/responsible-persons.module';
import { ServicesModule } from './services/services.module';
import { StockModule } from './stock/stock.module';
import { UnitsModule } from './units/units.module';

@Module({
  imports: [
    PrismaModule,
    ManagementsModule,
    ServicesModule,
    UnitsModule,
    ResponsiblePersonsModule,
    InventoryItemsModule,
    StockModule,
    ImportsModule,
  ],
  controllers: [AppController, DashboardController],
})
export class AppModule {}
