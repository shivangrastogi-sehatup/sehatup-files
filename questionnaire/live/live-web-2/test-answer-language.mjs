/**
 * Stored answers must always be English, whatever language is on screen.
 *
 *   node test-answer-language.mjs
 *
 * Firestore, the CRM and the PDF all key off the English question text, and
 * causeMapping / futureRisksMapping are English-keyed too. A translated string
 * reaching allAnswers does not throw — it just silently drops report sections
 * and writes Hindi into the backend, so it needs a check that fails loudly.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEVANAGARI = /[ऀ-ॿ]/;

const src = fs.readFileSync(path.join(ROOT, '_shared/public/questionnaire-engine.js'), 'utf8');

// --- 1. the engine must never read the rendered heading into stored state ----
// Anchor on the method DEFINITIONS: both names also appear earlier as calls
// inside handleGlobalClick, and slicing between those yields 93 empty chars
// that would make every assertion below pass for the wrong reason.
const defStart = src.search(/\n\s*handleMultiSelectSubmit\s*\(\s*\)\s*\{/);
const defEnd = src.search(/\n\s*prevQuestion\s*\(\s*\)\s*\{/);
assert.ok(defStart > 0 && defEnd > defStart, 'could not locate handleMultiSelectSubmit');
const multi = src.slice(defStart, defEnd);
assert.ok(multi.includes('allAnswers[group.key].push'),
  'handleMultiSelectSubmit no longer contains the answer push — this check needs updating');
const pushBlock = multi.slice(multi.indexOf('allAnswers[group.key].push'));
assert.ok(
  !/question:\s*container\.querySelector\('h2'\)\.innerText\s*,/.test(pushBlock),
  'handleMultiSelectSubmit must not store the rendered <h2>: it is translated, so ' +
  'Hindi visitors write Devanagari question text into Firestore and lose report sections'
);
assert.ok(
  /askedQuestion\s*\?\s*askedQuestion\.question/.test(pushBlock),
  'handleMultiSelectSubmit should store the config question'
);

// --- 2. no other write path reads rendered text into allAnswers -------------
for (const m of src.matchAll(/allAnswers\[[^\]]+\]\.push\(\{[\s\S]{0,400}?\}\)/g)) {
  assert.ok(!/\.innerText|\.textContent/.test(m[0].split('question:')[1]?.split(',')[0] || ''),
    'an allAnswers push still takes its question from the DOM:\n' + m[0].slice(0, 200));
}

// --- 3. every mapping key in every config is English ------------------------
const QUIZZES = [
  ['mens-wellness', 'config-mens-health.js'],
  ['mens-weight', 'config-mens-weight.js'],
  ['womens-wellness', 'config-womens-health.js'],
  ['womens-weight', 'config-womens-weight.js'],
];

for (const [dir, file] of QUIZZES) {
  const s = fs.readFileSync(path.join(ROOT, dir, 'public', file), 'utf8');
  const names = [...new Set([...s.matchAll(/^\s*(?:const|let|var)\s+(\w+)\s*=/gm)].map((m) => m[1]))];
  const expr = '({' + names.map((n) => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',') + '})';
  const all = vm.runInNewContext(s + '\n;' + expr + ';',
    { window: {}, document: { getElementById: () => null }, console: { log() {}, error() {} } }, { timeout: 8000 });
  const cfg = all.questionnaireConfig;

  for (const map of [cfg.causeMapping, cfg.futureRisksMapping].filter(Boolean)) {
    for (const qKey of Object.keys(map)) {
      assert.ok(!DEVANAGARI.test(qKey), `${dir}: Devanagari causeMapping key: ${qKey.slice(0, 40)}`);
    }
  }

  // Every multi-select question must be resolvable from the config by index —
  // that is what the fix relies on to recover the English text.
  for (const g of cfg.questionGroups || []) {
    (g.questions || []).forEach((q, i) => {
      if (!q.multiple) return;
      assert.strictEqual((g.questions || [])[i].question, q.question,
        `${dir}/${g.key}: question ${i} is not addressable by index`);
      assert.ok(!DEVANAGARI.test(q.question), `${dir}: config question is not English: ${q.question}`);
      (q.options || []).forEach((o) => assert.ok(!DEVANAGARI.test(o.text || ''),
        `${dir}: config option is not English: ${o.text}`));
    });
  }
}

console.log('all answer-language checks passed');
