/** @jest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { StockDocument } from '@/lib/types';
import { MyTransferredPropertyCard } from './my-transferred-property-card';

const mvoId = '11111111-1111-4111-8111-111111111111';
const lineId = '22222222-2222-4222-8222-222222222222';

function transfer(): StockDocument {
  const person = {
    id: mvoId,
    lastName: 'Іваненко',
    firstName: 'Іван',
    middleName: null,
    personnelNumber: '0001',
    externalAccountingCode: '0001',
  };
  const recipient = {
    ...person,
    id: '55555555-5555-4555-8555-555555555555',
    lastName: 'Жигульський',
    firstName: 'Андрій',
    personnelNumber: '0057',
    externalAccountingCode: '0057',
  };
  const item = {
    id: '66666666-6666-4666-8666-666666666666',
    externalCode: '1812065276',
    name: 'RFID-мітка',
    unitOfMeasure: 'шт.',
  };
  return {
    id: '77777777-7777-4777-8777-777777777777',
    displayNumber: 25,
    documentDate: '2026-08-10T00:00:00.000Z',
    type: 'MVO_TRANSFER',
    status: 'POSTED',
    sourceResponsiblePersonId: mvoId,
    destinationResponsiblePersonId: recipient.id,
    sourceResponsiblePerson: person,
    destinationResponsiblePerson: recipient,
    lines: [
      {
        id: lineId,
        inventoryItemId: item.id,
        inventoryItem: item,
        quantity: '10',
        issuedQuantity: '4',
        availableToIssue: '6',
      },
    ],
    issues: [],
    attachments: [],
    totalPositions: 1,
    totalQuantity: '10',
  } as StockDocument;
}

afterEach(cleanup);

describe('MyTransferredPropertyCard', () => {
  it('shows only transfer facts without the old child issue workflow', () => {
    render(
      <MyTransferredPropertyCard
        transfer={transfer()}
        transferLineId={lineId}
        onBack={jest.fn()}
      />,
    );

    expect(screen.getByText('Передано')).toBeTruthy();
    expect(screen.getByText('0057 — Жигульський Андрій')).toBeTruthy();
    expect(screen.getByText('№ 25')).toBeTruthy();
    expect(screen.queryByText('Видано')).toBeNull();
    expect(screen.queryByText('Залишилось оформити видачу')).toBeNull();
    expect(screen.queryByRole('button', { name: /видач/i })).toBeNull();
  });
});
