import type { FaqEntry } from './utils';

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const LEAF_BLOCK_TAGS = new Set(['P', 'UL', 'OL', 'DIV', 'SECTION', 'ARTICLE', ...HEADING_TAGS]);
const BLOCK_SELECTOR = 'p,ul,ol,div,section,article,h1,h2,h3,h4,h5,h6';

// ── Bold detection ───────────────────────────────────────────────────────────

const isBoldElement = (element: HTMLElement, isInsideBold: boolean): boolean => {
  const declaredWeight = element.style.fontWeight;
  if (declaredWeight) return declaredWeight === 'bold' || declaredWeight === 'bolder' || parseInt(declaredWeight, 10) >= 600;
  if (element.tagName === 'B' || element.tagName === 'STRONG') return true;
  return isInsideBold;
};

const isEntirelyBold = (node: Node, isInsideBold: boolean): boolean => {
  if (node.nodeType === Node.TEXT_NODE) return !node.textContent?.trim() || isInsideBold;
  if (!(node instanceof HTMLElement)) return true;
  const isBoldHere = isBoldElement(node, isInsideBold);
  return Array.from(node.childNodes).every((child) => isEntirelyBold(child, isBoldHere));
};

// ── Block collection ─────────────────────────────────────────────────────────

const collectBlocks = (container: Node): HTMLElement[] => {
  const blocks: HTMLElement[] = [];
  let looseInlineNodes: Node[] = [];

  const flushLooseInlineNodes = () => {
    if (looseInlineNodes.some((node) => node.textContent?.trim())) {
      const paragraph = document.createElement('p');
      looseInlineNodes.forEach((node) => paragraph.appendChild(node.cloneNode(true)));
      blocks.push(paragraph);
    }
    looseInlineNodes = [];
  };

  container.childNodes.forEach((child) => {
    const isBlockLevel = child instanceof HTMLElement && (LEAF_BLOCK_TAGS.has(child.tagName) || child.querySelector(BLOCK_SELECTOR));
    if (!isBlockLevel) {
      looseInlineNodes.push(child);
      return;
    }
    flushLooseInlineNodes();
    const isWrapper = child.querySelector(BLOCK_SELECTOR) && !['P', 'UL', 'OL', ...HEADING_TAGS].includes(child.tagName);
    if (isWrapper) blocks.push(...collectBlocks(child));
    else blocks.push(child);
  });
  flushLooseInlineNodes();
  return blocks;
};

// ── Answer text ──────────────────────────────────────────────────────────────

const collapse = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();

const answerBlockText = (block: HTMLElement): string => {
  if (block.tagName !== 'UL' && block.tagName !== 'OL') return collapse(block.textContent);
  return Array.from(block.querySelectorAll('li'))
    .map((item) => collapse(Array.from(item.childNodes)
      .filter((node) => !(node instanceof HTMLElement && (node.tagName === 'UL' || node.tagName === 'OL')))
      .map((node) => node.textContent)
      .join('')))
    .filter(Boolean)
    .join('\n');
};

// ── Public entry point ───────────────────────────────────────────────────────

export function extractFaqEntriesFromRichText(pastedHtml: string): FaqEntry[] {
  const pastedDocument = new DOMParser().parseFromString(pastedHtml, 'text/html');
  const faqEntries: FaqEntry[] = [];
  let currentAnswerLines: string[] = [];
  let currentQuestion: string | null = null;

  const finishCurrentEntry = () => {
    if (currentQuestion) faqEntries.push({ question: currentQuestion, answer: currentAnswerLines.join('\n') });
    currentAnswerLines = [];
  };

  collectBlocks(pastedDocument.body).forEach((block) => {
    const blockText = collapse(block.textContent);
    if (!blockText) return;

    const isListBlock = block.tagName === 'UL' || block.tagName === 'OL';
    const isQuestionBlock = !isListBlock && (HEADING_TAGS.has(block.tagName) || isEntirelyBold(block, false));

    if (isQuestionBlock) {
      finishCurrentEntry();
      currentQuestion = blockText;
    } else if (currentQuestion) {
      currentAnswerLines.push(answerBlockText(block));
    }
  });
  finishCurrentEntry();

  return faqEntries;
}
