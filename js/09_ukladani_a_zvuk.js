// Ukládání postupu a zvuky
// Část hry Dárek – načítá se v index.html v pořadí podle čísla.
'use strict';

// =====================================================================
// UKLÁDÁNÍ – localStorage může být zakázaný (soukromé okno, blokovaná
// data, některé prohlížeče u souborů z disku), proto vše v try/catch.
// Když nejde použít, hra normálně běží, jen si nic nepamatuje.
// =====================================================================
function storageGet(key) {
  try { return window.localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch (e) { /* nevadí */ }
}
function storageRemove(key) {
  try { window.localStorage.removeItem(key); } catch (e) { /* nevadí */ }
}

// Každý režim má vlastní uložení (hlavní hra / Vrah z učebny C109)
const saveKey = () => (state.mode === 'vrah' ? CONFIG.SAVE_KEY_VRAH : CONFIG.SAVE_KEY);
function saveProgress() {
  storageSet(saveKey(), JSON.stringify({
    quests: state.quests,
    tracked: state.tracked,
    money: state.money,
    bag: state.bag,
    story: state.story,
    vrah: state.vrah,
    speedrun: state.speedrun,   // časovač režimu Speedrun (28_speedrun.js), jinak null
  }));
}

// Načte uložený postup; vrací null, když není co nabídnout nebo jsou data neplatná
function loadProgress(key = CONFIG.SAVE_KEY) {
  const raw = storageGet(key);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const stages = ['none', 'assigned', 'carrying', 'done'];
    const quests = {};
    if (data.quests && typeof data.quests === 'object') {
      for (const q of QUESTS) if (stages.includes(data.quests[q.id])) quests[q.id] = data.quests[q.id];
    } else if (Number.isInteger(data.questIndex)) {   // starší uložení: úkoly šly po sobě
      QUESTS.forEach((q, i) => {
        if (i < data.questIndex) quests[q.id] = 'done';
        else if (i === data.questIndex && stages.includes(data.questStage)) quests[q.id] = data.questStage;
      });
    } else return null;
    if (!Object.values(quests).some((st) => st !== 'none') && !data.money && !(data.speedrun && data.speedrun.t > 0)) return null;   // nic rozehraného (rozběhnutý speedrun se ale nabídne)
    // Vrah: úkol „vrah“ je zadaný hned od začátku – rozehraný je až s postupem (jinak by na úvodu
    // pořád svítilo „Pokračovat ve Vrahovi“ i „Začít Vraha znovu“, i když hráč nic neudělal)
    const v = data.vrah;
    if (key === CONFIG.SAVE_KEY_VRAH && (!v || (v.stage === 'binkova1' && !(v.clues && v.clues.length))) && !data.money && !(data.speedrun && data.speedrun.t > 0)) return null;
    return {
      quests, tracked: typeof data.tracked === 'string' ? data.tracked : null,
      money: Number.isFinite(data.money) ? data.money : 0,
      bag: Array.isArray(data.bag) ? data.bag : [],
      story: data.story && typeof data.story === 'object' ? data.story : null,
      vrah: data.vrah && typeof data.vrah === 'object' ? data.vrah : null,
      speedrun: data.speedrun && Number.isFinite(data.speedrun.t) && data.speedrun.t >= 0 ? { t: data.speedrun.t } : null,
    };
  } catch (e) {
    return null;
  }
}

// =====================================================================
// ZVUK – krátká pípnutí přes Web Audio API a hudba na pozadí ze složky zvuky/
// =====================================================================
const audio = {
  ctx: null,
  muted: storageGet(CONFIG.MUTE_KEY) === '1',
  unlocked: false,   // hráč už klikl / zmáčkl klávesu (do té doby prohlížeč zvuk nepustí)
};

