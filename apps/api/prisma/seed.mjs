import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const management = await prisma.management.upsert({
    where: { code: 'VOLYN' },
    update: {
      name: 'Управління патрульної поліції у Волинській області',
      shortName: 'УПП у Волинській області',
      isActive: true,
    },
    create: {
      name: 'Управління патрульної поліції у Волинській області',
      shortName: 'УПП у Волинській області',
      code: 'VOLYN',
      isActive: true,
    },
  });

  const supportService = await prisma.service.upsert({
    where: {
      managementId_code: {
        managementId: management.id,
        code: 'SUPPORT',
      },
    },
    update: {
      name: 'Служба забезпечення',
      isActive: true,
    },
    create: {
      name: 'Служба забезпечення',
      code: 'SUPPORT',
      managementId: management.id,
      isActive: true,
    },
  });

  const monitoringService = await prisma.service.upsert({
    where: {
      managementId_code: {
        managementId: management.id,
        code: 'MONITORING',
      },
    },
    update: {
      name: 'Відділ моніторингу',
      isActive: true,
    },
    create: {
      name: 'Відділ моніторингу',
      code: 'MONITORING',
      managementId: management.id,
      isActive: true,
    },
  });

  const logisticsUnit = await prisma.unit.upsert({
    where: {
      serviceId_code: {
        serviceId: supportService.id,
        code: 'LOGISTICS',
      },
    },
    update: {
      name: 'Сектор логістики',
      isActive: true,
    },
    create: {
      name: 'Сектор логістики',
      code: 'LOGISTICS',
      serviceId: supportService.id,
      isActive: true,
    },
  });

  await prisma.unit.upsert({
    where: {
      serviceId_code: {
        serviceId: supportService.id,
        code: 'WAREHOUSE',
      },
    },
    update: {
      name: 'Склад майна',
      isActive: true,
    },
    create: {
      name: 'Склад майна',
      code: 'WAREHOUSE',
      serviceId: supportService.id,
      isActive: true,
    },
  });

  const dutyUnit = await prisma.unit.upsert({
    where: {
      serviceId_code: {
        serviceId: monitoringService.id,
        code: 'DUTY',
      },
    },
    update: {
      name: 'Чергове відділення',
      isActive: true,
    },
    create: {
      name: 'Чергове відділення',
      code: 'DUTY',
      serviceId: monitoringService.id,
      isActive: true,
    },
  });

  await prisma.responsiblePerson.upsert({
    where: { personnelNumber: 'TEST-MVO-001' },
    update: {
      lastName: 'Тестовий',
      firstName: 'Олександр',
      middleName: 'Демонстраційний',
      position: 'Інспектор з обліку майна',
      phone: '+380000000001',
      email: 'mvo.test.001@example.invalid',
      externalAccountingName: 'Тестовий О.Д._0619',
      externalAccountingCode: '0619',
      managementId: management.id,
      serviceId: supportService.id,
      unitId: logisticsUnit.id,
      appointmentOrderNumber: 'ТЕСТ-1',
      appointmentDate: new Date('2026-01-10T00:00:00.000Z'),
      isActive: true,
    },
    create: {
      lastName: 'Тестовий',
      firstName: 'Олександр',
      middleName: 'Демонстраційний',
      personnelNumber: 'TEST-MVO-001',
      position: 'Інспектор з обліку майна',
      phone: '+380000000001',
      email: 'mvo.test.001@example.invalid',
      externalAccountingName: 'Тестовий О.Д._0619',
      externalAccountingCode: '0619',
      managementId: management.id,
      serviceId: supportService.id,
      unitId: logisticsUnit.id,
      appointmentOrderNumber: 'ТЕСТ-1',
      appointmentDate: new Date('2026-01-10T00:00:00.000Z'),
      isActive: true,
    },
  });

  await prisma.responsiblePerson.upsert({
    where: { personnelNumber: 'TEST-MVO-002' },
    update: {
      lastName: 'Демонстраційна',
      firstName: 'Марія',
      middleName: 'Тестівна',
      position: 'Старший інспектор',
      phone: '+380000000002',
      email: 'mvo.test.002@example.invalid',
      managementId: management.id,
      serviceId: monitoringService.id,
      unitId: dutyUnit.id,
      appointmentOrderNumber: 'ТЕСТ-2',
      appointmentDate: new Date('2026-02-15T00:00:00.000Z'),
      isActive: true,
    },
    create: {
      lastName: 'Демонстраційна',
      firstName: 'Марія',
      middleName: 'Тестівна',
      personnelNumber: 'TEST-MVO-002',
      position: 'Старший інспектор',
      phone: '+380000000002',
      email: 'mvo.test.002@example.invalid',
      managementId: management.id,
      serviceId: monitoringService.id,
      unitId: dutyUnit.id,
      appointmentOrderNumber: 'ТЕСТ-2',
      appointmentDate: new Date('2026-02-15T00:00:00.000Z'),
      isActive: true,
    },
  });

  await prisma.inventoryItem.upsert({
    where: { externalCode: '1812060344' },
    update: {
      name: 'Безконтактна магнітна картка MF S50',
      unitOfMeasure: 'шт',
      reviewStatus: 'VERIFIED',
      isActive: true,
    },
    create: {
      externalCode: '1812060344',
      name: 'Безконтактна магнітна картка MF S50',
      unitOfMeasure: 'шт',
      category: 'Тестова номенклатура',
      reviewStatus: 'VERIFIED',
      createdManually: true,
      isActive: true,
    },
  });

  await prisma.inventoryItem.upsert({
    where: { externalCode: '0000000001' },
    update: {
      name: 'Тестова позиція для імпорту',
      unitOfMeasure: 'шт',
      reviewStatus: 'NEEDS_REVIEW',
      isActive: true,
    },
    create: {
      externalCode: '0000000001',
      name: 'Тестова позиція для імпорту',
      unitOfMeasure: 'шт',
      category: 'Тестова номенклатура',
      reviewStatus: 'NEEDS_REVIEW',
      createdManually: false,
      isActive: true,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
