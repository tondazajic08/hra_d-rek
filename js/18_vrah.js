// Režim „Vrah z učebny C109“ – samostatný příběh, zapíná se na úvodní obrazovce
// Část hry Dárek – načítá se v index.html v pořadí podle čísla.
'use strict';

// =====================================================================
// REŽIM VRAH – state.mode === 'vrah'. Má vlastní uložení (CONFIG.SAVE_KEY_VRAH),
// vlastní úkol (QUESTS.vrah, mode: 'vrah') a postavy na jiných místech než
// v hlavní hře: Binková s Mišákem v kabinetu 5, Holub chodí s kafem po chodbě
// Céčka ve 3. patře a jeho kabinet je Kabinet 7 (nad Kabinetem 4, chodba s C308).
//
// Postup (state.vrah.stage):
//   binkova1  – zajít za Binkovou (kabinet 5), dá klíč od C109
//   stopy     – v C109 najít 3 stopy (otisk boty, kousek dortu, zmuchlaný papír)
//   binkova2  – vrátit se; Mišák chce logo Slávie na Holubův kabinet
//   logo      – nalepit logo na dveře Kabinetu 4, když se Holub nedívá
//   binkova3  – vrátit se; Binková chce Lektvar Zelené Karmy
//   krivacek  – Křiváček (kabinet 2) dá na výběr: tequila a Dvě panenky, nebo laborka (3. fáze)
//   tequila   – školník (dolní šatny) dá tequilu jen za klíče od kotelny
//   klice     – klíče má uklízečka (hala ve 2. patře Céčka), dá je za vytření chodby
//   mamKlice  – klíče nést školníkovi
//   panenky   – s tequilou zpátky ke Křiváčkovi a zahrát mu Dvě panenky (rytmická hra)
//   laborka   – (druhá možnost) vloupání do laborky A114: small talk, kód skříně, pipeta,
//               vrátit lahvičky; Lukášková hlídá (stealth). Chycen → Kabinet věčnosti (kvíz),
//               prohra = game over. Pak Křiváček namíchá lektvar.
//   lektvar   – s lektvarem do kabinetu 5 → finále
// =====================================================================
const VRAH = {
  OFFICE: 'kabinet5',          // kabinet Binkové
  HOLUB_DOOR: 'kabinet7',      // Holubův kabinet (3. patro Céčka, nad Kabinetem 4)
  CORRIDOR: 'cecko3',          // chodba, kde Holub chodí s kafem (stejný tvar jako v 1. patře)
  CRIME: 'c109',
};
state.mode = null;    // null = hlavní hra, 'vrah' = tenhle příběh
state.vrah = null;
const vrahOn = () => state.mode === 'vrah';
const ROMAN = { name: 'Roman', color: CONFIG.PLAYER_COLOR };

// Výchozí místa postav z hlavní hry – po návratu do hlavní hry se vrátí
const VRAH_CAST = ['holub', 'binkova', 'misak', 'krivacek', 'lukaskova'];
const CAST_HOME = Object.fromEntries(VRAH_CAST.map((id) => {
  const t = TEACHERS[id];
  return [id, { room: t.room, at: { ...t.at }, minigame: t.minigame, look: { ...t.look } }];
}));
function placeStatic(t, room, at) {
  Object.assign(t, { route: null, arrived: false, room, at: { ...at } });
  t.rect = rectInRoom(ROOMS[room], t.at, CONFIG.TEACHER_W, CONFIG.TEACHER_H);
}
// Holub v režimu: s hrnkem kafe tam a zpátky po chodbě Céčka (od svého kabinetu na konec)
// po chodbě ve 3. patře (od kabinetu na konec a zpátky ke schodům) a dolů do haly ve 2. patře
const HOLUB_ROUTE = [
  { room: VRAH.CORRIDOR, path: [[60, 50], [150, 56], [420, 72], [730, 72], [420, 72], [180, 100], [180, 385]] },
  { room: 'cecko2', path: [[180, 262], [180, 420], [90, 420], [330, 420]] },
];
function holubWalks() {
  const t = TEACHERS.holub;
  Object.assign(t, { route: HOLUB_ROUTE, once: false, arrived: false, speed: 60, pause: 1.5,
    seg: 0, pt: 1, dirStep: 1, wait: 0, walkPhase: 0, walkBlend: 0, face: null, _last: null,
    pos: { x: HOLUB_ROUTE[0].path[0][0], y: HOLUB_ROUTE[0].path[0][1] } });
  placeMovingTeacher(t);
}

function newVrah() {
  return { stage: 'binkova1', clues: [], stars: 0, sus: 0, said: 0 };
}
// Nová / načtená hra (resetGame): v režimu postavy na místa z příběhu, jinak zpátky domů
function applyVrah(progress) {
  state.scene = null;
  state.sticker = null;
  for (const id of VRAH_CAST) {
    const t = TEACHERS[id], home = CAST_HOME[id];
    t.look = { ...home.look };
    t.minigame = home.minigame;
    placeStatic(t, home.room, home.at);
  }
  state.vrah = null;
  state.choice = state.mop = state.rhythm = null;
  state.lab = null; state.labTask = null; state.quiz = null; state.gameOver = null; state.follow = null;
  for (const id of VRAH_ONLY) Object.assign(TEACHERS[id], { room: null, rect: null });   // v hlavní hře nejsou
  if (!vrahOn()) return;
  placeStatic(TEACHERS.skolnik, 'satnyDole', { x: 0.3, y: 0.75 });   // pod prostředními skříňkami
  placeStatic(TEACHERS.uklizecka, 'cecko2', { x: 378 / 420, y: 470 / 528 });   // vpravo dole, mimo vytíranou plochu
  state.vrah = { ...newVrah(), ...(progress && progress.vrah ? progress.vrah : {}) };
  state.quests.vrah = state.vrah.stage === 'konec' ? 'done' : 'assigned';
  state.tracked = 'vrah';
  placeStatic(TEACHERS.binkova, VRAH.OFFICE, { x: 0.5, y: 0.15 });
  placeStatic(TEACHERS.misak, VRAH.OFFICE, { x: 0.13, y: 0.2 });
  TEACHERS.holub.minigame = null;
  TEACHERS.holub.look.mug = true;
  if (state.vrah.stage === 'laborka') startFollow();
  if (state.vrah.stage === 'konec') { placeStatic(TEACHERS.holub, VRAH.OFFICE, { x: 0.3, y: 0.62 }); TEACHERS.holub.look.green = 1; }
  else holubWalks();
}
// Kde režim začíná: na chodbě Céčka před kabinetem Binkové
function vrahStart() {
  const door = ROOMS[VRAH.OFFICE].doors[0];
  enterRoom(door.to, door.spawn ? { x: door.spawn.x, y: door.spawn.y } : undefined);
  if (state.vrah.stage === 'binkova1') state.toast = { text: '🔍 Binková tě shání – je u sebe v kabinetu.', t: CONFIG.TOAST_TIME + 3 };
}
const VRAH_STAGES = ['binkova1', 'stopy', 'binkova2', 'logo', 'binkova3', 'krivacek', 'tequila', 'klice', 'mamKlice', 'panenky', 'laborka', 'lektvar', 'konec'];
const stageAtLeast = (stage) => state.vrah && VRAH_STAGES.indexOf(state.vrah.stage) >= VRAH_STAGES.indexOf(stage);
function setVrahStage(stage) {
  state.vrah.stage = stage;
  saveProgress();
}

// Text úkolu v liště a v katalogu podle postupu
function vrahHint() {
  const v = state.vrah;
  if (!v) return '';
  return {
    binkova1: 'Zajdi za Binkovou do jejího kabinetu (Kabinet Binková a Kučerová)',
    stopy: `Najdi v C109 stopy (${v.clues.length}/3)`,
    binkova2: 'Vrať se se stopami za Binkovou (Kabinet Binková a Kučerová)',
    logo: 'Nalep logo Slávie na Holubův kabinet (Kabinet Holuba), až se nedívá',
    binkova3: 'Vrať se za Binkovou a Mišákem (Kabinet Binková a Kučerová)',
    krivacek: 'Zajdi za Křiváčkem (Kabinet Křiváček) pro Lektvar Zelené Karmy',
    tequila: 'Sežeň jahodovou tequilu – má ji školník (ve skříňkách dole)',
    klice: 'Klíče od kotelny má uklízečka – najdi ji',
    mamKlice: 'Dones klíče od kotelny školníkovi (ve skříňkách dole)',
    panenky: 'Dones Křiváčkovi tequilu a zahraj mu Dvě panenky (Kabinet Křiváček)',
    laborka: labHint(),
    lektvar: 'Přines lektvar do kabinetu Binkové (Kabinet Binková a Kučerová)',
    konec: 'Hotovo',
  }[v.stage];
}
questById('vrah').hint = vrahHint;

// =====================================================================
// SCÉNY – rozhovory víc postav za sebou. Krok je { who, text } (dialog),
// { act: fn } (něco se stane) nebo { wait: s } (pauza na animaci).
// Na konci se zavolá onEnd. Dialog se zavírá jako obvykle (06_logika.js → sceneNext).
// =====================================================================
function playScene(steps, onEnd) {
  state.scene = { steps: steps.slice(), onEnd, wait: 0 };
  sceneNext();
}
// Další krok scény; true = scéna pokračuje (nový dialog nebo pauza)
function sceneNext() {
  const sc = state.scene;
  if (!sc) return false;
  while (sc.steps.length) {
    const st = sc.steps.shift();
    if (st.act) { st.act(); continue; }
    if (st.wait) { sc.wait = st.wait; return true; }
    const who = st.who || ROMAN;
    state.dialog = { name: who.name, color: who.color, text: st.text };
    return true;
  }
  state.scene = null;
  if (sc.onEnd) sc.onEnd();
  if (state.screen === 'playing') saveProgress();   // po každém rozhovoru uložit (půjčky od Mály, hádanky…)
  return !!state.dialog;
}
function updateScene(dt) {
  const sc = state.scene;
  if (!sc || !sc.wait || state.dialog) return;
  sc.wait -= dt;
  if (sc.wait <= 0) { sc.wait = 0; sceneNext(); }
}

// =====================================================================
// ROZHOVORY V REŽIMU
// =====================================================================
const B = () => TEACHERS.binkova, M = () => TEACHERS.misak, H = () => TEACHERS.holub, K = () => TEACHERS.krivacek;
function talkOffice() {   // Binková i Mišák v kabinetu – co se řekne, záleží na postupu
  const v = state.vrah;
  if (v.stage === 'binkova1') {
    playScene([
      { who: B(), text: 'Pojď dál, Romane. Někdo mi v C109 rozbil Ferdinanda. Dvanáct let jsem ho zalévala!' },
      { who: B(), text: 'Nevím, kdo to byl. Ale Mišák tvrdí, že to ví.' },
      { who: M(), text: 'Vím. Ale nic není zadarmo.' },
      { who: B(), text: 'Tady máš klíč od C109. Prohlédni to tam, třeba najdeš nějaké stopy.' },
    ], () => { setVrahStage('stopy'); state.toast = { text: '🔑 Máš klíč od C109', t: CONFIG.TOAST_TIME + 2 }; });
  } else if (v.stage === 'stopy') {
    playScene([{ who: B(), text: `Tak co, Romane? Našel jsi v C109 něco? Zatím máš ${v.clues.length} ze 3 stop.` }]);
  } else if (v.stage === 'binkova2') {
    playScene([
      { who: B(), text: 'Otisk boty, kousek dortu a zmuchlaný papír… Tohle je na mě moc. Mišáku?' },
      { who: M(), text: 'Holub mi zabavil šálu. Nalep mu na kabinet logo Slávie a řeknu ti, kdo to byl.' },
      { who: M(), text: 'Samolepku máš tady. Holub bývá u sebe v kabinetu. A bacha, chodí kolem s kafem.' },
    ], () => { setVrahStage('logo'); state.toast = { text: '⭐ Máš samolepku Slávie', t: CONFIG.TOAST_TIME }; });
  } else if (v.stage === 'logo') {
    playScene([{ who: M(), text: 'Logo Slávie na Holubův kabinet. Rovně a bez bublin, jo? Jinak nic.' }]);
  } else if (v.stage === 'binkova3') {
    playScene([
      { who: M(), text: `Krásný${v.stars >= 3 ? ', ani bublinka' : ''}. Řeknu ti to… ale až budeš mít něco, čím Binková toho člověka potrestá.` },
      { who: B(), text: 'Lektvar Zelené Karmy! Kdo ho vypije, týden vypadá jako kytka. Umí ho jen Křiváček.' },
      { who: B(), text: 'Křiváček je u sebe v kabinetu.' },
    ], () => setVrahStage('krivacek'));
  } else if (v.stage === 'krivacek') {
    playScene([{ who: B(), text: 'Bez lektvaru od Křiváčka se nehneme. Je u sebe v kabinetu.' }]);
  } else if (v.stage === 'lektvar') {
    finale();
  } else {
    playScene([{ who: B(), text: 'Ferdinand II. ti roste krásně. Díky, detektive.' }]);
  }
  return true;
}
TEACHERS.binkova.talk = () => vrahOn() && talkOffice();
TEACHERS.misak.talk = () => vrahOn() && talkOffice();
TEACHERS.holub.talk = () => {
  if (!vrahOn()) return false;
  const v = state.vrah;
  if (v.stage === 'konec') playScene([{ who: H(), text: 'Nemluv na mě. Fotosyntetizuju.' }]);
  else if (stageAtLeast('binkova3')) playScene([{ who: H(), text: 'Kdo mi nalepil na kabinet Slávii?! Až ho najdu…' }]);
  else playScene([{ who: H(), text: 'Co tu chceš? Nevidíš, že nesu kafe?' }]);
  return true;
};
TEACHERS.krivacek.talk = () => {
  if (!vrahOn()) return false;
  const st = state.vrah.stage;
  if (st === 'krivacek') {
    playScene([
      { who: K(), text: 'Lektvar Zelené Karmy? To je zakázaná biologie, Romane.' },
      { who: K(), text: 'Udělám ho, ale nic není zadarmo. Vyber si.' },
    ], krivacekChoice);
  } else if (st === 'panenky') {
    playScene([{ who: K(), text: 'Jahodová tequila! No ne. A teď Dvě panenky – kytaru máš tady. Do rytmu, Romane.' }], startRhythm);
  } else if (st === 'laborka') {
    if (state.lab && state.lab.done) labPotion();
    else if (!state.lab || !state.lab.talked) { playScene([{ who: K(), text: 'Tak jdeme do laborky. Jdu za tebou.' }]); startFollow(); }
    else playScene([{ who: K(), text: 'Já ji zabavil, teď je to na tobě. Kód, pipeta, lahvičky – a pak za mnou.' }]);
  } else if (['tequila', 'klice', 'mamKlice'].includes(st)) {
    playScene([{ who: K(), text: 'Bez jahodové tequily nic. Školník ji má zabavenou z lyžáku.' }]);
  } else {
    playScene([{ who: K(), text: stageAtLeast('lektvar') ? 'Lektvar máš. A nikde jsi mě neviděl.' : 'Zdravím, Romane. Teď nemám čas, chystám pokusy.' }]);
  }
  return true;
};
function krivacekChoice() {
  openChoice('Co uděláš pro Křiváčka?', [
    { label: '🍓 Sehnat tequilu a zahrát Dvě panenky' },
    { label: '🧪 Vloupat se do laborky' },
  ], (i) => {
    if (i === 0) {
      playScene([{ who: K(), text: 'Sežeň mi jahodovou tequilu a zahraj mi Dvě panenky. Pak se uvidí.' }], () => setVrahStage('tequila'));
    } else {
      playScene([
        { who: K(), text: 'Ingredience jsou v chemické laborce u Lukáškové. Pojď, jdu s tebou.' },
        { who: K(), text: 'Já ji zabavím, ty to vybereš. Ale jestli tě chytí, já tě neznám.' },
      ], () => { setVrahStage('laborka'); startFollow(); });
    }
  });
}

