/* Landing pages: countdown to the end of today's slots, and the booking form.
   Leads go to the same places as the site's lead popup (sections/lead-popup):
   Firestore "popup_leads" and the Google Sheet, written in parallel, saved if
   either one takes it. Attribution (UTM etc.) comes from sehatup-attribution. */
(function () {
  var FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBCuj9geUYV69Ievt59WO8PjJWQZ1cKDLw',
    authDomain: 'sehatup-f96b5.firebaseapp.com',
    projectId: 'sehatup-f96b5',
    storageBucket: 'sehatup-f96b5.firebasestorage.app',
    messagingSenderId: '886569695434',
    appId: '1:886569695434:web:4932dca7625c98972a5c33'
  };
  var SDK = '10.13.0';
  var SHEET_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbw-5Pky1FEOJb4OdReak1jYLC39toWkAXB_sX3nNWoDUrKc3ZOwW2BcwQiIxjgTLOOpUQ/exec';

  /* ---- countdown: time left until midnight India time (today's slots) ---- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var timers = document.querySelectorAll('[data-lp-timer]');
  if (timers.length) {
    var tick = function () {
      var now = new Date();
      var ist = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60000);
      var left = (24 * 3600) - (ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds());
      var h = Math.floor(left / 3600), m = Math.floor(left % 3600 / 60), s = left % 60;
      timers.forEach(function (t) {
        t.querySelector('[data-h]').textContent = pad(h);
        t.querySelector('[data-m]').textContent = pad(m);
        t.querySelector('[data-s]').textContent = pad(s);
      });
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---- symptom cards: tap to select, button counts the picks ---- */
  window.lpSymptoms = [];
  document.querySelectorAll('[data-lp-symptoms]').forEach(function (sec) {
    var items = sec.querySelectorAll('.lp-sym');
    var label = sec.querySelector('.lp-sym-cta [data-base]');
    var tpl = sec.dataset.selectedText || '';
    function update() {
      var picked = [];
      items.forEach(function (i) { if (i.getAttribute('aria-pressed') === 'true') picked.push(i.dataset.sym); });
      window.lpSymptoms = picked;
      if (label) label.textContent = picked.length && tpl ? tpl.replace('[n]', picked.length) : label.dataset.base;
    }
    items.forEach(function (i) {
      i.addEventListener('click', function () {
        i.setAttribute('aria-pressed', i.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        update();
      });
    });
  });

  /* ---- horizontal rows: arrow buttons, hidden at the ends ---- */
  document.querySelectorAll('[data-lp-scroller]').forEach(function (row) {
    var track = row.querySelector('.lp-symptoms');
    var prev = row.querySelector('[data-dir="-1"]'), next = row.querySelector('[data-dir="1"]');
    if (!track || !prev || !next) return;
    function sync() {
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    }
    [prev, next].forEach(function (b) {
      b.addEventListener('click', function () { track.scrollBy({ left: +b.dataset.dir * track.clientWidth * 0.8, behavior: 'smooth' }); });
    });
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  });

  /* ---- Firestore writer, loaded only when someone submits ---- */
  var writer = null;
  function getWriter() {
    if (writer) return writer;
    writer = Promise.all([
      import('https://www.gstatic.com/firebasejs/' + SDK + '/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/' + SDK + '/firebase-firestore.js')
    ]).then(function (m) {
      var app = m[0].getApps().length ? m[0].getApp() : m[0].initializeApp(FIREBASE_CONFIG);
      var db = m[1].getFirestore(app);
      return function (col, data) {
        return m[1].addDoc(m[1].collection(db, col), Object.assign({}, data, { timestamp: m[1].serverTimestamp(), createdAt: new Date() }));
      };
    });
    writer.catch(function () { writer = null; });
    return writer;
  }
  function sendToSheet(lead, url) {
    url = url || SHEET_WEBAPP_URL;  // the section setting wins; else the default sheet
    if (!url) return Promise.resolve(false);
    return fetch(url, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(lead) })
      .then(function () { return true; }, function () { return false; });
  }

  document.querySelectorAll('[data-lp-form]').forEach(function (box) {
    var form = box.querySelector('form');
    var btn = form.querySelector('button[type="submit"]');
    var err = form.querySelector('.lp-form__err');
    var label = btn.innerHTML;
    var busy = false;

    function bad(input, msg) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      err.textContent = msg;
      return false;
    }
    function valid() {
      form.querySelectorAll('[aria-invalid]').forEach(function (i) { i.removeAttribute('aria-invalid'); });
      var name = form.elements.name, phone = form.elements.phone, age = form.elements.age;
      if (name.value.trim().length < 2) return bad(name, 'Please enter your name.');
      var digits = phone.value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
      if (!/^[6-9]\d{9}$/.test(digits)) return bad(phone, 'Please enter a valid 10-digit mobile number.');
      phone.value = digits;
      if (age && age.value && (+age.value < 15 || +age.value > 90)) return bad(age, 'Please enter your age.');
      return true;
    }

    if (location.hash === '#' + box.id) form.elements.name.focus({ preventScroll: true });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy || !valid()) return;
      busy = true;
      err.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Booking...';

      var attribution = {};
      try { if (window.SehatUpAttribution) attribution = window.SehatUpAttribution.fields(); } catch (x) {}
      var f = form.elements;
      var lead = Object.assign({
        name: f.name.value.trim(),
        phone: f.phone.value,
        age: f.age ? f.age.value : '',
        concern: f.concern ? f.concern.value : '',
        preferredTime: f.time ? f.time.value : '',
        symptoms: (window.lpSymptoms || []).join(', '),
        gender: box.dataset.gender || '',
        status: 'new',
        source: box.dataset.source || 'landing_page',
        pageUrl: window.location.href,
        referrer: document.referrer || ''
      }, attribution);

      Promise.allSettled([
        getWriter().then(function (add) { return add(box.dataset.collection || 'popup_leads', lead); }),
        sendToSheet(lead, box.dataset.sheet)
      ]).then(function (r) {
        var ok = r[0].status === 'fulfilled' || (r[1].status === 'fulfilled' && r[1].value === true);
        if (r[0].status !== 'fulfilled') console.error('[landing] Firestore write failed:', r[0].reason);
        if (!ok) throw new Error('not saved');
        try { if (window.fbq) window.fbq('track', 'Lead'); } catch (x) {}
        try { if (window.oaiq) window.oaiq('measure', 'lead_created', { type: 'customer_action' }); } catch (x) {}
        try { if (window.Shopify && Shopify.analytics) Shopify.analytics.publish('lp_lead', { source: lead.source }); } catch (x) {}
        var to = box.dataset.redirect || '/pages/booking-confirmed';
        to += (to.indexOf('?') > -1 ? '&' : '?') + 'from=' + encodeURIComponent(location.pathname + location.search);
        // Short pause so the pixels above can send before the page changes.
        setTimeout(function () { window.location.href = to; }, 250);
      }).catch(function () {
        err.textContent = 'Could not send. Check your connection and try again.';
        btn.disabled = false;
        btn.innerHTML = label;
        busy = false;
      });
    });
  });
})();
