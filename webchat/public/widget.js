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
    title: (script && script.dataset.title) || 'sehatUP Mitra',
    subtitle: (script && script.dataset.subtitle) || 'SehatUP health advisor',
    greeting: (script && script.dataset.greeting) ||
      'Hello! Main sehatUP Mitra hu. Product, price ya health concern - kuch bhi puchiye.',
    accent: (script && script.dataset.accent) || '#ee204a',
    avatar: (script && script.dataset.avatar) || '',
    // The launcher artwork. Empty keeps the built-in speech-bubble SVG, which stays
    // sharp at any density and costs no request. A URL swaps in a raster mark from
    // the theme instead, so trying a new icon is a Shopify edit, not a deploy.
    // data-icon-full="1" says the artwork IS the circle: the button drops its own
    // crimson fill rather than ringing the image with it.
    icon: (script && script.dataset.icon) || '',
    iconFull: (script && script.dataset.iconFull) === '1',
    // Corner offsets, any CSS length. Phones get their own bottom value because a sticky
    // add-to-cart bar is a mobile-only obstacle.
    // How many times the attention ring pulses after the page settles. Finite on purpose:
    // an infinite pulse is what made the launcher feel like it was nagging. 0 turns it off.
    pulse: Math.max(0, Math.min(10, parseInt((script && script.dataset.pulse) || '3', 10) || 0)),
    // The greeting that unfurls out of the launcher on a first visit. It REPLACES
    // the pulse rather than joining it - see the guard below.
    tip: (script && script.dataset.tip) !== '0',
    tipTitle: (script && script.dataset.tipTitle) || 'sehatUP Mitra',
    tipText: (script && script.dataset.tipText) || 'Ask me anything about health or products',
    tipDelay: Math.max(0, parseInt((script && script.dataset.tipDelay) || '2800', 10) || 0),
    tipHold: Math.max(2000, parseInt((script && script.dataset.tipHold) || '7000', 10) || 7000),
    // How often the greeting is allowed to appear:
    //   session  once per visit (default). A store is many page loads in one visit,
    //            and a welcome that reintroduces itself on page four is nagging.
    //   page     every page load. Maximum reach, at the cost of that.
    //   day      once per browser per calendar day.
    tipScope: (script && script.dataset.tipScope) || 'session',
    bottom: (script && script.dataset.bottom) || '32px',
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

  // One attention grab, not two. A ring pulsing around a launcher that is also
  // unfurling a greeting reads as a widget shouting over itself, so the greeting
  // wins and the pulse stands down. Set data-tip="0" to go back to the ring.
  if (CONFIG.tip) CONFIG.pulse = 0;

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
    // Attribution comes from the sehatup-attribution snippet, which captured it on the
    // visitor's FIRST page view. Reading the current URL here would lose it for anyone
    // who browsed before opening the chat, which is most people.
    var attribution = null;
    try {
      if (window.SehatUpAttribution) attribution = window.SehatUpAttribution.fields();
    } catch (e) { /* never let attribution break a chat */ }

    return {
      url: location.href,
      title: document.title,
      productHandle: handle,
      attribution: attribution,
    };
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
    tip: root.querySelector('.tip'),
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

  /* ------------------------------------------------------------ greeting */

  var TIP_KEY = 'sehatup_chat_tip_v1';
  var tipTimer = null;

  function hideTip() {
    window.clearTimeout(tipTimer);
    if (el.tip) el.tip.classList.remove('show');
  }

  // Returns true when this browser has already had the greeting for the current
  // scope, and claims the slot when it has not. Storage failing (private mode,
  // quota, cookies off) always resolves to "show it" - a greeting nobody
  // remembers is a smaller failure than a greeting nobody ever sees.
  function tipAlreadyShown() {
    if (CONFIG.tipScope === 'page') return false;
    try {
      if (CONFIG.tipScope === 'day') {
        var today = new Date().toISOString().slice(0, 10);
        if (localStorage.getItem(TIP_KEY) === today) return true;
        localStorage.setItem(TIP_KEY, today);
        return false;
      }
      if (sessionStorage.getItem(TIP_KEY)) return true;
      sessionStorage.setItem(TIP_KEY, '1');
      return false;
    } catch (e) {
      return false;
    }
  }

  function showTip() {
    if (!el.tip) return;
    // Never to somebody already in a conversation. That guard holds in every
    // scope: interrupting a live chat is worse than missing a greeting.
    if (state.opened || state.messages.length) return;
    if (tipAlreadyShown()) return;
    el.tip.classList.add('show');
    tipTimer = window.setTimeout(hideTip, CONFIG.tipHold);
  }

  function open() {
    hideTip();
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
  if (el.tip) {
    el.tip.addEventListener('click', open);
    window.setTimeout(showTip, CONFIG.tipDelay);
  }
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

  // Reopening the panel across page loads is what lets a conversation survive a
  // storefront navigation: tap a product mid-chat and you keep your place. A
  // reload is not that. Nobody refreshes a page expecting a panel to spring open
  // over it, so a reload is treated as a fresh arrival - and state.opened is
  // cleared with it, so the next navigation does not resurrect the panel either.
  // An unknown navigation type falls back to leaving it shut: a wrong "open"
  // interrupts, a wrong "closed" costs one tap.
  function wasReload() {
    try {
      var nav = performance.getEntriesByType('navigation')[0];
      if (nav) return nav.type === 'reload';
      return !!(performance.navigation && performance.navigation.type === 1);
    } catch (e) {
      return false;
    }
  }

  if (state.opened && state.messages.length) {
    if (wasReload()) {
      state.opened = false;
      saveState();
    } else {
      open();
    }
  }

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
    var icon = CONFIG.icon
      ? '<img class="ico" src="' + esc(CONFIG.icon) + '" alt="">'
      : '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
        '</svg>';

    var avatar = CONFIG.avatar
      ? '<img class="av" src="' + esc(CONFIG.avatar) + '" alt="">'
      : '<div class="av fallback">' + esc(CONFIG.title.charAt(0).toUpperCase()) + '</div>';

    var tip = CONFIG.tip
      // aria-hidden on purpose: it repeats what the launcher's own label already
      // says, and a screen reader should not hear the same offer twice.
      ? '<div class="tip" aria-hidden="true">' +
          '<span class="tip__in">' +
            '<strong>' + esc(CONFIG.tipTitle) + '</strong>' +
            '<span>' + esc(CONFIG.tipText) + '</span>' +
          '</span>' +
        '</div>'
      : '';

    return '' +
      tip +
      '<button class="launcher' + (CONFIG.icon && CONFIG.iconFull ? ' launcher--art' : '') + '" type="button" aria-expanded="false" aria-label="Chat with ' + esc(CONFIG.title) + '">' +
        icon +
        (CONFIG.pulse > 0 ? '<span class="pulse"></span>' : '') +
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

        '<p class="legal">sehatUP Mitra health information deti hain, medical diagnosis nahi. Dose aur medicine doctor decide karte hain.</p>' +
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
  /* Everything below is derived from --brand with color-mix, so changing
     data-accent still recolours the whole panel in one move. */
  --brand-deep: color-mix(in srgb, var(--brand) 84%, #000);
  --brand-sink: color-mix(in srgb, var(--brand) 60%, #45101f);
  --brand-tint: color-mix(in srgb, var(--brand) 9%, #fff);
  --brand-wash: color-mix(in srgb, var(--brand) 4%, #fff);
  --brand-ring: color-mix(in srgb, var(--brand) 26%, transparent);
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

/* Raster launcher art, in the two shapes it can take. A small glyph sits on the
   crimson button like the built-in SVG does. A full-bleed mark IS the button, so
   the fill comes off - otherwise the button's circle rings the artwork's own one -
   and the radius moves onto the image, because a border-radius on the button does
   not clip its children. */
.ico { width: 26px; height: 26px; object-fit: contain; }
/* padding:0 is load-bearing: a <button> carries a UA default padding of 1px 6px,
   which the 26px glyph never noticed because it was centred anyway. A full-bleed
   image does notice - it lays out in the content box, so the circle arrives as a
   46x56 oval. */
.launcher--art { background: none; padding: 0; }
.launcher--art .ico { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }

/* The greeting unfurls OUT OF the launcher rather than appearing beside it.

   The pill is right-anchored and its collapsed width is exactly the launcher's,
   so at rest it is hidden underneath the circle; growing max-width pushes its
   left edge outward while the circle stays put as the right end cap. The reader
   sees one object stretching, not a second object arriving, which is the whole
   idea: the icon is speaking.

   The text fades in a beat late so nobody watches it slide. That is the only
   orchestration here - one moment, once a visit, then a quiet circle forever. */
.tip {
  position: fixed; right: var(--gap-right); bottom: var(--gap-bottom);
  z-index: 2147482999;
  display: flex; align-items: center;
  box-sizing: border-box;
  height: 58px;
  padding-right: 58px;
  max-width: 58px;
  overflow: hidden;
  border-radius: 29px;
  background: var(--panel);
  border: 1px solid var(--rule);
  box-shadow: 0 4px 14px rgba(69,16,31,.10), 0 14px 44px rgba(69,16,31,.12);
  opacity: 0;
  cursor: pointer;
  pointer-events: none;
  transition: max-width .46s cubic-bezier(.2,.9,.25,1), opacity .22s ease;
}
.tip.show { max-width: min(340px, calc(100vw - 32px)); opacity: 1; pointer-events: auto; }
.tip__in {
  padding: 0 14px 0 20px;
  white-space: nowrap;
  opacity: 0;
  transform: translateX(10px);
  transition: opacity .26s ease .14s, transform .34s cubic-bezier(.2,.9,.25,1) .14s;
}
.tip.show .tip__in { opacity: 1; transform: none; }
.tip__in strong {
  display: block;
  font-size: 13.5px; font-weight: 600; letter-spacing: -.012em;
  color: var(--ink);
}
.tip__in span {
  display: block; margin-top: 1px;
  font-size: 11.5px; line-height: 1.35; color: var(--muted);
}

/* Attention ring. It runs a FIXED number of times and then stops for good - an infinite
   pulse is what made this feel like it was tugging at the reader's sleeve. Two seconds of
   delay lets the page settle first, so it reads as the widget arriving rather than as
   part of the page load. The "both" fill mode holds the final, transparent frame. */
.pulse {
  position: absolute; inset: 0; border-radius: 50%;
  border: 2px solid var(--brand); opacity: 0;
  animation: pulse 2.2s cubic-bezier(.2,.6,.3,1) 2s ${CONFIG.pulse} both;
}
@keyframes pulse {
  0%   { transform: scale(1);    opacity: .5; }
  70%  { transform: scale(1.45); opacity: 0; }
  100% { transform: scale(1.45); opacity: 0; }
}

/* panel */
.panel {
  position: fixed; right: var(--gap-right); bottom: var(--gap-bottom); z-index: 2147483000;
  width: 380px; max-width: calc(100vw - 32px);
  /* Height adapts to the window instead of being a fixed 600 that gets trimmed.

     The panel hangs off the bottom corner, so its ceiling is the viewport minus
     the corner gap it stands on, minus a real top margin. The old flat 40px was
     not that sum: against a 32px bottom gap it left exactly 8px of headroom, so
     the panel touched the top edge the moment the window was anything short of
     tall, and read as clipped.

     dvh, not vh: on phones vh is measured with the browser UI hidden, so a panel
     anchored to the bottom is precisely the thing that gets cut off at the top
     while the URL bar is showing. Each vh line below is the fallback for engines
     that do not know dvh - the later declaration wins where it is understood and
     is discarded as invalid where it is not, which is the whole trick.

     clamp, so the panel earns extra height on a tall screen rather than leaving
     it empty, and gives it up on a short one before max-height has to intervene. */
  --panel-gap-top: 24px;
  height: clamp(380px, 74vh, 680px);
  height: clamp(380px, 74dvh, 680px);
  max-height: calc(100vh - var(--gap-bottom) - var(--panel-gap-top));
  max-height: calc(100dvh - var(--gap-bottom) - var(--panel-gap-top));
  background: var(--panel); border-radius: 20px;
  border: 1px solid var(--rule);
  box-shadow: 0 2px 8px rgba(69,16,31,.06), 0 24px 70px -14px rgba(120,12,40,.34);
  display: flex; flex-direction: column; overflow: hidden;
  opacity: 0; transform: translateY(12px) scale(.985); pointer-events: none;
  transition: opacity .22s ease, transform .28s cubic-bezier(.2,.8,.3,1);
}
.panel.show { opacity: 1; transform: none; pointer-events: auto; }

/* header - the brand band. The old flat wine was the right call when the panel was
   the only thing on screen, but next to a storefront running bright red CTAs it read
   as muddy rather than calm. Crimson ties the panel to the page it opens over. The
   gradient is two stops of one hue, so it reads as depth rather than decoration. */
.head {
  display: flex; align-items: center; gap: 12px;
  padding: 15px 16px; color: #fff;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-sink) 100%);
}
/* The avatar is itself a crimson mark, so on a crimson header it needs its own white
   ground or it dissolves into the band. contain + padding + border-box gives it one. */
.av { width: 40px; height: 40px; border-radius: 50%; object-fit: contain; flex: 0 0 auto;
      background: #fff; padding: 2px; box-sizing: border-box;
      box-shadow: 0 2px 6px rgba(69,16,31,.24); }
.av.fallback { display: grid; place-items: center; padding: 0;
      background: rgba(255,255,255,.18); color: #fff;
      font-weight: 700; font-size: 15px; letter-spacing: .02em; }
.who { flex: 1; min-width: 0; }
.who strong { display: block; font-size: 16px; font-weight: 700; letter-spacing: -.015em; }
/* status as a micro-label, not body text - it is metadata, and should read like it */
.who span { display: flex; align-items: center; gap: 6px; margin-top: 2px;
      font-size: 10.5px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase;
      color: rgba(255,255,255,.82); }
.dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80;
       box-shadow: 0 0 0 3px rgba(74,222,128,.3); }
.close { background: transparent; border: 0; color: rgba(255,255,255,.7); cursor: pointer;
         width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center;
         transition: background .15s, color .15s; }
.close:hover { background: rgba(255,255,255,.12); color: #fff; }
.close:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }

/* log */
.log { flex: 1; overflow-y: auto; overscroll-behavior: contain;
       padding: 18px 16px 8px; background: var(--brand-wash); }
.log::-webkit-scrollbar { width: 5px; }
.log::-webkit-scrollbar-thumb { background: var(--brand-ring); border-radius: 3px; }
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
                   border-bottom-left-radius: 6px; color: var(--ink);
                   box-shadow: 0 1px 2px rgba(69,16,31,.05); }
.row.user .bubble { background: var(--brand); color: #fff; border-bottom-right-radius: 6px;
                    box-shadow: 0 2px 8px -2px var(--brand-ring); }

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
.btn.primary { background: var(--brand); color: #fff;
               box-shadow: 0 4px 10px -4px var(--brand-ring); }
.btn.primary:hover { background: var(--brand-deep); }
.btn.primary.done { background: #2f7d51; }
.btn.primary:disabled { opacity: .65; cursor: default; }
.btn.ghost { background: transparent; color: var(--muted); border-color: var(--rule); }
.btn.ghost:hover { color: var(--ink); border-color: #d9cdd1; }
.btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

/* handoff */
.wa { display: inline-flex; align-items: center; gap: 8px; margin-top: 10px;
      padding: 10px 15px; border-radius: 11px; background: #1faa54; color: #fff;
      font-size: 13.5px; font-weight: 600; text-decoration: none; align-self: flex-start;
      animation: rise .34s cubic-bezier(.16,.84,.3,1) both; animation-delay: .07s;
      transition: background .15s; }
.wa:hover { background: #18904c; }
.wa:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

/* chips - these are the opening questions, so they have to look answerable. Grey on
   white read as disabled. They stay white against the blush log rather than filling
   with tint, which would put a second field of pink under a pink header. */
.chips { display: flex; flex-wrap: wrap; gap: 7px; padding: 2px 16px 12px; background: var(--brand-wash); }
.chips[hidden] { display: none; }
.chip { font: inherit; font-size: 12.5px; font-weight: 500; padding: 7px 13px; border-radius: 999px;
        border: 1px solid var(--brand-ring); background: var(--panel); color: var(--brand-deep);
        cursor: pointer; transition: background .15s, border-color .15s, color .15s; }
.chip:hover { background: var(--brand-tint); border-color: var(--brand); }
.chip:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

/* composer */
.composer { display: flex; gap: 9px; align-items: flex-end; padding: 12px 14px 9px;
            border-top: 1px solid var(--rule); background: var(--panel); }
.input { flex: 1; font: inherit; font-size: 14.5px; line-height: 1.5; resize: none;
         border-radius: 12px; border: 1px solid var(--rule); background: var(--paper);
         padding: 10px 13px; max-height: 96px; color: var(--ink); overflow-y: hidden;
         transition: border-color .15s, background .15s; }
.input::placeholder { color: var(--faint); }
.input:focus { outline: none; border-color: var(--brand); background: var(--panel);
               box-shadow: 0 0 0 3px var(--brand-ring); }
.input:disabled { opacity: .55; }
.send { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 12px; border: 0;
        background: var(--brand); color: #fff; cursor: pointer;
        display: grid; place-items: center; transition: background .15s, opacity .15s;
        box-shadow: 0 4px 12px -4px var(--brand-ring); }
.send:hover { background: var(--brand-deep); }
.send:disabled { opacity: .35; cursor: default; }
.send:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

.legal { margin: 0; padding: 0 16px 12px; font-size: 10.5px; line-height: 1.45;
         color: var(--muted); background: var(--panel); text-align: center; }

@media (max-width: 560px) {
  .wrap { --gap-bottom: ${CONFIG.bottomMobile}; --gap-right: 16px; }
  .panel { right: 0; bottom: 0; width: 100vw; max-width: 100vw;
           height: 100dvh; max-height: 100dvh; border-radius: 0; border: 0; }
  .launcher { width: 54px; height: 54px; }
  .tip { height: 54px; padding-right: 54px; max-width: 54px; border-radius: 27px; }
  .tip.show { max-width: calc(100vw - 32px); }
  .tip__in { padding-left: 18px; }
  .row { max-width: 90%; }
}

@media (prefers-reduced-motion: reduce) {
  .pulse { animation: none; }
  /* Still appears and still leaves, it just does not perform the unfurl. */
  .tip { transition: opacity .2s ease; }
  .tip__in { transition: none; transform: none; opacity: 1; }
  .row.in, .card, .wa { animation: none; }
  .typing i { animation: none; opacity: .5; }
  .panel, .launcher, .btn, .chip, .input, .send { transition: none; }
}
`;
  }
})();
