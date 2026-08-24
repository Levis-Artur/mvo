import type { Prisma } from '@prisma/client';

export const BASE_SERVICES = [
  { code: 'IT', name: 'ІТ' },
  { code: 'MTZ', name: 'МТЗ' },
  { code: 'UATZ', name: 'УАТЗ' },
] as const;

export const BASE_SERVICE_CODES = BASE_SERVICES.map((service) => service.code);

type BaseServicesClient = Pick<
  Prisma.TransactionClient,
  'management' | 'service'
>;

export function baseServicesForManagement(managementId: string) {
  return BASE_SERVICES.map((service) => ({
    managementId,
    code: service.code,
    name: service.name,
    isActive: true,
  }));
}

export async function backfillBaseServices(client: BaseServicesClient) {
  const managements = await client.management.findMany({
    select: { id: true },
  });
  if (!managements.length) {
    return { managements: 0, missing: 0, created: 0, normalized: 0 };
  }

  const existing = await client.service.findMany({
    where: {
      managementId: { in: managements.map((management) => management.id) },
      code: { in: [...BASE_SERVICE_CODES] },
    },
    select: { managementId: true, code: true },
  });
  const existingKeys = new Set(
    existing.map((service) => `${service.managementId}\u0000${service.code}`),
  );
  const missing = managements.flatMap((management) =>
    baseServicesForManagement(management.id).filter(
      (service) =>
        !existingKeys.has(`${service.managementId}\u0000${service.code}`),
    ),
  );
  const result = missing.length
    ? await client.service.createMany({ data: missing, skipDuplicates: true })
    : { count: 0 };
  let normalized = 0;
  for (const service of BASE_SERVICES) {
    const update = await client.service.updateMany({
      where: { code: service.code, name: { not: service.name } },
      data: { name: service.name },
    });
    normalized += update.count;
  }

  return {
    managements: managements.length,
    missing: missing.length,
    created: result.count,
    normalized,
  };
}
