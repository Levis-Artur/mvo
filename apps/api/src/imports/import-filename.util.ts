import { posix } from 'node:path';
import * as iconv from 'iconv-lite';

const MAX_FILENAME_LENGTH = 255;
const MOJIBAKE_MARKERS = /(?:[ÐÑ][\u0080-\u00bf]|Р.|С.|Ã.|Â.|â€)/g;

function mojibakeScore(value: string): number {
  return value.match(MOJIBAKE_MARKERS)?.length ?? 0;
}

function decodeCandidate(
  value: string,
  encoding: BufferEncoding | 'win1251',
): string | undefined {
  const decoded =
    encoding === 'win1251'
      ? iconv.decode(iconv.encode(value, 'win1251'), 'utf8')
      : Buffer.from(value, encoding).toString('utf8');

  if (decoded.includes('\uFFFD')) {
    return undefined;
  }

  return decoded;
}

function repairMojibake(value: string): string {
  const score = mojibakeScore(value);
  if (score === 0) {
    return value;
  }

  const candidates = [
    decodeCandidate(value, 'latin1'),
    decodeCandidate(value, 'win1251'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.reduce((best, candidate) => {
    return mojibakeScore(candidate) < mojibakeScore(best) ? candidate : best;
  }, value);
}

function truncatePreservingExtension(
  filename: string,
  maxLength = MAX_FILENAME_LENGTH,
): string {
  if (filename.length <= maxLength) {
    return filename;
  }

  const extension = posix.extname(filename);
  if (!extension || extension.length >= maxLength) {
    return filename.slice(0, maxLength);
  }

  return `${filename.slice(0, maxLength - extension.length)}${extension}`;
}

function removeControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && (code < 127 || code > 159);
    })
    .join('');
}

export function normalizeImportFilename(originalFilename: string): string {
  const repaired = repairMojibake(originalFilename);
  const basename = posix.basename(repaired.replaceAll('\\', '/'));
  const cleaned = removeControlCharacters(basename).trim();
  const safeFilename = cleaned || 'import.csv';

  return truncatePreservingExtension(safeFilename);
}