// --- Finále: Holub vtrhne do kabinetu, Binková mu vylije lektvar do kafe, Holub zezelená
function finale() {
  const holub = H();
  playScene([
    { who: M(), text: 'Byl to Holub. Honil mě v C109 kvůli šále, zakopl a shodil Ferdinanda.' },
    { act: () => { placeStatic(holub, VRAH.OFFICE, { x: 0.3, y: 0.62 }); holub.look.mug = true; refreshRoom(); playSound([[200, 0, 0.08], [160, 0.1, 0.12]]); } },
    { who: holub, text: 'KDO MI NALEPIL NA KABINET SLÁVII?!' },
    { who: B(), text: 'Jane… Ferdinand.' },
    { who: holub, text: 'To byla nehoda!' },
    { who: B(), text: 'Tohle taky.' },
    { act: () => { state.vrah.pour = 0; playSound([[880, 0, 0.05], [660, 0.1, 0.05], [440, 0.2, 0.3]]); } },
    { wait: 2.2 },
    { who: holub, text: 'Tak to je ještě horší než to logo.' },
    { act: () => {
      state.story.ferdinand = true;
      state.toast = { text: '🏆 Úspěch: Zahradní detektiv · 🪴 Dostal jsi Ferdinanda II.', t: CONFIG.TOAST_TIME + 4 };
      playSound(CONFIG.SOUND_COMPLETE);
    } },
    { who: B(), text: 'Romane, tady máš Ferdinanda II. Zalévej ho. Dvanáct let, ať to vidím.' },
  ], () => {
    setVrahStage('konec'); setQuestStage(questById('vrah'), 'done');
    if (typeof mainMoneyAdd === 'function') { mainMoneyAdd(50); state.toast = { text: '💰 Vrah dopaden! +50 Kč do hlavní hry', t: CONFIG.TOAST_TIME + 2 }; }   // odměna (41_ucty_a_odmeny.js)
  });
}
// Po přesunu postavy do místnosti, kde hráč je: přepočítat, kdo je vidět a co je pevné
function refreshRoom() {
  state.teachers = Object.values(TEACHERS).filter((t) => t.room === state.room.id && t.rect);
}

// =====================================================================
// ČÁST 1: MÍSTO ČINU – C109 je zamčená, dokud hráč nemá klíč; v ní 3 stopy
// (u každé mezerník / ťuknutí) a zbytky Ferdinanda
// =====================================================================
const CLUES = [
  { id: 'bota', at: { x: 470, y: 352 }, icon: 'boot', name: 'Otisk boty v hlíně',
    text: 'Otisk boty v hlíně z Ferdinanda. Velký, pánský… a podrážka jako od sálovek z tělocvičny.' },
  { id: 'dort', at: { x: 318, y: 166 }, icon: 'cake', name: 'Kousek dortu',
    text: 'Kousek dortu. Kdo nosí do školy dort? Někdo, kdo ho bral ve sborovně… a s plnou pusou nekouká pod nohy.' },
  { id: 'papir', at: { x: 122, y: 236 }, icon: 'paper', name: 'Zmuchlaný papír',
    text: 'Zmuchlaný papír: „Zabaveno: šála SK Slavia Praha. Vyzvedne si u mě. — J. H.“' },
];
const clueRect = (c) => { const r = ROOMS[VRAH.CRIME]; return { x: r.x + c.at.x - 14, y: r.y + c.at.y - 14, w: 28, h: 28 }; };
function clueSpot() {
  if (!vrahOn() || state.vrah.stage !== 'stopy' || state.room.id !== VRAH.CRIME) return null;
  const p = state.player, rr = CONFIG.TEACHER_TALK_RANGE;
  const near = { x: p.x - rr, y: p.y - rr, w: p.w + 2 * rr, h: p.h + 2 * rr };
  const c = CLUES.find((cc) => !state.vrah.clues.includes(cc.id) && rectsOverlap(near, clueRect(cc)));
  return c ? clueRect(c) : null;
}
function examineClue() {
  const box = clueSpot();
  const c = box && CLUES.find((cc) => clueRect(cc).x === box.x && clueRect(cc).y === box.y);
  if (!c) return;
  state.vrah.clues.push(c.id);
  playSound(CONFIG.SOUND_PICKUP);
  const n = state.vrah.clues.length;
  playScene([{ text: c.text }], () => {
    if (n < 3) { state.toast = { text: `🔍 Stopa ${n}/3: ${c.name}`, t: CONFIG.TOAST_TIME }; saveProgress(); return; }
    setVrahStage('binkova2');
    state.toast = { text: '🔍 Máš všechny tři stopy – vrať se za Binkovou do Kabinetu 5', t: CONFIG.TOAST_TIME + 2 };
  });
}
SPOTS.push({ rect: clueSpot, act: examineClue, hintDx: 0 });

// Zamčené dveře do C109 (dokud hráč nemá klíč)
function doorBlocked(door) {
  if (!vrahOn() || door.to !== VRAH.CRIME || state.vrah.stage !== 'binkova1') return false;
  if (!state.toast) state.toast = { text: '🔒 C109 je zamčená. Klíč má Binková (Kabinet Binková a Kučerová).', t: CONFIG.TOAST_TIME };
  const p = state.player, back = { top: [0, 6], bottom: [0, -6], left: [6, 0], right: [-6, 0] }[door.side];
  p.x += back[0]; p.y += back[1];   // odstrčit od dveří, ať se to neopakuje každý snímek
  return true;
}

// =====================================================================
// ČÁST 2: LOGO SLÁVIE – u dveří Kabinetu 4 se samolepka táhne myší / prstem
// z levého horního rohu do pravého dolního (nebo se drží šipka →). Moc rychle =
// bubliny, moc pomalu = Holub se vrátí. Holub vidí před sebe (kužel jako dozor
// u gum); když hráče u dveří vidí, roste podezření, a při plném ho chytí.
// =====================================================================
const STICKER = { panel: { x: 240, y: 330, w: 320, h: 230 }, box: { x: 330, y: 380, w: 140, h: 140 },
  FAST: 0.8, KEY_ACCEL: 0.9 };
function stickerSpot() {
  if (!vrahOn() || state.vrah.stage !== 'logo' || state.room.id !== VRAH.CORRIDOR || state.sticker) return null;
  const door = ROOMS[VRAH.CORRIDOR].doors.find((d) => d.to === VRAH.HOLUB_DOOR);
  return { x: door.x + door.w, y: door.y, w: 34, h: door.h };
}
function startSticker() {
  state.sticker = { p: 0, v: 0, dev: 0, bubbles: [], drag: false, key: false, t: 0 };
  playSound([[523, 0, 0.05]]);
}
SPOTS.push({ rect: stickerSpot, act: startSticker, hintDx: 0 });

// Tah myší / prstem po samolepce
function stickerPointer(e, type) {
  const s = state.sticker;
  if (!s) return;
  const g = screenToGame(e.clientX, e.clientY);
  if (!g) return;
  const b = STICKER.box;
  if (type === 'down') {
    if (!pointInRect(g.x, g.y, b, 20)) return;
    s.drag = true;
  }
  if (type === 'up') { s.drag = false; return; }
  if (!s.drag) return;
  // průmět na úhlopříčku: 0 = levý horní roh, 1 = pravý dolní; odchylka od ní v px
  const dx = g.x - b.x, dy = g.y - b.y, len = Math.hypot(b.w, b.h);
  const proj = (dx * b.w + dy * b.h) / (len * len);
  const dev = Math.abs(dx * b.h - dy * b.w) / len;
  if (proj > s.p) { s.pending = (s.pending || 0) + (Math.min(1, proj) - s.p); s.p = Math.min(1, proj); }
  if (s.p > 0.05) s.dev = Math.max(s.dev, dev);
}
window.addEventListener('pointerdown', (e) => stickerPointer(e, 'down'));
window.addEventListener('pointermove', (e) => stickerPointer(e, 'move'));
window.addEventListener('pointerup', (e) => stickerPointer(e, 'up'));

function updateSticker(dt) {
  const s = state.sticker;
  s.t += dt;
  if (s.key) { s.v = Math.min(1.6, s.v + STICKER.KEY_ACCEL * dt); s.p = Math.min(1, s.p + s.v * dt); }
  else if (s.pending !== undefined) { s.v = s.v * 0.8 + (s.pending / dt) * 0.2; s.pending = 0; }
  else s.v = Math.max(0, s.v - 3 * dt);
  if (!s.key && !s.drag) s.v = Math.max(0, s.v - 3 * dt);
  // moc rychle → bublina na aktuálním místě
  if (s.v > STICKER.FAST && s.p < 1 && Math.random() < dt * 6 * (s.v - STICKER.FAST + 0.3)) {
    s.bubbles.push({ k: s.p, off: (Math.random() - 0.5) * 40 });
    playSound([[1200, 0, 0.03]]);
  }
  if (s.p >= 1) finishSticker();
}
function finishSticker() {
  const s = state.sticker;
  const stars = Math.max(1, 3 - (s.bubbles.length > 3 ? 2 : s.bubbles.length > 0 ? 1 : 0) - (s.dev > 22 ? 1 : 0));
  state.sticker = null;
  state.vrah.stars = stars;
  state.vrah.sus = 0;
  setVrahStage('binkova3');
  playSound(CONFIG.SOUND_COMPLETE);
  state.toast = { text: `⭐ Logo nalepeno: ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} – rychle zpátky za Mišákem!`, t: CONFIG.TOAST_TIME + 2 };
}
// Holub se dívá: u dveří (a hlavně při lepení) roste podezření
function updateSuspicion(dt) {
  const v = state.vrah, holub = H();
  if (v.stage !== 'logo' || state.room.id !== VRAH.CORRIDOR || holub.room !== VRAH.CORRIDOR || !holub.rect) return;
  updateWatcherFacing(holub);
  const p = state.player, door = stickerSpot() || (state.sticker && ROOMS[VRAH.CORRIDOR].doors.find((d) => d.to === VRAH.HOLUB_DOOR));
  const nearDoor = door && Math.hypot(p.x - door.x, p.y - door.y) < 90;
  const seen = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.8]].some(([fx, fy]) => watcherSees(holub, p.x + p.w * fx, p.y + p.h * fy));
  const before = v.sus;
  // vidí-li hráče: při lepení rychle, u dveří středně, jinde na chodbě pomalu
  if (seen) v.sus = Math.min(1, v.sus + (state.sticker ? 1.2 : nearDoor ? 0.6 : 0.3) * dt);
  else v.sus = Math.max(0, v.sus - 0.2 * dt);
  const say = (text) => { state.toast = { text: `☕ Holub: „${text}“`, t: CONFIG.TOAST_TIME }; };
  if (before < 0.4 && v.sus >= 0.4) say('Cítím tady sešívaný vzduch.');
  if (before < 0.75 && v.sus >= 0.75) say('Kdo se to tu ochomýtá u mýho kabinetu?');
  if (v.sus >= 1) {   // chycen: vyhodí hráče z chodby (a samolepku seškrábe) – zkouší se znovu, není to konec hry
    const sticking = !!state.sticker;
    state.sticker = null;
    v.sus = 0;
    playSound([[300, 0, 0.1], [200, 0.12, 0.3]]);
    playScene([{ who: holub, text: sticking
      ? 'Co to tu lepíš na můj kabinet?! Tak to hezky seškrábeme… a zmiz, než si tě zapíšu!'
      : 'Co tu pořád šmejdíš u mýho kabinetu? Zmiz z mý chodby, než si tě zapíšu!' }],
    () => {
      const down = ROOMS[VRAH.CORRIDOR].doors.find((d) => d.to === 'cecko2');   // poslal tě po schodech dolů
      enterRoom('cecko2', down && down.spawn);
      state.toast = { text: sticking ? 'Samolepka je seškrábnutá. Počkej, až Holub odejde nebo se otočí zády, a zkus to znovu.' : 'Holub tě vyhodil. Počkej, až odejde nebo se otočí zády.', t: CONFIG.TOAST_TIME + 2 };
    });
  }
}

