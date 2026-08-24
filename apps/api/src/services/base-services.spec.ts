import { backfillBaseServices, BASE_SERVICE_CODES } from './base-services';

function fixture(initialCodes: string[] = []) {
  const services = initialCodes.map((code) => ({
    managementId: 'management-1',
    code,
    name: code,
  }));
  const client = {
    management: {
      findMany: jest.fn().mockResolvedValue([{ id: 'management-1' }]),
    },
    service: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve(services)),
      createMany: jest.fn().mockImplementation(({
        data,
      }: {
        data: Array<{ managementId: string; code: string; name: string }>;
      }) => {
        for (const service of data) {
          if (
            !services.some(
              (existing) =>
                existing.managementId === service.managementId &&
                existing.code === service.code,
            )
          ) {
            services.push({
              managementId: service.managementId,
              code: service.code,
              name: service.name,
            });
          }
        }
        return Promise.resolve({ count: data.length });
      }),
      updateMany: jest.fn().mockImplementation(({
        where,
        data,
      }: {
        where: { code: string; name: { not: string } };
        data: { name: string };
      }) => {
        let count = 0;
        for (const service of services) {
          if (service.code === where.code && service.name !== where.name.not) {
            service.name = data.name;
            count += 1;
          }
        }
        return Promise.resolve({ count });
      }),
    },
  };
  return { client, services };
}

describe('base services backfill', () => {
  it('adds IT, MTZ and UATZ to a management without services', async () => {
    const { client, services } = fixture();

    await expect(backfillBaseServices(client as never)).resolves.toEqual({
      managements: 1,
      missing: 3,
      created: 3,
      normalized: 0,
    });
    expect(services.map((service) => service.code).sort()).toEqual(
      [...BASE_SERVICE_CODES].sort(),
    );
  });

  it('adds only MTZ and UATZ when IT already exists', async () => {
    const { client, services } = fixture(['IT']);

    await expect(backfillBaseServices(client as never)).resolves.toEqual({
      managements: 1,
      missing: 2,
      created: 2,
      normalized: 1,
    });
    expect(services.map((service) => service.code).sort()).toEqual(
      [...BASE_SERVICE_CODES].sort(),
    );
  });

  it('is idempotent and does not duplicate services on a repeated run', async () => {
    const { client, services } = fixture();

    await backfillBaseServices(client as never);
    await expect(backfillBaseServices(client as never)).resolves.toEqual({
      managements: 1,
      missing: 0,
      created: 0,
      normalized: 0,
    });
    expect(services).toHaveLength(3);
    expect(client.service.createMany).toHaveBeenCalledTimes(1);
  });
});
