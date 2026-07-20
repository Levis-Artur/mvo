import { Readable } from 'node:stream';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import type { CurrentUser } from '../auth/auth.types';
import { ExportMyPropertyQueryDto, MyPropertyExportSection } from './dto/my-property-query.dto';
import { StockController } from './stock.controller';

describe('StockController my-property export', () => {
  it('returns an attachment stream with CSV headers', async () => {
    const currentUser: CurrentUser = {
      id: 'user-id',
      username: 'mvo',
      role: UserRole.MVO,
      isActive: true,
      mustChangePassword: false,
      responsiblePersonId: 'person-id',
    };
    const myPropertyService = {
      exportCsv: jest.fn().mockResolvedValue({
        filename: 'mvo-property-002-2026-07-20.csv',
        stream: Readable.from(['csv']),
      }),
    };
    const response = { setHeader: jest.fn() } as unknown as Response;
    const controller = new StockController({} as never, myPropertyService as never);

    const file = await controller.exportMyProperty({
      section: MyPropertyExportSection.ALL,
    } as ExportMyPropertyQueryDto, currentUser, response);

    expect(myPropertyService.exportCsv).toHaveBeenCalledWith(
      { section: MyPropertyExportSection.ALL },
      currentUser,
    );
    expect(file.getHeaders()).toEqual({
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="mvo-property-002-2026-07-20.csv"',
      length: undefined,
    });
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });
});
