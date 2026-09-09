/**
 * Hover-stop / resume behaviour for sections/featured-in.liquid.
 *
 * Clicking a logo opens it in a new tab: pointerleave never fires, no rAF runs
 * while the tab is hidden, and the pointer comes back parked on the logo. Each
 * of those broke the strip in its own way, so each has a case here.
 *
 * Runs the section's REAL closure, lifted out of the .liquid, against a fake
 * clock — so it cannot drift away from what ships.
 *
 *   node test-featured-in.mjs [path-to-liquid]
 */
import fs from 'fs';
import assert from 'assert';

const src = fs.readFileSync(process.argv[2] || 'sections/featured-in.liquid', 'utf8');
const m = src.match(/\/\/ Ease the strip to a stop[\s\S]*?\n  \}\)\(\);/);
assert(m, 'hover closure not found in the section');
const closure = m[0].replace(/\{\{[^}]*\}\}/g, '0');

function harness() {
  const listeners = {};
  const on = (o) => (ev, fn) => ((listeners[o + ':' + ev] ||= []).push(fn));
  const animation = { playbackRate: 1 };
  const track = { getAnimations: () => [animation], addEventListener: on('track') };
  const wrap = { addEventListener: on('wrap') };
  const win = { addEventListener: on('window') };
  const doc = { hidden: false, addEventListener: on('document') };

  let queue = new Map(), id = 0;
  const raf = (fn) => (queue.set(++id, fn), id);
  const caf = (i) => queue.delete(i);

  const h = {
    rate: () => +animation.playbackRate.toFixed(3),
    fire: (k) => (listeners[k] || []).slice().forEach(f => f()),
    doc,
    // One paint. `drop` models a backgrounded tab: the frame never arrives.
    run: (frames, drop) => {
      for (let i = 0; i < frames; i++) {
        const q = queue; queue = new Map();
        if (!drop) q.forEach(f => f());
      }
    },
  };
  new Function('track', 'wrap', 'window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', closure)
    (track, wrap, win, doc, raf, caf);
  return h;
}

// 1. Hover coasts to a stop rather than cutting.
{
  const h = harness();
  h.fire('wrap:pointerenter'); h.run(1);
  assert(h.rate() > 0.5 && h.rate() < 1, `should ease, not cut: ${h.rate()}`);
  h.run(120);
  assert.strictEqual(h.rate(), 0, `hover should stop the strip, got ${h.rate()}`);
  h.fire('wrap:pointerleave'); h.run(120);
  assert.strictEqual(h.rate(), 1, 'leaving resumes');
}

// 2. The click-through: a new tab takes focus and pointerleave never arrives.
{
  const h = harness();
  h.fire('wrap:pointerenter'); h.run(120);
  h.fire('window:blur'); h.run(120);
  assert.strictEqual(h.rate(), 1, `blur must resume the strip, got ${h.rate()}`);
}

// 3. The ramp is interrupted mid-way by the tab going hidden, so the frame it
//    was waiting on is never delivered. Coming back must still restore speed.
{
  const h = harness();
  h.fire('wrap:pointerenter'); h.run(3);              // part-way down
  h.fire('window:blur'); h.run(2);                    // resume starts
  h.doc.hidden = true; h.run(50, true);               // hidden: frames dropped
  h.doc.hidden = false; h.fire('document:visibilitychange');
  assert.strictEqual(h.rate(), 1, `returning must restore full speed at once, got ${h.rate()}`);
}

// 4. The pointer is still parked where the click happened. That is not a fresh
//    hover, so it must not stop the strip again.
{
  const h = harness();
  h.fire('wrap:pointerenter'); h.run(120);
  h.fire('window:blur');
  h.doc.hidden = false; h.fire('document:visibilitychange'); h.run(120);
  assert.strictEqual(h.rate(), 1, 'a parked pointer must not re-stop the strip');
  // ...but once it leaves and comes back, hover works as normal again.
  h.fire('wrap:pointerleave'); h.run(120);
  h.fire('wrap:pointerenter'); h.run(120);
  assert.strictEqual(h.rate(), 0, 'a real re-entry still stops it');
}

console.log('featured-in hover/resume: all checks pass');
