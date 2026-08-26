/* SehatUP on-site chat panel.
 *
 * One self-contained file, no build step, no dependencies. Drop the loader snippet into
 * theme.liquid and this replaces the tap-out-to-WhatsApp button with a real conversation.
 *
 * Everything renders inside a shadow root. Shopify themes ship broad global selectors
 * (button {}, * { box-sizing }, .visually-hidden, print rules) and a widget that inherits
 * those looks different on every template. The shadow boundary makes it look the same on
 * all of them, and stops this widget's styles leaking back onto the store.
 *
 * Configure via data-* attributes on the script tag - see webchat/README.md.
 */
(function () {
  'use strict';

  if (window.__sehatupChatLoaded) return;
  window.__sehatupChatLoaded = true;

  var script = document.currentScript ||
    document.querySelector('script[src*="widget.js"]');

  var CONFIG = {
    api: (script && script.dataset.api) || '',
    title: (script && script.dataset.title) || 'Ananya',
    subtitle: (script && script.dataset.subtitle) || 'SehatUP health advisor',
    greeting: (script && script.dataset.greeting) ||
      'Hello! Main Ananya hu SehatUP se. Product, price ya health concern - kuch bhi puchiye.',
    accent: (script && script.dataset.accent) || '#ee204a',
    avatar: (script && script.dataset.avatar) || '',
    // Corner offsets, any CSS length. Phones get their own bottom value because a sticky
    // add-to-cart bar is a mobile-only obstacle.
    bottom: (script && script.dataset.bottom) || '20px',
    right: (script && script.dataset.right) || '20px',
    bottomMobile: (script && script.dataset.bottomMobile) || '16px',
    chips: ((script && script.dataset.chips) ||
      'Weight loss ke liye kya lu?|Periods ki problem hai|Free consultation kaise hoti hai?|Delivery kitne din me?')
      .split('|').filter(Boolean),
  };

  // An absent data-api is a misconfigured install and must fail loudly. An empty one is
  // deliberate: it resolves /api/chat against the current origin, which is what the
  // preview page and `vercel dev` both want.
  if (!script || script.dataset.api === undefined) {
    console.error('[sehatup-chat] data-api is missing on the widget script tag');
    return;
  }
  CONFIG.api = CONFIG.api.replace(/\/+$/, '');

  var STORAGE_KEY = 'sehatup_chat_v1';
  var state = loadState();
  var streaming = false;

  /* ---------------------------------------------------------------- state */

  function newSessionId() {
    // Random enough to key a Firestore doc, cheap enough to not pull in a uuid library.
    return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function loadState() {
    // sessionStorage, not localStorage: a Shopify store is many page loads in one visit,
    // so the transcript has to survive navigation - but starting fresh tomorrow is right,
    // since yesterday's prices and yesterday's concern are both stale.
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.messages)) return parsed;
      }
    } catch (e) { /* private mode, quota, corrupt JSON - all mean "start fresh" */ }
    return { sessionId: newSessionId(), startedAt: Date.now(), messages: [], opened: false };
  }

  function saveState() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* non-fatal */ }
  }

  function pageContext() {
    var handle = '';
    try {
      handle = (window.ShopifyAnalytics && window.ShopifyAnalytics.meta &&
        window.ShopifyAnalytics.meta.product && window.ShopifyAnalytics.meta.product.handle) || '';
    } catch (e) { /* not a Shopify page */ }
    if (!handle) {
      var m = location.pathname.match(/\/products\/([^/?#]+)/);
      if (m) handle = m[1];
    }
    return { url: location.href, title: document.title, productHandle: handle };
  }

  /* ----------------------------------------------------------------- dom */

  var host = document.createElement('div');
  host.id = 'sehatup-chat-root';
  host.setAttribute('data-sehatup-chat', '');
  var root = host.attachShadow({ mode: 'open' });

  var style = document.createElement('style');
  style.textContent = css(CONFIG.accent);
  root.appendChild(style);

  var wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.innerHTML = template();
  root.appendChild(wrap);

  (document.body || document.documentElement).appendChild(host);

  var el = {
    launcher: root.querySelector('.launcher'),
    panel: root.querySelector('.panel'),
    close: root.querySelector('.close'),
    log: root.querySelector('.log'),
    form: root.querySelector('.composer'),
    input: root.querySelector('.input'),
    send: root.querySelector('.send'),
    chips: root.querySelector('.chips'),
  };

  /* -------------------------------------------------------------- render */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function bubbleEl(role) {
    var row = document.createElement('div');
    row.className = 'row ' + role;
    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    row.appendChild(bubble);
    el.log.appendChild(row);
    return { row: row, bubble: bubble };
  }

  function renderText(node, text) {
    // The server strips markdown and markers before sending. Stripping markers again here
    // is belt and braces: if that filter ever regresses, the visitor sees a missing card
    // rather than "[[product:vaji-bati]]" printed in the middle of a sentence. Costs one
    // regex per frame.
    var clean = String(text)
      .replace(/\[\[(?:product:[a-z0-9-]+|whatsapp)\]\]/gi, '')
      .replace(/\n{3,}/g, '\n\n');
    node.innerHTML = esc(clean).replace(/\n/g, '<br>');
  }

  function renderCards(row, products) {
    if (!products || !products.length) return;
    var box = document.createElement('div');
    box.className = 'cards';

    products.forEach(function (p) {
      var card = document.createElement('div');
      card.className = 'card';

      var priceHtml = money(p.price);
      if (p.mrp && p.mrp > p.price) {
        priceHtml += ' <s>' + money(p.mrp) + '</s>' +
          (p.discountPct ? ' <em>' + p.discountPct + '% off</em>' : '');
      }

      // A product with several variants (size, pack) cannot be added blind - guessing the
      // variant is how you generate a wrong-item return. Send those to the product page.
      //
      // And when that is the case, "View" would go to the same URL as "Choose option":
      // two buttons, one destination, which just makes the reader stop and work out
      // whether there is a difference. There isn't, so only one button is shown. The pair
      // appears only when the two actions genuinely differ - buy it here, or go look first.
      var multi = p.variantCount > 1 || !p.variantId;
      var buttons = multi
        ? '<a class="btn primary" href="' + esc(p.url) + '">Choose option</a>'
        : '<button class="btn primary add" type="button" data-variant="' + esc(p.variantId) + '">Add to cart</button>' +
          '<a class="btn ghost" href="' + esc(p.url) + '">View</a>';

      card.innerHTML =
        (p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">' : '<div class="noimg"></div>') +
        '<div class="cbody">' +
          '<div class="ctitle">' + esc(p.title) + '</div>' +
          '<div class="cprice">' + priceHtml + '</div>' +
          '<div class="cbtns">' + buttons + '</div>' +
        '</div>';

      // An image arriving after render grows the row, which leaves the card half below the
      // fold on a log that was already scrolled to the bottom. Re-pin on load.
      var img = card.querySelector('img');
      if (img) img.addEventListener('load', scrollDown, { once: true });

      box.appendChild(card);
    });

    row.appendChild(box);
  }

  function renderHandoff(row, handoff) {
    if (!handoff) return;
    var a = document.createElement('a');
    a.className = 'wa';
    a.href = handoff.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = waIcon() + '<span>' + esc(handoff.label || 'Chat with our team') + '</span>';
    row.appendChild(a);
  }

  function addMessage(msg, animate) {
    var b = bubbleEl(msg.role === 'user' ? 'user' : 'bot');
    renderText(b.bubble, msg.text);
    renderCards(b.row, msg.products);
    renderHandoff(b.row, msg.handoff);
    if (animate) b.row.classList.add('in');
    scrollDown();
    return b;
  }

  function scrollDown() {
    // rAF so it runs after layout, otherwise a just-added card scrolls short.
    requestAnimationFrame(function () { el.log.scrollTop = el.log.scrollHeight; });
  }

  function renderAll() {
    el.log.innerHTML = '';
    addMessage({ role: 'bot', text: CONFIG.greeting });
    state.messages.forEach(function (m) { addMessage(m); });
    el.chips.hidden = state.messages.length > 0;
  }

  /* --------------------------------------------------------------- chat */

  function open() {
    el.panel.classList.add('show');
    el.launcher.classList.add('hidden');
    el.launcher.setAttribute('aria-expanded', 'true');
    state.opened = true;
    saveState();
    scrollDown();
    if (!matchMedia('(max-width: 560px)').matches) el.input.focus();
  }

  function close() {
    el.panel.classList.remove('show');
    el.launcher.classList.remove('hidden');
    el.launcher.setAttribute('aria-expanded', 'false');
  }

  function setBusy(on) {
    streaming = on;
    el.send.disabled = on;
    el.input.disabled = on;
  }

  function typingRow() {
    var row = document.createElement('div');
    row.className = 'row bot';
    row.innerHTML = '<div class="bubble typing"><i></i><i></i><i></i></div>';
    el.log.appendChild(row);
    scrollDown();
    return row;
  }

  async function send(text) {
    text = String(text || '').trim();
    if (!text || streaming) return;

    el.chips.hidden = true;
    state.messages.push({ role: 'user', text: text });
    saveState();
    addMessage({ role: 'user', text: text }, true);

    el.input.value = '';
    autosize();
    setBusy(true);

    var typing = typingRow();
    var target = null;
    var acc = '';

    try {
      var res = await fetch(CONFIG.api + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          sessionStartedAt: state.startedAt,
          page: pageContext(),
          messages: state.messages.map(function (m) {
            return {
              role: m.role === 'user' ? 'user' : 'model',
              text: m.text,
              // Which cards this reply already showed, so the server can avoid
              // re-attaching a product that is still on screen a message above.
              products: (m.products || []).map(function (p) { return p.handle; }),
            };
          }),
        }),
      });

      if (res.status === 429) throw new Error('rate');
      if (!res.ok || !res.body) throw new Error('http ' + res.status);

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      var done = null;

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buf += decoder.decode(chunk.value, { stream: true });

        var frames = buf.split('\n\n');
        buf = frames.pop() || '';

        for (var i = 0; i < frames.length; i++) {
          var ev = '', data = '';
          frames[i].split('\n').forEach(function (line) {
            if (line.indexOf('event:') === 0) ev = line.slice(6).trim();
            else if (line.indexOf('data:') === 0) data += line.slice(5).trim();
          });
          if (!data) continue;

          var payload;
          try { payload = JSON.parse(data); } catch (e) { continue; }

          if (ev === 'delta' && payload.t) {
            // Buffer only. Painting each fragment as it lands makes the reply assemble
            // itself in front of the reader - words half-formed, the bubble jumping as it
            // reflows - which reads as a machine thinking out loud. Holding the dots until
            // the thought is complete, then showing it whole, is how a person types.
            acc += payload.t;
          } else if (ev === 'done') {
            done = payload;
          }
        }
      }

      if (!acc.trim()) acc = 'Sorry, main abhi reply nahi kar payi. Ek baar phir try kijiye.';

      // The reveal: dots out, whole message in, rising as one piece. Cards and the handoff
      // button carry their own staggered delay in CSS so they follow the text rather than
      // landing on top of it.
      typing.remove();
      target = bubbleEl('bot');
      renderText(target.bubble, acc);
      target.row.classList.add('in');

      var products = (done && done.products) || [];
      var handoff = (done && done.handoff) || null;
      renderCards(target.row, products);
      renderHandoff(target.row, handoff);

      state.messages.push({ role: 'bot', text: acc, products: products, handoff: handoff });
      saveState();
      scrollDown();
    } catch (err) {
      if (typing.parentNode) typing.remove();
      var msg = err && err.message === 'rate'
        ? 'Thoda dheere ji, ek minute ruk kar phir puchiye.'
        : 'Connection me dikkat aa gayi. Aap team se seedha baat kar sakte hain.';
      var fb = { role: 'bot', text: msg };
      if (err.message !== 'rate') {
        fb.handoff = {
          url: 'https://wa.me/919355539355?text=' + encodeURIComponent('Hi SehatUP team, website chat is not working for me.'),
          label: 'Chat with our team',
        };
      }
      state.messages.push(fb);
      saveState();
      addMessage(fb, true);
    } finally {
      setBusy(false);
      if (!matchMedia('(max-width: 560px)').matches) el.input.focus();
    }
  }

  async function addToCart(variantId, button) {
    var original = button.textContent;
    button.disabled = true;
    button.textContent = 'Adding...';
    try {
      var r = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: Number(variantId), quantity: 1 }] }),
      });
      if (!r.ok) throw new Error('cart ' + r.status);
      button.textContent = 'Added ✓';
      button.classList.add('done');

      // Themes listen for this to refresh their cart drawer/count. Harmless where nothing
      // listens, and it saves a full page reload where something does.
      document.dispatchEvent(new CustomEvent('sehatup:cart-updated'));
      setTimeout(function () { location.href = '/cart'; }, 900);
    } catch (e) {
      button.disabled = false;
      button.textContent = original;
      console.error('[sehatup-chat] add to cart failed', e);
    }
  }

  /* ------------------------------------------------------------- events */

  el.launcher.addEventListener('click', open);
  el.close.addEventListener('click', close);

  el.form.addEventListener('submit', function (e) {
    e.preventDefault();
    send(el.input.value);
  });

  el.input.addEventListener('keydown', function (e) {
    // Enter sends, Shift+Enter is a newline - the convention every chat app uses.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(el.input.value);
    }
  });

  el.input.addEventListener('input', autosize);

  function autosize() {
    el.input.style.height = 'auto';
    var h = Math.min(el.input.scrollHeight, 96);
    el.input.style.height = h + 'px';
    // A one-row textarea whose scrollHeight exceeds its rows height paints a scrollbar,
    // which on Windows means two little arrow buttons sitting in the composer. Only allow
    // scrolling once the box has actually hit its ceiling.
    el.input.style.overflowY = el.input.scrollHeight > 96 ? 'auto' : 'hidden';
  }

  el.chips.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (chip) send(chip.textContent);
  });

  el.log.addEventListener('click', function (e) {
    var add = e.target.closest('.add');
    if (add) addToCart(add.dataset.variant, add);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && el.panel.classList.contains('show')) close();
  });

  /* --------------------------------------------------------------- boot */

  renderAll();
  autosize();
  if (state.opened && state.messages.length) open();

  window.SehatUpChat = {
    open: open,
    close: close,
    ask: function (t) { open(); send(t); },
    reset: function () {
      state = { sessionId: newSessionId(), startedAt: Date.now(), messages: [], opened: false };
      saveState();
      renderAll();
    },
  };

  /* ------------------------------------------------------------ markup */

  function waIcon() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
      '<path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.09c-.24.68-1.42 1.31-1.95 1.36-.5.05-.97.23-3.27-.68-2.75-1.08-4.5-3.9-4.64-4.08-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27a1 1 0 0 1 .72-.34h.52c.17 0 .39-.06.61.47.24.57.8 1.98.87 2.12.07.14.11.31.02.5-.09.18-.14.29-.27.45-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.72 1.19 1.55 1.93 1.07.95 1.97 1.25 2.24 1.39.27.14.43.11.59-.07.16-.18.68-.79.86-1.07.18-.27.36-.22.61-.13.25.09 1.58.75 1.86.88.27.14.45.2.52.32.07.11.07.66-.17 1.34z"/></svg>';
  }

  function template() {
    var avatar = CONFIG.avatar
      ? '<img class="av" src="' + esc(CONFIG.avatar) + '" alt="">'
      : '<div class="av fallback">' + esc(CONFIG.title.charAt(0).toUpperCase()) + '</div>';

    return '' +
      '<button class="launcher" type="button" aria-expanded="false" aria-label="Chat with ' + esc(CONFIG.title) + '">' +
        '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
        '</svg>' +
      '</button>' +

      '<section class="panel" role="dialog" aria-label="' + esc(CONFIG.title) + ' chat">' +
        '<header class="head">' +
          avatar +
          '<div class="who">' +
            '<strong>' + esc(CONFIG.title) + '</strong>' +
            '<span><i class="dot"></i>' + esc(CONFIG.subtitle) + '</span>' +
          '</div>' +
          '<button class="close" type="button" aria-label="Close chat">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</header>' +

        '<div class="log" role="log" aria-live="polite"></div>' +

        '<div class="chips">' +
          CONFIG.chips.map(function (c) {
            return '<button class="chip" type="button">' + esc(c) + '</button>';
          }).join('') +
        '</div>' +

        '<form class="composer">' +
          '<textarea class="input" rows="1" placeholder="Apna sawaal likhiye..." aria-label="Your message"></textarea>' +
          '<button class="send" type="submit" aria-label="Send">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>' +
          '</button>' +
        '</form>' +

        '<p class="legal">Ananya health information deti hain, medical diagnosis nahi. Dose aur medicine doctor decide karte hain.</p>' +
      '</section>';
  }

  function css(accent) {
    return `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }

/* Palette note: SehatUP's crimson is a storefront CTA colour. At full saturation across
   every surface it reads as alarm, which is the wrong register for someone typing out an
   embarrassing health problem. So the hue stays and the VALUE changes - a deep aubergine
   carries the panel, and the bright brand colour is spent in exactly two places where it
   earns its keep: the launcher, which has to be noticed, and the price, which is the
   commercial moment. Consulting room, not emergency ward. */
.wrap {
  --brand: ${accent};
  --deep: #45101f;
  --deep-soft: #5c1b2b;
  --ink: #241a1e;
  --muted: #7c6f74;
  --faint: #a49a9e;
  --paper: #faf7f6;
  --panel: #ffffff;
  --rule: #ece3e5;
  --gap-bottom: ${CONFIG.bottom};
  --gap-right: ${CONFIG.right};
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}

/* launcher - the one place the bright brand colour belongs */
.launcher {
  position: fixed; right: var(--gap-right); bottom: var(--gap-bottom); z-index: 2147483000;
  width: 58px; height: 58px; border: 0; border-radius: 50%;
  background: var(--brand); color: #fff;
  cursor: pointer; display: grid; place-items: center;
  box-shadow: 0 6px 16px rgba(69,16,31,.16), 0 12px 40px rgba(69,16,31,.14);
  transition: transform .24s cubic-bezier(.2,.8,.3,1), box-shadow .24s, opacity .18s;
}
.launcher:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(69,16,31,.2), 0 18px 50px rgba(69,16,31,.18); }
.launcher:active { transform: translateY(0) scale(.97); }
.launcher.hidden { opacity: 0; pointer-events: none; transform: scale(.7); }
.launcher:focus-visible { outline: 2px solid var(--deep); outline-offset: 3px; }

/* panel */
.panel {
  position: fixed; right: var(--gap-right); bottom: var(--gap-bottom); z-index: 2147483000;
  width: 380px; max-width: calc(100vw - 32px);
  height: 600px; max-height: calc(100vh - 40px);
  background: var(--panel); border-radius: 20px;
  border: 1px solid var(--rule);
  box-shadow: 0 2px 6px rgba(36,26,30,.04), 0 18px 60px rgba(36,26,30,.14);
  display: flex; flex-direction: column; overflow: hidden;
  opacity: 0; transform: translateY(12px) scale(.985); pointer-events: none;
  transition: opacity .22s ease, transform .28s cubic-bezier(.2,.8,.3,1);
}
.panel.show { opacity: 1; transform: none; pointer-events: auto; }

/* header - flat, not a gradient. A gradient here is decoration; flat colour is a decision. */
.head {
  display: flex; align-items: center; gap: 12px;
  padding: 15px 16px; color: #fff; background: var(--deep);
}
.av { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex: 0 0 auto;
      background: var(--deep-soft); }
.av.fallback { display: grid; place-items: center; background: var(--deep-soft);
      font-weight: 600; font-size: 15px; letter-spacing: .02em; }
.who { flex: 1; min-width: 0; }
.who strong { display: block; font-size: 15px; font-weight: 600; letter-spacing: -.01em; }
/* status as a micro-label, not body text - it is metadata, and should read like it */
.who span { display: flex; align-items: center; gap: 6px; margin-top: 2px;
      font-size: 10.5px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase;
      color: rgba(255,255,255,.68); }
.dot { width: 5px; height: 5px; border-radius: 50%; background: #5fd08a; }
.close { background: transparent; border: 0; color: rgba(255,255,255,.7); cursor: pointer;
         width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center;
         transition: background .15s, color .15s; }
.close:hover { background: rgba(255,255,255,.12); color: #fff; }
.close:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }

/* log */
.log { flex: 1; overflow-y: auto; overscroll-behavior: contain;
       padding: 18px 16px 8px; background: var(--paper); }
.log::-webkit-scrollbar { width: 5px; }
.log::-webkit-scrollbar-thumb { background: #ded4d7; border-radius: 3px; }
.log::-webkit-scrollbar-track { background: transparent; }

.row { display: flex; flex-direction: column; margin-bottom: 14px; max-width: 86%; }
.row.user { margin-left: auto; align-items: flex-end; }

/* The signature moment: a reply arrives as one whole thought, rising into place.
   Never assembled in front of the reader a fragment at a time. */
.row.in { animation: rise .34s cubic-bezier(.16,.84,.3,1) both; }
@keyframes rise {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
}

.bubble { padding: 11px 14px; border-radius: 16px; font-size: 14.5px; line-height: 1.55;
          word-wrap: break-word; overflow-wrap: anywhere; }
.row.bot .bubble { background: var(--panel); border: 1px solid var(--rule);
                   border-bottom-left-radius: 6px; color: var(--ink); }
.row.user .bubble { background: var(--deep); color: #fff; border-bottom-right-radius: 6px; }

/* one calm breath, not three bouncing balls */
.typing { display: flex; gap: 5px; align-items: center; padding: 15px 16px; }
.typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--faint);
            animation: breathe 1.6s ease-in-out infinite; }
.typing i:nth-child(2) { animation-delay: .22s; }
.typing i:nth-child(3) { animation-delay: .44s; }
@keyframes breathe {
  0%, 60%, 100% { opacity: .28; }
  30%           { opacity: .85; }
}

/* product cards - the commercial moment, so this is where the brand colour reappears */
.cards { display: flex; flex-direction: column; gap: 9px; margin-top: 10px; width: 100%; }
.card { display: flex; gap: 12px; padding: 11px; background: var(--panel);
        border: 1px solid var(--rule); border-radius: 14px;
        animation: rise .34s cubic-bezier(.16,.84,.3,1) both; }
.card:nth-child(2) { animation-delay: .07s; }
.card:nth-child(3) { animation-delay: .14s; }
.card img, .noimg { width: 60px; height: 60px; border-radius: 10px; object-fit: cover;
        flex: 0 0 auto; background: var(--paper); }
.cbody { flex: 1; min-width: 0; }
.ctitle { font-size: 13px; font-weight: 600; line-height: 1.35; letter-spacing: -.005em;
          margin-bottom: 5px; color: var(--ink);
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden; }
.cprice { font-size: 15px; font-weight: 700; color: var(--brand); margin-bottom: 9px;
          letter-spacing: -.01em; }
.cprice s { color: var(--faint); font-weight: 400; font-size: 12px; margin-left: 5px; }
.cprice em { font-style: normal; font-size: 11px; font-weight: 600; color: #2f7d51;
             margin-left: 5px; letter-spacing: 0; }
.cbtns { display: flex; gap: 7px; }
.btn { font: inherit; font-size: 12.5px; font-weight: 600; padding: 7px 13px;
       border-radius: 9px; cursor: pointer; border: 1px solid transparent;
       text-decoration: none; display: inline-flex; align-items: center;
       transition: background .15s, border-color .15s, color .15s; }
.btn.primary { background: var(--deep); color: #fff; }
.btn.primary:hover { background: var(--deep-soft); }
.btn.primary.done { background: #2f7d51; }
.btn.primary:disabled { opacity: .65; cursor: default; }
.btn.ghost { background: transparent; color: var(--muted); border-color: var(--rule); }
.btn.ghost:hover { color: var(--ink); border-color: #d9cdd1; }
.btn:focus-visible { outline: 2px solid var(--deep); outline-offset: 2px; }

/* handoff */
.wa { display: inline-flex; align-items: center; gap: 8px; margin-top: 10px;
      padding: 10px 15px; border-radius: 11px; background: #1faa54; color: #fff;
      font-size: 13.5px; font-weight: 600; text-decoration: none; align-self: flex-start;
      animation: rise .34s cubic-bezier(.16,.84,.3,1) both; animation-delay: .07s;
      transition: background .15s; }
.wa:hover { background: #18904c; }
.wa:focus-visible { outline: 2px solid var(--deep); outline-offset: 2px; }

/* chips - neutral. Pink chips on a pink header was two shouts in one room. */
.chips { display: flex; flex-wrap: wrap; gap: 7px; padding: 2px 16px 12px; background: var(--paper); }
.chips[hidden] { display: none; }
.chip { font: inherit; font-size: 12.5px; padding: 7px 13px; border-radius: 999px;
        border: 1px solid var(--rule); background: var(--panel); color: var(--muted);
        cursor: pointer; transition: border-color .15s, color .15s; }
.chip:hover { border-color: #d9cdd1; color: var(--ink); }
.chip:focus-visible { outline: 2px solid var(--deep); outline-offset: 2px; }

/* composer */
.composer { display: flex; gap: 9px; align-items: flex-end; padding: 12px 14px 9px;
            border-top: 1px solid var(--rule); background: var(--panel); }
.input { flex: 1; font: inherit; font-size: 14.5px; line-height: 1.5; resize: none;
         border-radius: 12px; border: 1px solid var(--rule); background: var(--paper);
         padding: 10px 13px; max-height: 96px; color: var(--ink); overflow-y: hidden;
         transition: border-color .15s, background .15s; }
.input::placeholder { color: var(--faint); }
.input:focus { outline: none; border-color: var(--deep); background: var(--panel); }
.input:disabled { opacity: .55; }
.send { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 12px; border: 0;
        background: var(--deep); color: #fff; cursor: pointer;
        display: grid; place-items: center; transition: background .15s, opacity .15s; }
.send:hover { background: var(--deep-soft); }
.send:disabled { opacity: .35; cursor: default; }
.send:focus-visible { outline: 2px solid var(--deep); outline-offset: 2px; }

.legal { margin: 0; padding: 0 16px 12px; font-size: 10.5px; line-height: 1.45;
         color: var(--faint); background: var(--panel); text-align: center; }

@media (max-width: 560px) {
  .wrap { --gap-bottom: ${CONFIG.bottomMobile}; --gap-right: 16px; }
  .panel { right: 0; bottom: 0; width: 100vw; max-width: 100vw;
           height: 100dvh; max-height: 100dvh; border-radius: 0; border: 0; }
  .launcher { width: 54px; height: 54px; }
  .row { max-width: 90%; }
}

@media (prefers-reduced-motion: reduce) {
  .row.in, .card, .wa { animation: none; }
  .typing i { animation: none; opacity: .5; }
  .panel, .launcher, .btn, .chip, .input, .send { transition: none; }
}
`;
  }
})();
