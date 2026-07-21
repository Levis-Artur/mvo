import { ApiError } from '../../lib/api-client';
import { getMvoErrorMessage } from './formatters';

describe('MVO error presentation', () => {
  it.each([
    [new ApiError('Forbidden', 403, 'FORBIDDEN'), 'Ви не маєте доступу до цієї операції.'],
    [new ApiError('limit must not be greater than 100', 400), 'Не вдалося завантажити дані. Натисніть «Оновити».'],
    [new ApiError('source balance not found', 404), 'Ця позиція вже була змінена. Оновіть список і повторіть спробу.'],
    [new ApiError('ASSIGNED bucket unavailable', 409), 'Ця позиція вже була змінена. Оновіть список і повторіть спробу.'],
    [new ApiError('Insufficient quantity', 409), 'Недостатньо майна для цієї операції.'],
    [new ApiError('File too large', 413), 'Файл накладної перевищує допустимий розмір.'],
    [new ApiError('Attachment required', 400), 'Спочатку додайте фото або PDF накладної.'],
  ])('перетворює очікувану технічну помилку', (error, expected) => {
    expect(getMvoErrorMessage(error)).toBe(expected);
  });

  it('зберігає зрозуміле українське повідомлення сервера', () => {
    expect(getMvoErrorMessage(new ApiError('Вкажіть одержувача', 400))).toBe('Вкажіть одержувача');
  });
});
