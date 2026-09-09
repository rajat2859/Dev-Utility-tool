import assert from 'node:assert/strict';
import { escapeHtml, randomInt, semanticTagsForInlineStyle, shuffled } from './utils';
// npx tsx src/lib/utils.test.ts
// Guards the two things that are easy to get silently wrong: randomInt must be
// unbiased and in range, shuffled must be a permutation that actually moves.


for (let i = 0; i < 5000; i++) {
  const n = randomInt(7);
  assert.ok(Number.isInteger(n) && n >= 0 && n < 7, `out of range: ${n}`);
}
assert.equal(randomInt(1), 0);
assert.equal(randomInt(0), 0);

// Every bucket must be hit, and roughly evenly: a `% n` implementation over a
// 32-bit source is only ~2e-8 biased, so this catches gross errors, not bias.
const counts = new Array(7).fill(0);
for (let i = 0; i < 70000; i++) counts[randomInt(7)]++;
assert.ok(counts.every((c) => c > 8000 && c < 12000), `skewed: ${counts}`);

const input = [...Array(50).keys()];
const out = shuffled(input);
assert.deepEqual([...out].sort((a, b) => a - b), input, 'not a permutation');
assert.deepEqual(input, [...Array(50).keys()], 'mutated its input');
assert.notDeepEqual(out, input, 'did not shuffle');

// Fisher-Yates reaches every position; a sort-comparator shuffle leaves the
// first elements near the front. Check element 0 moves across the array.
const landings = new Set();
for (let i = 0; i < 400; i++) landings.add(shuffled(input).indexOf(0));
assert.ok(landings.size > 35, `element 0 only reached ${landings.size} slots`);

console.log('utils: all checks passed');

// --- semanticTagsForInlineStyle -------------------------------------------
// The shapes real editors actually paste.
assert.deepEqual(semanticTagsForInlineStyle({ fontWeight: '700' }), ['strong']);
assert.deepEqual(semanticTagsForInlineStyle({ fontWeight: 'bold' }), ['strong']);
assert.deepEqual(semanticTagsForInlineStyle({ fontWeight: 'bolder' }), ['strong']);
assert.deepEqual(semanticTagsForInlineStyle({ fontWeight: '600' }), ['strong']);
assert.deepEqual(semanticTagsForInlineStyle({ fontStyle: 'italic' }), ['em']);
assert.deepEqual(semanticTagsForInlineStyle({ textDecoration: 'line-through' }), ['del']);
assert.deepEqual(semanticTagsForInlineStyle({ textDecorationLine: 'underline' }), ['u']);
assert.deepEqual(
  semanticTagsForInlineStyle({ fontWeight: '700', fontStyle: 'italic', textDecoration: 'underline line-through' }),
  ['strong', 'em', 'del', 'u'],
);

// Must NOT fire: normal weight is what Google Docs puts on its wrapper <b>,
// and treating it as bold would bold the entire pasted document.
assert.deepEqual(semanticTagsForInlineStyle({ fontWeight: 'normal' }), []);
assert.deepEqual(semanticTagsForInlineStyle({ fontWeight: '400' }), []);
assert.deepEqual(semanticTagsForInlineStyle({ fontWeight: '500' }), []);
assert.deepEqual(semanticTagsForInlineStyle({ fontStyle: 'normal' }), []);
assert.deepEqual(semanticTagsForInlineStyle({ textDecoration: 'none' }), []);
assert.deepEqual(semanticTagsForInlineStyle({}), []);
assert.deepEqual(semanticTagsForInlineStyle({ fontWeight: '', fontStyle: '' }), []);

console.log('html format mapping: all checks passed');

// --- escapeHtml -----------------------------------------------------------
assert.equal(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
assert.equal(escapeHtml('use <div> tags'), 'use &lt;div&gt; tags');
assert.equal(escapeHtml('say "hi"'), 'say &quot;hi&quot;');
// & must be escaped first, or the other replacements get double-escaped.
assert.equal(escapeHtml('&lt;'), '&amp;lt;');
assert.equal(escapeHtml('a &amp;&lt;b&gt;'), 'a &amp;amp;&amp;lt;b&amp;gt;');
assert.equal(escapeHtml(''), '');
assert.equal(escapeHtml('plain text'), 'plain text');

console.log('escapeHtml: all checks passed');
