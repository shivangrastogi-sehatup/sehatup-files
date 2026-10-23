const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/health-score-glance.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };

// The photo shows at once (it is the first thing people see); only the ring draws in.
rep(`  #hsg-{{ section.id }}.pre .g__disc { opacity: 0; }\n`, '');
rep(`      q('.g__disc').animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: ease, fill: 'backwards' });\n`, '');

rep(`    // Wait for the photo (max 1.5s) and two frames, so the entrance does not
    // fight image decoding and the rest of the page booting.`,
`    // Wait for the photo (max 1.5s), the page load and an idle moment, so the
    // ring draws on a quiet main thread (while the page boots, frames take
    // 50-150ms and the drawing stutters).`);
rep(`    function nextFrames() {`,
`    function settled() {
      return new Promise(function (ok) {
        function idle() { if (window.requestIdleCallback) requestIdleCallback(ok, { timeout: 1200 }); else setTimeout(ok, 300); }
        if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle, { once: true });
      });
    }
    function nextFrames() {`);
rep(`photoReady.then(nextFrames).then(enter);`, `photoReady.then(settled).then(nextFrames).then(enter);`);
fs.writeFileSync(p, t);
console.log('ok');
