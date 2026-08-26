// Assembles the system prompt for one turn.
//
// Three blocks get concatenated: the hand-written persona, the policy KB, and the live
// catalog read from Shopify moments ago. The persona and policies are static text files
// on purpose - a non-developer can edit the bot's rules or a return window without
// touching JavaScript.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogBlock } from './catalog.js';

const here = dirname(fileURLToPath(import.meta.url));

// Vercel's file tracer and `vercel dev` disagree about the working directory, so try the
// obvious candidates rather than betting on one. Cached at module scope: the lambda reads
// each file once per cold start, not once per message.
function loadText(...relative) {
  const candidates = [
    join(here, '..', '..', ...relative),
    join(here, '..', ...relative),
    join(process.cwd(), ...relative),
    join(process.cwd(), 'webchat', ...relative),
  ];
  for (const path of candidates) {
    try {
      const text = readFileSync(path, 'utf8');
      if (text.trim()) return text;
    } catch (_) { /* try the next candidate */ }
  }
  throw new Error(`Could not find ${relative.join('/')} - looked in: ${candidates.join(', ')}`);
}

const PERSONA = loadText('prompts', 'ananya-web.txt');
const POLICIES = loadText('api', 'kb', 'policies.md');

// Conditions and medicines that must gate a product recommendation. Kept deliberately
// broad and in both scripts - a false positive costs one clarifying question, a false
// negative means recommending a supplement to someone on thyroid medication.
const HEALTH_FLAGS = [
  'thyroid', 'thyroide', 'tsh',
  'sugar', 'diabet', 'madhumeh', 'shugar',
  'bp', 'blood pressure', 'hypertension',
  'heart', 'dil ki', 'cardiac',
  'kidney', 'liver', 'gurda',
  'pregnan', 'pregnent', 'garbh', 'conceive', 'breastfeed', 'feeding',
  'surgery', 'operation', 'operate',
  'dawai', 'dawa', 'davai', 'medicine', 'tablet', 'medication',
];

/**
 * Pull out the visitor's own words wherever they mentioned a condition or a medicine.
 *
 * This exists because the history window is not enough. A disclosure made at message one
 * can still be inside the window at message seventeen and simply get buried - the model
 * reads the recent turns and recommends a weight product to someone who told it about
 * thyroid eight turns ago. Restating their exact words at the top of every prompt keeps
 * the fact salient no matter how long the conversation runs.
 *
 * Their words, not a summary: "koi dawai nahi chal rahi" and "thyroid ki dawai chal rahi
 * hai" both match the same keyword, and only the original sentence tells them apart.
 */
function healthDisclosures(allMessages) {
  const hits = [];
  for (const m of allMessages) {
    if (m.role !== 'user') continue;
    const text = String(m.text || '');
    const low = text.toLowerCase();
    if (HEALTH_FLAGS.some((f) => low.includes(f))) hits.push(text.slice(0, 200));
  }
  // Keep the earliest ones: the first disclosure is the one at risk of scrolling out.
  return hits.slice(0, 4);
}

// Script blocks are unambiguous: if a message contains Tamil codepoints it is Tamil.
const SCRIPTS = [
  ['Tamil', /[஀-௿]/],
  ['Bengali', /[ঀ-৿]/],
  ['Telugu', /[ఀ-౿]/],
  ['Kannada', /[ಀ-೿]/],
  ['Malayalam', /[ഀ-ൿ]/],
  ['Gujarati', /[઀-૿]/],
  ['Punjabi (Gurmukhi)', /[਀-੿]/],
  ['Odia', /[଀-୿]/],
  ['Urdu', /[؀-ۿ]/],
  // Devanagari last: Hindi and Marathi share it, and the others are more specific.
  ['Hindi (Devanagari)', /[ऀ-ॿ]/],
];

