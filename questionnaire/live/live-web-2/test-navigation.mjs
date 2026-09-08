/**
 * Previous-button navigation check.
 *
 *   node test-navigation.mjs
 *
 * Guards the two traps behind "Previous does nothing" and "the loader GIF appears
 * in the questions section": a group that reads as complete makes renderQuestionGroup
 * skip forward, and from the last group that skip re-fires finishQuestionnaire.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(ROOT, '_shared/public/questionnaire-engine.js'), 'utf8');
const cfgSrc = fs.readFileSync(path.join(ROOT, 'mens-wellness/public/config-mens-health.js'), 'utf8');

// Load the real engine class and the real men's-wellness config.
const sandbox = {
  window: {}, document: { getElementById: () => null, addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout,
};
const ctx = vm.createContext(sandbox);
vm.runInContext(cfgSrc + '\n;globalThis.__cfg = questionnaireConfig;', ctx);
vm.runInContext(src.replace(/document\.addEventListener[\s\S]*$/, '') +
  '\n;globalThis.__Engine = QuestionnaireEngine;', ctx);
const { __Engine: Engine, __cfg: config } = sandbox;

const engine = Object.create(Engine.prototype);
engine.config = config;
engine.progressConfig = [];
engine.persistData = () => {};
engine.saveLocalState = () => {};

const steps = [];
engine.showStep = (s) => { steps.push(s); engine.state.currentStep = s; };
engine.renderQuestionGroup = (g) => { steps.push('render:' + g.key); };

const groups = config.questionGroups;
const dynamic = groups.find((g) => g.isDynamic);
const last = groups[groups.length - 1];
const resultsStep = last.step + 1;

// --- 1. dynamic group is rebuilt from the stored concern after a reload ----------
dynamic.questions = [];                       // what a fresh page load looks like
engine.state = { currentStep: last.step, allAnswers: { concern: [{ text: 'ED' }] } };
engine.rehydrateDynamicGroups();
assert.ok(dynamic.questions.length > 0,
  'dynamic group must be rebuilt from the stored concern, else Previous skips over it');

// --- 2. Previous at the first question of the last group goes BACK --------------
engine.state = {
  currentStep: last.step,
  allAnswers: { concern: [{ text: 'ED' }], [dynamic.key]: [{ q: 1 }, { q: 2 }], [last.key]: [] },
};
steps.length = 0;
engine.prevQuestion();
assert.deepStrictEqual(steps, [dynamic.step],
  `Previous at the last group's first question must go back to step ${dynamic.step}, got ${steps}`);
assert.strictEqual(engine.state.allAnswers[dynamic.key].length, 1,
  'going back must pop the previous group\'s last answer so a question is re-rendered');

// --- 3. Previous from the results page must NOT re-fire submit ------------------
for (const from of [resultsStep, 99]) {
  engine.state = {
    currentStep: from,
    allAnswers: { concern: [{ text: 'ED' }], [last.key]: last.questions.map((_, i) => ({ q: i })) },
  };
  steps.length = 0;
  engine.prevQuestion();
  assert.deepStrictEqual(steps, [last.step],
    `Previous from step ${from} must land on ${last.step}, got ${steps}`);
  assert.strictEqual(engine.state.allAnswers[last.key].length, last.questions.length - 1,
    `Previous from step ${from} must pop an answer, or the group reads as complete and ` +
    'renderQuestionGroup skips forward into finishQuestionnaire (the loader GIF bug)');
}

// --- 4. the final question's button says Submit, every earlier one says Next ----
assert.ok(engine.isFinalQuestion(last, last.questions.length - 1),
  'last question of the last group must be the final question');
assert.ok(!engine.isFinalQuestion(last, 0) || last.questions.length === 1,
  'an earlier question in the last group is not the final question');
assert.ok(!engine.isFinalQuestion(dynamic, dynamic.questions.length - 1),
  'the last question of a NON-last group is not the final question');
// btn-submit must exist in BOTH language blocks, or the button renders empty in one.
// uiTranslations is built in the constructor, so read the two blocks out of the source.
for (const [lang, block] of Object.entries({
  en: src.slice(src.indexOf("'en': {"), src.indexOf("'hi': {")),
  hi: src.slice(src.indexOf("'hi': {")),
})) {
  assert.ok(/'btn-submit':\s*"[^"]+"/.test(block),
    `uiTranslations.${lang} must define a non-empty btn-submit`);
}

console.log('all navigation checks passed');
