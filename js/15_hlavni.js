// Rozcestník obrazovek, herní smyčka a start (načítá se poslední)
// Část hry Dárek – načítá se v index.html v pořadí podle čísla.
'use strict';

// --- Rozcestník: co se má v daném kroku/snímku dít podle obrazovky ---
function update(dt) {
  tickSpeedrun(dt);   // časovač režimu Speedrun (28_speedrun.js)
  updateMultiplayer(dt);   // online hráči (29_multiplayer.js)
  updateVoice();           // hlasový chat (34_hlas.js)
  updateDuel(dt);          // online zápasy: výzvy a síť (35_online_hry.js)
  takeDuelTaps();          // okno s výzvou: Přijmout / Odmítnout
  takeOnlineTaps();        // tlačítko Online a jméno na úvodu
  takeQualityTaps();       // úvod: tlačítko Kvalita (30_kvalita.js)
  takeMenuButtonTaps();    // ve hře: tlačítko ☰ Hlavní menu (31_menu.js)
  takeVoiceTaps();         // ve hře: 🎤 (34_hlas.js)
  takeEmoteTaps();         // ve hře: smajlíky (29_multiplayer.js)
  takeMuteTaps();
  takeMusicTaps();
  if (state.screen === 'playing' && amongOn()) { updateAmong(dt); return; }   // Among Us (36_among.js)
  if (state.screen === 'playing') {
    takeCatalogTaps();
    takeInventoryTaps();
    takeMapTaps();
    updatePlaying(dt);
    watchProgress();
    return;
  }
  if (state.screen === 'basket') {
    state.time += dt;
    updateBasket(dt);
    return;
  }
  if (state.screen === 'chess') {
    state.time += dt;
    updateChess(dt);
    return;
  }
  if (state.screen === 'foosball') {
    state.time += dt;
    updateFoosball(dt);
    return;
  }
  if (state.screen === 'pingpong') {
    state.time += dt;
    updatePingpong(dt);   // 32_pingpong.js
    return;
  }
  if (state.screen === 'horor') {
    state.time += dt;
    updateHoror(dt);      // Bacha na Láďu – horor z první osoby (39_horor.js)
    return;
  }
  if (state.screen === 'skins') {
    state.time += dt;
    updateSkins(dt);      // Locker – výběr skinu (33_skiny.js)
    return;
  }
  state.time += dt; // animace v menu
  if (state.screen === 'end') {
    state.endTime += dt;
    updateConfetti(dt);
  }
  updateMenu();
}

function render() {
  cullReset();
  clearCanvas();   // i okraje širokého plátna na mobilu
  if (state.screen === 'title') renderTitle();
  else if (state.screen === 'end') renderEnd();
  else if (state.screen === 'basket') renderBasket();
  else if (state.screen === 'chess') renderChess();
  else if (state.screen === 'foosball') renderFoosball();
  else if (state.screen === 'pingpong') renderPingpong();
  else if (state.screen === 'skins') renderSkins();
  else if (state.screen === 'horor') renderHoror();
  else renderGame();
  if (state.screen === 'playing' && !amongOn()) { drawCatalog(); drawMap(); drawSongMenu(); drawPrankHud(); drawVrahOverlays(); drawStoryOverlays(); drawCatalogButton(); drawMapButton(); drawInventoryButton(); }
  drawMuteButton();
  drawMusicButton();   // co hraje (ve hře a na úvodu)
  if (state.screen === 'playing' && !amongOn()) drawEnergyBar();   // hlad (17_pribehy.js)
  drawSpeedrunTimer(); // časovač ve hře (jen speedrun)
  drawOnlineBadge();   // kolik hráčů je online (29_multiplayer.js)
  drawOnlineButton();  // tlačítko Online a jméno na úvodu
  drawMenuButton();    // ☰ Hlavní menu ve hře (31_menu.js)
  drawEmoteUi();       // 😊 smajlíky ve hře (29_multiplayer.js)
  drawVoiceButton();   // 🎤 hlas ve hře (34_hlas.js)
  drawDuelInvite();    // výzva na pingpong / fotbálek (35_online_hry.js)
  drawQualityButton(); // úvod: Kvalita (30_kvalita.js)
  drawMusicMenu();     // seznam písniček (P)
  drawModePick();      // výběr režimu při nové hře (úvod i závěr)
  drawSpawnPick();     // kde začít: venku / ve skříňkách (33_skiny.js)
  drawModesMenu();     // 🎮 Módy na úvodu (10_obrazovky.js)
  drawAmongPick();     // Among Us: seznam her (36_among.js)
  drawPauseMenu();     // Pozastaveno / Hlavní menu (31_menu.js)
  drawLeaderboard();   // okno žebříčku
}

// =====================================================================
// HERNÍ SMYČKA – pevný krok logiky, vykreslení jednou za snímek
// =====================================================================
let lastTime = performance.now();
let accumulator = 0;

function frame(now) {
  let frameTime = (now - lastTime) / 1000;
  lastTime = now;
  if (frameTime > CONFIG.MAX_FRAME_TIME) frameTime = CONFIG.MAX_FRAME_TIME;

  accumulator += frameTime;
  while (accumulator >= CONFIG.FIXED_DT) {
    update(CONFIG.FIXED_DT);
    accumulator -= CONFIG.FIXED_DT;
  }

  if (shouldRender()) render();   // nízká kvalita: každý druhý snímek (30_kvalita.js)
  requestAnimationFrame(frame);
}

// =====================================================================
// START
// =====================================================================
resize();
prepareRooms();
prepareCharacters();
enterRoom(CONFIG.START_ROOM);
state.savedGame = loadProgress();
state.savedVrah = loadProgress(CONFIG.SAVE_KEY_VRAH);   // Vrah z učebny C109 (18_vrah.js)
setScreen('title'); // hra začne až po kliknutí na „Hrát“
requestAnimationFrame((t) => { lastTime = t; frame(t); });
