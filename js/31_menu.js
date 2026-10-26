// Nabídka „Pozastaveno / Hlavní menu“ ve hře (tlačítko ☰ vedle inventáře nebo Esc)
// Část hry Dárek – načítá se v index.html po 30_kvalita.js a před 15_hlavni.js.
// Od kamaráda (větev mptest, tam v 29_online.js), napojené na 29_multiplayer.js.
'use strict';

// =====================================================================
// HLAVNÍ MENU VE HŘE – hra stojí (i časovač speedrunu), postup se uloží.
// Online a kvalita se přepínají přímo tady a nabídka zůstane otevřená.
// =====================================================================
const MENU_BUTTON = { x: 596, y: 6, w: 34, h: 30 };   // ve hře vedle inventáře
state.pauseMenu = null;                                // otevřená nabídka { sel }

const pauseItems = () => [
  { id: 'resume', label: '▶ Pokračovat' },
  ...(mpReady() ? [{ id: 'online', label: `👥 Online: ${mp.on ? 'ZAP' : 'VYP'}` }] : []),   // 29_multiplayer.js
  ...voicePauseItems(),                                                                     // 🎤 hlas a ztlumení hráčů (34_hlas.js)
  ...amongPauseItems(),                                                                     // Among Us: ukončit kolo (36_among.js)
  { id: 'quality', label: qualityLabel() },                                                  // 30_kvalita.js
  { id: 'menu', label: '🏠 Hlavní menu' },
];
const pausePanel = () => { const h = 100 + pauseItems().length * 62; return { x: 250, y: Math.round(CONFIG.HEIGHT / 2 - h / 2), w: 300, h }; };
const pauseRows = () => { const P = pausePanel(); return pauseItems().map((it, i) => ({ x: P.x + 20, y: P.y + 70 + i * 62, w: P.w - 40, h: 52 })); };

function canOpenPause() {
  return state.screen === 'playing' && !state.transition && !state.pauseMenu && !!state.room && !state.room.shop
    && !(state.musicMenu || state.songMenu || state.map || state.catalog || state.inventory || state.wires || state.sticker || state.labTask || state.board || state.dialog);
}
function takeMenuButtonTaps() {
  if (state.screen !== 'playing' || state.transition || state.pauseMenu) return;
  input.events = input.events.filter((ev) => {
    const hit = ev.type === 'tap' && ev.x !== null && pointInRect(ev.x, ev.y, MENU_BUTTON, 4);
    if (hit) state.pauseMenu = { sel: 0 };
    return !hit;
  });
}
function drawMenuButton() {
  if (state.screen !== 'playing') return;
  const b = MENU_BUTTON;
  roundRectPath(b.x, b.y, b.w, b.h, 6);
  ctx.fillStyle = state.pauseMenu ? 'rgba(255, 213, 74, 0.9)' : 'rgba(0, 0, 0, 0.45)'; ctx.fill();
  ctx.fillStyle = state.pauseMenu ? '#2b1d14' : '#ffffff';
  for (let k = 0; k < 3; k++) ctx.fillRect(b.x + 9, b.y + 8 + k * 6, 16, 3);   // ikonka ☰
}
function pauseMenuEvents(events) {
  const m = state.pauseMenu;
  for (const ev of events) {
    let i = null;
    if (ev.type === 'action') i = m.sel;
    else if (ev.x != null) {
      const hit = pauseRows().findIndex((r) => pointInRect(ev.x, ev.y, r, 0));
      if (hit >= 0) i = hit;
      else if (!pointInRect(ev.x, ev.y, pausePanel(), 0)) { state.pauseMenu = null; return; }   // ťuknutí mimo = zpět do hry
    }
    if (i === null) continue;
    const item = pauseItems()[i];
    if (item.id === 'online') { setOnline(!mp.on); m.sel = i; continue; }       // zapnout / vypnout online, nabídka zůstane
    if (voicePauseAction(item.id)) { m.sel = i; continue; }                     // hlas zap/vyp, ztlumit hráče
    if (amongPauseAction(item.id)) return;                                      // Among Us: ukončit kolo
    if (item.id === 'quality') { toggleQuality(); m.sel = i; continue; }        // výchozí / nízká kvalita
    state.pauseMenu = null;
    if (item.id === 'menu') { saveProgress(); goToTitle(); }   // postup (i čas speedrunu) se uloží, v menu je „Pokračovat“
    return;
  }
}
// Esc otevře / zavře nabídku (zachytí se dřív než ostatní okna, aby je Esc nezavřel a hned otevřel menu)
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || e.repeat) return;
  if (state.pauseMenu) state.pauseMenu = null;
  else if (canOpenPause()) state.pauseMenu = { sel: 0 };
}, true);
window.addEventListener('keydown', (e) => {
  if (!state.pauseMenu) return;
  if (KEYMAP.up.includes(e.code)) state.pauseMenu.sel = Math.max(0, state.pauseMenu.sel - 1);
  else if (KEYMAP.down.includes(e.code)) state.pauseMenu.sel = Math.min(pauseItems().length - 1, state.pauseMenu.sel + 1);
});
function drawPauseMenu() {
  const m = state.pauseMenu;
  if (!m) return;
  const P = pausePanel();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(-VIEW.offX, 0, CONFIG.WIDTH + 2 * VIEW.offX, CONFIG.HEIGHT);
  roundRectPath(P.x, P.y, P.w, P.h, 14);
  ctx.fillStyle = '#f4ecd8'; ctx.fill();
  ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 4; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 21px sans-serif'; ctx.fillStyle = '#3b2a1c';
  ctx.fillText('Pozastaveno', P.x + P.w / 2, P.y + 36);
  pauseRows().forEach((r, i) => {
    roundRectPath(r.x, r.y, r.w, r.h, 10);
    const it = pauseItems()[i];
    ctx.fillStyle = i === m.sel && !isTouchHint() ? '#ffe9a8' : (it.id === 'online' && mp.on) || (it.id === 'voice' && voice.on) ? '#d9f2d9' : '#fffaf0'; ctx.fill();
    ctx.strokeStyle = 'rgba(59, 42, 28, 0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = 'bold 17px sans-serif'; ctx.fillStyle = '#2b1d14'; ctx.textAlign = 'center';
    ctx.fillText(it.label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  });
  ctx.font = '12px sans-serif'; ctx.fillStyle = '#6d5a48';
  ctx.fillText(isTouchHint() ? 'Postup se uloží' : 'Šipky + mezerník, Esc = zpět do hry', P.x + P.w / 2, P.y + P.h - 16);
}