// Hudba ze souborů – vždy jen jedna skladba (audio.track):
//   main = hudba na pozadí (vybrané album popořadě dokola – musicPlaylist(), audio.mainIndex),
//   foos = u fotbálku (CONFIG.FOOS_MUSIC_FILE, hraje dokola).
// Tlačítko zvuku ji vypíná spolu s pípáním; když je hra schovaná (jiná záložka,
// zamčený mobil), ztichne. Hlavní hudba po fotbálku pokračuje, kde skončila.
const musicTracks = {};
// song = písnička od Mykyho (src se mění podle výběru, hraje jednou)
const firstMusic = CONFIG.MUSIC_ALBUMS.mix.songs[0].file;
// klus = Treplev v C202 u Tomáše Kluse (17_pribehy.js)
for (const [id, file] of [['main', firstMusic], ['foos', CONFIG.FOOS_MUSIC_FILE], ['song', firstMusic], ['klus', CONFIG.KLUS_MUSIC_FILE], ['panenky', CONFIG.PANENKY_MUSIC_FILE]]) {
  const a = new Audio(file);
  a.loop = true;
  a.volume = CONFIG.MUSIC_VOLUME;
  a.preload = 'auto';
  musicTracks[id] = a;
}
musicTracks.song.loop = false;
musicTracks.main.loop = false;   // po dohrání jde další skladba ze seznamu
musicTracks.panenky.loop = false;   // rytmická hra hraje písničku jednou od začátku
audio.mainIndex = 0;
audio.album = 'mix';
const music = musicTracks.main;
audio.track = 'main';
function updateMusic() {
  const allowed = audio.unlocked && !audio.muted && !document.hidden;
  for (const [id, a] of Object.entries(musicTracks)) {
    const play = allowed && id === audio.track;
    if (play && a.paused) a.play().catch(() => { /* soubor chybí nebo ho prohlížeč nepustil */ });
    else if (!play && !a.paused) a.pause();
  }
}
// Přepne skladbu; fromStart = pustit ji od začátku (fotbálek při každém otevření)
function setMusicTrack(id, fromStart) {
  if (fromStart) musicTracks[id].currentTime = 0;
  if (id === 'foos') audio.prevTrack = audio.track;   // po fotbálku se vrátí, co hrálo předtím
  audio.track = id;
  updateMusic();
}

// Písnička od Mykyho: hraje jednou místo hudby na pozadí, po dohrání se vrátí hlavní hudba
function playSong(song) {
  const a = musicTracks.song;
  a.pause();
  a.src = song.file;
  a.currentTime = 0;
  audio.songName = song.name;
  state.toast = { text: '♪ Hraje: ' + song.name, t: CONFIG.TOAST_TIME };
  setMusicTrack('song');
}
musicTracks.song.addEventListener('ended', () => {
  if (audio.track !== 'song') return;
  setMusicTrack('main');
  state.toast = { text: 'Písnička dohrála', t: CONFIG.TOAST_TIME };
});
musicTracks.song.addEventListener('error', () => {   // soubor písničky ve složce zvuky/ chybí
  if (audio.track !== 'song') return;
  setMusicTrack('main');
  state.toast = { text: 'Tahle písnička ve hře zatím není', t: CONFIG.TOAST_TIME };
});
document.addEventListener('visibilitychange', updateMusic);

