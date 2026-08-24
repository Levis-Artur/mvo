import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  backfillBaseServices,
  BASE_SERVICE_CODES,
} from './base-services';

async function main() {
  const prisma = new PrismaClient();

  try {
    const result = await backfillBaseServices(prisma);
    const nonBaseServices = await prisma.service.findMany({
      where: { code: { notIn: [...BASE_SERVICE_CODES] } },
      orderBy: [{ management: { name: 'asc' } }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        management: { select: { id: true, name: true, code: true } },
        _count: { select: { responsiblePersons: true } },
      },
    });

    console.log(
      JSON.stringify(
        {
          ...result,
          nonBaseServices,
          numericCodeServices: nonBaseServices.filter((service) =>
            /^\d+$/.test(service.code.trim()),
          ),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