// =====================================================================
// KAŽDÝ SNÍMEK (06_logika.js) a vstupy, když je otevřené lepení
// =====================================================================
function updateVrah(dt) {
  if (!vrahOn()) return;
  updateScene(dt);
  if (state.vrah.pour !== undefined && state.vrah.pour < 1) {   // finále: Holub zelená
    state.vrah.pour = Math.min(1, state.vrah.pour + dt / 2);
    H().look.green = Math.max(0, (state.vrah.pour - 0.35) / 0.65);
  }
  if (state.sticker && state.room.id !== VRAH.CORRIDOR) state.sticker = null;   // odešel od dveří
  if (state.sticker) updateSticker(dt);
  if (state.vrah && !state.dialog) updateSuspicion(dt);
  if (state.vrah && state.vrah.stage === 'laborka') { if (!state.scene && !state.dialog && !state.choice) updateFollow(dt); updateLab(dt); }
  if (state.quiz && !state.dialog) updateQuiz(dt);
  if (state.vrah && !state.dialog && !state.choice) {
    updateWetFloor();
    if (state.mop) updateMop(dt);
    if (state.rhythm) updateRhythm(dt);
  }
}
// Lepení: hráč stojí u dveří, svět běží dál (Holub chodí); Esc / klik mimo panel = nechat být
function vrahOverlayEvents(events, dt) {
  if (!vrahOn() || state.dialog) return false;   // dialog se zavírá jako obvykle (06_logika.js)
  if (state.scene && state.scene.wait) { updateMovingTeachers(dt); return true; }   // animace ve finále
  if (state.choice) { choiceEvents(events); return true; }
  if (state.gameOver) { gameOverEvents(events); return true; }
  if (state.quiz) { quizEvents(events); return true; }
  if (labOverlayEvents(events, dt)) return true;
  if (state.rhythm) { rhythmEvents(events); return true; }
  if (!state.sticker) return false;
  for (const ev of events) {
    if (ev.x != null && !pointInRect(ev.x, ev.y, STICKER.panel, 0)) { state.sticker = null; break; }
  }
  updateMovingTeachers(dt);
  return true;
}
window.addEventListener('keydown', (e) => {
  if (!state.sticker) return;
  if (e.code === 'Escape') { state.sticker = null; return; }
  if (KEYMAP.right.includes(e.code)) state.sticker.key = true;
});
window.addEventListener('keyup', (e) => {
  if (state.sticker && KEYMAP.right.includes(e.code)) state.sticker.key = false;
});

