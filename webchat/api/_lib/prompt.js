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

/**
 * @param {object[]} products  live catalog from getCatalog()
 * @param {object}   page      { url, title, productHandle } the visitor is looking at
 * @param {object[]} allMessages  the FULL client history, before the window is applied
 */
export function buildSystemPrompt(products, page = {}, allMessages = []) {
  const parts = [PERSONA];

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

  return parts.join('\n\n---\n\n');
}

/** Exposed so the smoke-test script can assert the prompt actually assembled. */
export const promptStats = () => ({
  personaChars: PERSONA.length,
  policyChars: POLICIES.length,
});
