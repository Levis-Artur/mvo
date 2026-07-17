import {
  addQuantities,
  formatQuantity,
  isPositiveQuantity,
} from './quantity-format';

describe('quantity formatting', () => {
  it('formats large values without converting them to Number', () => {
    expect(formatQuantity('12345678901234567890.1250')).toBe(
      '12 345 678 901 234 567 890,1250',
    );
  });

  it('adds fractional quantities without rounding', () => {
    expect(addQuantities(['0.1', '0.02', '10000000000000000000.003'])).toBe(
      '10000000000000000000.123',
    );
  });

  it('distinguishes positive and zero quantities', () => {
    expect(isPositiveQuantity('0.000')).toBe(false);
    expect(isPositiveQuantity('0.001')).toBe(true);
  });
});
