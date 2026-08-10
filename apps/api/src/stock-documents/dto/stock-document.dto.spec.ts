import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateIssueDto,
  CreateTransferIssueDto,
} from './stock-document.dto';

describe('CreateIssueDto multipart payload', () => {
  it('parses and validates JSON lines sent by FormData', async () => {
    const dto = plainToInstance(CreateIssueDto, {
      documentDate: '2026-08-07T00:00:00.000Z',
      recipientName: 'Зовнішній одержувач',
      note: 'Примітка',
      lines: JSON.stringify([
        {
          inventoryItemId: '11111111-1111-4111-8111-111111111111',
          sourceBalanceId: '22222222-2222-4222-8222-222222222222',
          quantity: '2.5',
        },
      ]),
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.lines).toHaveLength(1);
    expect(dto.lines[0]).toEqual(
      expect.objectContaining({
        inventoryItemId: '11111111-1111-4111-8111-111111111111',
        sourceBalanceId: '22222222-2222-4222-8222-222222222222',
        quantity: '2.5',
      }),
    );
  });

  it('rejects malformed JSON lines as a validation error', async () => {
    const dto = plainToInstance(CreateIssueDto, {
      documentDate: '2026-08-07T00:00:00.000Z',
      recipientName: 'Зовнішній одержувач',
      lines: '{not-json}',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'lines')).toBe(true);
  });
});

describe('CreateTransferIssueDto multipart payload', () => {
  it('parses source transfer line references without accepting balance ids', async () => {
    const dto = plainToInstance(CreateTransferIssueDto, {
      documentDate: '2026-08-10T00:00:00.000Z',
      recipientName: 'Одержувач',
      lines: JSON.stringify([
        {
          sourceTransferLineId:
            '77777777-7777-4777-8777-777777777777',
          quantity: '2',
        },
      ]),
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.lines[0]).toMatchObject({
      sourceTransferLineId: '77777777-7777-4777-8777-777777777777',
      quantity: '2',
    });
    expect(dto.lines[0]).not.toHaveProperty('sourceBalanceId');
  });
});
