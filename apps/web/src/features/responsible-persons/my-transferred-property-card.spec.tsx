/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AuthUser, StockDocument } from '@/lib/types';
import { MyTransferredPropertyCard } from './my-transferred-property-card';

const mvoId = '11111111-1111-4111-8111-111111111111';
const lineId = '22222222-2222-4222-8222-222222222222';
const issueId = '33333333-3333-4333-8333-333333333333';

const user = {
  id: '44444444-4444-4444-8444-444444444444',
  username: 'mvo',
  role: 'MVO',
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: mvoId,
} satisfies AuthUser;

function transfer(availableToIssue = '6'): StockDocument {
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
        issuedQuantity: availableToIssue === '0' ? '10' : '4',
        availableToIssue,
        sourceTransferLineId: null,
      },
    ],
    issues: [
      {
        id: issueId,
        displayNumber: 31,
        documentDate: '2026-08-11T00:00:00.000Z',
        type: 'ISSUE',
        status: 'POSTED',
        recipientName: 'Склад забезпечення',
        lines: [
          {
            id: '88888888-8888-4888-8888-888888888888',
            inventoryItemId: item.id,
            inventoryItem: item,
            quantity: '4',
            sourceTransferLineId: lineId,
          },
          {
            id: '99999999-9999-4999-8999-999999999999',
            inventoryItemId: item.id,
            inventoryItem: item,
            quantity: '50',
            sourceTransferLineId: 'another-line',
          },
        ],
        attachments: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            documentId: issueId,
            originalFileName: 'накладна.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            sha256: 'hash',
            uploadedByUserId: user.id,
            createdAt: '2026-08-11T00:00:00.000Z',
          },
        ],
        totalPositions: 2,
        totalQuantity: '54',
      } as StockDocument,
    ],
    attachments: [],
    totalPositions: 1,
    totalQuantity: '10',
  } as StockDocument;
}

afterEach(cleanup);

describe('MyTransferredPropertyCard', () => {
  it('shows transfer-line quantities and issues only the selected line', () => {
    const onIssue = jest.fn();
    const onViewIssue = jest.fn();
    render(
      <MyTransferredPropertyCard
        transfer={transfer()}
        transferLineId={lineId}
        user={user}
        onBack={jest.fn()}
        onIssue={onIssue}
        onViewIssue={onViewIssue}
      />,
    );

    expect(screen.getByText('Передано')).toBeTruthy();
    expect(screen.getByText('Видано')).toBeTruthy();
    expect(screen.getByText('Залишилось оформити видачу')).toBeTruthy();
    expect(screen.getByText('0057 — Жигульський Андрій')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.queryByText('54')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Оформити видачу' }));
    expect(onIssue).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Є документ')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'накладна.pdf' })).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Переглянути видачу' }),
    );
    expect(onViewIssue).toHaveBeenCalledWith(issueId);
  });

  it('shows a neutral completed state instead of an unavailable action', () => {
    render(
      <MyTransferredPropertyCard
        transfer={transfer('0')}
        transferLineId={lineId}
        user={user}
        onBack={jest.fn()}
        onIssue={jest.fn()}
        onViewIssue={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Оформити видачу' })).toBeNull();
    expect(screen.getByText('Видано повністю')).toBeTruthy();
  });
});