// =====================================================================
// KRESLENÍ
// =====================================================================
// Logo Slávie (zjednodušené): kruh napůl červený a bílý s červenou hvězdou
function drawSlavia(cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI / 2, Math.PI * 1.5); ctx.fill();
  ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#d32f2f'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.25 : r * 0.6;
    ctx.lineTo(r * 0.12 + Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
Object.assign(ICONS, {
  key(cx, cy, s) {   // zlatý klíč
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.5);
    ctx.strokeStyle = '#c9a646'; ctx.lineWidth = s * 0.1;
    ctx.beginPath(); ctx.arc(-s * 0.22, 0, s * 0.16, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.06, 0); ctx.lineTo(s * 0.42, 0); ctx.moveTo(s * 0.3, 0); ctx.lineTo(s * 0.3, s * 0.14); ctx.moveTo(s * 0.4, 0); ctx.lineTo(s * 0.4, s * 0.12); ctx.stroke();
    ctx.restore();
  },
  slavia(cx, cy, s) { drawSlavia(cx, cy, s * 0.4); },
  boot(cx, cy, s) {   // otisk podrážky v hlíně
    ctx.fillStyle = '#6d4c2f'; ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.42, s * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3e2a19';
    ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.08, s * 0.11, s * 0.18, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + s * 0.03, cy + s * 0.17, s * 0.08, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  },
  cake(cx, cy, s) {   // kousek dortu
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#f5deb3'; ctx.beginPath(); ctx.moveTo(-s * 0.38, s * 0.25); ctx.lineTo(s * 0.38, s * 0.25); ctx.lineTo(s * 0.38, -s * 0.05); ctx.lineTo(-s * 0.38, -s * 0.25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f48fb1'; ctx.beginPath(); ctx.moveTo(-s * 0.38, -s * 0.25); ctx.lineTo(s * 0.38, -s * 0.05); ctx.lineTo(s * 0.38, -s * 0.13); ctx.lineTo(-s * 0.38, -s * 0.33); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8d6e63'; ctx.fillRect(-s * 0.38, s * 0.05, s * 0.76, s * 0.05);
    ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.33, s * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
  paper(cx, cy, s) {   // zmuchlaný papír
    ctx.fillStyle = '#fafafa'; ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = s * (i % 2 ? 0.28 : 0.38); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - s * 0.15, cy - s * 0.1); ctx.lineTo(cx + s * 0.12, cy + s * 0.05); ctx.moveTo(cx - s * 0.05, cy + s * 0.15); ctx.lineTo(cx + s * 0.15, cy - s * 0.12); ctx.stroke();
  },
  potion(cx, cy, s) {   // baňka se zeleným lektvarem
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#b0bec5'; ctx.fillRect(-s * 0.08, -s * 0.42, s * 0.16, s * 0.2);
    ctx.fillStyle = '#8d6e63'; ctx.fillRect(-s * 0.1, -s * 0.48, s * 0.2, s * 0.08);
    ctx.fillStyle = '#76ff03'; ctx.beginPath(); ctx.arc(0, s * 0.12, s * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#33691e'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.beginPath(); ctx.arc(-s * 0.1, s * 0.02, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
  plant(cx, cy, s) {   // Ferdinand II. – fikus v květináči
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#c1663b'; ctx.beginPath(); ctx.moveTo(-s * 0.22, s * 0.12); ctx.lineTo(s * 0.22, s * 0.12); ctx.lineTo(s * 0.16, s * 0.45); ctx.lineTo(-s * 0.16, s * 0.45); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2e7d32';
    for (const [x, y, a] of [[-0.18, -0.05, -0.6], [0.18, -0.08, 0.6], [0, -0.28, 0], [-0.12, -0.35, -0.4], [0.14, -0.32, 0.4]]) {
      ctx.save(); ctx.translate(x * s, y * s); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, s * 0.09, s * 0.17, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  },
});
// Co má hráč u sebe v režimu (inventář, 17_pribehy.js)
function vrahInventory() {
  if (!vrahOn()) return [];
  const v = state.vrah, st = v.stage, list = [];
  if (st !== 'binkova1') list.push({ icon: 'key', name: 'Klíč od C109', note: 'od Binkové' });
  for (const c of CLUES) if (v.clues.includes(c.id)) list.push({ icon: c.icon, name: c.name, note: 'stopa z C109' });
  if (st === 'logo') list.push({ icon: 'slavia', name: 'Samolepka Slávie', note: 'na Holubův kabinet' });
  if (st === 'lektvar') list.push({ icon: 'potion', name: 'Lektvar Zelené Karmy', note: 'od Křiváčka' });
  list.push(...vrahInventory2());
  if (state.lab && state.lab.code) list.push({ icon: 'potion', name: 'Ingredience z laborky', note: state.lab.done ? 'hotový základ lektvaru' : 'ze skříně Lukáškové' });
  if (state.vrah.jednicka) list.push({ icon: 'grade', name: 'Jednička z biologie', note: 'od Křiváčka' });
  if (state.story.ferdinand) list.push({ icon: 'plant', name: 'Ferdinand II.', note: 'zalévat 12 let' });
  return list;
}

// Ve světě: zbytky Ferdinanda a stopy v C109, logo na dveřích, Holubův výhled, kafe při finále
function drawVrahWorld() {
  if (!vrahOn()) return;
  const room = state.room, v = state.vrah;
  drawMopWorld();
  drawLabWorld();
  if (room.id === VRAH.CRIME) {
    const x = room.x + 470, y = room.y + 352;
    ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.ellipse(x, y, 30, 14, 0, 0, Math.PI * 2); ctx.fill();   // hlína
    ctx.fillStyle = '#c1663b';
    for (const [dx, dy, a] of [[-26, -8, 0.4], [20, 6, -0.6], [-10, 10, 1.2], [28, -10, 0.1]]) {   // střepy
      ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(a); ctx.fillRect(-6, -3, 12, 6); ctx.restore();
    }
    ctx.fillStyle = '#2e7d32';
    for (const [dx, dy, a] of [[-38, 4, 0.8], [-44, -6, -0.3], [-30, -14, 0.2]]) {   // vyvrácený fikus
      ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, 5, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (v.stage === 'stopy') {
      const wave = Math.sin(state.time * CONFIG.ITEM_BOB_SPEED);
      for (const c of CLUES) {
        if (v.clues.includes(c.id)) continue;
        const r = clueRect(c);
        ctx.globalAlpha = 0.3 + 0.15 * wave;
        ctx.fillStyle = CONFIG.ITEM_GLOW_COLOR;
        ctx.beginPath(); ctx.arc(r.x + 14, r.y + 14, 22, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        drawIcon(c.icon, r.x + 14, r.y + 14, 26);
      }
    }
  }
  if (room.id === VRAH.CORRIDOR) {
    const door = room.doors.find((d) => d.to === VRAH.HOLUB_DOOR);
    if (stageAtLeast('binkova3')) drawSlavia(door.x + door.w + 10, door.y + door.h / 2, 11);
    // Holubův výhled (jen když se lepí logo)
    const holub = H();
    if (v.stage === 'logo' && holub.room === room.id && holub.face && holub.rect) {
      const r = holub.rect, ex = r.x + r.w / 2, ey = r.y + r.h / 2, a = Math.atan2(holub.face.y, holub.face.x);
      const g = ctx.createRadialGradient(ex, ey, 10, ex, ey, PRANK.VIEW_RANGE);
      g.addColorStop(0, `rgba(255, ${Math.round(220 - 160 * v.sus)}, 90, 0.35)`);
      g.addColorStop(1, 'rgba(255, 220, 90, 0.03)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.arc(ex, ey, PRANK.VIEW_RANGE, a - PRANK.VIEW_HALF_ANGLE, a + PRANK.VIEW_HALF_ANGLE); ctx.closePath(); ctx.fill();
    }
  }
  // finále: z lahvičky nad Holubovým hrnkem kape lektvar
  if (room.id === VRAH.OFFICE && v.pour !== undefined && v.pour < 1 && H().rect) {
    const r = H().rect, x = r.x + r.w / 2 + 14, y = r.y + 10;
    drawIcon('potion', x, y - 22, 18);
    ctx.fillStyle = '#76ff03';
    for (let i = 0; i < 3; i++) { const k = (state.time * 2 + i / 3) % 1; ctx.beginPath(); ctx.arc(x, y - 10 + k * 18, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
}
// Rozhraní: panel lepení a ukazatel Holubova podezření
function drawVrahOverlays() {
  if (!vrahOn()) return;
  const v = state.vrah;
  drawMopHud();
  drawLabHud();
  drawChoice();
  drawRhythm();
  drawQuiz();
  drawGameOver();
  if (v.stage === 'logo' && state.room.id === VRAH.CORRIDOR && (v.sus > 0 || state.sticker)) {
    const x = 250, y = 82, w = 300;
    roundRectPath(x, y, w, 22, 8); ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fill();
    roundRectPath(x + 110, y + 6, (w - 120) * v.sus, 10, 4);
    ctx.fillStyle = v.sus > 0.75 ? '#e53935' : v.sus > 0.4 ? '#fb8c00' : '#fdd835'; ctx.fill();
    ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('☕ Podezření', x + 8, y + 12);
  }
  const s = state.sticker;
  if (!s) return;
  const P = STICKER.panel, b = STICKER.box;
  roundRectPath(P.x, P.y, P.w, P.h, 12);
  ctx.fillStyle = 'rgba(244, 236, 216, 0.95)'; ctx.fill();
  ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 3; ctx.stroke();
  ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#3b2a1c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(isTouchHint() ? 'Táhni samolepku z rohu do rohu' : 'Táhni myší z rohu do rohu (nebo drž →)', P.x + P.w / 2, P.y + 22);
  drawRect(b, '#8d5a34');   // dveře Holubova kabinetu
  ctx.strokeStyle = '#5d3a1f'; ctx.lineWidth = 2; ctx.strokeRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
  // nalepená část loga (od levého horního rohu po úhlopříčce)
  ctx.save();
  ctx.beginPath();
  const k = s.p * 2;   // úhlopříčný řez: x + y < k * strana
  ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.min(b.w, k * b.w), b.y);
  if (k > 1) { ctx.lineTo(b.x + b.w, b.y + (k - 1) * b.h); ctx.lineTo(b.x + (k - 1) * b.w, b.y + b.h); }
  ctx.lineTo(b.x, b.y + Math.min(b.h, k * b.h));
  ctx.closePath(); ctx.clip();
  drawSlavia(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 10);
  ctx.restore();
  // ohyb ještě nenalepené samolepky
  if (s.p < 1) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(b.x + b.w * s.p, b.y + b.h * s.p, 8, 0, Math.PI * 2); ctx.fill();
  }
  for (const bb of s.bubbles) {   // bubliny
    const bx = b.x + b.w * bb.k + bb.off * 0.5, by = b.y + b.h * bb.k - bb.off * 0.5;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.font = '12px sans-serif'; ctx.fillStyle = s.v > STICKER.FAST ? '#c62828' : '#3b2a1c';
  ctx.fillText(s.v > STICKER.FAST ? 'Moc rychle – bubliny!' : `Bubliny: ${s.bubbles.length}`, P.x + P.w / 2, P.y + P.h - 14);
}


// =====================================================================
// VÝBĚR Z MOŽNOSTÍ – panel jako seznam písniček; šipky + mezerník, nebo ťuknutí
// =====================================================================
const CHOICE_PANEL = { x: 160, y: 170, w: 480, h: 230 };
// panel se natáhne podle počtu možností (výběr piva má pět) a zůstane na střed obrazovky
function choicePanel() {
  const h = Math.max(CHOICE_PANEL.h, 92 + state.choice.options.length * 62);
  return { ...CHOICE_PANEL, h, y: Math.min(CHOICE_PANEL.y, Math.round((CONFIG.HEIGHT - h) / 2)) };
}
const choiceRows = () => { const P = choicePanel(); return state.choice.options.map((_, i) => ({ x: P.x + 20, y: P.y + 70 + i * 62, w: P.w - 40, h: 52 })); };
function openChoice(title, options, onPick) {
  state.choice = { title, options, sel: 0, onPick };
}
function choiceEvents(events) {
  const c = state.choice;
  for (const ev of events) {
    let i = null;
    if (ev.type === 'action') i = c.sel;
    else if (ev.x != null) { i = choiceRows().findIndex((r) => pointInRect(ev.x, ev.y, r, 0)); if (i < 0) i = null; }
    if (i === null) continue;
    state.choice = null;
    playSound([[660, 0, 0.05]]);
    c.onPick(i);
    return;
  }
}
function drawChoice() {
  const c = state.choice;
  if (!c) return;
  const P = choicePanel();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  roundRectPath(P.x, P.y, P.w, P.h, 14);
  ctx.fillStyle = '#f4ecd8'; ctx.fill();
  ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 4; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 21px sans-serif'; ctx.fillStyle = '#3b2a1c';
  ctx.fillText(c.title, P.x + P.w / 2, P.y + 36, P.w - 30);
  choiceRows().forEach((r, i) => {
    const o = c.options[i];
    roundRectPath(r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = i === c.sel && !isTouchHint() ? '#ffe9a8' : '#fffaf0'; ctx.fill();
    ctx.strokeStyle = 'rgba(59, 42, 28, 0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = 'bold 17px sans-serif'; ctx.fillStyle = '#2b1d14'; ctx.textAlign = 'left';
    ctx.fillText(o.label, r.x + 16, r.y + r.h / 2 + 1);
    if (o.note) { ctx.textAlign = 'right'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#9e9e9e'; ctx.fillText(o.note.toUpperCase(), r.x + r.w - 14, r.y + r.h / 2 + 1); }
  });
}

// =====================================================================
// 2. FÁZE: TEQUILA A PANENKY
// Školník (dolní šatny) má jahodovou tequilu, dá ji za klíče od kotelny. Klíče má
// uklízečka (hala ve 2. patře Céčka), vrátí je, když hráč vytře halu, než přijde ředitel.
// Školník má hlavu z fotky (fotky/školník.jpg), uklízečka zatím kreslený obličej (look.hair, look.skin).
// =====================================================================
TEACHERS.skolnik = {
  name: 'Školník', pro: 'školníka', color: '#455a64',
  room: 'satnyDole', at: { x: 0.3, y: 0.75 },
  look: { face: 'skolnik', body: '#2f6fb5', collar: '#255a94', arms: '#2f6fb5', pants: '#263238', shoes: '#1b1b1b', hair: '#3e3e46', skin: '#e8b996' },   // hlava z fotky (modré triko jako na ní)
  texts: { idle: 'Ta ředitelka mi zakázala brát si vás z hodin, teda až na tělák.' },
};
TEACHERS.uklizecka = {
  name: 'Uklízečka', pro: 'uklízečku', color: '#00838f',
  room: 'cecko2', at: { x: 378 / 420, y: 470 / 528 },
  look: { body: '#26a69a', collar: '#00897b', arms: '#26a69a', pants: '#37474f', shoes: '#eeeeee', hair: '#6d4c41', skin: '#f0c8a0' },
  texts: { idle: 'Neber mi kýbl, mladej.' },
};
const VRAH_ONLY = ['uklizecka'];   // v hlavní hře není (applyVrah); školník je v dolních šatnách v obou režimech
const S = () => TEACHERS.skolnik, U = () => TEACHERS.uklizecka;

TEACHERS.skolnik.talk = () => {
  if (!vrahOn()) return false;
  const st = state.vrah.stage;
  if (st === 'tequila') {
    playScene([
      { text: 'Dobrý den. Prý máte jahodovou tequilu…' },
      { who: S(), text: 'Tequila? Zabavená na lyžáku. Ale bez klíčů od kotelny nic. Celá škola zmrzne a já budu za blbce.' },
    ], () => setVrahStage('klice'));
  } else if (st === 'klice') {
    playScene([{ who: S(), text: 'Klíče od kotelny, mladej. Pak se bavíme. Prý je viděla uklízečka.' }]);
  } else if (st === 'mamKlice') {
    playScene([
      { who: S(), text: 'Klíče od kotelny! Ty jsi poklad. Tady máš tu tequilu – a já tě neviděl.' },
    ], () => { setVrahStage('panenky'); state.toast = { text: '🍓 Máš jahodovou tequilu', t: CONFIG.TOAST_TIME }; });
  } else playScene([{ who: S(), text: TEACHERS.skolnik.texts.idle }]);
  return true;
};
TEACHERS.uklizecka.talk = () => {
  if (!vrahOn()) return false;
  const st = state.vrah.stage;
  if (st === 'klice' && !state.mop) {
    playScene([
      { text: 'Dobrý den. Nemáte náhodou klíče od kotelny?' },
      { who: U(), text: 'Klíče? Jo, mám je. Ale nejdřív mop, mladej.' },
      { who: U(), text: 'Vytři mi tuhle halu, než přijde ředitel. A děcka ti to budou šlapat, tak hejbni.' },
    ], startMop);
  } else if (st === 'klice') {
    playScene([{ who: U(), text: 'Nemluv a vytírej!' }]);
  } else if (stageAtLeast('mamKlice')) {
    playScene([{ who: U(), text: 'Pěkně vytřeno. Kdybys chtěl brigádu, víš, kde mě najdeš.' }]);
  } else playScene([{ who: U(), text: TEACHERS.uklizecka.texts.idle }]);
  return true;
};

// --- mokrá podlaha s cedulí u uklízečky (před vytíráním)
const WET = { room: 'cecko2', x: 270, y: 445, w: 70, h: 50 };
function updateWetFloor() {
  const v = state.vrah;
  if (v.stage !== 'klice' || state.mop || state.room.id !== WET.room) return;
  const r = ROOMS[WET.room], p = state.player;
  const hit = rectsOverlap(p, { x: r.x + WET.x, y: r.y + WET.y, w: WET.w, h: WET.h });
  if (hit && !(v.wetSaid > state.time)) {
    v.wetSaid = state.time + 5;
    state.toast = { text: '🧹 Uklízečka: „Šlapeš mi po mokrým! Tos neviděl tu ceduli?!“', t: CONFIG.TOAST_TIME + 1 };
    playSound([[500, 0, 0.08], [380, 0.1, 0.12]]);
  }
}

// --- MINIHRA Vytírání na čas: hala je rozdělená na dlaždice, Roman je chůzí vytírá,
// děti přebíhají a šlapou bláto. Do časového limitu musí být čisto aspoň na 90 %.
// plocha končí před uklízečkou (stojí vpravo dole mimo ni), aby se dalo všude dojít
const MOP = { room: 'cecko2', x0: 30, y0: 330, cols: 8, rows: 4, tile: 40, TIME: 46, GOAL: 0.87, WET: 2.5, KIDS: 3, KID_SPEED: 92, DIRTY: 0.7, KID_MUD: 0.5 };
function startMop() {
  const n = MOP.cols * MOP.rows, tiles = new Uint8Array(n), wet = new Float32Array(n);
  for (let i = 0; i < n; i++) tiles[i] = Math.random() < MOP.DIRTY ? 1 : 0;   // 1 = špinavá
  state.mop = { t: MOP.TIME, tiles, wet, kids: [], spawn: 1.5 };
  state.toast = { text: `🧽 Vytři halu na ${Math.round(MOP.GOAL * 100)} % – máš ${MOP.TIME} s!`, t: CONFIG.TOAST_TIME };
}
const mopClean = () => { const m = state.mop; let c = 0; for (const t of m.tiles) if (!t) c++; return c / m.tiles.length; };
function mopTileAt(lx, ly) {
  const c = Math.floor((lx - MOP.x0) / MOP.tile), r = Math.floor((ly - MOP.y0) / MOP.tile);
  return c >= 0 && r >= 0 && c < MOP.cols && r < MOP.rows ? r * MOP.cols + c : -1;
}
const KID_LOOKS = [
  { body: '#e53935', collar: '#c62828', arms: '#e53935', pants: '#1e3a8a', shoes: '#fafafa', hair: '#3e2723', skin: '#f2c9a0' },
  { body: '#fdd835', collar: '#f9a825', arms: '#fdd835', pants: '#37474f', shoes: '#212121', hair: '#f4c95d', skin: '#f6d3b0' },
  { body: '#8e24aa', collar: '#6a1b9a', arms: '#8e24aa', pants: '#263238', shoes: '#fafafa', hair: '#1b1b1b', skin: '#d9a77c' },
];
function updateMop(dt) {
  const m = state.mop, room = ROOMS[MOP.room];
  if (state.room.id !== MOP.room) { state.mop = null; state.toast = { text: 'Utekl jsi od mopu – uklízečka chce začít znovu.', t: CONFIG.TOAST_TIME }; return; }
  m.t -= dt;
  // Roman vytírá všechny dlaždice, na kterých stojí (mop je široký)
  const p = state.player;
  for (const [fx, fy] of [[0, 0.4], [1, 0.4], [0, 1], [1, 1]]) {
    const i = mopTileAt(p.x + p.w * fx - room.x, p.y + p.h * fy - room.y);
    if (i >= 0) { m.tiles[i] = 0; m.wet[i] = MOP.WET; }
  }
  for (let k = 0; k < m.wet.length; k++) m.wet[k] = Math.max(0, m.wet[k] - dt);
  // děti přebíhají halou zleva doprava (nebo naopak) a šlapou bláto
  m.spawn -= dt;
  if (m.spawn <= 0 && m.kids.length < MOP.KIDS) {
    const left = Math.random() < 0.5, row = Math.floor(Math.random() * MOP.rows);
    const y = MOP.y0 + row * MOP.tile + MOP.tile / 2 + (Math.random() - 0.5) * 16;
    m.kids.push({ x: left ? 10 : MOP.x0 + MOP.cols * MOP.tile + 20, y, dir: left ? 1 : -1, look: KID_LOOKS[Math.floor(Math.random() * KID_LOOKS.length)], phase: 0 });
    m.spawn = 2.2 + Math.random() * 1.5;
  }
  for (const kid of m.kids) {
    kid.x += kid.dir * MOP.KID_SPEED * dt;
    kid.phase += dt * CONFIG.PLAYER_STEP_SPEED;
    const j = mopTileAt(kid.x, kid.y + 10);
    if (j >= 0 && j !== kid.last) {   // na novou dlaždici – jen občas nechá šlápotu
      kid.last = j;
      if (Math.random() < MOP.KID_MUD) m.tiles[j] = 1;
    }
  }
  m.kids = m.kids.filter((kid) => kid.x > 0 && kid.x < MOP.x0 + MOP.cols * MOP.tile + 30);
  if (mopClean() >= MOP.GOAL) {
    state.mop = null;
    playSound(CONFIG.SOUND_COMPLETE);
    playScene([
      { who: U(), text: 'No vidíš, že to jde! A ředitel nic nepoznal.' },
      { who: U(), text: 'Tady máš klíče od kotelny. A ani slovo, že jsem je našla ve Ferdinandově hlíně.' },
    ], () => { setVrahStage('mamKlice'); state.toast = { text: '🔑 Máš klíče od kotelny', t: CONFIG.TOAST_TIME }; });
  } else if (m.t <= 0) {
    state.mop = null;
    playSound(CONFIG.SOUND_MISS);
    playScene([{ who: U(), text: 'Ředitel už jde a ty to máš jak po bitvě! Znova, mladej. Promluv si se mnou, až budeš připravenej.' }]);
  }
}
function drawMopWorld() {
  const room = state.room, v = state.vrah;
  if (room.id !== MOP.room) return;
  if (v.stage === 'klice' && !state.mop) {   // mokrá podlaha a žlutá cedule
    ctx.fillStyle = 'rgba(120, 190, 255, 0.35)';
    roundRectPath(room.x + WET.x, room.y + WET.y, WET.w, WET.h, 12); ctx.fill();
    const cx = room.x + WET.x + WET.w / 2, cy = room.y + WET.y + 6;
    ctx.fillStyle = '#fdd835'; ctx.beginPath(); ctx.moveTo(cx - 9, cy + 16); ctx.lineTo(cx + 9, cy + 16); ctx.lineTo(cx, cy - 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#1b1b1b'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', cx, cy + 9);
  }
  const m = state.mop;
  if (!m) return;
  for (let r = 0; r < MOP.rows; r++) {
    for (let c = 0; c < MOP.cols; c++) {
      const i = r * MOP.cols + c, x = room.x + MOP.x0 + c * MOP.tile, y = room.y + MOP.y0 + r * MOP.tile;
      if (m.tiles[i]) {   // bláto
        ctx.fillStyle = 'rgba(93, 64, 55, 0.55)';
        for (const [dx, dy, rr] of [[12, 14, 7], [26, 22, 8], [18, 30, 5], [30, 10, 4]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, rr, 0, Math.PI * 2); ctx.fill(); }
      } else if (m.wet[i] > 0) {   // čerstvě vytřeno
        ctx.fillStyle = `rgba(150, 210, 255, ${0.35 * m.wet[i] / MOP.WET})`;
        ctx.fillRect(x + 1, y + 1, MOP.tile - 2, MOP.tile - 2);
      }
    }
  }
  for (const kid of m.kids) {
    ctx.save(); ctx.translate(room.x + kid.x, room.y + kid.y + 14); ctx.scale(0.75, 0.75);
    drawFigure(0, 0, kid.phase, 1, kid.look);
    ctx.restore();
  }
}
function drawMopHud() {
  const m = state.mop;
  if (!m) return;
  const clean = Math.round(mopClean() * 100);
  roundRectPath(250, 82, 300, 24, 8); ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'; ctx.fill();
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = m.t < 10 ? '#ff8a80' : '#ffffff';
  ctx.fillText(`🧽 Vytírání: ${Math.ceil(m.t)} s  ·  čisto ${clean} % z ${Math.round(MOP.GOAL * 100)} %`, 400, 95);
}

// --- MINIHRA Dvě panenky: rytmická hra – šipky padají ve 4 drahách, mačká se do rytmu
// na čáře (šipky / WASD, na mobilu tlačítka dole). Hraje písnička ze zvuky/ od začátku.
// Tempo písničky se nedalo změřit, šipky jdou po dobách v PANENKY.BPM (dá se doladit).
const PANENKY = { BPM: 116, LENGTH: 34, FALL: 2.4, WINDOW: 0.15, GOAL: 0.6, LEAD: 2,
  lanes: [['ArrowLeft', 'KeyA'], ['ArrowDown', 'KeyS'], ['ArrowUp', 'KeyW'], ['ArrowRight', 'KeyD']],
  arrows: ['←', '↓', '↑', '→'], colors: ['#e53935', '#1e88e5', '#43a047', '#fdd835'],
  laneX: (i) => 250 + i * 100, HIT_Y: 470, TOP_Y: 110 };
function startRhythm() {
  const beat = 60 / PANENKY.BPM, notes = [];
  let lane = 1;
  for (let t = PANENKY.LEAD, k = 0; t < PANENKY.LEAD + PANENKY.LENGTH; t += beat, k++) {
    if (k % 8 === 7) continue;                                  // na konci taktu pauza
    lane = (lane + 1 + Math.floor(Math.random() * 3)) % 4;      // pokaždé jiná dráha
    notes.push({ t, lane, hit: false, miss: false });
    if (k % 4 === 1 && Math.random() < 0.35) notes.push({ t: t + beat / 2, lane: (lane + 2) % 4, hit: false, miss: false });   // osminka navíc
  }
  state.rhythm = { t: 0, notes, hits: 0, combo: 0, best: 0, fb: null, flash: [0, 0, 0, 0], started: false };
}
function rhythmPress(lane) {
  const r = state.rhythm;
  if (!r) return;
  r.flash[lane] = 0.15;
  const note = r.notes.find((n) => !n.hit && !n.miss && n.lane === lane && Math.abs(n.t - r.t) <= PANENKY.WINDOW);
  if (note) {
    note.hit = true; r.hits++; r.combo++; r.best = Math.max(r.best, r.combo);
    r.fb = { text: Math.abs(note.t - r.t) < 0.06 ? 'Perfektní!' : 'Dobře!', color: '#76ff03', t: 0.5 };
  } else { r.combo = 0; r.fb = { text: 'Vedle', color: '#ff8a80', t: 0.4 }; }
}
function updateRhythm(dt) {
  const r = state.rhythm;
  r.t += dt;
  if (!r.started && r.t >= PANENKY.LEAD - 0.3) { r.started = true; setMusicTrack('panenky', true); }
  for (const n of r.notes) if (!n.hit && !n.miss && r.t - n.t > PANENKY.WINDOW) { n.miss = true; r.combo = 0; }
  for (let i = 0; i < 4; i++) r.flash[i] = Math.max(0, r.flash[i] - dt);
  if (r.fb) { r.fb.t -= dt; if (r.fb.t <= 0) r.fb = null; }
  if (r.t > PANENKY.LEAD + PANENKY.LENGTH + 1) finishRhythm();
}
function finishRhythm() {
  const r = state.rhythm, ratio = r.hits / r.notes.length;
  state.rhythm = null;
  setMusicTrack('main');
  const pct = Math.round(ratio * 100);
  if (ratio >= PANENKY.GOAL) {
    playSound(CONFIG.SOUND_COMPLETE);
    playScene([
      { who: K(), text: `To bylo krásný. Jak za mlada na chatě. (${pct} % not)` },
      { who: K(), text: 'Lektvar máš. Kdo ho vypije, týden vypadá jako kytka. A já tě neznám.' },
    ], () => { state.vrah.route = 'tequila'; setVrahStage('lektvar'); state.toast = { text: '🧪 Máš Lektvar Zelené Karmy', t: CONFIG.TOAST_TIME }; });
  } else {
    playSound(CONFIG.SOUND_MISS);
    playScene([{ who: K(), text: `To nebyly Dvě panenky, to byla tři neštěstí. (${pct} % not, potřebuješ ${Math.round(PANENKY.GOAL * 100)} %) Znova – promluv si se mnou.` }]);
  }
}
const rhythmButtons = () => PANENKY.lanes.map((_, i) => ({ x: PANENKY.laneX(i) - 40, y: 505, w: 80, h: 60 }));
function rhythmEvents(events) {
  for (const ev of events) {
    if (ev.x == null) continue;
    const i = rhythmButtons().findIndex((b) => pointInRect(ev.x, ev.y, b, 6));
    if (i >= 0) rhythmPress(i);
  }
}
function drawRhythm() {
  const r = state.rhythm;
  if (!r) return;
  ctx.fillStyle = 'rgba(15, 12, 30, 0.97)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#ffd54a';
  ctx.fillText('🎸 Dvě panenky pro Křiváčka', 400, 40);
  ctx.font = '14px sans-serif'; ctx.fillStyle = '#cfd8dc';
  ctx.fillText(`Trefeno ${r.hits} / ${r.notes.length}  ·  kombo ${r.combo}  ·  potřebuješ ${Math.round(PANENKY.GOAL * 100)} %`, 400, 70);
  for (let i = 0; i < 4; i++) {   // dráhy
    const x = PANENKY.laneX(i);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'; ctx.fillRect(x - 40, PANENKY.TOP_Y, 80, PANENKY.HIT_Y - PANENKY.TOP_Y + 30);
    ctx.strokeStyle = PANENKY.colors[i]; ctx.lineWidth = 3;
    ctx.globalAlpha = 0.5 + r.flash[i] * 3;
    ctx.beginPath(); ctx.arc(x, PANENKY.HIT_Y, 26, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText(PANENKY.arrows[i], x, PANENKY.HIT_Y + 1);
  }
  for (const n of r.notes) {   // padající šipky
    if (n.hit) continue;
    const k = 1 - (n.t - r.t) / PANENKY.FALL;
    if (k < 0 || k > 1.25) continue;
    const x = PANENKY.laneX(n.lane), y = PANENKY.TOP_Y + (PANENKY.HIT_Y - PANENKY.TOP_Y) * k;
    ctx.globalAlpha = n.miss ? 0.3 : 1;
    ctx.fillStyle = PANENKY.colors[n.lane]; ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#1b1b1b'; ctx.fillText(PANENKY.arrows[n.lane], x, y + 1);
    ctx.globalAlpha = 1;
  }
  if (r.fb) { ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = r.fb.color; ctx.fillText(r.fb.text, 400, 420); }
  if (r.t < PANENKY.LEAD) { ctx.font = 'bold 60px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(String(Math.ceil(PANENKY.LEAD - r.t)), 400, 280); }
  // tlačítka pro dotyk (a nápověda kláves)
  rhythmButtons().forEach((b, i) => {
    roundRectPath(b.x, b.y, b.w, b.h, 10);
    ctx.fillStyle = r.flash[i] > 0 ? PANENKY.colors[i] : 'rgba(255, 255, 255, 0.12)'; ctx.fill();
    ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(PANENKY.arrows[i], b.x + b.w / 2, b.y + b.h / 2 + 1);
  });
}
window.addEventListener('keydown', (e) => {
  if (state.rhythm && !e.repeat) {
    const lane = PANENKY.lanes.findIndex((keys) => keys.includes(e.code));
    if (lane >= 0) rhythmPress(lane);
  }
  if (state.choice && !e.repeat) {
    const c = state.choice;
    if (KEYMAP.up.includes(e.code)) c.sel = (c.sel + c.options.length - 1) % c.options.length;
    if (KEYMAP.down.includes(e.code)) c.sel = (c.sel + 1) % c.options.length;
  }
});

// Věci 2. fáze v inventáři
function vrahInventory2() {
  const st = state.vrah.stage, list = [];
  if (st === 'mamKlice') list.push({ icon: 'keys', name: 'Klíče od kotelny', note: 'pro školníka' });
  if (st === 'panenky') list.push({ icon: 'tequila', name: 'Jahodová tequila', note: 'pro Křiváčka' });
  return list;
}
Object.assign(ICONS, {
  keys(cx, cy, s) {   // svazek klíčů na kroužku
    ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = s * 0.06;
    ctx.beginPath(); ctx.arc(cx - s * 0.15, cy - s * 0.15, s * 0.16, 0, Math.PI * 2); ctx.stroke();
    ICONS.key(cx + s * 0.06, cy + s * 0.05, s * 0.8);
    ctx.save(); ctx.translate(cx - s * 0.1, cy + s * 0.12); ctx.rotate(1.2); ICONS.key(0, 0, s * 0.6); ctx.restore();
  },
  tequila(cx, cy, s) {   // růžová lahev s jahodou
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#5d4037'; ctx.fillRect(-s * 0.06, -s * 0.5, s * 0.12, s * 0.1);
    ctx.fillStyle = '#f8bbd0'; ctx.fillRect(-s * 0.05, -s * 0.42, s * 0.1, s * 0.18);
    roundRectPath(-s * 0.2, -s * 0.26, s * 0.4, s * 0.72, 8); ctx.fillStyle = '#ec407a'; ctx.fill();
    ctx.strokeStyle = '#ad1457'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff8e1'; ctx.fillRect(-s * 0.16, -s * 0.02, s * 0.32, s * 0.24);
    ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(0, s * 0.1, s * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#43a047'; ctx.fillRect(-s * 0.03, s * 0.01, s * 0.06, s * 0.03);
    ctx.restore();
  },
});


// =====================================================================
// 3. FÁZE: VLOUPÁNÍ DO LABORKY (A114)
// Při prvním vstupu Křiváček zabaví Lukáškovou (small talk – hráč vybírá jeho repliky).
// Pak Lukášková střídavě odchází (Křiváček ji volá) a vrací se hlídat – chodí kolem
// laborky a vidí před sebe. Hráč se schovává (pod lavici, za kostru, do digestoře).
// Úkoly v pořadí: kód skříně (Ca–Fe → protonová čísla z tabulky na zdi), pipeta
// (zastavit kapání na rysce, 3 látky), vrátit lahvičky na poličku (paměťovka).
// Podezření roste, když ji Lukášková vidí, a skokem při hluku (špatný kód, přelitá
// zkumavka, chyba v lahvičkách). Plné = chycen → Kabinet věčnosti.
// =====================================================================
const LAB = {
  ROOM: 'laborky', CODE: '2026', CODE_TEXT: 'Ca – Fe',   // laboratoř chemie dole pod schody (19_laborky.js)
  AWAY: 30,                                   // jak dlouho je Lukášková pryč s Křiváčkem (s), pak hlídá pořád
  route: [[320, 395], [320, 85], [110, 80], [320, 85], [530, 80]],   // uličkou uprostřed a vpředu podél tabule
  // místa v laborce (px od rohu místnosti)
  spots: {
    cabinet: { x: 67, y: 59, w: 50, h: 28, label: 'Skříň' },
    table: { x: 140, y: 22, w: 80, h: 40, label: 'Periodická tabulka' },
    pipette: { x: 366, y: 155, w: 60, h: 50, label: 'Pipeta' },
    shelf: { x: 520, y: 368, w: 74, h: 32, label: 'Polička' },
  },
  hides: {
    digestor: { x: 530, y: 22, w: 82, h: 40, label: 'Digestoř' },
    kostra: { x: 64, y: 360, w: 44, h: 58, label: 'Kostra' },
    lavice: { x: 210, y: 305, w: 66, h: 50, label: 'Pod lavici' },
  },
};
const LU = () => TEACHERS.lukaskova;
const labRect = (r) => { const room = ROOMS[LAB.ROOM]; return { x: room.x + r.x, y: room.y + r.y, w: r.w, h: r.h }; };
function newLab() {
  return { talked: false, distracted: false, code: false, read: false, pipette: 0, memory: false, done: false,
    sus: 0, said: 0, away: 0, present: 0, hidden: null };
}
function labHint() {
  const l = state.lab;
  if (!l || !l.talked) return 'Jdi s Křiváčkem do laborky – on Lukáškovou zabaví';
  if (l.done) return 'Zmiz z laborky a zajdi za Křiváčkem (Kabinet Křiváček)';
  if (!l.code) return `Otevři skříň – kód je „${LAB.CODE_TEXT}“ (protonová čísla najdeš v tabulce na zdi)`;
  if (l.pipette < 3) return `Namíchej látky pipetou u stolu (${l.pipette}/3)`;
  return 'Vrať lahvičky na poličku přesně, jak byly';
}
// Lukášková v laborce chodí dokola (stejně jako Holub po chodbě), nebo je pryč
function lukPatrol() {
  const t = LU();
  const path = LAB.route;
  Object.assign(t, { route: [{ room: LAB.ROOM, path }], once: false, arrived: false, speed: 52, pause: 1.2,
    seg: 0, pt: 1, dirStep: 1, wait: 0, walkPhase: 0, walkBlend: 0, face: null, _last: null,
    pos: { x: path[0][0], y: path[0][1] } });
  placeMovingTeacher(t);
}
function lukAway() { Object.assign(LU(), { route: null, room: null, rect: null }); refreshRoom(); }
function lukHome() { placeStatic(LU(), CAST_HOME.lukaskova.room, CAST_HOME.lukaskova.at); refreshRoom(); }

// --- small talk při prvním vstupu do laborky: strom rozhovoru – Lukášková vždy odpoví na to,
// co Křiváček opravdu řekl. Konec 'leave' = odejde s ním (na fikusy / kafe / papíry),
// 'stay' = zůstane a hlídá. Špatná replika (bad) zvedne podezření.
const TALK_TREE = {
  start: { her: 'Křiváčku? Co vy tady v laborce?', options: [
    { label: '„Ivano, vy jste dneska nějak chemicky přitažlivá.“', good: true, reply: 'Ale jděte, Křiváčku… to bude ten nový plášť. A co tu vlastně chcete?', next: 'proc' },
    { label: '„Nevíte, kde jsou klíče od laborky?“', bad: true, reply: 'Klíče? K čemu vy byste potřeboval klíče od mojí laborky?', next: 'proc' },
    { label: '„Jen jsem šel kolem, cítil jsem síru.“', reply: 'Síru? To budou zase druháci. A ještě něco?', next: 'proc' },
  ] },
  proc: { options: [
    { label: '„Mám v kabinetu nové fikusy. Musíte je vidět – a uvařím kafe.“', good: true, reply: 'Fikusy? No… to bych se možná i podívala.', next: 'fikusy' },
    { label: '„Potřebuju od vás podepsat papíry na olympiádu.“', reply: 'Papíry? Teď? No dobře, kde je máte?', next: 'papiry' },
    { label: '„Ten Roman za mnou? Toho si nevšímejte.“', bad: true, reply: 'Roman? Jaký Roman?… Křiváčku, proč se tak divně usmíváte?', next: 'roman' },
  ] },
  fikusy: { options: [
    { label: '„Tak pojďte hned, voda na kafe už se vaří.“', good: true, end: 'leave', reply: 'Tak dobře, ale jen na chvilku! Pokus mi tu počká.' },
    { label: '„Ale nejdřív bych nahlédl do té vaší skříně…“', bad: true, end: 'stay', reply: 'Do mojí skříně? Tak to tedy ne. Fikusy počkají.' },
    { label: '„Nebo radši zítra, jak chcete.“', end: 'stay', reply: 'Tak zítra. Teď mám rozdělaný pokus.' },
  ] },
  papiry: { options: [
    { label: '„Mám je v kabinetu. A uvařím vám tam kafe, ať se nenadřete.“', good: true, end: 'leave', reply: 'Kafe? To beru. Ale rychle, mám tu pokus.' },
    { label: '„Vlastně ne – hledám tu jen kód od skříně.“', bad: true, end: 'stay', reply: 'Kód od skříně?! Tak to tady zůstanu a budu dávat pozor.' },
    { label: '„Přinesu je jindy.“', end: 'stay', reply: 'Jak chcete. Já tu stejně zůstávám.' },
  ] },
  roman: { options: [
    { label: '„Ivano, žádný Roman. Pojďte radši na kafe, mám nové fikusy.“', good: true, end: 'leave', reply: 'No… dobře. Ale jen chvilku – a ať tu nikdo na nic nesahá!' },
    { label: '„Roman tu jen hledá kód od skříně.“', bad: true, end: 'stay', reply: 'COŽE?! Tak to tady zůstanu a nespustím z něj oči.' },
    { label: '„Asi se mi to zdálo.“', end: 'stay', reply: 'Mně se to tedy nezdálo. Zůstanu tady.' },
  ] },
};
function startSmallTalk() {
  const k = K(), lu = LU();
  state.follow = null;   // Křiváček došel s hráčem až sem
  placeStatic(lu, LAB.ROOM, { x: 270 / 640, y: 392 / 440 });   // u dveří
  placeStatic(k, LAB.ROOM, { x: 375 / 640, y: 392 / 440 });
  refreshRoom();
  const node = (id) => {
    const n = TALK_TREE[id];
    const ask = () => openChoice('Co má Křiváček říct?', n.options, (pick) => {
      const o = n.options[pick];
      if (o.bad) state.lab.sus = Math.min(0.9, state.lab.sus + 0.2);
      playScene([{ who: k, text: o.label.replace(/[„“]/g, '') }, { who: lu, text: o.reply }],
        () => (o.end ? endSmallTalk(o.end === 'leave') : node(o.next)));
    });
    if (n.her) playScene([{ who: lu, text: n.her }], ask); else ask();
  };
  playScene([{ who: k, text: 'Psst, Romane, já ji zabavím. Ty mi napovídej, co mám říkat.' }], () => node('start'));
}
// Konec small talku: Křiváček hráči potichu vysvětlí, co dělat, a odejde (s Lukáškovou, nebo sám)
function endSmallTalk(leave) {
  const lab = state.lab, k = K(), lu = LU();
  lab.talked = true;
  lab.distracted = leave;
  const plan = 'Kód je na skříni – čísla prvků najdeš v periodické tabulce. Pak namíchej látky pipetou a nakonec vrať lahvičky na poličku.';
  playScene([
    { who: k, text: leave ? `(potichu) Máš chvilku, Romane. ${plan}` : `(potichu) Nevyšlo to, zůstane tu. ${plan}` },
    { who: k, text: leave ? 'Až se vrátí, schovej se – digestoř, kostra, nebo pod stůl. A já tě neznám.' : 'Hlídá – schovávej se, když se dívá: digestoř, kostra, nebo pod stůl. A já tě neznám.' },
  ], () => {
    walkOut(k, () => placeStatic(k, CAST_HOME.krivacek.room, CAST_HOME.krivacek.at));
    if (leave) {
      walkOut(lu, () => { lab.away = LAB.AWAY; });
      state.toast = { text: '🧪 Lukášková odchází s Křiváčkem – máš asi půl minuty!', t: CONFIG.TOAST_TIME + 2 };
    } else {
      lukPatrol();
      lab.present = Infinity;
      state.toast = { text: 'Lukášková zůstala hlídat – schovávej se, když se dívá!', t: CONFIG.TOAST_TIME + 2 };
    }
  });
}
// Postava odejde dveřmi z laborky (vidět, jak jde), pak zmizí
function walkOut(t, onGone) {
  const room = ROOMS[LAB.ROOM], door = room.doors[0];
  const from = { x: t.rect.x + t.rect.w / 2 - room.x, y: t.rect.y + t.rect.h / 2 - room.y };
  const to = { x: door.x + door.w / 2 - room.x, y: door.y - room.y - 6 };
  Object.assign(t, { route: [{ room: LAB.ROOM, path: [[from.x, from.y], [to.x, to.y]] }], once: true, arrived: false, speed: 95, pause: 0,
    seg: 0, pt: 1, dirStep: 1, wait: 0, walkPhase: 0, walkBlend: 0, pos: { ...from } });
  t.onArrive = () => {
    Object.assign(t, { route: null, room: null, rect: null, onArrive: null, once: false, arrived: false });
    refreshRoom();
    if (onGone) onGone();
  };
  placeMovingTeacher(t);
}

// --- Křiváček jde s hráčem do laborky (drží se kousek za ním, přes dveře ho následuje)
function startFollow() {
  state.follow = { id: 'krivacek' };
  const t = K();
  state.solids = state.solids.filter((s) => s !== t.rect);   // stál v kabinetu – už tam není překážka
  Object.assign(t, { route: null });
}
function updateFollow(dt) {
  const f = state.follow;
  if (!f) return;
  const t = TEACHERS[f.id], p = state.player;
  const target = { x: p.x + p.w / 2 - 38, y: p.y + p.h / 2 + 6 };
  if (t.room !== state.room.id || !t.rect) {   // hráč přešel do jiné místnosti – Křiváček za ním
    t.room = state.room.id;
    f.x = target.x; f.y = target.y;
    refreshRoom();
  }
  const dx = target.x - f.x, dy = target.y - f.y, d = Math.hypot(dx, dy);
  const moving = d > 40;
  if (moving) { const step = Math.min(d - 30, 215 * dt); f.x += dx / d * step; f.y += dy / d * step; }
  t.walkBlend = (t.walkBlend || 0) + ((moving ? 1 : 0) - (t.walkBlend || 0)) * Math.min(1, dt * 8);
  if (moving) t.walkPhase = (t.walkPhase || 0) + dt * CONFIG.PLAYER_STEP_SPEED;
  t.rect = { x: Math.round(f.x - CONFIG.TEACHER_W / 2), y: Math.round(f.y - CONFIG.TEACHER_H / 2), w: CONFIG.TEACHER_W, h: CONFIG.TEACHER_H };
}

// --- stealth a střídání Lukáškové
function labSpotAt(dict) {   // místo, u kterého hráč stojí
  const p = state.player, r = CONFIG.TEACHER_TALK_RANGE;
  const near = { x: p.x - r, y: p.y - r, w: p.w + 2 * r, h: p.h + 2 * r };
  for (const [id, s] of Object.entries(dict)) if (rectsOverlap(near, labRect(s))) return { id, ...s };
  return null;
}
function labNoise(amount, text) {
  const lab = state.lab;
  lab.sus = Math.min(1, lab.sus + amount);
  playSound([[220, 0, 0.1], [180, 0.1, 0.15]], 'sawtooth');
  if (text) state.toast = { text, t: CONFIG.TOAST_TIME };
}
function updateLab(dt) {
  if (!state.lab) state.lab = newLab();
  const lab = state.lab, lu = LU(), inLab = state.room.id === LAB.ROOM;
  if (lab.done) return;
  if (!lab.talked) {
    if (inLab && !state.dialog && !state.scene && !state.choice) startSmallTalk();
    return;
  }
  if (state.dialog || state.scene || state.choice || state.quiz || state.gameOver) return;
  // Lukášková: odešla s Křiváčkem → po chvíli se vrátí dveřmi a pak už hlídá pořád
  if (lab.away > 0) {
    lab.away -= dt;
    if (lab.away <= 0) { lukPatrol(); lab.present = Infinity; if (inLab) state.toast = { text: '👣 Lukášková se vrací! Odteď hlídá – schovávej se, když se dívá.', t: CONFIG.TOAST_TIME + 2 }; }
  }
  if (!inLab || lu.room !== LAB.ROOM || !lu.rect || !lu.route || lu.onArrive) { lab.sus = Math.max(0, lab.sus - 0.08 * dt); return; }   // hlídá jen při obchůzce (ne když odchází)
  updateWatcherFacing(lu);
  const p = state.player;
  const seen = !lab.hidden && [[0.5, 0.5], [0.2, 0.2], [0.8, 0.8]].some(([fx, fy]) => watcherSees(lu, p.x + p.w * fx, p.y + p.h * fy));
  const before = lab.sus;
  if (seen) lab.sus = Math.min(1, lab.sus + (state.labTask ? 1.1 : 0.7) * (lab.distracted ? 0.8 : 1) * dt);
  else lab.sus = Math.max(0, lab.sus - 0.1 * dt);
  const say = (text) => { state.toast = { text: `🧪 Lukášková: „${text}“`, t: CONFIG.TOAST_TIME + 1 }; };
  if (before < 0.35 && lab.sus >= 0.35) say('Cítím tu nedovolenou reakci.');
  if (before < 0.7 && lab.sus >= 0.7) say('Někdo tu je. Molekuly nelžou.');
  if (lab.sus >= 1) labCaught();
}
function labCaught() {
  state.labTask = null;
  state.lab.hidden = null;
  state.vrah.caught = true;
  playSound([[440, 0, 0.12], [330, 0.14, 0.12], [220, 0.28, 0.4]]);
  playScene([
    { who: LU(), text: 'Ale ale, Romane. Víš, co se stane se vzorkem, který nepatří do experimentu?' },
    { who: LU(), text: 'Neutralizuje se.' },
    { text: '…a Romana odvedli do Kabinetu věčnosti.' },
  ], startQuiz);
}

// --- interakce v laborce: schovat se / úkoly (mezerník nebo ťuknutí u místa)
function labSpot() {
  if (!vrahOn() || state.vrah.stage !== 'laborka' || !state.lab || !state.lab.talked || state.lab.done || state.room.id !== LAB.ROOM) return null;
  if (state.lab.hidden || state.labTask) return null;
  const s = labSpotAt(LAB.spots) || labSpotAt(LAB.hides);
  return s ? labRect(s) : null;
}
function labAct() {
  const lab = state.lab, task = labSpotAt(LAB.spots), hide = labSpotAt(LAB.hides);
  if (task) {
    if (task.id === 'table') { state.labTask = { kind: 'table' }; lab.read = true; return; }
    if (task.id === 'cabinet') {
      if (lab.code) { state.toast = { text: 'Skříň je prázdná – ingredience už máš.', t: CONFIG.TOAST_TIME }; return; }
      state.labTask = { kind: 'code', input: '' }; return;
    }
    if (task.id === 'pipette') {
      if (!lab.code) { state.toast = { text: 'Nejdřív potřebuješ ingredience ze skříně.', t: CONFIG.TOAST_TIME }; return; }
      if (lab.pipette >= 3) { state.toast = { text: 'Látky už jsou namíchané.', t: CONFIG.TOAST_TIME }; return; }
      startPipette(); return;
    }
    if (task.id === 'shelf') {
      if (lab.pipette < 3) { state.toast = { text: 'Lahvičky vrátíš, až namícháš látky.', t: CONFIG.TOAST_TIME }; return; }
      startMemory(); return;
    }
  }
  if (hide) {
    lab.hidden = hide.id;
    playSound([[300, 0, 0.05]]);
    state.toast = { text: `🙈 Schovaný (${hide.label}) – mezerník / ťuknutí = vylézt`, t: CONFIG.TOAST_TIME };
  }
}
SPOTS.push({ rect: labSpot, act: labAct, hintDx: 0 });
const vrahHidden = () => vrahOn() && state.lab && !!state.lab.hidden && state.room.id === LAB.ROOM;

// Otevřený úkol / schování: hráč stojí, svět běží (Lukášková chodí)
function labOverlayEvents(events, dt) {
  const lab = state.lab;
  if (!lab) return false;
  if (lab.hidden) {
    if (events.some((ev) => ev.type === 'action' || ev.x != null)) { lab.hidden = null; state.toast = null; }
    updateMovingTeachers(dt);
    return true;
  }
  const t = state.labTask;
  if (!t) return false;
  for (const ev of events) labTaskEvent(t, ev);
  if (state.labTask && state.labTask.kind === 'pipette') updatePipette(dt);
  if (state.labTask && state.labTask.kind === 'memory') updateMemory(dt);
  updateMovingTeachers(dt);
  return true;
}
const TASK_PANEL = { x: 200, y: 300, w: 400, h: 260 };
function labTaskEvent(t, ev) {
  if (ev.x != null && !pointInRect(ev.x, ev.y, TASK_PANEL, 0)) { state.labTask = null; return; }   // ťuk mimo = nechat být
  if (t.kind === 'table') { if (ev.type === 'action') state.labTask = null; return; }
  if (t.kind === 'code') {
    if (ev.x == null) return;
    const k = keypadKeys().find((kk) => pointInRect(ev.x, ev.y, kk.rect, 2));
    if (k) codeKey(k.key);
    return;
  }
  if (t.kind === 'pipette') { if (ev.type === 'action' || ev.x != null) pipetteStop(); return; }
  if (t.kind === 'memory') {
    if (ev.x == null) { if (ev.type === 'action') memorySelect(t.sel); return; }
    const i = memorySlots().findIndex((r) => pointInRect(ev.x, ev.y, r, 2));
    if (i >= 0) memorySelect(i);
    else if (pointInRect(ev.x, ev.y, memoryDoneButton(), 2)) memoryConfirm();
  }
}

// --- kód skříně: protonová čísla Ca (20) a Fe (26)
const keypadKeys = () => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'];
  return keys.map((key, i) => ({ key, rect: { x: TASK_PANEL.x + 120 + (i % 3) * 56, y: TASK_PANEL.y + 78 + Math.floor(i / 3) * 42, w: 50, h: 36 } }));
};
function codeKey(key) {
  const t = state.labTask, lab = state.lab;
  if (key === '⌫') { t.input = t.input.slice(0, -1); return; }
  if (key === 'OK') {
    if (t.input === LAB.CODE) {
      lab.code = true; state.labTask = null;
      playSound(CONFIG.SOUND_PICKUP);
      state.toast = { text: '🔓 Cvak! Ve skříni jsou ingredience. Teď pipeta.', t: CONFIG.TOAST_TIME + 1 };
    } else { t.input = ''; labNoise(0.2, '🔒 Špatný kód – skříň zapípala!'); }
    return;
  }
  if (t.input.length < 4) { t.input += key; playSound([[700 + Number(key) * 40, 0, 0.04]]); }
}

// --- pipeta: hladina stoupá sama, zastavit na rysce; 3 látky, každá rychlejší
const PIPETTE = { names: ['Chlorofyl', 'Zelená skalice', 'Kapka karmy'], colors: ['#43a047', '#26a69a', '#76ff03'], band: [0.6, 0.72] };
function startPipette() { state.labTask = { kind: 'pipette', level: 0, speed: 0.22 + state.lab.pipette * 0.09, msg: null, msgT: 0 }; }
function updatePipette(dt) {
  const t = state.labTask;
  if (t.msgT > 0) { t.msgT -= dt; if (t.msgT <= 0) t.msg = null; return; }
  t.level += t.speed * dt;
  if (t.level >= 1) pipetteStop();   // přeteklo samo
}
function pipetteStop() {
  const t = state.labTask, lab = state.lab;
  if (t.msgT > 0) return;
  const [a, b] = PIPETTE.band;
  if (t.level >= a && t.level <= b) {
    lab.pipette++;
    playSound([[880, 0, 0.06], [1175, 0.07, 0.08]]);
    if (lab.pipette >= 3) { state.labTask = null; state.toast = { text: '⚗️ Látky namíchané! Teď vrať lahvičky na poličku.', t: CONFIG.TOAST_TIME + 1 }; return; }
    Object.assign(t, { level: 0, speed: 0.22 + lab.pipette * 0.09, msg: 'Přesně! Další látka…', msgT: 0.8 });
  } else if (t.level > b) {
    labNoise(0.25, '🫧 Přelité! Zkumavka bublá a syčí…');
    Object.assign(t, { level: 0, msg: 'Přelité – znovu', msgT: 0.8 });
  } else {
    Object.assign(t, { level: 0, msg: 'Málo – znovu', msgT: 0.6 });
  }
}

// --- vrať to, jak to bylo: 5 lahviček 3 s ukázat, pak jsou zpřeházené; prohazovat dvojice
const MEMORY = { colors: ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa'], SHOW: 3 };
function startMemory() {
  const order = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
  state.labTask = { kind: 'memory', order, cur: [0, 1, 2, 3, 4], phase: 'show', t: MEMORY.SHOW, pick: null };
  shuffleMemory();
}
function shuffleMemory() {
  const t = state.labTask;
  do { t.cur = [...t.order].sort(() => Math.random() - 0.5); } while (t.cur.every((c, i) => c === t.order[i]));
  t.sel = 0;
}
function updateMemory(dt) {
  const t = state.labTask;
  if (t.phase === 'show') { t.t -= dt; if (t.t <= 0) t.phase = 'arrange'; }
}
const memorySlots = () => [0, 1, 2, 3, 4].map((i) => ({ x: TASK_PANEL.x + 40 + i * 66, y: TASK_PANEL.y + 80, w: 56, h: 100 }));
const memoryDoneButton = () => ({ x: TASK_PANEL.x + 130, y: TASK_PANEL.y + 200, w: 140, h: 36 });
function memorySelect(i) {
  const t = state.labTask;
  if (t.phase !== 'arrange' || i == null) return;
  if (t.pick === null) { t.pick = i; return; }
  [t.cur[t.pick], t.cur[i]] = [t.cur[i], t.cur[t.pick]];
  t.pick = null;
  playSound([[600, 0, 0.04]]);
}
function memoryConfirm() {
  const t = state.labTask, lab = state.lab;
  if (t.phase !== 'arrange') return;
  if (t.cur.every((c, i) => c === t.order[i])) {
    lab.memory = true; lab.done = true; state.labTask = null;
    lukHome();
    playSound(CONFIG.SOUND_COMPLETE);
    state.toast = { text: '✅ Všechno je jak dřív. Zmiz z laborky a zajdi za Křiváčkem!', t: CONFIG.TOAST_TIME + 2 };
    saveProgress();
  } else {
    labNoise(0.3, '🍶 Lahvičky nesedí – cinklo to!');
    t.phase = 'show'; t.t = 2; t.pick = null; shuffleMemory();
  }
}
window.addEventListener('keydown', (e) => {
  const t = state.labTask;
  if (!t || state.dialog) return;
  if (e.code === 'Escape') { state.labTask = null; return; }
  if (t.kind === 'code' && /^(Digit|Numpad)\d$/.test(e.code)) codeKey(e.code.slice(-1));
  if (t.kind === 'code' && e.code === 'Backspace') codeKey('⌫');
  if (t.kind === 'code' && (e.code === 'Enter' || e.code === 'NumpadEnter')) codeKey('OK');
  if (t.kind === 'memory') {
    if (KEYMAP.left.includes(e.code)) t.sel = (t.sel + 4) % 5;
    if (KEYMAP.right.includes(e.code)) t.sel = (t.sel + 1) % 5;
    if (e.code === 'Enter') memoryConfirm();
  }
});

// Křiváček namíchá lektvar (bonus: jednička, když hráče nikdo nechytil)
function labPotion() {
  const bonus = !state.vrah.caught;
  playScene([
    { who: K(), text: 'Výborně, Romane. Teď to zamíchat… kapka karmy… a je to.' },
    { who: K(), text: bonus ? 'A protože tě nikdo nechytil – jednička z biologie. Zasloužená.' : 'Chytili tě, ale aspoň jsi to dotáhl. A já tě neznám.' },
  ], () => {
    state.vrah.route = 'laborka';
    if (bonus) state.vrah.jednicka = true;
    setVrahStage('lektvar');
    state.toast = { text: bonus ? '🧪 Máš Lektvar Zelené Karmy · 📗 jednička z biologie' : '🧪 Máš Lektvar Zelené Karmy', t: CONFIG.TOAST_TIME + 2 };
  });
}

// =====================================================================
// KABINET VĚČNOSTI – kvíz na čas: přiřadit značku k prvku. 8 otázek, 40 s, stačí 6.
// Výhra = propuštění (laborka znovu), prohra = GAME OVER u výdejního okénka.
// =====================================================================
const ELEMENTS = [['Sodík', 'Na'], ['Draslík', 'K'], ['Železo', 'Fe'], ['Vápník', 'Ca'], ['Měď', 'Cu'], ['Stříbro', 'Ag'], ['Zlato', 'Au'],
  ['Olovo', 'Pb'], ['Rtuť', 'Hg'], ['Cín', 'Sn'], ['Síra', 'S'], ['Dusík', 'N'], ['Kyslík', 'O'], ['Uhlík', 'C'], ['Fosfor', 'P'],
  ['Chlor', 'Cl'], ['Zinek', 'Zn'], ['Hořčík', 'Mg'], ['Hliník', 'Al'], ['Křemík', 'Si'], ['Vodík', 'H'], ['Helium', 'He']];
const QUIZ = { COUNT: 8, TIME: 40, GOAL: 6 };
function startQuiz() {
  const pool = [...ELEMENTS].sort(() => Math.random() - 0.5).slice(0, QUIZ.COUNT);
  const questions = pool.map(([name, sym]) => {
    const wrong = ELEMENTS.filter((e) => e[1] !== sym).sort(() => Math.random() - 0.5).slice(0, 3).map((e) => e[1]);
    return { name, sym, options: [sym, ...wrong].sort(() => Math.random() - 0.5) };
  });
  state.quiz = { questions, i: 0, right: 0, t: QUIZ.TIME, sel: 0, fb: null };
}
const quizOptions = () => [0, 1, 2, 3].map((i) => ({ x: 170 + (i % 2) * 240, y: 330 + Math.floor(i / 2) * 80, w: 220, h: 64 }));
function quizAnswer(i) {
  const q = state.quiz, cur = q.questions[q.i];
  if (!cur || q.fb) return;
  const ok = cur.options[i] === cur.sym;
  if (ok) q.right++;
  q.fb = { ok, t: 0.5 };
  playSound(ok ? [[880, 0, 0.06]] : [[160, 0, 0.15]], ok ? CONFIG.SOUND_WAVE : 'sawtooth');
}
function updateQuiz(dt) {
  const q = state.quiz;
  q.t -= dt;
  if (q.fb) { q.fb.t -= dt; if (q.fb.t <= 0) { q.fb = null; q.i++; q.sel = 0; } }
  if (q.i >= q.questions.length || q.t <= 0) finishQuiz();
}
function finishQuiz() {
  const q = state.quiz, won = q.right >= QUIZ.GOAL;
  state.quiz = null;
  if (won) {
    playSound(CONFIG.SOUND_COMPLETE);
    playScene([
      { who: LU(), text: `${q.right} z ${q.questions.length}. Hm. Na vzorek docela slušné. Jdi – a ať tě tu už nevidím.` },
      { text: 'Roman je propuštěn. Laborku můžeš zkusit znovu.' },
    ], labRetry);
  } else {
    playSound([[300, 0, 0.2], [200, 0.25, 0.3], [120, 0.6, 0.6]], 'sawtooth');
    state.gameOver = { t: 0 };
  }
}
function quizEvents(events) {
  for (const ev of events) {
    if (ev.type === 'action') { quizAnswer(state.quiz.sel); continue; }
    if (ev.x == null) continue;
    const i = quizOptions().findIndex((r) => pointInRect(ev.x, ev.y, r, 2));
    if (i >= 0) quizAnswer(i);
  }
}
window.addEventListener('keydown', (e) => {
  const q = state.quiz;
  if (!q || e.repeat) return;
  if (KEYMAP.left.includes(e.code)) q.sel = q.sel % 2 ? q.sel - 1 : q.sel;
  if (KEYMAP.right.includes(e.code)) q.sel = q.sel % 2 ? q.sel : q.sel + 1;
  if (KEYMAP.up.includes(e.code)) q.sel = q.sel >= 2 ? q.sel - 2 : q.sel;
  if (KEYMAP.down.includes(e.code)) q.sel = q.sel >= 2 ? q.sel : q.sel + 2;
  const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code];
  if (n !== undefined) quizAnswer(n);
});
// Po propuštění / „zkusit znovu“: laborka od začátku, hráč na chodbě před A114
function labRetry() {
  state.gameOver = null;
  state.lab = newLab();
  state.lab.talked = true;   // Křiváček už ji jednou zabavil – teď hlídá
  lukPatrol();
  state.lab.present = Infinity;
  const door = ROOMS[LAB.ROOM].doors[0];
  enterRoom(door.to, door.spawn);
  saveProgress();
}
// GAME OVER: Roman o 40 let starší hlídá frontu u výdejního okénka
const gameOverButtons = () => [
  { id: 'retry', label: 'Zkusit laborku znovu', rect: { x: 150, y: 500, w: 240, h: 50 } },
  { id: 'title', label: 'Na úvod', rect: { x: 410, y: 500, w: 240, h: 50 } },
];
function gameOverEvents(events) {
  for (const ev of events) {
    if (state.gameOver.t < 1.5) continue;
    let b = null;
    if (ev.type === 'action') b = gameOverButtons()[0];
    else if (ev.x != null) b = gameOverButtons().find((bb) => pointInRect(ev.x, ev.y, bb.rect, 2));
    if (!b) continue;
    if (b.id === 'retry') labRetry();
    else { state.gameOver = null; saveProgress(); goToTitle(); }
    return;
  }
}

// =====================================================================
// KRESLENÍ LABORKY
// =====================================================================
function drawLabWorld() {
  if (state.room.id !== LAB.ROOM) return;
  const room = state.room, X = (x) => room.x + x, Y = (y) => room.y + y;
  // periodická tabulka na horní zdi vlevo od tabule
  const pt = { x: X(145), y: Y(3), w: 70, h: 16 };
  drawRect(pt, '#fafafa');
  for (let r = 0; r < 2; r++) for (let c = 0; c < 9; c++) drawRect({ x: pt.x + 3 + c * 7.4, y: pt.y + 2 + r * 6.5, w: 6, h: 5 }, ['#ef9a9a', '#90caf9', '#a5d6a7', '#ffe082'][(r + c) % 4]);
  // digestoř vpravo nahoře
  drawRect({ x: X(534), y: Y(22), w: 74, h: 36 }, '#b0bec5');
  drawRect({ x: X(538), y: Y(26), w: 66, h: 24 }, 'rgba(180, 220, 240, 0.8)');
  drawRect({ x: X(534), y: Y(54), w: 74, h: 6 }, '#78909c');
  // kostra vlevo dole
  const kx = X(86), ky = Y(366);
  ctx.strokeStyle = '#f5f5f5'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(kx, ky, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(kx, ky + 7); ctx.lineTo(kx, ky + 32); ctx.moveTo(kx - 10, ky + 14); ctx.lineTo(kx + 10, ky + 14);
  ctx.moveTo(kx, ky + 32); ctx.lineTo(kx - 7, ky + 46); ctx.moveTo(kx, ky + 32); ctx.lineTo(kx + 7, ky + 46); ctx.stroke();
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(kx - 6, ky + 18 + i * 4); ctx.lineTo(kx + 6, ky + 18 + i * 4); ctx.stroke(); }
  // polička s lahvičkami na spodní zdi vpravo
  drawRect({ x: X(522), y: Y(400), w: 70, h: 18 }, '#8d6e63');
  MEMORY.colors.forEach((c, i) => drawRect({ x: X(526 + i * 13), y: Y(403), w: 9, h: 12 }, c));
  // štítek na skříni
  if (vrahOn() && state.vrah.stage === 'laborka' && state.lab && !state.lab.code) {
    roundRectPath(X(74), Y(34), 36, 16, 4); ctx.fillStyle = '#fff8e1'; ctx.fill();
    ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = '#3b2a1c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(LAB.CODE_TEXT, X(92), Y(42));
  }
  drawLabMarkers();
  // výhled Lukáškové
  const lu = LU();
  if (vrahOn() && state.lab && state.lab.talked && !state.lab.done && lu.room === LAB.ROOM && lu.face && lu.rect) {
    const r = lu.rect, ex = r.x + r.w / 2, ey = r.y + r.h / 2, a = Math.atan2(lu.face.y, lu.face.x);
    const g = ctx.createRadialGradient(ex, ey, 10, ex, ey, PRANK.VIEW_RANGE);
    g.addColorStop(0, `rgba(140, 255, ${Math.round(200 - 160 * state.lab.sus)}, 0.32)`);
    g.addColorStop(1, 'rgba(140, 255, 200, 0.03)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.arc(ex, ey, PRANK.VIEW_RANGE, a - PRANK.VIEW_HALF_ANGLE, a + PRANK.VIEW_HALF_ANGLE); ctx.closePath(); ctx.fill();
  }
  // schovaný Roman: jen obrys
  if (vrahHidden()) {
    const p = state.player;
    ctx.globalAlpha = 0.35; drawPlayerFigure(p.x + p.w / 2, p.y + p.h, 0, 0); ctx.globalAlpha = 1;
  }
}
// Co je v laborce právě na řadě: zvýrazní se to místo (a tabulka, dokud není kód)
function labTarget() {
  const l = state.lab;
  if (!l || !l.talked) return null;
  if (l.done) return 'door';
  if (!l.code) return 'cabinet';
  if (l.pipette < 3) return 'pipette';
  return 'shelf';
}
function drawLabMarkers() {
  const lab = state.lab, room = state.room;
  if (!vrahOn() || state.vrah.stage !== 'laborka' || !lab || !lab.talked || room.id !== LAB.ROOM) return;
  const pulse = 0.5 + 0.5 * Math.sin(state.time * 4);
  const ring = (r, strong) => {
    ctx.strokeStyle = `rgba(255, 213, 74, ${strong ? 0.5 + 0.5 * pulse : 0.35})`; ctx.lineWidth = strong ? 3 : 2;
    ctx.setLineDash(strong ? [] : [5, 4]);
    roundRectPath(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 8); ctx.stroke(); ctx.setLineDash([]);
    if (strong) {   // poskakující šipka nad místem
      const cx = r.x + r.w / 2, y = r.y - 14 - pulse * 5;
      ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.moveTo(cx - 8, y - 8); ctx.lineTo(cx + 8, y - 8); ctx.lineTo(cx, y + 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3b2a1c'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  };
  const target = labTarget();
  if (target === 'door') { const d = room.doors[0]; ring({ x: d.x, y: d.y - 10, w: d.w, h: d.h + 10 }, true); }
  else if (target) {
    ring(labRect(LAB.spots[target]), true);
    if (target === 'cabinet' && !lab.read) ring(labRect(LAB.spots.table), false);   // nápověda: tabulka
  }
  // kde se dá schovat, když Lukášková hlídá
  const lu = LU();
  if (lu.room === LAB.ROOM && lu.route && !lab.hidden) {
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const h of Object.values(LAB.hides)) { const r = labRect(h); ctx.globalAlpha = 0.85; ctx.fillText('🙈', r.x + r.w / 2, r.y + 10); ctx.globalAlpha = 1; }
  }
}
// Seznam úkolů v laborce – pruh pod místností (laboratoř je na obrazovce celá, dole je volno)
function drawLabChecklist() {
  const l = state.lab;
  const rows = [
    [l.code, `Kód skříně „${LAB.CODE_TEXT}“`],
    [l.pipette >= 3, `Pipeta ${Math.min(3, l.pipette)}/3`],
    [l.memory, 'Lahvičky na poličku'],
  ];
  roundRectPath(130, 566, 540, 26, 8); ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'; ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  rows.forEach(([ok, text], i) => {
    ctx.font = ok ? '13px sans-serif' : 'bold 13px sans-serif';
    ctx.fillStyle = ok ? '#8fd18f' : '#ffffff';
    ctx.fillText(`${ok ? '✔' : '☐'} ${text}`, 220 + i * 180, 580);
  });
}
function drawLabHud() {
  const lab = state.lab;
  if (!lab || !lab.talked || lab.done || state.room.id !== LAB.ROOM || state.vrah.stage !== 'laborka') return;
  drawLabChecklist();
  const x = 250, y = 82, w = 300;
  roundRectPath(x, y, w, 22, 8); ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fill();
  roundRectPath(x + 110, y + 6, (w - 120) * lab.sus, 10, 4);
  ctx.fillStyle = lab.sus > 0.7 ? '#e53935' : lab.sus > 0.35 ? '#fb8c00' : '#76ff03'; ctx.fill();
  ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(lab.away > 0 ? '🧪 Lukášková pryč' : '🧪 Podezření', x + 8, y + 12);
  drawLabTask();
}
function drawLabTask() {
  const t = state.labTask;
  if (!t) return;
  const P = TASK_PANEL;
  roundRectPath(P.x, P.y, P.w, P.h, 12);
  ctx.fillStyle = 'rgba(244, 236, 216, 0.96)'; ctx.fill();
  ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 3; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#3b2a1c';
  const title = { table: '📋 Periodická tabulka (výřez)', code: `🔒 Kód skříně: ${LAB.CODE_TEXT}`, pipette: `⚗️ Pipeta: ${PIPETTE.names[state.lab.pipette] || ''}`, memory: '🍶 Vrať lahvičky, jak byly' }[t.kind];
  ctx.fillText(title, P.x + P.w / 2, P.y + 22);
  ctx.font = '11px sans-serif'; ctx.fillStyle = '#6b5a48';
  ctx.fillText('Esc / ťuknutí mimo = nechat být (a schovat se!)', P.x + P.w / 2, P.y + P.h - 12);
  if (t.kind === 'table') {   // prvky 1–30: značka a protonové číslo
    const syms = ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn'];
    syms.forEach((s, i) => {
      const x = P.x + 22 + (i % 10) * 36, y = P.y + 46 + Math.floor(i / 10) * 56;
      drawRect({ x, y, w: 32, h: 48 }, ['#ffcdd2', '#bbdefb', '#c8e6c9', '#fff9c4'][Math.floor(i / 10) + (i % 2)] || '#eeeeee');
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#555'; ctx.fillText(String(i + 1), x + 16, y + 10);
      ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#1b1b1b'; ctx.fillText(s, x + 16, y + 30);
    });
    return;
  }
  if (t.kind === 'code') {
    roundRectPath(P.x + 120, P.y + 40, 160, 32, 6); ctx.fillStyle = '#263238'; ctx.fill();
    ctx.font = 'bold 22px monospace'; ctx.fillStyle = '#76ff03';
    ctx.fillText((t.input + '____').slice(0, 4).split('').join(' '), P.x + P.w / 2, P.y + 57);
    for (const k of keypadKeys()) {
      roundRectPath(k.rect.x, k.rect.y, k.rect.w, k.rect.h, 6);
      ctx.fillStyle = k.key === 'OK' ? '#2e7d32' : '#8a5a2e'; ctx.fill();
      ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(k.key, k.rect.x + k.rect.w / 2, k.rect.y + k.rect.h / 2 + 1);
    }
    if (!state.lab.read) {   // tip vlevo vedle klávesnice
      ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#c62828';
      ctx.fillText('Tip: tabulka', P.x + 60, P.y + 120); ctx.fillText('prvků visí', P.x + 60, P.y + 136); ctx.fillText('na zdi laborky', P.x + 60, P.y + 152);
    }
    return;
  }
  if (t.kind === 'pipette') {   // zkumavka s ryskou
    const tx = P.x + P.w / 2 - 30, ty = P.y + 50, tw = 60, th = 160, [a, b] = PIPETTE.band;
    roundRectPath(tx, ty, tw, th, 20); ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.fill();
    ctx.strokeStyle = '#78909c'; ctx.lineWidth = 2; ctx.stroke();
    const lv = Math.min(1, t.level);
    ctx.save(); roundRectPath(tx, ty, tw, th, 20); ctx.clip();
    drawRect({ x: tx, y: ty + th * (1 - lv), w: tw, h: th * lv }, PIPETTE.colors[state.lab.pipette] || '#76ff03');
    ctx.restore();
    drawRect({ x: tx - 10, y: ty + th * (1 - b), w: tw + 20, h: th * (b - a) }, 'rgba(255, 193, 7, 0.35)');
    ctx.strokeStyle = '#e65100'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx - 12, ty + th * (1 - (a + b) / 2)); ctx.lineTo(tx + tw + 12, ty + th * (1 - (a + b) / 2)); ctx.stroke();
    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#3b2a1c';
    ctx.fillText(t.msg || (isTouchHint() ? 'Ťukni, až bude na rysce' : 'Mezerník, až bude na rysce'), P.x + P.w / 2, P.y + 225);
    ctx.fillText(`${state.lab.pipette}/3`, P.x + P.w - 30, P.y + 22);
    return;
  }
  if (t.kind === 'memory') {
    const show = t.phase === 'show';
    memorySlots().forEach((r, i) => {
      const c = MEMORY.colors[show ? t.order[i] : t.cur[i]];
      if (!show && t.pick === i) { roundRectPath(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 8); ctx.fillStyle = '#ffd54a'; ctx.fill(); }
      if (!show && !isTouchHint() && t.sel === i) { ctx.strokeStyle = '#3b2a1c'; ctx.lineWidth = 2; ctx.strokeRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12); }
      drawRect({ x: r.x + 20, y: r.y, w: 16, h: 20 }, '#cfd8dc');
      roundRectPath(r.x + 6, r.y + 18, r.w - 12, r.h - 18, 10); ctx.fillStyle = c; ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#3b2a1c';
    if (show) ctx.fillText(`Zapamatuj si pořadí… ${Math.ceil(t.t)}`, P.x + P.w / 2, P.y + 58);
    else {
      ctx.fillText(isTouchHint() ? 'Ťukni na dvě lahvičky = prohodit' : '← → vyber, mezerník = vzít / prohodit', P.x + P.w / 2, P.y + 58);
      const b = memoryDoneButton();
      roundRectPath(b.x, b.y, b.w, b.h, 8); ctx.fillStyle = '#2e7d32'; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillText('Hotovo (Enter)', b.x + b.w / 2, b.y + b.h / 2 + 1);
    }
  }
}
function drawQuiz() {
  const q = state.quiz;
  if (!q) return;
  ctx.fillStyle = '#1a0f2e'; ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  for (let i = 0; i < 40; i++) {   // „věčnost“ – hvězdičky
    ctx.fillStyle = `rgba(200, 180, 255, ${0.2 + 0.2 * Math.sin(state.time * 2 + i)})`;
    ctx.fillRect((i * 97) % 800, (i * 53) % 600, 2, 2);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#b388ff';
  ctx.fillText('⏳ Kabinet věčnosti', 400, 50);
  ctx.font = '15px sans-serif'; ctx.fillStyle = '#d1c4e9';
  ctx.fillText(`Lukášková: „Přiřaď značky. ${QUIZ.GOAL} z ${QUIZ.COUNT} a můžeš jít.“`, 400, 82);
  ctx.fillText(`Otázka ${Math.min(q.i + 1, q.questions.length)}/${q.questions.length}  ·  správně ${q.right}  ·  ${Math.ceil(q.t)} s`, 400, 110);
  roundRectPath(150, 130, 500, 10, 4); ctx.fillStyle = '#311b92'; ctx.fill();
  roundRectPath(150, 130, 500 * Math.max(0, q.t / QUIZ.TIME), 10, 4); ctx.fillStyle = q.t < 10 ? '#ff5252' : '#b388ff'; ctx.fill();
  const cur = q.questions[q.i];
  if (!cur) return;
  ctx.font = 'bold 44px sans-serif'; ctx.fillStyle = '#ffffff';
  ctx.fillText(cur.name, 400, 240);
  quizOptions().forEach((r, i) => {
    const isAns = q.fb && cur.options[i] === cur.sym;
    roundRectPath(r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = isAns ? '#2e7d32' : i === q.sel && !isTouchHint() ? '#7e57c2' : '#4527a0'; ctx.fill();
    ctx.font = 'bold 30px sans-serif'; ctx.fillStyle = '#ffffff';
    ctx.fillText(cur.options[i], r.x + r.w / 2, r.y + r.h / 2 + 1);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#d1c4e9'; ctx.fillText(String(i + 1), r.x + 14, r.y + 14);
  });
  if (q.fb) { ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = q.fb.ok ? '#76ff03' : '#ff8a80'; ctx.fillText(q.fb.ok ? 'Správně!' : `Ne – ${cur.sym}`, 400, 300); }
}
function drawGameOver() {
  const g = state.gameOver;
  if (!g) return;
  g.t += 1 / 60;
  // výdejní okénko jídelny
  ctx.fillStyle = '#cfd8dc'; ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  drawRect({ x: 0, y: 330, w: CONFIG.WIDTH, h: 270 }, '#b0a28f');
  drawRect({ x: 120, y: 120, w: 560, h: 170 }, '#eceff1');
  drawRect({ x: 140, y: 140, w: 520, h: 110 }, '#37474f');
  drawRect({ x: 110, y: 250, w: 580, h: 30 }, '#90a4ae');
  ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('VÝDEJ OBĚDŮ', 400, 160);
  ctx.font = '15px sans-serif'; ctx.fillText('Dnes: knedlo, vepřo, zelo · Zítra: knedlo, vepřo, zelo', 400, 200);
  // starý šedivý Roman hlídá frontu
  ctx.save(); ctx.translate(330, 420); ctx.scale(1.6, 1.6);
  drawPlayerFigure(0, 0, 0, 0);
  ctx.restore();
  ctx.fillStyle = 'rgba(225, 225, 225, 0.92)';   // šedivé vlasy a knír – o 40 let starší
  ctx.beginPath(); ctx.ellipse(330, 328, 30, 13, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(300, 326, 7, 18); ctx.fillRect(353, 326, 7, 18);
  ctx.beginPath(); ctx.ellipse(330, 348, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
  // Křiváček v pozadí
  ctx.save(); ctx.translate(560, 400); ctx.scale(1.1, 1.1);
  drawFigure(0, 0, 0, 0, teacherLook(K()));
  ctx.restore();
  roundRectPath(500, 290, 150, 34, 10); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#3b2a1c'; ctx.fillText('„Já ho neznám.“', 575, 307);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'; ctx.fillRect(0, 20, CONFIG.WIDTH, 80);
  ctx.font = 'bold 34px sans-serif'; ctx.fillStyle = '#ff5252'; ctx.fillText('GAME OVER', 400, 48);
  ctx.font = '17px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('Doživotní dozor u výdejního okénka · o 40 let později…', 400, 80);
  if (g.t < 1.5) return;
  for (const b of gameOverButtons()) {
    roundRectPath(b.rect.x, b.rect.y, b.rect.w, b.rect.h, 12);
    ctx.fillStyle = b.id === 'retry' ? '#2e7d32' : '#455a64'; ctx.fill();
    ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(b.label, b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2 + 1);
  }
}
ICONS.grade = (cx, cy, s) => {   // papír s jedničkou
  ctx.fillStyle = '#fafafa'; ctx.fillRect(cx - s * 0.32, cy - s * 0.42, s * 0.64, s * 0.84);
  ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - s * 0.32, cy - s * 0.42, s * 0.64, s * 0.84);
  ctx.font = `bold ${Math.round(s * 0.6)}px serif`; ctx.fillStyle = '#c62828'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('1', cx, cy + s * 0.04);
};