// Hinglish and English share the Latin alphabet, so script alone cannot separate them.
// These are Hindi function words that are NOT also English words - that exclusion is the
// whole game. An earlier version of this list contained "to", "me" and "par", which are
// three of the commonest words in English, so "Do you deliver to Chennai?" classified as
// Hinglish and got answered in Hinglish. Short two-letter particles (ka, ki, ke, se, ho,
// hu) are left out for the same reason: too easy to hit by accident, and they almost
// always appear next to a longer marker anyway.
const HINGLISH_MARKERS = new RegExp(
  '\\b(' + [
    'hai', 'hain', 'hoon', 'kya', 'kyu', 'kyun', 'mujhe', 'mera', 'meri', 'mere',
    'aap', 'aapko', 'aapka', 'apna', 'nahi', 'nahin', 'haan', 'chahiye', 'chaiye',
    'kitne', 'kitna', 'kitni', 'batao', 'bataye', 'bata', 'karo', 'karna', 'karte',
    'lena', 'leni', 'liye', 'mein', 'bhi', 'abhi', 'kab', 'kaise', 'kaha', 'kahan',
    'thoda', 'zyada', 'acha', 'accha', 'theek', 'bhej', 'dijiye', 'kijiye',
    'sakta', 'sakti', 'sakte', 'raha', 'rahi', 'rahe', 'gaya', 'gayi', 'hota', 'hoti',
    'wala', 'wali', 'koi', 'kuch', 'paisa', 'paise', 'dawai', 'dava', 'hoga', 'hogi',
    'milega', 'milegi', 'chahta', 'chahti', 'lagta', 'lagti', 'jayega', 'jayegi',
  ].join('|') + ')\\b', 'i'
);

// English function words that are NOT also common in romanized Indian languages. "or" is
// deliberately absent - it is also Bengali for "his/her", and it appeared in the very
// message that first exposed this ("amari naam shivang hobe, or tumar naam ki?").
const ENGLISH_MARKERS = /\b(the|is|are|am|was|were|you|your|yours|can|could|do|does|did|what|when|where|which|how|why|who|please|want|need|have|has|had|will|would|should|this|that|these|those|with|from|about|there|here|they|them|been|its|not|don't|doesn't|i'm|i've|tell|send|give|know|think|much|many|any|some|help|my|been|because|but|and|for)\b/g;

/**
 * Work out what language to answer in, deterministically.
 *
 * A prompt rule alone loses this fight: the persona, the examples and the style notes are
 * all written in Hinglish, so thousands of Hinglish tokens drown out one line asking for
 * English. Tested before this existed, "how much is shilajit?" came back in Devanagari
 * every single time. Stating the answer as a fact, computed from the message, wins.
 */
export function languageDirective(lastUserText) {
  const text = String(lastUserText || '');
  if (!text.trim()) return '';

  for (const [name, re] of SCRIPTS) {
    if (re.test(text)) {
      return `THE VISITOR'S LAST MESSAGE IS IN ${name.toUpperCase()}. Write your entire ` +
        `reply in ${name}, in that same script. Do not reply in Hinglish or English. ` +
        `Product names stay in Latin script exactly as the catalog spells them, prices ` +
        `stay as digits, and the [[...]] markers are copied exactly.`;
    }
  }

  if (HINGLISH_MARKERS.test(text)) {
    return "THE VISITOR'S LAST MESSAGE IS IN HINGLISH (Hindi in Roman letters). Write your " +
      'reply in Hinglish, in Roman letters. Do not use Devanagari.';
  }

  // Two independent English function words before claiming English. One is not enough:
  // "aber miene hindi oder englisch is nicht gut" is German and contains "is", and a
  // single stray match used to be enough to assert English over it.
  const englishHits = new Set((text.toLowerCase().match(ENGLISH_MARKERS) || []));
  if (englishHits.size >= 2) {
    return "THE VISITOR'S LAST MESSAGE IS IN ENGLISH. Write your ENTIRE reply in plain " +
      'English. Do not use Hindi, do not use Hinglish, do not use Devanagari, and do not ' +
      'slip Hindi words into English sentences. The examples later in these instructions ' +
      'are written in Hinglish only because most visitors write that way - copy their ' +
      'judgement, never their language.';
  }

  // Latin letters, but neither clearly English nor clearly Hinglish. This is German,
  // French, Bengali typed in Roman letters ("tumi ki korche"), Roman Tamil, and so on.
  // Asserting English here was the bug: it is confidently wrong, and it talked over a
  // Bengali speaker in Hinglish. The model can read the message; let it decide, and say
  // so explicitly rather than leaving it to be drowned out by a Hinglish prompt.
  return "THE VISITOR'S LAST MESSAGE IS IN LATIN SCRIPT BUT IS NOT CLEARLY ENGLISH OR " +
    'HINGLISH. Work out what language it actually is - it may be German, French, Spanish, ' +
    'or an Indian language typed in Roman letters such as Bengali ("tumi ki korcho"), ' +
    'Tamil, Telugu or Marathi - and reply in THAT language, using the same script they ' +
    'used. Do not default to Hinglish, and never tell them you cannot speak their ' +
    'language. If you truly cannot place it, reply in simple English.';
}

