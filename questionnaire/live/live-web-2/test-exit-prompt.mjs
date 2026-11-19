/**
 * Leave-the-quiz reminder check.
 *
 *   node test-exit-prompt.mjs
 *
 * Phone/browser Back mid-quiz must show the reminder once, with this quiz's tagline
 * ("This is the reason most people never recover / lose the weight"), "Leave anyway"
 * must really go back, and a second Back, the welcome screen and the results screen
 * must never be blocked.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(ROOT, '_shared/public/questionnaire-engine.js'), 'utf8')
  .replace(/^document\.addEventListener[\s\S]*$/m, '');
const RECOVER = /<span>This is the reason<\/span> most people never recover\./;
const WEIGHT = /<span>This is the reason<\/span> most people never lose the weight\./;
const QUIZZES = {
  'mens-wellness/public/config-mens-health.js': RECOVER,
  'womens-wellness/public/config-womens-health.js': RECOVER,
  'mens-weight/public/config-mens-weight.js': WEIGHT,
  'womens-weight/public/config-womens-weight.js': WEIGHT,
};

// The shared strings the test uses must be the engine's real ones.
const HEAD = { en: 'This is the reason', hi: 'यही वजह है कि' };
for (const h of Object.values(HEAD)) assert.ok(src.includes(`'exit-head': "${h}"`), `engine has exit-head "${h}"`);

function setup(cfgFile) {
  const listeners = {};
  const history = { pushes: 0, backs: 0, pushState() { this.pushes++; }, back() { this.backs++; } };
  const session = {};
  const buttons = {};
  const modal = { style: {}, set innerHTML(h) { this.html = h; }, querySelector: (sel) => buttons[sel] ||= { focus() {}, style: {} } };
  const sandbox = {
    window: { addEventListener: (t, f) => (listeners[t] = f), matchMedia: () => ({ matches: false }) },
    document: { getElementById: (id) => (id === 'exit-modal' ? modal : null), addEventListener() {} },
    history, navigator: {}, requestAnimationFrame: (f) => f(),
    sessionStorage: { getItem: (k) => session[k] ?? null, setItem: (k, v) => (session[k] = v) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, cfgFile), 'utf8') + '\n;globalThis.__cfg = questionnaireConfig;', sandbox);
  vm.runInContext(src + '\n;globalThis.__Engine = QuestionnaireEngine;', sandbox);

  const e = Object.create(sandbox.__Engine.prototype);
  e.config = sandbox.__cfg;
  e.db = null;
  e.currentLanguage = 'en';
  const base = (lang) => ({ 'exit-title-one': '1 step to your report', 'exit-title-many': '{n} steps to your report', 'exit-head': HEAD[lang], 'exit-stay': 's', 'exit-leave': 'l' });
  e.uiTranslations = { en: { ...base('en'), ...e.config.uiStrings.en }, hi: { ...base('hi'), ...e.config.uiStrings.hi } };
  e.progressConfig = [{ step: 2, displayStep: 1 }, ...e.config.questionGroups.map((g, i) => ({ step: g.step, displayStep: i + 2 }))];
  e.state = { currentStep: 2, allAnswers: { concern: [] } };
  e.setupExitGuard();
  return { e, history, modal, buttons, back: () => listeners.popstate() };
}

for (const [cfg, tagline] of Object.entries(QUIZZES)) {
  // Mid-quiz Back -> reminder with this quiz's tagline; Leave goes back.
  let t = setup(cfg);
  t.e.armExitGuard();
  assert.equal(t.history.pushes, 1, `${cfg}: guard entry added`);
  t.back();
  assert.equal(t.modal.style.display, 'flex', `${cfg}: reminder shown on Back`);
  assert.match(t.modal.html, tagline, `${cfg}: tagline`);
  assert.match(t.modal.html, /\d steps to your report/, `${cfg}: steps-left title`);
  assert.doesNotMatch(t.modal.html, /href=|%<\/p>/, `${cfg}: no research numbers or links`);
  assert.match(t.buttons['.exit-bar span'].style.width, /^\d+%$/, `${cfg}: progress bar filled`);
  t.buttons['.exit-leave'].onclick();
  assert.equal(t.history.backs, 1, `${cfg}: Leave anyway really goes back`);

  // Hindi tagline.
  t = setup(cfg);
  t.e.currentLanguage = 'hi';
  t.e.armExitGuard(); t.back();
  assert.match(t.modal.html, /<span>यही वजह है कि<\/span> ज़्यादातर/, `${cfg}: Hindi tagline`);

  // Continue keeps them; it is never re-armed, so the next Back just leaves.
  t = setup(cfg);
  t.e.armExitGuard();
  t.back();
  t.buttons['.exit-stay'].onclick();
  assert.equal(t.history.backs, 0, `${cfg}: Continue stays`);
  t.e.armExitGuard();
  assert.equal(t.history.pushes, 1, `${cfg}: shown once per visit, not re-armed`);

  // Welcome screen and results screen: never armed; armed-then-finished just goes back.
  t = setup(cfg);
  t.e.state.currentStep = 1; t.e.armExitGuard();
  const last = t.e.config.questionGroups.at(-1).step;
  t.e.state.currentStep = last + 1; t.e.armExitGuard();
  assert.equal(t.history.pushes, 0, `${cfg}: not armed on welcome/results`);
  t.e.state.currentStep = 2; t.e.armExitGuard();
  t.e.state.currentStep = last + 1; t.back();
  assert.equal(t.modal.style.display, undefined, `${cfg}: no reminder on results`);
  assert.equal(t.history.backs, 1, `${cfg}: Back from results is not blocked`);
}

// Progress bar follows real progress: last step half done -> 1 step left, bar over 75%.
{
  const t = setup('womens-weight/public/config-womens-weight.js');
  const g = t.e.config.questionGroups;
  t.e.state.currentStep = g.at(-1).step;
  t.e.state.allAnswers[g.at(-1).key] = g.at(-1).questions.slice(0, Math.floor(g.at(-1).questions.length / 2));
  t.e.armExitGuard(); t.back();
  assert.match(t.modal.html, /1 step to your report/);
  assert.ok(parseInt(t.buttons['.exit-bar span'].style.width) > 75, 'bar over 75%');
}

console.log('all exit-prompt checks passed');
