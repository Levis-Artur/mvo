type DecimalParts = {
  negative: boolean;
  integer: string;
  fraction: string;
};

function parseDecimal(value: string): DecimalParts {
  const normalized = value.trim();
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return { negative: false, integer: '0', fraction: '' };
  return {
    negative: Boolean(match[1]),
    integer: (match[2] ?? '0').replace(/^0+(?=\d)/, ''),
    fraction: match[3] ?? '',
  };
}

export function formatQuantity(value: string) {
  const parts = parseDecimal(value);
  const grouped = parts.integer.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const sign = parts.negative && !isZeroQuantity(value) ? '−' : '';
  return `${sign}${grouped}${parts.fraction ? `,${parts.fraction}` : ''}`;
}

export function isZeroQuantity(value: string) {
  const parts = parseDecimal(value);
  return BigInt(`${parts.integer}${parts.fraction}` || '0') === BigInt(0);
}

export function isPositiveQuantity(value: string) {
  const parts = parseDecimal(value);
  return !parts.negative && !isZeroQuantity(value);
}

export function addQuantities(values: string[]) {
  const parts = values.map(parseDecimal);
  const scale = Math.max(0, ...parts.map((item) => item.fraction.length));
  const total = parts.reduce((sum, item) => {
    const digits = `${item.integer}${item.fraction.padEnd(scale, '0')}`;
    const amount = BigInt(digits || '0');
    return sum + (item.negative ? -amount : amount);
  }, BigInt(0));
  const negative = total < BigInt(0);
  const absolute = (negative ? -total : total).toString().padStart(scale + 1, '0');
  if (scale === 0) return `${negative ? '-' : ''}${absolute}`;
  const integer = absolute.slice(0, -scale) || '0';
  const fraction = absolute.slice(-scale).replace(/0+$/, '');
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`;
}