/**
 * @param {object[]} products  live catalog from getCatalog()
 * @param {object}   page      { url, title, productHandle } the visitor is looking at
 * @param {object[]} allMessages  the FULL client history, before the window is applied
 */
export function buildSystemPrompt(products, page = {}, allMessages = []) {
  const lastUser = [...allMessages].reverse().find((m) => m.role === 'user')?.text || '';
  const language = languageDirective(lastUser);

  // Language goes FIRST, ahead of the persona, and is repeated last. Both ends of a long
  // prompt are attended to more reliably than the middle, and this instruction has to beat
  // a whole document written in another language.
  const parts = language ? [language, PERSONA] : [PERSONA];

  const disclosures = healthDisclosures(allMessages);
  if (disclosures.length) {
    parts.push(
      'WHAT THIS PERSON HAS ALREADY TOLD YOU ABOUT THEIR HEALTH - these are their own\n' +
      'words, from earlier in this same conversation:\n' +
      disclosures.map((d) => `  "${d}"`).join('\n') +
      '\n\nRead them again before you recommend anything. If they have a condition or take\n' +
      'a regular medicine, the safety rule applies for the WHOLE conversation, not just the\n' +
      'message they said it in - steer to the free consultation instead of recommending a\n' +
      'product, and say why in one line. If what they said means it does NOT apply (for\n' +
      'example they told you nothing is going on), treat the safety question as already\n' +
      'answered and do not ask it again.'
    );
  }

  parts.push(
    'POLICIES (the only policy facts you have. A line marked TODO is NOT a fact - for ' +
    'those say the team will confirm and offer WhatsApp):\n' + POLICIES
  );

  parts.push(catalogBlock(products));

  // Page context is what makes "iska price kya hai" answerable without the visitor
  // naming the product. Without it the bot has to ask, which on a product page feels
  // stupid to the visitor who is staring at the thing.
  if (page.productHandle) {
    const current = products.find((p) => p.handle === page.productHandle);
    if (current && !current.rx) {
      parts.push(
        'PAGE CONTEXT: the visitor is on the product page for "' + current.title + '" ' +
        '(handle ' + current.handle + '). If they say "this", "ye", "iska" or ask a price ' +
        'without naming anything, they almost certainly mean this product.'
      );
    } else if (current && current.rx) {
      parts.push(
        'PAGE CONTEXT: the visitor is on the page for "' + current.title + '", which is ' +
        'PRESCRIPTION ONLY. Do not quote a price or produce a card for it even though they ' +
        'are looking at it. Explain it needs a doctor and offer the consultation.'
      );
    }
  } else if (page.title) {
    parts.push('PAGE CONTEXT: the visitor is on the page "' + page.title + '".');
  }

  if (language) parts.push(language);

  return parts.join('\n\n---\n\n');
}

/** Exposed so the smoke-test script can assert the prompt actually assembled. */
export const promptStats = () => ({
  personaChars: PERSONA.length,
  policyChars: POLICIES.length,
});
