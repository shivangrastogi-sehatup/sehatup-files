// Turns the model's text stream into (clean text, markers) while it is still streaming.
//
// The model writes [[product:vaji-bati]] and [[whatsapp]] inline. Those must never reach
// the visitor's screen, and they cannot simply be regexed off at the end, because the
// point of streaming is that the text is already on screen by then. So the filter emits
// text eagerly but holds back any tail that could still turn into a marker - otherwise
// the visitor watches "[[produ" appear and then disappear.

// The model is told to write plain text, but models drift. Strip the formatting it was
// asked not to use rather than shipping stray asterisks to a customer.
export function cleanText(s) {
  return String(s)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|\s)\*(\S[^*]*?)\*/g, '$1$2')
    .replace(/(^|\n)[ \t]*[*+][ \t]+/g, '$1')
    .replace(/(^|\n)#{1,6}[ \t]+/g, '$1')
    .replace(/[—–]/g, '-')   // em/en dash -> plain hyphen, house style
    .replace(/`/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * @param {(text: string) => void} emit  called with each safe, cleaned fragment
 */
export function createMarkerFilter(emit) {
  var pending = '';
  var markers = [];
  // The leading \s* matters: the model puts markers on their own line, so removing only
  // the brackets leaves behind the newline that introduced them. Two markers in a row then
  // read as a blank gap in the middle of the reply where the cards should be.
  var MARKER = /\s*\[\[(product:[a-z0-9][a-z0-9-]*|whatsapp)\]\]/gi;

  function extract() {
    var m;
    MARKER.lastIndex = 0;
    while ((m = MARKER.exec(pending))) {
      markers.push(m[1].toLowerCase());
      pending = pending.slice(0, m.index) + pending.slice(m.index + m[0].length);
      MARKER.lastIndex = m.index;
    }
  }

  function flushSafe() {
    // Hold back ONLY a tail that could still grow into a marker: one or two opening
    // brackets followed by marker-legal characters, running to the end of the buffer.
    //
    // Anchoring on the last "[" instead looks equivalent and is not: given the buffer
    // "[[", the last "[" is at index 1, so everything before it - a lone "[" - gets
    // emitted as settled text and the marker is broken in half. That only shows up when
    // a marker straddles a chunk boundary, which is most of the time on a real stream.
    // The trailing \]? matters as much as the leading brackets: at one character per
    // chunk the buffer sits at "[[product:vaji-bati]" for a tick, with the second closing
    // bracket still in flight. Without it that tick looks like settled text and the whole
    // marker is emitted to the visitor verbatim.
    // Two things get held back: a possible partial marker, and ANY trailing whitespace.
    // The whitespace case is not cosmetic - one character per frame, the newline before a
    // marker arrives in its own frame, so by the time the "[" shows up the newline has
    // already been emitted and can no longer be swallowed with the marker. Holding all
    // trailing whitespace costs nothing: it ships with the next frame, or at end().
    var m = pending.match(/(?:\s*\[\[?[a-z0-9:-]*\]?|\s+)$/i);
    var safeUpto = m ? m.index : pending.length;
    if (safeUpto <= 0) return;
    var out = pending.slice(0, safeUpto);
    pending = pending.slice(safeUpto);
    if (out) emit(cleanText(out));
  }

  return {
    push(chunk) {
      pending += chunk;
      extract();
      flushSafe();
    },
    end() {
      extract();
      // Whatever is still held back was a false alarm (a real "[" in the prose), except
      // a marker the model never finished writing - drop that half-written tail.
      // Also drop trailing whitespace: a reply whose last line was a marker otherwise
      // ends with the newline that introduced it.
      var out = pending.replace(/\[\[[^\]]*$/, '').replace(/\s+$/, '');
      pending = '';
      if (out) emit(cleanText(out));
      return markers;
    },
  };
}

/**
 * Resolves raw markers against the live catalog. This is the guarantee, not the prompt:
 * a hallucinated handle, a prescription handle or an out-of-stock handle simply never
 * becomes a card, whatever the model wrote.
 */
export function resolveMarkers(markers, cards, maxCards = 3, recentlyShown = []) {
  var products = [];
  var seen = new Set();
  var handoff = false;
  // Cards shown in the last couple of replies. The model will happily re-attach the same
  // product to every message once it has recommended it - one real transcript had the
  // same Vaji Bati card on five consecutive replies, which reads as nagging. The card is
  // still on screen just above; showing it again adds nothing.
  var recent = new Set(recentlyShown);

  for (var marker of markers) {
    if (marker === 'whatsapp') { handoff = true; continue; }
    var handle = marker.replace(/^product:/, '');
    var card = cards[handle];
    if (!card || !card.inStock || seen.has(handle) || recent.has(handle)) continue;
    seen.add(handle);
    if (products.length < maxCards) products.push(card);
  }

  return { products, handoff };
}
