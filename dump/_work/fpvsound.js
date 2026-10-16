// Adds an optional sound (mute/unmute) button to the floating video's small player.
const fs = require('fs');
for (const p of process.argv.slice(2)) {
  let t = fs.readFileSync(p, 'utf8');
  const rep = (a, b) => { const n = t.split(a).length - 1; if (n !== 1) throw new Error(p + ': anchor x' + n + ': ' + a.slice(0, 70)); t = t.replace(a, b); };

  // markup: the button sits over the middle of the small video
  rep(`      <button type="button" class="fpv__dock-dismiss" data-fpv-dismiss aria-label="Hide this video">&#215;</button>`,
`      {%- if section.settings.dock_sound -%}
        <button type="button" class="fpv__dock-sound" data-fpv-dock-sound aria-pressed="false" aria-label="Turn sound on">
          <svg class="fpv__ds-off" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9l4 6M21 9l-4 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <svg class="fpv__ds-on" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      {%- endif -%}
      <button type="button" class="fpv__dock-dismiss" data-fpv-dismiss aria-label="Hide this video">&#215;</button>`);

  // styles
  rep(`  #{{ fpv_id }} .fpv__dock-dismiss {`,
`  /* Sound button over the middle of the small video (optional). */
  #{{ fpv_id }} .fpv__dock-sound {
    position: absolute; left: 50%; top: 50%; z-index: 2;
    width: 38px; height: 38px; margin: -19px 0 0 -19px; padding: 0;
    border: 0; border-radius: 50%;
    background: rgba(0, 0, 0, .5); color: #fff;
    display: grid; place-items: center; cursor: pointer;
    -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, .25);
  }
  #{{ fpv_id }} .fpv__dock-sound:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  #{{ fpv_id }} .fpv__dock-sound .fpv__ds-on,
  #{{ fpv_id }} .fpv__dock-sound[aria-pressed="true"] .fpv__ds-off { display: none; }
  #{{ fpv_id }} .fpv__dock-sound[aria-pressed="true"] .fpv__ds-on { display: block; }
  @media (max-width: 749px) {
    #{{ fpv_id }} .fpv__dock-sound { width: 34px; height: 34px; margin: -17px 0 0 -17px; }
  }

  #{{ fpv_id }} .fpv__dock-dismiss {`);

  // script: toggle, hand the sound state to the big player, never play twice
  rep(`    dock.addEventListener('animationend', function (e) {`,
`    // Optional sound button on the small video.
    var dockSound = $('[data-fpv-dock-sound]');
    function syncDockSound() {
      if (!dockSound) return;
      var on = !dockVideo.muted;
      dockSound.setAttribute('aria-pressed', on ? 'true' : 'false');
      dockSound.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
    }
    if (dockSound && dockVideo) {
      dockSound.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dockVideo.muted = !dockVideo.muted;
        if (dockVideo.paused) { var pp = dockVideo.play(); if (pp && pp.catch) pp.catch(function () {}); }
        syncDockSound();
      });
      // Whenever the small player is hidden (closed, near the footer, big
      // player open), its sound goes off.
      new MutationObserver(function () {
        if (dock.hidden && !dockVideo.muted) { dockVideo.muted = true; syncDockSound(); }
      }).observe(dock, { attributes: true, attributeFilter: ['hidden'] });
    }

    dock.addEventListener('animationend', function (e) {`);

  // opening the big player: start with the small player's sound choice, pause the small one
  rep(`      setStatus('');
      video.muted = true;`,
`      setStatus('');
      var withSound = !!(dockSound && dockVideo && !dockVideo.muted);
      if (dockVideo) { dockVideo.pause(); dockVideo.muted = true; syncDockSound(); }
      video.muted = !withSound;`);

  // closing the big player: the small one carries on (muted)
  rep(`      dock.hidden = dockDismissed || atFooter;`,
`      dock.hidden = dockDismissed || atFooter;
      if (dockVideo && !dock.hidden) { var dp = dockVideo.play(); if (dp && dp.catch) dp.catch(function () {}); }`);

  // schema
  const sch = t.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  const j = JSON.parse(sch[1]);
  if (j.settings.some(s => s.id === 'dock_sound')) throw new Error(p + ' already has dock_sound');
  const at = j.settings.findIndex(s => s.id === 'dock_bottom');
  j.settings.splice(at + 1, 0, { type: 'checkbox', id: 'dock_sound', label: 'Show a sound button on the small video', info: 'A mute / unmute button in the middle of the small floating video. The video starts muted; one tap turns the sound on.', default: false });
  t = t.replace(sch[1], '\n' + JSON.stringify(j, null, 2) + '\n');
  fs.writeFileSync(p, t);
  console.log('ok', p.split(/[\\/]/).slice(-3).join('/'));
}
