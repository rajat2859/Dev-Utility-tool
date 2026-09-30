import { escapeHtml, type FaqEntry } from './utils';

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const LEAF_BLOCK_TAGS = new Set(['P', 'UL', 'OL', 'DIV', 'SECTION', 'ARTICLE', ...HEADING_TAGS]);
const BLOCK_SELECTOR = 'p,ul,ol,div,section,article,h1,h2,h3,h4,h5,h6';
const SAFE_LINK_PROTOCOL = /^(https?:|mailto:)/i;

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

// ── Answer HTML cleaning ─────────────────────────────────────────────────────

const cleanInlineHtml = (node: Node, isInsideBold: boolean): string => {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml((node.textContent ?? '').replace(/\s+/g, ' '));
  if (!(node instanceof HTMLElement)) return '';

  const isBoldHere = isBoldElement(node, isInsideBold);
  let innerHtml = Array.from(node.childNodes).map((child) => cleanInlineHtml(child, isBoldHere)).join('');

  if (node.tagName === 'BR') return '<br>';
  if (node.tagName === 'A' && SAFE_LINK_PROTOCOL.test(node.getAttribute('href') ?? '')) {
    innerHtml = `<a href="${escapeHtml(node.getAttribute('href')!)}">${innerHtml}</a>`;
  }
  if (node.tagName === 'I' || node.tagName === 'EM' || node.style.fontStyle === 'italic') innerHtml = `<em>${innerHtml}</em>`;
  if (isBoldHere && !isInsideBold && innerHtml.trim()) innerHtml = `<strong>${innerHtml}</strong>`;
  return innerHtml;
};

const cleanListHtml = (list: HTMLElement): string => {
  const listItemsHtml = Array.from(list.children)
    .map((child) => {
      const nestedLists = Array.from(child.children).filter((nested) => nested.tagName === 'UL' || nested.tagName === 'OL');
      const ownContentNodes = Array.from(child.childNodes).filter((node) => !nestedLists.includes(node as Element));
      const itemHtml = ownContentNodes.map((node) => cleanInlineHtml(node, false)).join('').trim() +
        nestedLists.map((nested) => cleanListHtml(nested as HTMLElement)).join('');
      return itemHtml ? `<li>${itemHtml}</li>` : '';
    })
    .join('');
  const tagName = list.tagName.toLowerCase();
  return listItemsHtml ? `<${tagName}>${listItemsHtml}</${tagName}>` : '';
};

const cleanAnswerBlockHtml = (block: HTMLElement): string => {
  if (block.tagName === 'UL' || block.tagName === 'OL') return cleanListHtml(block);
  const paragraphHtml = cleanInlineHtml(block, false).trim();
  return paragraphHtml ? `<p>${paragraphHtml}</p>` : '';
};

// ── Public entry point ───────────────────────────────────────────────────────

export function extractFaqEntriesFromRichText(pastedHtml: string): FaqEntry[] {
  const pastedDocument = new DOMParser().parseFromString(pastedHtml, 'text/html');
  const faqEntries: FaqEntry[] = [];
  let currentAnswerBlocksHtml: string[] = [];
  let currentQuestion: string | null = null;

  const finishCurrentEntry = () => {
    if (currentQuestion) faqEntries.push({ question: currentQuestion, answer: currentAnswerBlocksHtml.join('') });
    currentAnswerBlocksHtml = [];
  };

  collectBlocks(pastedDocument.body).forEach((block) => {
    const blockText = (block.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!blockText) return;

    const isListBlock = block.tagName === 'UL' || block.tagName === 'OL';
    const isQuestionBlock = !isListBlock && (HEADING_TAGS.has(block.tagName) || isEntirelyBold(block, false));

    if (isQuestionBlock) {
      finishCurrentEntry();
      currentQuestion = blockText;
    } else if (currentQuestion) {
      currentAnswerBlocksHtml.push(cleanAnswerBlockHtml(block));
    }
  });
  finishCurrentEntry();

  return faqEntries;
}
