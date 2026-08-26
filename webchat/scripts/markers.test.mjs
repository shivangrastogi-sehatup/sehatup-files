// node scripts/markers.test.mjs
//
// The marker filter runs on a token stream, so the cases that matter are the ones where a
// marker is split across chunk boundaries in an awkward place. Those are exactly the cases
// that are invisible in manual testing, because a fast connection tends to deliver whole
// markers in one chunk and everything looks fine until it doesn't.

import { createMarkerFilter, resolveMarkers, cleanText } from '../api/_lib/markers.js';

let failures = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) { console.log(`        expected ${e}\n        actual   ${a}`); failures += 1; }
}

/** Feeds `text` through the filter in fixed-size chunks. */
function run(text, chunkSize) {
  let out = '';
  const f = createMarkerFilter((t) => { out += t; });
  for (let i = 0; i < text.length; i += chunkSize) f.push(text.slice(i, i + chunkSize));
  const markers = f.end();
  return { text: out, markers };
}

const SAMPLE = 'Vaji Bati stamina ke liye hai.\n[[product:vaji-bati]]\nAur koi sawaal?';
// The newline in front of the marker is swallowed with it, so one line break survives -
// the one that separates the marker line from the sentence after it.
const EXPECT_TEXT = 'Vaji Bati stamina ke liye hai.\nAur koi sawaal?';

// Every chunk size from 1 (worst case: marker split at every character) upward.
for (const size of [1, 2, 3, 5, 7, 11, 23, 1000]) {
  const r = run(SAMPLE, size);
  check(`chunk size ${size}: text is clean`, r.text, EXPECT_TEXT);
  check(`chunk size ${size}: marker captured`, r.markers, ['product:vaji-bati']);
}

// Two markers plus a handoff, the shape of a "which one did you mean" reply.
const TWO = 'Do options hain.\n[[product:a-one]]\n[[product:b-two]]\n[[whatsapp]]';
check('multiple markers, char by char', run(TWO, 1).markers,
  ['product:a-one', 'product:b-two', 'whatsapp']);
check('multiple markers, text stripped', run(TWO, 1).text.trim(), 'Do options hain.');

// A real bracket in the prose must survive, not be eaten as a suspected marker.
check('literal bracket survives', run('Price [approx] Rs499 hai.', 3).text, 'Price [approx] Rs499 hai.');
check('literal bracket yields no markers', run('Price [approx] Rs499 hai.', 3).markers, []);

// Truncated output (maxOutputTokens hit mid-marker) must not leak the fragment.
// The trailing newline goes with the half-written marker - it was only there to put the
// marker on its own line, so leaving it would end the reply on a blank line.
check('half-written marker is dropped', run('Ye dekhiye.\n[[product:vaji-', 4).text, 'Ye dekhiye.');
check('half-written marker yields nothing', run('Ye dekhiye.\n[[product:vaji-', 4).markers, []);

// Markdown the model was told not to emit.
check('bold stripped', cleanText('**Vaji Bati** ka price'), 'Vaji Bati ka price');
check('bullets stripped', cleanText('Options:\n* one\n* two'), 'Options:\none\ntwo');
check('em dash normalised', cleanText('Free consultation — bilkul free'), 'Free consultation - bilkul free');

// resolveMarkers is the containment boundary: prompt rules are advisory, this is not.
const CARDS = {
  'vaji-bati': { handle: 'vaji-bati', inStock: true },
  'sold-out': { handle: 'sold-out', inStock: false },
};
check('unknown handle dropped', resolveMarkers(['product:hallucinated'], CARDS).products, []);
check('out of stock dropped', resolveMarkers(['product:sold-out'], CARDS).products.length, 0);
check('rx handle absent from index is dropped', resolveMarkers(['product:tadalafil-5-mg'], CARDS).products, []);
check('duplicate collapsed',
  resolveMarkers(['product:vaji-bati', 'product:vaji-bati'], CARDS).products.length, 1);
check('handoff detected', resolveMarkers(['whatsapp'], CARDS).handoff, true);
check('no handoff by default', resolveMarkers(['product:vaji-bati'], CARDS).handoff, false);
check('card count capped',
  resolveMarkers(['product:vaji-bati'], CARDS, 0).products.length, 0);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
