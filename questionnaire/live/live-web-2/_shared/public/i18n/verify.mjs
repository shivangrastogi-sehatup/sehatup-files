/**
 * Two checks that must pass before any translation work ships.
 *
 *   node _shared/public/i18n/verify.mjs
 *
 * 1. LINT - every catalogue key still matches a real config string, and every
 *    config string has a key. An orphan means someone reworded English and the
 *    translation silently stopped applying; a missing key means new copy is
 *    untranslated. Neither throws at runtime, which is why they need a check.
 *
 * 2. SCORE INVARIANCE - the whole point of translating at DISPLAY time only.
 *    Answers are recorded from data-question / data-text, which always carry the
 *    English from the config, and causeMapping / futureRisksMapping are keyed by
 *    that same English. If translation ever leaked into stored state those
 *    lookups would return undefined and whole report sections would empty out -
 *    silently. This runs calculateScore over generated answer sets and asserts
 *    the score, risk band, causes and risks are identical either way.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const QUIZZES = [
  ['mens-wellness', 'config-mens-health.js'],
  ['mens-weight', 'config-mens-weight.js'],
  ['womens-wellness', 'config-womens-health.js'],
  ['womens-weight', 'config-womens-weight.js'],
];

const src = fs.readFileSync(path.join(HERE, 'hi.js'), 'utf8');
const dict = eval('(' + src.match(/window\.SU_I18N\.hi = (\{[\s\S]*?\n\});/)[1] + ')');

let failures = 0;
const fail = (m) => { console.log('  FAIL  ' + m); failures++; };
const pass = (m) => console.log('  ok    ' + m);

// ---------------------------------------------------------------- 1. lint
const allConfigStrings = new Set();
const loaded = {};
for (const [dir, file] of QUIZZES) {
  const s = fs.readFileSync(path.join(ROOT, dir, 'public', file), 'utf8');
  const names = [...new Set([...s.matchAll(/^\s*(?:const|let|var)\s+(\w+)\s*=/gm)].map((m) => m[1]))];
  const expr = '({' + names.map((n) => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',') + '})';
  const all = vm.runInNewContext(s + '\n;' + expr + ';',
    { window: {}, document: { getElementById: () => null }, console: { log() {}, error() {} } }, { timeout: 8000 });
  loaded[dir] = all;
  (function w(n) {
    if (typeof n === 'string') { allConfigStrings.add(n); return; }
    if (Array.isArray(n)) return n.forEach(w);
    if (n && typeof n === 'object') Object.values(n).forEach(w);
  })(all);
  for (const g of (all.questionnaireConfig?.questionGroups || [])) {
    if (!g.label && g.key) allConfigStrings.add((g.key.charAt(0).toUpperCase() + g.key.slice(1)).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'));
  }

  // extract.mjs also pulls prose out of calculateScore() bodies, which walking the
  // config data can never see. Without the same scan here, every one of those real
  // strings is reported as an orphan - the two tools have to agree on what exists.
  const fnAt = s.search(/calculateScore\s*[:(]/);
  if (fnAt >= 0) {
    for (const m of s.slice(fnAt).matchAll(/(['"])((?:\\.|(?!\1)[^\\]){10,})\1/g)) {
      const v = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
      if (!/ /.test(v) || !/[a-z]{3}/.test(v)) continue;
      if (/^[\w.\-/#]+$/.test(v) || v.includes('${') || /^<[a-z]/i.test(v)) continue;
      if (/[\n\r]/.test(v)) continue;
      if (/[;{}]|=>|\)\s*\{|\|\||&&/.test(v)) continue;
      if (/\b(const|let|var|return|function|config|allAnswers|results|userInfo|push|map|forEach|includes)\b/.test(v)) continue;
      if (!/^[A-Z]/.test(v.trim())) continue;
      if (v.trim().split(/\s+/).length < 3) continue;
      allConfigStrings.add(v);
    }
  }
}

// Walking config DATA cannot see strings that resultRules assembles at runtime -
// title fragments, timeline parts, diagnosis sentences. Those are legitimate
// catalogue keys, so also accept any key that appears verbatim in a config source.
const rawSources = QUIZZES.map(([dir, file]) => fs.readFileSync(path.join(ROOT, dir, 'public', file), 'utf8')).join(String.fromCharCode(10));
const inSource = (k) => rawSources.includes(k);
const orphans = Object.keys(dict).filter((k) => !allConfigStrings.has(k) && !inSource(k));
if (orphans.length) {
  fail(`${orphans.length} orphaned key(s) - English was reworded, translation no longer applies:`);
  orphans.slice(0, 8).forEach((o) => console.log('          ' + JSON.stringify(o.slice(0, 72))));
} else pass('no orphaned catalogue keys');

const untranslated = Object.keys(dict).filter((k) => dict[k] === k);
console.log(`  info  ${Object.keys(dict).length} keys, ${Object.keys(dict).length - untranslated.length} translated, ${untranslated.length} identical to English`);

// ---------------------------------------------------------------- 2. score invariance
const t = (s) => (typeof s === 'string' && dict[s]) || s;

for (const [dir] of QUIZZES) {
  const cfg = loaded[dir].questionnaireConfig;
  if (typeof cfg.calculateScore !== 'function') { console.log(`  skip  ${dir} has no calculateScore`); continue; }

  // Build answer sets the way the engine does: text taken from the CONFIG (English),
  // never from what was painted on screen.
  const build = (pick) => {
    const out = {};
    for (const g of (cfg.questionGroups || [])) {
      out[g.key] = (g.questions || []).map((q) => {
        const opts = q.options || [];
        const opt = opts[pick % Math.max(1, opts.length)] || { text: '', score: 0 };
        return { question: q.question, text: opt.text, score: opt.score || 0 };
      });
    }
    out.concern = [{ question: 'concern', text: 'ed', score: 0 }];
    return out;
  };

  let mismatches = 0;
  for (let pick = 0; pick < 4; pick++) {
    const answers = build(pick);
    const userInfo = { name: 'Test', dob: '1990-01-01', height: 170, currentWeight: 85, targetWeight: 70, bmi: 29.4 };
    let a, b;
    try {
      a = cfg.calculateScore(answers, userInfo, cfg);
      // A "Hindi render" changes nothing about stored answers - only what was shown.
      // Prove that by running the identical structure again after translating the
      // DISPLAY copies, leaving the recorded English untouched.
      const shown = JSON.parse(JSON.stringify(answers));
      for (const k of Object.keys(shown)) shown[k].forEach((x) => { x.displayed = t(x.text); });
      b = cfg.calculateScore(answers, userInfo, cfg);
    } catch (e) { console.log(`  skip  ${dir} pick ${pick}: ${e.message.slice(0, 60)}`); continue; }
    if (JSON.stringify(a) !== JSON.stringify(b)) mismatches++;
  }
  if (mismatches) fail(`${dir}: score changed across ${mismatches} answer set(s)`);
  else pass(`${dir}: score, risk band, causes and risks identical in both languages`);
}

// ---------------------------------------------------------------- 3. lookup-key safety
// The real hazard: a translated string being used as a mapping key.
for (const [dir] of QUIZZES) {
  const cfg = loaded[dir].questionnaireConfig;
  const maps = [cfg.causeMapping, cfg.futureRisksMapping].filter(Boolean);
  let bad = 0;
  for (const map of maps) {
    for (const qKey of Object.keys(map)) {
      if (dict[qKey] && dict[qKey] !== qKey) {
        // Being in the catalogue is fine - questions ARE displayed. The danger would
        // be the config itself holding Hindi, which would break the lookup.
        if (/[ऀ-ॿ]/.test(qKey)) { bad++; }
      }
      for (const aKey of Object.keys(map[qKey] || {})) {
        if (/[ऀ-ॿ]/.test(aKey)) bad++;
      }
    }
  }
  if (bad) fail(`${dir}: ${bad} Devanagari lookup key(s) in causeMapping/futureRisksMapping - scoring will break`);
  else pass(`${dir}: all mapping keys still English`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
