// node scripts/language.test.mjs
//
// The language classifier decides what language the bot answers in, so a wrong answer
// here is a customer being replied to in a language they may not read. It runs offline
// and costs nothing, unlike noticing the problem in a transcript a week later.
//
// The English cases matter most. The prompt is written almost entirely in Hinglish, so
// left to itself the model answers Hinglish no matter what was asked - these assertions
// are what force the explicit override.

import { languageDirective } from '../api/_lib/prompt.js';

let failures = 0;
function expect(text, wanted) {
  const directive = languageDirective(text);
  const ok = directive.includes(wanted);
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${wanted}] ${JSON.stringify(text).slice(0, 62)}`);
  if (!ok) { console.log(`        got: ${directive.slice(0, 110) || '(empty)'}`); failures += 1; }
}

console.log('--- English (must not be misread as Hinglish) ---');
expect('how much is shilajit?', 'ENGLISH');
expect('Do you deliver to Chennai?', 'ENGLISH');              // "to" used to break this
expect('Can you send it to me?', 'ENGLISH');                  // "to" and "me"
expect('Is this on par with the other one?', 'ENGLISH');      // "par"
expect('what is your return policy?', 'ENGLISH');
expect('i have thyroid, can i take the weight loss kit?', 'ENGLISH');
expect('My order has not arrived yet', 'ENGLISH');
expect('Do I need a prescription for this?', 'ENGLISH');
expect('Tell me the price', 'ENGLISH');

console.log('\n--- Hinglish ---');
expect('shilajit ka price kya hai', 'HINGLISH');
expect('mujhe weight loss karna hai', 'HINGLISH');
expect('delivery kitne din me aati hai', 'HINGLISH');
expect('koi dawai chal rahi hai', 'HINGLISH');
expect('order kab tak milega', 'HINGLISH');
expect('aapka clinic kahan hai', 'HINGLISH');
expect('periods ki problem hai mujhe', 'HINGLISH');

console.log('\n--- Other scripts ---');
expect('எனக்கு தைராய்டு பிரச்சனை இருக்கு', 'TAMIL');
expect('শিলাজিৎ এর দাম কত?', 'BENGALI');
expect('ఎండ్‌లెస్ టాబ్లెట్ ధర ఎంత?', 'TELUGU');
expect('ಶಿಲಾಜಿತ್ ಬೆಲೆ ಎಷ್ಟು?', 'KANNADA');
expect('എനിക്ക് തൈറോയ്ഡ് ഉണ്ട്', 'MALAYALAM');
expect('મને વજન ઘટાડવું છે', 'GUJARATI');
expect('ਮੈਨੂੰ ਭਾਰ ਘਟਾਉਣਾ ਹੈ', 'PUNJABI');
expect('ମୋର ଓଜନ କମାଇବାକୁ ଅଛି', 'ODIA');
expect('مجھے وزن کم کرنا ہے', 'URDU');
expect('मुझे पीरियड्स की समस्या है', 'HINDI');
expect('डिलिव्हरी किती दिवसात होते?', 'HINDI');   // Marathi shares Devanagari

console.log('\n--- neither English nor Hinglish: defer, do not guess English ---');
expect('amari naam shivang hobe , or tumar naam ki ?', 'LATIN SCRIPT');  // Romanized Bengali
expect('tumi ki korcho', 'LATIN SCRIPT');
expect('du bist sehr nett', 'LATIN SCRIPT');                             // German
expect('hast du eine medizin fur mich?', 'LATIN SCRIPT');
expect('aber miene hindi oder englisch is nicht gut', 'LATIN SCRIPT');   // one "is" must not win
expect('bonjour, je voudrais un produit', 'LATIN SCRIPT');

console.log('\n--- mixed script wins over Latin ---');
expect('shilajit ka price? मुझे बताओ', 'HINDI');
expect('price எவ்வளவு?', 'TAMIL');

console.log('\n--- empty input produces no directive ---');
const blank = languageDirective('');
console.log(`${blank === '' ? 'PASS' : 'FAIL'}  empty string -> no directive`);
if (blank !== '') failures += 1;

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
