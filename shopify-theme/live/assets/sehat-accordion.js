/* Shared accordion for sehatUP sections (FAQ, product fold-outs, ...).

   Usage: put data-sehat-accordion on the element that wraps the <details>
   items and load this file with defer. Each <details> then slides open and
   shut, and opening one closes the others in the same wrapper.

   While moving, an item carries the class is-opening or is-closing, so a
   section's own CSS can fade its content (e.g. .is-closing .answer { opacity: 0 }).

   Without this script (or with reduced motion) the native <details> still
   works; give the items a shared name="..." attribute to keep one-open-at-a-time. */
(function () {
  if (window.sehatAccordion) { window.sehatAccordion(); return; }

  var EASE = 'cubic-bezier(.16, 1, .3, 1)', MS = 400;

  function stop(d) { if (d._anim) { d._anim.cancel(); d._anim = null; } }
  function run(d, from, to, done) {
    d.style.overflow = 'hidden';
    d._anim = d.animate({ height: [from + 'px', to + 'px'] }, { duration: MS, easing: EASE });
    d._anim.onfinish = function () { d._anim = null; d.style.overflow = ''; done && done(); };
  }
  function open(d) {
    var start = d.offsetHeight; stop(d);   // measure before cancelling, so a mid-flight tap starts from where it is
    d.classList.remove('is-closing'); d.classList.add('is-opening'); d.open = true;
    var end = d.offsetHeight;
    requestAnimationFrame(function () { d.classList.remove('is-opening'); });
    run(d, start, end);
  }
  function close(d) {
    var start = d.offsetHeight; stop(d);
    d.classList.add('is-closing');
    var shut = d.querySelector('summary').offsetHeight + (d.offsetHeight - d.clientHeight);
    run(d, start, shut, function () { d.open = false; d.classList.remove('is-closing'); });
  }

  function setup(wrap) {
    if (wrap.dataset.sehatAccordion === 'on') return;
    wrap.dataset.sehatAccordion = 'on';
    var items = Array.prototype.filter.call(wrap.querySelectorAll('details'), function (d) { return d.querySelector('summary'); });
    items.forEach(function (d) {
      d.removeAttribute('name');   // this script closes the others itself, animated
      d.querySelector('summary').addEventListener('click', function (e) {
        e.preventDefault();
        if (d.open && !d.classList.contains('is-closing')) { close(d); return; }
        items.forEach(function (o) { if (o !== d && o.open && !o.classList.contains('is-closing')) close(o); });
        open(d);
      });
    });
  }

  window.sehatAccordion = function () {
    if (!Element.prototype.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('[data-sehat-accordion]').forEach(setup);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.sehatAccordion);
  else window.sehatAccordion();
  // Sections added or re-rendered in the theme editor.
  document.addEventListener('shopify:section:load', window.sehatAccordion);
})();
