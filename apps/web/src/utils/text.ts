const cp1252CharToByte = new Map<string, number>([
  ['€', 0x80],
  ['‚', 0x82],
  ['ƒ', 0x83],
  ['„', 0x84],
  ['…', 0x85],
  ['†', 0x86],
  ['‡', 0x87],
  ['ˆ', 0x88],
  ['‰', 0x89],
  ['Š', 0x8a],
  ['‹', 0x8b],
  ['Œ', 0x8c],
  ['Ž', 0x8e],
  ['‘', 0x91],
  ['’', 0x92],
  ['“', 0x93],
  ['”', 0x94],
  ['•', 0x95],
  ['–', 0x96],
  ['—', 0x97],
  ['˜', 0x98],
  ['™', 0x99],
  ['š', 0x9a],
  ['›', 0x9b],
  ['œ', 0x9c],
  ['ž', 0x9e],
  ['Ÿ', 0x9f],
]);

function looksGarbled(text: string): boolean {
  return /[ÃÂâ€\uFFFD]/.test(text);
}

function byteFromVisibleChar(char: string): number | null {
  const cp1252Byte = cp1252CharToByte.get(char);

  if (typeof cp1252Byte === 'number') {
    return cp1252Byte;
  }

  const codePoint = char.codePointAt(0);

  if (typeof codePoint === 'number' && codePoint <= 0xff) {
    return codePoint;
  }

  return null;
}

function decodeLatin1OrCp1252AsUtf8(text: string): string {
  const bytes: number[] = [];

  for (const char of text) {
    const nextByte = byteFromVisibleChar(char);

    if (nextByte === null) {
      return text;
    }

    bytes.push(nextByte);
  }

  return new TextDecoder('utf-8').decode(Uint8Array.from(bytes));
}

export function normalizeText(text: string): string {
  if (!text || !looksGarbled(text)) {
    return text;
  }

  let current = text;

  for (let i = 0; i < 2; i += 1) {
    const repaired = decodeLatin1OrCp1252AsUtf8(current);

    if (repaired === current) {
      break;
    }

    current = repaired;

    if (!looksGarbled(current)) {
      break;
    }
  }

  return current;
}