// Písničky vybraného alba; do Mixu se po sluchátkách od Mykyho přidají jeho tři (ne do Red Hotů)
function musicPlaylist() {
  const album = CONFIG.MUSIC_ALBUMS[audio.album] || CONFIG.MUSIC_ALBUMS.mix;
  const myky = audio.album === 'mix' && state.story && state.story.headphones ? TEACHERS.myky.songs : [];
  return album.songs.concat(myky);
}
const currentSong = () => { const l = musicPlaylist(); return l[audio.mainIndex] || l[0]; };
// Přepne album a pustí jeho první písničku
function setAlbum(id) {
  audio.album = id;
  audio.mainFails = 0;
  playMainTrack(0);
  if (audio.track !== 'main') setMusicTrack('main');
  state.toast = { text: `💿 Album: ${CONFIG.MUSIC_ALBUMS[id].name}`, t: CONFIG.TOAST_TIME };
}
// Hudba na pozadí: přepne na skladbu i ze seznamu (od začátku)
function playMainTrack(i) {
  const list = musicPlaylist();
  audio.mainIndex = ((i % list.length) + list.length) % list.length;
  const a = musicTracks.main;
  a.pause();
  a.src = list[audio.mainIndex].file;
  updateMusic();
}
// Tlačítko / klávesa N: další skladba; když hraje písnička od Mykyho, skončí a jde další hudba
function nextMusic() {
  audio.mainFails = 0;
  playMainTrack(audio.mainIndex + 1);
  if (audio.track !== 'main') setMusicTrack('main');   // písnička od Mykyho / Treplev skončí
}
musicTracks.main.addEventListener('ended', () => playMainTrack(audio.mainIndex + 1));
musicTracks.main.addEventListener('error', () => {   // soubor chybí – zkusí další (jednou dokola)
  audio.mainFails = (audio.mainFails || 0) + 1;
  if (audio.mainFails < musicPlaylist().length) playMainTrack(audio.mainIndex + 1);
});
musicTracks.main.addEventListener('playing', () => { audio.mainFails = 0; });
const musicButton = () => (state.screen === 'title' ? CONFIG.MUSIC_BUTTON_TITLE : CONFIG.MUSIC_BUTTON);
const musicButtonShown = () => state.screen === 'title' || state.screen === 'playing';
// Ťuknutí na tlačítko hudby vyřadí z fronty, aby se nepočítalo jako herní akce
function takeMusicTaps() {
  if (!musicButtonShown()) return;
  input.events = input.events.filter((ev) => {
    const hit = ev.type === 'tap' && ev.x !== null && pointInRect(ev.x, ev.y, musicButton(), 4);
    if (hit) toggleMusicMenu();
    return !hit;
  });
}
// Tlačítko nahoře: co právě hraje (písnička od Mykyho zeleně), ťuknutí otevře seznam písniček
function drawMusicButton() {
  if (!musicButtonShown()) return;
  const b = musicButton();
  roundRectPath(b.x, b.y, b.w, b.h, 6);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  const song = audio.track === 'song' ? audio.songName : audio.track === 'klus' ? CONFIG.KLUS_MUSIC_NAME
    : audio.track === 'panenky' ? CONFIG.PANENKY_MUSIC_NAME : null;
  let name = '♪ ' + (song || currentSong().name);
  ctx.font = 'bold 12px sans-serif';
  const maxW = b.w - 30;
  if (ctx.measureText(name).width > maxW) {   // dlouhý název zkrátit
    while (name.length > 3 && ctx.measureText(name + '…').width > maxW) name = name.slice(0, -1);
    name += '…';
  }
  ctx.globalAlpha = audio.muted ? 0.5 : 1;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = song ? '#8fd18f' : '#ffffff';
  ctx.fillText(name, b.x + 8, b.y + b.h / 2 + 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd54a';
  ctx.fillText('☰', b.x + b.w - 13, b.y + b.h / 2 + 1);
  ctx.globalAlpha = 1;
}

// Prohlížeče povolí zvuk až po akci uživatele, proto se AudioContext
// vytváří/probouzí přímo v obsluze kliknutí a klávesy
function unlockAudio() {
  try {
    if (!audio.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
    }
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
  } catch (e) { /* bez zvuku */ }
  if (!audio.unlocked) {
    // iPhone pustí zvuk jen z kliknutí – ostatní skladby se proto hned „odemknou“
    // krátkým ztlumeným přehráním, ať pak půjdou zapnout i mimo kliknutí (fotbálek)
    for (const [id, a] of Object.entries(musicTracks)) {
      if (id === audio.track) continue;
      a.muted = true;
      a.play().then(() => { if (id !== audio.track) a.pause(); a.muted = false; }).catch(() => { a.muted = false; });
    }
  }
  audio.unlocked = true;
  updateMusic();   // hudba se smí spustit jen přímo z kliknutí / klávesy
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (CONFIG.MUTE_KEYS.includes(e.code) && !e.repeat) toggleMute();
  if (CONFIG.MUSIC_NEXT_KEYS.includes(e.code) && !e.repeat && musicButtonShown()) nextMusic();
});

function playSound(notes, wave = CONFIG.SOUND_WAVE) {
  const c = audio.ctx;
  if (!c || audio.muted) return;
  try {
    for (const [freq, start, dur] of notes) {
      const t0 = c.currentTime + start;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, t0);
      // krátký náběh a doznění, ať to nelupe
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(CONFIG.SOUND_VOLUME, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
  } catch (e) { /* bez zvuku */ }
}

function toggleMute() {
  audio.muted = !audio.muted;
  storageSet(CONFIG.MUTE_KEY, audio.muted ? '1' : '0');
  updateMusic();
}

// Ťuknutí na tlačítko zvuku vyřadí z fronty, aby se nepočítalo jako herní akce
function takeMuteTaps() {
  input.events = input.events.filter((ev) => {
    const hit = ev.type === 'tap' && ev.x !== null && pointInRect(ev.x, ev.y, CONFIG.MUTE_BUTTON, 4);
    if (hit) toggleMute();
    return !hit;
  });
}

function drawMuteButton() {
  const b = CONFIG.MUTE_BUTTON;
  roundRectPath(b.x, b.y, b.w, b.h, 6);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  // reproduktor
  const x = b.x + 7;
  const cy = b.y + b.h / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x, cy - 4);
  ctx.lineTo(x + 5, cy - 4);
  ctx.lineTo(x + 11, cy - 9);
  ctx.lineTo(x + 11, cy + 9);
  ctx.lineTo(x + 5, cy + 4);
  ctx.lineTo(x, cy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (audio.muted) {
    // křížek
    ctx.moveTo(x + 14, cy - 5); ctx.lineTo(x + 21, cy + 5);
    ctx.moveTo(x + 21, cy - 5); ctx.lineTo(x + 14, cy + 5);
  } else {
    // vlnky
    ctx.arc(x + 12, cy, 5, -Math.PI / 4, Math.PI / 4);
    ctx.moveTo(x + 12 + 9 * Math.cos(-Math.PI / 4), cy + 9 * Math.sin(-Math.PI / 4));
    ctx.arc(x + 12, cy, 9, -Math.PI / 4, Math.PI / 4);
  }
  ctx.stroke();
}
