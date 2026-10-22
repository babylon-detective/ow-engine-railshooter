// The cursor and the screen flash live in a DOM layer over the engine's
// canvases, the way oskiewar's own SVG cursor sits over its UI: the browser
// draws it at the page's own pixels, pointer events move it directly, and it
// never stretches with the stage. The flash uses CSS opacity, which the v1
// api has no way to do (see WANTS.md, "Sprites and alpha").
const CSS = `
html.ic-nocursor, html.ic-nocursor * { cursor: none !important; }
#ic-layer { position: fixed; inset: 0; pointer-events: none; z-index: 50; overflow: hidden; contain: strict; }
#ic-flash { position: absolute; inset: 0; opacity: 0; background: #fff; }
#ic-cursor { position: absolute; left: 0; top: 0; width: 0; height: 0; will-change: transform; }
#ic-cursor svg { position: absolute; left: -60px; top: -60px; width: 120px; height: 120px; overflow: visible; }
#ic-cursor .sh { fill: none; stroke: #000; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; }
#ic-cursor .ln { fill: none; stroke: #0ff; stroke-width: 4.5; stroke-linecap: round; stroke-linejoin: round; transition: stroke .08s; }
#ic-cursor .m .ln { stroke-width: 5; }
#ic-cursor .t, #ic-cursor .br, #ic-cursor .tk { transition: transform .14s ease-out; }
#ic-cursor[data-mode=menu] .a, #ic-cursor[data-mode=active] .a,
#ic-cursor[data-mode=aim] .m, #ic-cursor[data-mode=lock] .m,
#ic-cursor[data-mode=hidden] svg, #ic-cursor.gone svg { display: none; }
#ic-cursor[data-mode=active] .t { transform: scale(1.32); }
#ic-cursor[data-mode=active] .m .ln { stroke: #fff; }
#ic-cursor[data-mode=lock] .ln { stroke: #ff3048; }
#ic-cursor[data-mode=lock] .br { transform: rotate(45deg) scale(.66); }
#ic-cursor[data-mode=lock] .tk { transform: scale(.8); }
#ic-cursor .x { opacity: 0; }
#ic-cursor .x .ln { stroke: #ff3048; }
`;

const SVG = `<svg viewBox="-60 -60 120 120" xmlns="http://www.w3.org/2000/svg">
  <g class="m"><g class="t">
    <path class="sh" transform="translate(1.6 1.6)" d="M0 -22V-12 M0 12V22 M-22 0H-12 M12 0H22"/>
    <path class="ln" d="M0 -22V-12 M0 12V22 M-22 0H-12 M12 0H22"/>
  </g>
    <circle cx="1.6" cy="1.6" r="4" fill="#000"/><circle r="4" fill="#fff"/>
  </g>
  <g class="a"><g class="k">
    <g class="br">
      <path class="sh" transform="translate(1.6 1.6)" d="M-38 -22V-38H-22 M22 -38H38V-22 M38 22V38H22 M-22 38H-38V22"/>
      <path class="ln" d="M-38 -22V-38H-22 M22 -38H38V-22 M38 22V38H22 M-22 38H-38V22"/>
    </g>
    <g class="tk">
      <path class="sh" transform="translate(1.6 1.6)" d="M0 -28V-14 M0 14V28 M-28 0H-14 M14 0H28"/>
      <path class="ln" d="M0 -28V-14 M0 14V28 M-28 0H-14 M14 0H28"/>
    </g>
    <circle cx="1.6" cy="1.6" r="4.5" fill="#000"/><circle r="4.5" fill="#fff"/>
  </g>
  <g class="x">
    <path class="sh" transform="translate(1.6 1.6)" d="M-20 -20L-9 -9 M20 -20L9 -9 M-20 20L-9 9 M20 20L9 9"/>
    <path class="ln" d="M-20 -20L-9 -9 M20 -20L9 -9 M-20 20L-9 9 M20 20L9 9"/>
  </g></g>
</svg>`;

const ui = { layer: null, cur: null, flash: null, kick: null, hit: null, mode: '', follow: 'mouse', flashAnim: null };

function place(x, y) {
  ui.cur.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  ui.cur.classList.remove('gone');
}

export function installOverlay() {
  if (typeof document === 'undefined' || ui.layer) return;
  document.getElementById('ic-layer')?.remove();
  document.getElementById('ic-style')?.remove();
  const style = document.createElement('style');
  style.id = 'ic-style';
  style.textContent = CSS;
  document.head.append(style);
  ui.layer = document.createElement('div');
  ui.layer.id = 'ic-layer';
  ui.flash = document.createElement('div');
  ui.flash.id = 'ic-flash';
  ui.cur = document.createElement('div');
  ui.cur.id = 'ic-cursor';
  ui.cur.className = 'gone';
  ui.cur.innerHTML = SVG;
  ui.kick = ui.cur.querySelector('.k');
  ui.hit = ui.cur.querySelector('.x');
  ui.layer.append(ui.flash, ui.cur);
  document.body.append(ui.layer);
  document.documentElement.classList.add('ic-nocursor');
  const follow = e => { ui.follow = 'mouse'; place(e.clientX, e.clientY); };
  addEventListener('pointermove', follow, { passive: true });
  addEventListener('pointerdown', follow, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => ui.cur.classList.add('gone'));
  setMode('menu');
}

// 'menu' (the precise crosshair), 'active' (it opens over something you can
// press), 'aim' (the play reticle), 'lock' (an enemy under it), 'hidden'.
export function setMode(mode) {
  if (!ui.cur || mode === ui.mode) return;
  ui.mode = mode;
  ui.cur.dataset.mode = mode;
}

// A pad's stick moves the reticle in stage units; the mouse moves it itself.
export function padAim(api, x, y) {
  if (!ui.cur) return;
  const { width, height } = api.view();
  ui.follow = 'pad';
  place(x / width * innerWidth, y / height * innerHeight);
}
export const following = () => ui.follow;

export function flash(rgb, opacity = .3, ms = 120) {
  if (!ui.flash) return;
  ui.flashAnim?.cancel();
  ui.flash.style.background = `rgb(${rgb.join(',')})`;
  ui.flashAnim = ui.flash.animate([{ opacity }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
}

export function recoil() {
  ui.kick?.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 130, easing: 'ease-out' });
}

export function hitMarker() {
  ui.hit?.animate([{ opacity: 1, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1.15)', offset: .35 }, { opacity: 0, transform: 'scale(1.3)' }],
    { duration: 300, easing: 'ease-out' });
}
