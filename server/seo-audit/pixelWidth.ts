const GROUPS: Array<[string, number]> = [
  ['ijl', 222],
  ["'", 191],
  ['|', 260],
  [' !,./:;I[\\]ft', 278],
  ['-()`r', 333],
  ['{}', 334],
  ['"', 355],
  ['*', 389],
  ['^', 469],
  ['cksvxyzJ', 500],
  ['0123456789?_abdeghnopquL', 556],
  ['+<=>~', 584],
  ['FTZ', 611],
  ['&ABEKPSVXY', 667],
  ['CDHNRUw', 722],
  ['GOQ', 778],
  ['Mm', 833],
  ['%', 889],
  ['W', 944],
  ['@', 1015],
];

const WIDTHS = new Map<string, number>();
for (const [chars, width] of GROUPS) for (const c of chars) WIDTHS.set(c, width);

const charWidth = (c: string) => WIDTHS.get(c) ?? ((c.codePointAt(0) ?? 0) > 0x2e7f ? 1000 : 556);

export function pixelWidth(text: string, fontPx: number): number {
  let units = 0;
  for (const c of text) units += charWidth(c);
  return Math.round((units / 1000) * fontPx);
}

export const titlePixelWidth = (text: string) => pixelWidth(text, 20);
export const descriptionPixelWidth = (text: string) => pixelWidth(text, 14);
