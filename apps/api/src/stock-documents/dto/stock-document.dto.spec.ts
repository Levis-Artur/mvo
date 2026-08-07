import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateIssueDto } from './stock-document.dto';

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
