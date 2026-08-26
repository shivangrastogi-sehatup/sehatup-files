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

/**
 * @param {object[]} products  live catalog from getCatalog()
 * @param {object}   page      { url, title, productHandle } the visitor is looking at
 */
export function buildSystemPrompt(products, page = {}) {
  const parts = [PERSONA];

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
