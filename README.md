# Hra „Dárek“ – školní hra z Gymnázia Prachatice

2D hra s pohledem shora, odehrává se ve škole. Hráč (kamarád, jeho hlava je z fotky)
chodí po škole a plní úkoly pro učitele. Hra je **`index.html` + kód ve složce `js/` + hlavy v `obrazky/`**.
Nepotřebuje žádný build. Otevře se i dvojklikem bez serveru (skripty jsou obyčejné `<script src>`, ne moduly).
Na dárek se dá složit do jednoho souboru přes `python tools/slozit_do_jednoho.py`, výsledek je `jeden_soubor/hra_darek.html`.

Tento soubor je hlavně pro **Clauda v příští konverzaci**, aby věděl, co a jak.

---

## Spuštění

**Úvod:** jen hlavní hra (**Hrát**, nebo **Pokračovat** + **Nová hra**) a pod tím **🎮 Módy** (`modesItems`, `drawModesMenu` v `10_obrazovky.js`): 🔍 Vrah z učebny C109 (s postupem Pokračovat ve Vrahovi + Začít Vraha znovu), 👻 Bacha na Láďu, 👾 Among Us (online, jen s databází), 🏆 Žebříček, Zpět. Uživatel chtěl, ať na úvodu není moc tlačítek.

**Mobil** (`isMobileView`: dotyková obrazovka, nebo `?mobil` v adrese pro zkoušení na počítači):
- Svět je přiblížený `CONFIG.MOBILE_ZOOM` (1.45) a kamera jde za hráčem (`getCamera(room, zoom)`, obrazovka = (svět − cam) × zoom; ťuknutí se přepočítá zpátky).
- Na šířku je plátno širší než 800 (`VIEW.w = 600 × poměr stran`). Svět jde přes celou šířku, rozhraní (lišta, tlačítka, dialogy, minihry, úvod) zůstává v 800 px uprostřed (`VIEW.offX`, posun je v základní transformaci; `screenToGame` vrací souřadnice rozhraní). Plátno se každý snímek celé smaže (`clearCanvas`).
- Na výšku je přes hru výzva „Otoč telefon na šířku“ (`#otoc` v `index.html`, CSS media query).
- Při prvním dotyku se hra zkusí přepnout na celou obrazovku a na šířku (Android; iPhone to neumí).
- Pohled zepředu (ulice) a bufet se nepřibližují.
- Písmo rozhraní je na mobilu větší (`UI_MOBILE` / `applyUiSize` v `07_kresleni.js`): lišta, dialog (i vyšší), hlášky, nápovědy, tlačítka. Texty na tlačítkách a dole na úvodu se při nedostatku místa zúží (`fillText` s `maxWidth`). Na tlačítku Vraha je lupa 🔍, protože detektiv 🕵️ se na mobilu skládá ze dvou znaků a rozhazoval text.

- Na počítači stačí otevřít `index.html` v prohlížeči.
- Na mobilu ve stejné Wi-Fi se ve složce hry spustí server
  `python tools/server.py` a v mobilu se otevře
  `http://<IP počítače>:8000/index.html` (naposledy to bylo `http://10.0.1.27:8000/index.html`).
  Wi-Fi profil je „Veřejná“ a firewall Python blokuje. Buď se Pythonu povolí přístup,
  nebo se síť přepne na „Soukromá“. Systémová nastavení mění uživatel sám.
- Ovládání:
  - pohyb šipkami nebo WASD, na mobilu dotykovým joystickem;
  - mezerník nebo Enter = mluvit / koupit;
  - Esc = odejít z bufetu.

## Struktura složky

```
index.html            jen stránka (styl, plátno, joystick) a <script src> na soubory z js/ v pořadí
js/01_nastaveni.js    CONFIG – všechny laditelné konstanty (START_ROOM: 'ulice', barvy, rozměry, tlačítka)
js/02_mistnosti.js    ROOMS (čistá data) + spojené chodby (ROOMS.chodba: parts/openings/wallCuts),
                      SCHODY_A/A1, patroA, dolní šatny, Šatny 3, A113 = A114, třídy A209–A213,
                      BUFET_MENU, KAVOVAR_MENU, BELL, prepareRooms, doorRect
js/03_postavy.js      hlavy (obrazky/*.png, FACE_FILES) a TEACHERS
js/04_ukoly.js        QUESTS, prepareCharacters, pohyblivý učitel
js/05_stav_a_ovladani.js  state, klávesnice, joystick, ťuknutí
js/06_logika.js       pohyb, kolize, dveře, rozhovory (talkTo), úkoly (questStage…), SPOTS (zvonek, šachy)
js/07_kresleni.js     plátno, renderGame, Před školou (FRONT), bufet a kávovar (SHOPS, renderShop, renderKavovar)
js/08_grafika_mistnosti.js  drawFigure (postavička), OBSTACLE_ART (nábytek podle kind), ROOM_ART (podlahy a zdi místností)
js/09_ukladani_a_zvuk.js    saveProgress/loadProgress (localStorage), pípání (Web Audio) a hudba na pozadí (music, updateMusic)
js/10_obrazovky.js    úvod (renderTitle, TITLE_SCENE), závěr, tlačítka, resetGame, watchProgress
js/11_minihra_kos.js  hod na koš
js/12_sachy.js        šachy (pravidla, počítač, kreslení)
js/13_katalog.js      katalog úkolů (Q / tlačítko) a mapa školy (K / tlačítko)
js/14_fotbalek.js     stolní fotbal (FOOS, FOOS_RODS, fyzika míčku, počítač)
js/16_gumy.js         minihra Gumy s Davidem na parkovišti (PRANK, dozor a jeho výhled, ředitelna)
js/17_pribehy.js      inventář (E), peněženka pro Chána, motorka a minihra s dráty, Tomáš Klus a Lili, hledání cesty pro postavy (buildRoute)
js/18_vrah.js         samostatný režim Vrah z učebny C109 (scény, stopy v C109, lepení loga Slávie, finále)
js/19_laborky.js      laborky: schody dolů vedle Málova kabinetu, chodba laboratoří, laboratoř chemie (místnosti, kresba, nábytek chembench / stairwall / rockcabinet / plainwall; díl chodby se schody od Křiváčka)
js/20_skola.js        Terka s Rauscherem (pomluvy o Holubovi, bubliny), Kabinet tělocvikářů (Láďa), Kabinet Chválová (tráva a kouř)
js/21_pivo.js         quest Recept na pivo (Kája a Lukášková, Kuba a kamery, Soumarův počítač, tiskárna s letopočty)
js/22_struny.js       quest Struny pro Málu (kleště od školníka s odpočtem, Binková hlídá, kytary v C202)
js/23_tabak.js        quest Tabák pro Křiváčka (prohledat A113, sáčky = rychlejší chůze)
js/24_damien.js       studenti Damien, Robin, Michele a quest s hádankou na tabuli
js/25_robin.js        miniquest HTML pro Robina (editor s náhledem, Jelínek radí za peníze)
js/26_teplota.js      miniquest Teplota pro Láďu a výběr u školníka (kleště / teploměr)
js/27_rozhovory.js    drobné rozhovory postav (Zita a Emma)
js/28_speedrun.js     režim Speedrun (časovač) a žebříček přes Firebase Firestore (od kamaráda)
js/29_multiplayer.js  online hráči: kdo má zapnuté Online, vidí ostatní ve stejné místnosti (Firebase Realtime Database)
js/30_kvalita.js      kvalita grafiky (výchozí / nízká) a nekreslení věcí mimo obrazovku (od kamaráda)
js/31_menu.js         ☰ Hlavní menu / Pozastaveno ve hře (od kamaráda, napojené na 29_multiplayer.js)
js/32_pingpong.js     minihra pingpong u stolů v hale s pingpongem
js/33_skiny.js        výběr startu (venku / ve skříňkách), Locker v Dolních šatnách a výběr skinu
js/34_hlas.js         hlasový chat (WebRTC): ve stejné místnosti, hlasitost podle vzdálenosti, mluví se při držení V / 🎤
js/35_online_hry.js   pingpong, fotbálek a šachy proti kamarádovi online (výzva se sázkou, přijetí, síť během zápasu)
js/36_among.js        režim Among Us: seznam her, čekárna, nastavení, mapy A a C, role, zabíjení, porady, hlasování, konec
js/37_among_ukoly.js  Among Us: úkoly (testy z předmětů po 50 otázkách, rychlá matika, kabely, Bakaláři, tabule, koš)
js/38_among_extra.js  Among Us: třídy na mapách, venty, sabotáže (světla, dveře), barvy hráčů
js/39_horor.js        Bacha na Láďu – horor z první osoby po budově A (raycasting), Láďa honí, úkryty, klíče ve třídách
js/15_hlavni.js       update/render podle obrazovky, herní smyčka, START (musí být poslední)
obrazky/              hlavy 48 × 48 px: hrac.png, mala.png, krivacek.png, rauscher.png, holub.png, soumar.png, lencova.png, vesela.png, mraz.png …
zvuky/                hudba: pozadí/ = hudba na pozadí (CONFIG.MUSIC_PLAYLIST), „Treplev.mp3“ (v C202 u Kluse), „fotbálek.mp3“ (u fotbálku), Mykyta/ = písničky od Mykyho
tools/                server.py (server bez cache), oblicej_na_sprite.py (fotka → hlava do obrazky/), ucitele.sh, slozit_do_jednoho.py
fotky/                fotky a ukázky od uživatele
zalohy/               zálohy (index_pred_rozdelenim.html = celá hra v jednom souboru před rozdělením)
jeden_soubor/         výstup slozit_do_jednoho.py (generuje se, needitovat)
```

Pravidla:

- **Pořadí souborů je důležité.** Kód, který se spouští hned při načtení (třeba `ROOMS`, `ROOM_ART`, `FLOOR_FILLS`), smí používat jen věci z dřívějších souborů nebo funkce ze stejného souboru. Funkce volané až za hry (`update`, `render`, události) mohou být kdekoli.
- Nový soubor: přidat `<script src>` do `index.html` na správné místo. Stejný seznam si čte i `slozit_do_jednoho.py`.
- Každý soubor začíná `'use strict';`. Globální `const` a funkce jsou vidět ve všech souborech.
- Hlava nového učitele: `python tools/oblicej_na_sprite.py --foto fotky/X.jpg --cil JMENO` uloží `obrazky/jmeno.png`. Pak přidat řádek do `FACE_FILES` (`js/03_postavy.js`) a `look.face` u učitele.

### Souřadnice a místnosti

- Plátno má 800 × 600. Herní plocha je od `ROOM_AREA_TOP` 72, tedy 528 px vysoká. Velké místnosti mají kameru.
- `at` u překážek a učitelů je **střed** jako podíl rozměru místnosti. Píše se jako `x / šířka`,
  např. `{ x: 330 / 1080, y: 470 / 800 }`, aby šlo číst v px.
- `WALL_THICKNESS` je 20 px. Podlaha místnosti je tedy od 20 do `w - 20`.
- Dveře se zadávají buď `{ side, at, to }`, nebo `{ side, local: {x,y,w,h}, to, hidden, spawnLocal }`.
- Překážky:
  - všechny jsou pevné;
  - `void` = plná zeď nebo díra. `edges` určuje, které hrany se kreslí jako zeď;
  - `ironrail` = kované zábradlí.
- Místnost s `front: true` je pohled zepředu (`ulice`, `bufet`). Má `shop: true` = obchod.

### Spojená chodba v přízemí (`ROOMS.chodba`, 2200 × 2380)

Je to jedna velká místnost poskládaná z dílů (`parts`). Každý díl má offset, vlastní dveře,
nábytek a kresbu (`art`). Díly se kreslí v pořadí. U překryvů bere název oblasti poslední díl.

| Díl | Offset | Co to je |
|---|---|---|
| `prosklena` | 1220,400 | Prosklená chodba. |
| `hala` | 1160,0 | Hala s pingpongem, podlaha jako v prosklené. |
| `zapad` | 0,780 | Západní chodba: WC kluci, A113, A114, kabinety; nahoře vlevo vedle Málova kabinetu schody dolů do laborek. |
| `vychod` | 1500,1440, 700 × 440 | Východní chodba. Vodorovné rameno má uvnitř 160 px. Okna jsou nahoře a vlevo jako v patře. |
| `predSchody` | 380,900, 1080 × 800 | **Chodba před schody / společenská místnost.** Popis níže. |
| `hlavniTop` | 940,1460 | Horní kus hlavní chodby. |
| `hlavni` | 760,1580 | Hlavní chodba za hlavním vchodem. Dole dveře do bufetu, vpravo kabinet3. |
| `schodyA` | 1320,1360 | Schodiště do 1. patra. 1. rameno vede nahoru, 2. doleva a 3. dolů. Jde se po celém a do patra se přejde **až na konci 3. ramene** (dole). V patře se jde 3. ramenem nahoru a do přízemí se přejde až u horní podesty. Zespodu na 3. rameno nejde (zábradlí), do zrcadla mezi rameny ano. |
| `vstup` | 1070,2000, 140 × 380 | Vstupní chodba podle fotky „chodba za venkovní učebnou“: okrové zdi s červeným soklem, 8 kamenných schodů nahoru, modrý koberec, dole dveře ven (`venku`). Vlevo na zdi je **zvonek**. |

Spojení dílů:

- `openings` = otevřené průchody ve společných zdech. `fill` určuje podlahu v průchodu: `'old'` (teraco) nebo `'new'` (dlaždice).
- `wallCuts` = kusy zdí spodního dílu, které se nepočítají.
- **Pozor:** špatně velký `wallCut` už dvakrát způsobil, že se dalo projít zdí. Vždy to otestuj (viz Testy).

**Chodba před schody** (lokální px od rohu dílu):

- Hala je na x 20–820, y 260–680. Vlevo a dole v koutu sahá až k y 780 (kout x 380–560).
- Zadní zeď je na y 240–260. Rám průchodu je vpravo, na x 680–820. Za ním je předsíň se schodištěm doprava a nahoru do prosklené chodby.
- **Prostor za schody** (podle fotky `místnost před schody a schody 2.png`) je ve čtverečku mezi rameny schodiště, na x 820–957, y 20–137.
  - Dřív tam bylo černé zrcadlo schodiště. Vchází se do něj zleva z předsíně.
  - Od ramen ho dělí zábradlí.
  - Je tam vitrína s poháry, křeslo, modré sedačky, betonový sloup a hydrant.
  - V horní zdi jsou dveře do **Dolních šaten**.
  - Uživatel ho nechtěl vlevo za zadní zdí ani vpravo od haly.
- Nízká zídka s květinami je na prvních třech dlaždicích od zadní zdi, pod ní je sloup.
- **Kávovar** je u levé zdi (x 20–80, y 404–496). Svítí před ním podlaha a je u něj nápis.
  - Dveře `kavovar` jsou skrytý pruh vpravo před ním: kdo do kávovaru vejde, nakupuje.
- Vybavení podle fotek a `oprava.jpg`:
  - modré sedačky do L v pravém dolním rohu se stolkem;
  - sedačky u levé zdi se stolkem;
  - fotbálek;
  - šachový stolek s vaky;
  - u zadní zdi kiosek, vitrína s 3D tiskárnou, koše a palma.
- Smazáno: pult (místo něj je kávovar), rohožka v rámu, hasičák a neviditelná zeď u koutu (`wallCut` {760,1460,20,120}).

### Ostatní

- **Obchody** jsou v `SHOPS`: `bufet` a `kavovar`. Každý má menu a tabuli (ceník), na kterou se dá ťuknout.
  - Kávovar (`renderKavovar`) je kreslený podle `fotky/kávovar.jpg`. Po nákupu se v okénku objeví kelímek.
  - Položky s `group: 'kava'` jsou kávy (úkol s kávou pro Málu je smazaný, `buy` úkoly v kódu zůstaly).
- **Bufet** je pohled zepředu podle `fotky/bufet.png`. Má tabuli s menu (`BUFET_MENU`, ceny v Kč) a prodavačku.
  - Nakupuje se šipkami a mezerníkem, odchází se Esc nebo řádkem „Odejít“.
  - Peníze jsou v `state.money` a ukazují se v HUD.
  - **Jak si hráč vydělá peníze, ještě není vymyšlené** („to pak vymyslíme“). Peníze půjčuje Mála (čím dál míň), jsou za výhry v šachu a v Chánově peněžence.
- **Hlavy z fotek:** `tools/oblicej_na_sprite.py` (Pillow + numpy) vyřízne obličej, udělá 48 × 48 sprite a uloží ho do `obrazky/`. U fotky s bílým pozadím použij `--bile-pozadi`: pozadí od okraje se nejdřív přebarví na zelenou, jinak by se se světlým pozadím odmazala i světlá tvář. Za pozadí bere i šedý stín na zdi (skoro bez barvy, `sytost < 34`), pleť je barevnější a zůstane. U pestrého pozadí použij `--grabcut` (OpenCV GrabCut, `pip install opencv-python-headless`). Ovál je „asi hlava“, střed „určitě hlava“, okolí pozadí. Nechá se jen největší kus a díry se vyplní. Všechny příkazy jsou v `tools/ucitele.sh`.
  Hlavy učitelů se dělají přes `sh tools/ucitele.sh`. Náhledy jsou ve `fotky/hlava_*.png`.
  - **Ruční opravy hlav:** uživatel pošle screenshot zvětšené hlavy s modrými čarami (`fotky/X oprava.jpg`), co je za čarou, má pryč. Dělá to `tools/oriznout_podle_car.py` (bez `--obrys` jsou čáry svislé hranice vlevo/vpravo, s `--obrys` čára obtáčí hlavu). Volá se na konci `ucitele.sh`, po vygenerování hlavy, a nesmí se pouštět dvakrát po sobě, protože se napasuje podle okrajů hlavy. Když čára na hotové hlavě ukazuje, kam hlavu **doplnit** (mezera v obličeji, chybějící brada), použije se stejný příkaz jako při výrobě hlavy a k němu `--doplnit "fotky/X oprava.jpg"`: plocha mezi čarou a hlavou se doplní z fotky (Bečvář, Veselá). Když je modře obtažená hlava přímo na fotce (ne na hotové hlavě), použije se `oblicej_na_sprite.py --obrys "fotky/X oprava.jpg"`: hlava se vyřízne přesně podle čáry a výřez se spočítá sám (Lencová). Hotové: Rauscher, Binková, Šmahel (`--obrys`), Zita (`--posun 3` = hlava o 3 px doprava, aby seděla na těle).
- **Postavička:**
  - hlava se kreslí 40 px (`PLAYER_HEAD_SIZE`);
  - trup má 24 px s rameny, ruce mají dlaně a houpou se, nohy mají 14 px;
  - kolize je čtverec 32 px u nohou (`PLAYER_SIZE`).

**Kabinet 2 (Křiváček)** je podle `fotky/kabinet křiváček.jpg`: místnost je 460 × 420, vlevo je vysoké rozšíření a kout vpravo nahoře je plná zeď (`void` s `edges: ['left', 'bottom']`, kreslí `drawVoidWalls`). Dveře do západní chodby jsou nahoře vpravo (`local`, na spodní hraně koutu), dole vpravo jsou dveře do A114 (v A114 nahoře vpravo). V rozšíření je velký stůl se dvěma počítači (`monitor`) a dvěma židlemi nahoře a dole, knihovna je na pravé zdi.

**Zvonek** ve vstupní chodbě je zvonek do kanceláře: ozve se Vozábalová „Romane, přestaň na mě zvonit.“ (`BELL.lines`). **Školník** mimo questy říká „Ta ředitelka mi zakázala brát si vás z hodin, teda až na tělák.“

**WC kluci v přízemí** (`wcKluci0`, u Mály) je podle `fotky/záchody u mály .jpg`: tři kabinky u levé zdi s dvířky doprava (`stall` s `facing: 'right'`), pod nimi zídka (`wcwall`), tři mušle na pravé zdi (`urinal`), dveře do západní chodby dole na levé zdi a dvě umyvadla u spodní zdi vpravo (`sink` s `wall: 'bottom'`). Otočený nábytek kreslí `drawTurned`.

**A107** je podle `fotky/A107.jpg`, focené ode dveří vpravo nahoře pohledem podél místnosti doleva. Je to jazyková učebna:
- dřevěné stoly se sluchátky (`langbench`) do U podle `fotky/A107 oprava.jpg`: levé křídlo pod okny navazuje na katedru, spodní řada mezi křídly a pravé křídlo, židle jsou vždy zvenku. U levého křídla je lavice pro dva (židle nahoře, dá se za ní projít). Za pravým křídlem je ulička ke dveřím.
- dveře jsou na pravé zdi nahoře (`at: 0.19`),
- katedra s počítačem vlevo nahoře,
- bílá tabule na horní zdi, u dveří umyvadlo se zásobníkem na ručníky a koš na tříděný odpad (`trashbin`),
- zelený sokl, plakáty na spodní zdi, žlutooranžové linoleum.

**A114** je laboratoř podle `fotky/A114.png`:

- parkety do stromečku (`drawHerringboneTile`);
- uprostřed rovná dlouhá lavice s umyvadly;
- na ni jsou z obou stran napojené tři řady stolů `labbench` se židlemi;
- kolem všude ulička, mezi řadami 42 px;
- skříň a radiátory pod okny.

**A113** je stejná laboratoř jako A114:

- obstacles i kresba se kopírují z `a114`;
- dveře jsou vpravo uprostřed (stejně jako v A114);

**Dolní šatny** (`satnyDole`) jsou podle `fotky/šatny správné.jpg`:

- Kreslí se jako šatny.
- Vchod je dole vlevo a vede do prostoru za schody v chodbě před schody.
- Skříňky jsou podél zdí, rohy zůstaly volné.
- Uprostřed je blok skříněk zády k sobě a nad ním hnědá lavička.
- Vpravo nahoře jsou dveře do Šaten 3.

**Šatny 3** (`satny3`) jsou podle `šatny 3.jpg` a `šatny 4.jpg`:

- vlevo dole dveře do dolních šaten a před nimi šedá rohož;
- na levé zdi skříňky;
- červené schody: zdola vpravo nahoru, nahoře podesta a zatočí **doleva**;
  - horní rameno je krátké (x 156–280), spodní rameno končí na y 325, pod ním je podlaha;
  - vlevo nahoře je volno a od ramene ho dělí zábradlí;
- od chodbičky schody dělí zábradlí.

Levý konec horního ramene je skrytý přechod do `satny2`. Přijde se **nahoře na podlahu** vedle schodů (`spawnLocal`), takže se schody nejdou dvakrát. Obráceně: konec schodů v `satny2` vede do Šaten 3 dole pod schody.

**Druhé schody k šatnám** (`satny2`) jsou podle `šatny 100.jpg` a skutečné fotky `druhé schody k šatnám.JPEG`:

- dveře do šaten jsou vpravo dole;
- na pravé zdi jsou skříňky, barvy se střídají po dvířkách (modrá, žlutá, zelená a dokola, `lockers` s `colors`), modré jsou v levém horním rohu; u začátku pravých skříněk stojí Myky;
- schody: z podlahy vlevo dole pár schodů doleva, podesta a pak zatočí doprava, dlouhé rameno dolů podél levé zdi;
- na jeho konci je přechod do Šaten 3.

**Prostor za schody** (`šatny 103/104.jpg`) je prázdný. Dveře do dolních šaten jsou na jeho pravé straně pod 2. ramenem schodiště. Před zábradlím, takže se do nich nedá spadnout ze schodů do prosklené chodby.

**Parkoviště** je zvětšené 1,4× (`PARKOVISTE_SCALE`, teď 896 × 672) i s auty. Rozměry v datech i v kresbě zůstávají v původním měřítku 640 × 480; kresbu zvětšuje `scaleRoomArt` (zdi zůstanou 20 px). Původně je podle `parkoviště.jpg` a `parkoviště 2 .jpg` a popisu uživatele:

- Vpravo dole stojí blok budovy (`void` solid). Nahoře je bílá budova s červenou taškou, dole nižší žlutá přístavba s plochou střechou. Střechy a fasády kreslí `drawOver`.
- **Dveře do Céčka** jsou v horní stěně budovy (`local` 532,110). Vyjde se nahoru na úzkou cestu mezi budovou a plotem do ulice.
- Jde se **doleva podél budovy** a **za rohem dolů** je parkoviště:
  - 5 aut čelem k budově, bílé vodorovné značení stání;
  - pruh trávy mezi auty a budovou.
- Vlevo nahoře je budka (garáž) s vraty doprava.
- Na horní zdi vlevo je výjezd do ulice.
- Dole a vlevo je kamenná zídka s plotem a za ní ulice z kostek.
- Flood fill ověřil, že ode dveří je dosažitelná celá volná plocha.

**Zvonek** je v `BELL` (vstupní chodba, vlevo na zdi):

- U zvonku se ukáže bublina. Mezerníkem nebo ťuknutím se zazvoní: crrr, vlny a dialog s náhodnou hláškou z `BELL.lines`, pokaždé jinou než minule.
- Hlášky jsou zatím provizorní. **Uživatel pošle vlastní**, pak se jen přepíše pole `BELL.lines`.

**Pozor:** poloha `at` předmětů a učitelů v `chodba` je podíl výšky celé chodby. Když se mění `h`, musí se upravit i ona.

**Třídy v 1. patře budovy A** (dveře v `patroA`):

- A209 je naproti konci schodů z přízemí (dolní zeď chodby, x 1110);
- A210 je v rohu chodby vlevo dole (dolní zeď hlavní chodby, úplně vlevo);
- A211 je v půlce levého ramene (levá zeď);
- A212 je na konci levého ramene vlevo;
- **Kabinet A213** je na horní zdi ramene vedle A212. Číslo uživatel nezadal, A213 je odhad.
- **A209 a A210** jsou počítačové učebny podle `fotky/A209.jpg` (A210 stejná, 600 × 460):
  - dveře nahoře vpravo, bílá tabule na levé zdi, okna nahoře;
  - stoly s počítači (`pcdesk`, `wall` = kde jsou monitory, umí top/bottom/left/right) tvoří spojené U se spojkou vpravo, otevřené k tabuli; oranžové židle jsou z vnější strany U, monitory míří dovnitř;
  - A209 má dveře nahoře vpravo, A210 nahoře vlevo (z rohu chodby dole vlevo);
  - U je odsunuté od zdí, aby se za počítači dalo projít;
  - uprostřed lavice čelem k tabuli, u oken po dvou a dole po jedné.
- A211 a A212 jsou obyčejné třídy (`makeClassroomArt`, `classroomDesks`).
- **Kanceláře a kabinety** (podle `fotky/sborovna.jpg`, dveře v `patroA`):
  - `predsinKabinetu` – Předsíň kabinetů. Dveře z chodby (dolní zeď, x 1410) má nahoře vpravo, vedle nich vpravo tiskárnu (`printer`, k ní se pak něco vymyslí). Vlevo uprostřed je Kabinet A214, dole uprostřed Kabinet A215.
  - `kancelar` – Kancelář školy (dolní zeď chodby, x 1664). Vlevo je napojená na `reditelna` (Ředitelna).
  - `kabinetA216` je na pravé zdi konce chodby.
  - `sborovna` je vpravo nahoře u východního křídla. Dveře jsou na pravé zdi křídla, křídlo je prodloužené nahoru (`vychodP` 1880,1340, 200 × 360). Vzhled je podle `fotky/SBOROVNA 2.jpg`: šedé kobercové čtverce, stoly do U s modrými židlemi (`labbench` s `look`), tiskárna, dva kulaté stolky (`roundtable`), skříň nahoře u levé zdi, tři okna vpravo. Vchod je dole vlevo (`oprava sborovny.jpg`), druhé zavřené dveře jsou na levé zdi.
  - Čísla A214–A216 jsou odhad.
- Okna v patře: v hlavní chodbě jen na horní zdi, v západním křídle jen vpravo, ve východním jen vlevo, na schodišti jen nahoře.

**Úvodní obrazovka** (`renderTitle`, `TITLE_SCENE` v `js/10_obrazovky.js`):

- Je na ní střed školy (rizalit) bez křídel, zvětšený přes celou obrazovku (`SCALE` 1.875). Kreslí ho `drawFrontScene(room, { label: false, sky: false, wings: false })` → `drawSchoolFront(room, { wings: false })`. Po stranách jsou stromy.
- **Nadpis** „GYMNÁZIUM PRACHATICE“ (`CONFIG.GAME_TITLE`) je ve velkém plochém oblouku nad horními okny, takže je nezakrývá. Konce oblouku jdou dolů vedle fasády (`drawArcTitle`, `TITLE_SCENE.ARC`: střed 400,968, poloměr 900). Má bílá písmena s tlustým tmavomodrým obrysem a stínem, aby byla vidět na žluté fasádě.
- Pod nadpisem je červená stuha „Pro Romana Gajdoše“ (`GAME_SUBTITLE`, `drawRibbon`) a velké zelené pulzující tlačítko „▶ HRÁT“ (`drawTitleButton`, `BUTTON_Y`). S uloženým postupem jsou vedle sebe zelené „Pokračovat (2/3)“ a modré „Nová hra“.
- **Okna:** ve 14 oknech rizalitu (`TITLE_WINDOWS`) jsou postavy s hlavou z fotky. Hlava se vejde do okna, takže se nepřekrývají. Postav je víc než oken, proto se každých `SWAP_TIME` s vystřídají (schovají se a vykouknou další). V jednom kole se nikdo neopakuje.
- Hráč stojí v hlavních dveřích. Dole je ovládání, jen pro klávesnici nebo jen pro dotyk podle `isTouchHint()`.

**Inventář** (`17_pribehy.js`) se otevře klávesou **E** nebo tlačítkem s batohem vlevo od mapy (`CONFIG.INVENTORY_BUTTON`). Vypadá jako katalog úkolů a ukazuje karty s nakreslenými ikonami (`ICONS`, `drawIcon`): peníze, sluchátka od Mykyho, Chánovu peněženku (kolik je v ní), nůž od Davida (během gum), kanystr, recept na pivo, kleště a struny a věci z bufetu nebo kávovaru (`state.bag`, ikona podle názvu `shopItemIcon`). Stejné ikony se kreslí i u předmětů na zemi (`item.icon`).

## Režim „Vrah z učebny C109“ (`js/18_vrah.js`)

- **Úvod:** „Pokračovat ve Vrahovi“ + „Začít Vraha znovu“ se ukáže až s opravdovým postupem (stage dál než `binkova1`, stopy, peníze nebo běžící speedrun – `loadProgress`). Dřív se uložení vytvořilo hned po spuštění a na úvodu pořád svítila obě tlačítka.

Je to samostatný příběh, který se zapíná na úvodní obrazovce tlačítkem „🕵️ Vrah z učebny C109“ pod HRÁT. Zadání od uživatele je v historii konverzace a má 4 části a 9 miniher.

- **Oddělení od hlavní hry:** `state.mode = 'vrah'` (v hlavní hře `null`). Režim má vlastní uložení `CONFIG.SAVE_KEY_VRAH` (`saveKey()`) a vlastní úkol `QUESTS.vrah` s `mode: 'vrah'` (`activeQuests()` ukazuje jen úkoly aktuálního režimu). Když je Vrah rozehraný, jsou na úvodu vedle sebe tlačítka „🕵️ Pokračovat ve Vrahovi“ a „Začít Vraha znovu“ (`vrahNew`, uložení se smaže). Na konci příběhu i hlavní hry jsou tlačítka „Hrát znovu“ (stejný režim od začátku) a „Na úvod“ (`goToTitle`, znovu načte, co je kde rozehrané). Po dohrání se uložení režimu smaže.
- **Postavy v režimu** (`applyVrah`): Binková a Mišák sedí v Kabinetu 5. Holub chodí s hrnkem kafe (`look.mug`) po chodbě Céčka ve 3. patře (`VRAH.CORRIDOR`) a po schodech i dolů do haly ve 2. patře (`HOLUB_ROUTE`) a jeho kabinet je Kabinet 7 (nad Kabinetem 4, `VRAH.HOLUB_DOOR`). V hlavní hře se všichni vrátí na svá místa (`CAST_HOME`): Holub do tělocvičny k hodu na koš, Binková a Mišák do C109.
- **Scény** (`playScene`, `sceneNext`): rozhovory víc postav za sebou. Krok je `{ who, text }`, `{ act }` nebo `{ wait }` (pauza na animaci). Dialog se zavírá jako obvykle a v `06_logika.js` se volá `sceneNext`.
- **Postup** (`state.vrah.stage`, text úkolu `vrahHint`):
  1. Binková dá klíč od C109. Do té doby je C109 zamčená (`doorBlocked`).
  2. V C109 jsou zbytky Ferdinanda a tři stopy u SPOTů: otisk boty, kousek dortu, zmuchlaný papír (`CLUES`).
  3. Mišák chce logo Slávie na Holubův kabinet.
  4. **Lepení loga** u dveří Kabinetu 7 (3. patro Céčka) (`state.sticker`): samolepka se táhne myší nebo prstem z rohu do rohu, případně se drží šipka →. Moc rychle znamená bubliny, odchylka od úhlopříčky ubírá hvězdy, hodnocení je 1–3 hvězdy. Holub vidí před sebe (kužel jako dozor u gum, `watcherSees`). Když vidí hráče kdekoli na chodbě, roste podezření (`state.vrah.sus`): při lepení rychle, u dveří středně, jinde pomalu. Holub u toho řekne své hlášky. Při plném podezření vyhodí hráče po schodech dolů do 2. patra (a když lepil, samolepku seškrábe) a zkouší se znovu. Bezpečně se lepí, když je Holub dole nebo jde zády.
  5. Binková chce Lektvar Zelené Karmy od Křiváčka (Kabinet 2).
  6. **Křiváček** dá na výběr (`openChoice` – panel s možnostmi, šipky a mezerník nebo ťuknutí).
     - **Tequila a Panenky (2. fáze, hotová):**
       - Školník (`TEACHERS.skolnik`, dolní šatny) dá jahodovou tequilu jen za klíče od kotelny.
       - Klíče má uklízečka (`TEACHERS.uklizecka`, hala ve 2. patře Céčka). Vedle ní je mokrá podlaha s cedulí, a když na ni hráč šlápne, uklízečka řekne svou hlášku (`WET`).
       - **Minihra Vytírání na čas** (`state.mop`, `MOP`): hala je rozdělená na dlaždice 8 × 4. Uklízečka stojí vpravo dole mimo ně, aby všude šlo dojít. Roman vytírá chůzí, a to všechny dlaždice, na kterých stojí. Děti (nejvýš 3, 92 px/s) přebíhají a občas nechají šlápotu (`KID_MUD` 50 %). Špinavých je na začátku 70 % dlaždic. Za 46 s musí být čisto aspoň na 87 %, jinak se to zkouší znovu. Nejdřív to bylo moc těžké, pak moc lehké a pak zase lehce ztížené (uživatel chce těžší, ale hratelné).
       - S klíči ke školníkovi pro tequilu a s ní zpátky ke Křiváčkovi.
       - **Minihra Dvě panenky** (`state.rhythm`, `PANENKY`): šipky padají ve 4 drahách. Mačkají se šipkami nebo WASD, na mobilu tlačítky dole. Hraje `zvuky/Záviš - Dvě panenky.mp3` (hudební stopa `panenky`). Na úspěch je potřeba trefit 60 % not. Tempo se nedalo změřit, šipky jdou po dobách v `PANENKY.BPM = 116` a dá se doladit. Šipky padají pomaleji (`FALL` 2,4 s shora na čáru, dřív 1,6 s).
       - Uklízečka je jen v tomhle režimu (`VRAH_ONLY`). Školník stojí v dolních šatnách i v hlavní hře. Hlava je oříznutá podle `fotky/školník oprava.jpg` (`oriznout_podle_car.py --vrsek`), pak ručně odstraněné pozadí vpravo vedle tváře a obličej posunutý na střed (záloha `zalohy/skolnik_pred_zarovnanim.png`). Školník má hlavu z `fotky/školník.jpg` (fotka je malá, 50 × 62 px), uklízečka zatím kreslený obličej (`look.hair`, `look.skin`).
     - **Vloupání do laborky (3. fáze, hotová):** laboratoř chemie dole pod schody u Lukáškové (`LAB.ROOM = 'laborky'`, `state.lab`).
       - **Křiváček jde s hráčem:** po výběru laborky ho následuje přes všechny místnosti až do laborky (`state.follow`, `updateFollow`). Neobjeví se tam sám.
       - **Small talk:** Křiváček zabaví Lukáškovou a hráč mu vybírá repliky. Je to strom rozhovoru (`TALK_TREE`): Lukášková vždy odpoví přímo na to, co Křiváček řekl, a podle toho jde rozhovor dál. Všech 27 kombinací je prošlých testem. Odejde jen tehdy, když ji poslední replika opravdu pozve pryč (kafe, fikusy, papíry). Špatná replika zvedne podezření.
       - **Po rozhovoru** Křiváček hráči potichu vysvětlí plán (kód, pipeta, lahvičky, kde se schovat) a odejde dveřmi (`walkOut`), buď s Lukáškovou, nebo sám.
       - **Hlídání:** když Lukášková odešla, vrátí se dveřmi po `LAB.AWAY` (30) s a pak hlídá pořád, už nemizí. Chodí uličkou uprostřed a vpředu podél tabule (`LAB.route`) a má kužel výhledu. Podezření ukazuje lišta nahoře a Lukášková u toho říká své hlášky.
       - **Co a kde dělat:** místo, které je na řadě, má pulzující rámeček a šipku (`labTarget`, `drawLabMarkers`). Dokud chybí kód, je čárkovaně zvýrazněná i periodická tabulka. Když Lukášková hlídá, jsou u míst na schování ikonky 🙈. Pod laborkou je pruh se seznamem úkolů (`drawLabChecklist`).
       - **Schovávání:** u digestoře, kostry nebo lavice mezerníkem (`LAB.hides`, `vrahHidden`). Schovaného nevidí a hráč se ukazuje jen jako obrys.
       - **Úkoly** (`state.labTask`, malý panel dole, svět běží dál, Esc nebo ťuknutí mimo = nechat být):
         - **Kód skříně** „Ca – Fe“ se zjistí z periodické tabulky na levé zdi (prvky 1–30): 20 a 26, tedy kód 2026. Zadává se klávesami nebo na klávesnici. Špatný kód je hluk.
         - **Pipeta:** 3 látky a hladina stoupá čím dál rychleji. Zastavit se má na rysce, přelití je hluk.
         - **Vrať to, jak to bylo:** 5 lahviček se ukáže na 3 s, pak jsou zpřeházené a prohazují se po dvou. Chyba je hluk.
       - **Chycen** (plné podezření): Lukášková řekne svou hlášku a hráč jde do Kabinetu věčnosti (`state.quiz`, kvíz na čas). 8 prvků, ke každému 4 značky, 40 s, stačí 6. Výhra znamená propuštění a laborku znovu (`labRetry`). Prohra je **GAME OVER** (`state.gameOver`): Roman o 40 let starší, šedivý, s knírem u výdejního okénka a Křiváček: „Já ho neznám.“ Pak jsou tlačítka „Zkusit laborku znovu“ a „Na úvod“.
       - **Po laborce** Křiváček namíchá lektvar. Když hráče nikdo nechytil (`state.vrah.caught`), dostane navíc jedničku z biologie (`state.vrah.jednicka`). Ta je v inventáři a na závěrečné obrazovce.
  7. **Finále** v Kabinetu 5: Holub vtrhne dovnitř, Binková mu vylije lektvar do kafe, Holub zezelená a vyraší mu lístek (`look.green`). Hráč dostane Ferdinanda II. do inventáře a úspěch „Zahradní detektiv“ a pak se ukáže vlastní závěrečná obrazovka.
- Inventář v režimu ukazuje klíč, stopy, samolepku, lektvar a Ferdinanda II. (`vrahInventory`, ikony v `ICONS`).
- Pořadí fází je `VRAH_STAGES` a `stageAtLeast(stage)` říká, jestli už hráč nějakou fázi prošel.

## Laborky (`js/19_laborky.js`, podle `fotky/laborky*.jpg`)

- **Schody do laboratoří** jsou kus spojené chodby (díl `schodyLab`, jako schody v budově A), nakreslené přímo naproti Křiváčkovu kabinetu (Kabinet 2). Díl leží nad jeho výběžkem západní chodby (ve světě x 0–200, y 560–800), průchod v horní zdi výběžku je v `openings`.
  - Od Křiváčkových dveří se jde rovně nahoru 1. ramenem, nahoře 2. ramenem doleva (taky schody), vlevo nahoře je malá podesta a 3. ramenem se jde dolů na jih. Všechna ramena jsou 62 px široká (`LAB_STAIRS`).
  - Kousek pod začátkem 3. ramene je neviditelný přechod (`hidden`) do chodby laboratoří. Hráč se tam objeví dole na zbytku schodů a sejde je směrem nahoru, takže je nepřeskočí.
  - Napravo od schodů jsou Málovy dveře, jako na fotce `laborky schody.jpg`, která je focená od Křiváčka.
  - Cestou zpátky jde hráč v chodbě laboratoří dolů po schodech. Na jejich konci je přechod a objeví se na podestě vlevo nahoře (`spawnLocal` 51, 600), odkud jde 2. ramenem doprava a 1. ramenem dolů do chodby.
- **Chodba laboratoří** (`labChodba`) je otočená o 180°: dole je zbytek schodů (sejdou se směrem nahoru) a nahoře vchod do laboratoře. Do laborky se tak vejde jejími spodními dveřmi a jde se dál stejným směrem, bez kroku zpátky. Vedle schodů jsou červené dveře se značkami nebezpečí. Dveře „Sklad chemikálií“ a druhé dveře jsou jen nakreslené (`drawFakeDoor`). Je v ní dřevěná skříň, hasičák a lékárnička.
- **Laboratoř chemie** (`laborky`, 640 × 440):
  - bílé stoly s modrou hranou a stojany s lahvemi (`chembench`) jdou od pultíků u zdí až k uličce uprostřed, takže se chodí jen středem (mezi řadami jsou slepé zálivy),
  - pultíky s umyvadly podél levé a pravé zdi,
  - zelená tabule a okna nahoře, skříň vlevo nahoře.
- **Postavy v laboratoři:** učí tu **Lukášková** (Ivča, chemie). Do A114 už nepatří, A114 zůstala jako učebna. Je tu i studentka **Kája** (hlava z `fotky/Kája.jpg`, v příběhu nedůležitá).
- **Režim Vrah:** laborka Vraha je tady (digestoř vpravo nahoře, kostra vlevo dole, polička s lahvičkami dole vpravo, periodická tabulka nahoře vlevo od tabule, skříň s kódem vlevo nahoře, pipeta u stolu vpravo nahoře). `CAST_HOME.lukaskova` se v `19_laborky.js` přepíše na laboratoř.
- **Jména v dialozích** jsou na štítku v barvě postavy, s bílým nebo tmavým písmem podle toho, jak je barva světlá (`isLightColor`). Dřív byla tmavá jména na tmavém pozadí špatně vidět.

## Další lidé ve škole (`js/20_skola.js`, `js/03_postavy.js`)

- **Terka** (studentka, `companion: 'rauscher'`) chodí vedle Rauschera (`placeCompanion` v `04_ukoly.js`: stejná místnost, 34 px bokem podle směru chůze). Není pevná.
  - Spolu pomlouvají Holuba (`GOSSIP`, 7 rozhovorů). Když je hráč blízko, střídají se nad nimi bubliny (`drawGossipBubble`, kreslí se nad hráčem).
  - Když hráč promluví s Terkou nebo s Rauscherem, zahrají celý rozhovor (`gossipTalk`, pokaždé další).
- **Láďa** (tělocvikář) je v **Kabinetu tělocvikářů** (`kabinet6` vedle tělocvičny, dřív Kabinet 6, přibyl koš s míči `ballcrate`). Samostatný kabinet tělocviku s dveřmi z tělocvičny je smazaný. Hláška je od uživatele (hospoda s taťkou).
- **Vozábalová** je v kanceláři školy za stolem.
- **Chválová** je v **Kabinetu Chválová** (`kabinetA216`, dřív Kabinet A216, na konci chodby v 1. patře). Samostatný kabinet pod sborovnou v přízemí je smazaný. Podle `fotky/kabinet ch..jpg` má stůl do L vpravo nahoře (dva `desk` podél horní zdi a kus dolů) a Chválová stojí v jeho rohu. Na horní zdi vlevo jsou dveře do sborovny, ve sborovně jsou vpravo dole. Z jejích dveří se valí kouř i do sborovny a na chodbu (`drawSmokeLeak`).
- **Sborovna:** velký stůl je otočený o 90° doleva (tvar ∩, otevřený dolů), tiskárna je v pravém horním rohu. Jsou tam květináče s „trávou“ (`grassplant`) a přes celou místnost stoupá kouř (`drawOver`). Nabízí Romanovi trávu (`TEACHERS.chvalova.talk`, volba `openChoice` funguje i v hlavní hře). Když si dá, je 30 s pomalejší (`HIGH.SPEED` 0.6) a motá se: směr chůze se pomalu houpe do stran (`highWobble`, `story.high`). Ukazatel energie ukazuje 🌿.
- **Ředitelka** je v ředitelně za stolem. Když Mráz chytí hráče u propichování gum, v ředitelně mu řekne svou hlášku (`prankCaught` v `16_gumy.js` je teď scéna).
- **Švecová** je v C308 u tabule.
- Hlavy jsou z `fotky/Terka.jpg`, `Láďa.jpg`, `Vozábalová.jpg`, `Chválová.jpg`, `Ředitelka.jpg`, `Švecová.jpg` a příkazy jsou na konci `tools/ucitele.sh`. Hlášky jsou zatím provizorní.

**Hlad** (`17_pribehy.js`, `HUNGER`):

- Energie (`story.energy`, 0–100) klesá jen při hraní, ne v dialogu ani v nabídkách. Z plna na nulu to trvá asi 25 minut (`HUNGER.DRAIN`). Původně to bylo 10 minut, ale uživateli to bylo moc rychlé.
- Pod 30 chodí Roman na 75 % rychlosti, na nule na 55 % (`walkSpeedFactor` v pohybu v `06_logika.js`). Hra se kvůli hladu nikdy nezastaví, jen se objeví upozornění.
- Jídlo z bufetu a kávovaru se jí v inventáři: klik nebo ťuknutí na kartu, případně šipky a mezerník (`eatFood`). Kolik které jídlo doplní a co k tomu Roman řekne, je ve `foodOf`. Káva doplní málo, ale na 45 s zrychlí chůzi na 130 % (`story.coffee`).
- Ukazatel energie je pod tlačítkem s hudbou (`drawEnergyBar`). Pod 30 bliká červeně.

**Stav příběhů** je `state.story` (`newStory()`) a ukládá se s postupem (`saveProgress` → `story`).

**Hudba na pozadí** se skládá z alb `CONFIG.MUSIC_ALBUMS` (hlasitost `MUSIC_VOLUME`):
- **Mix:** soubory ve `zvuky/pozadí/mix/`.
- **Red Hot Chili Peppers:** soubory ve `zvuky/pozadí/red hot chily peppers/`.

Hraje se vybrané album (`audio.album`, `musicPlaylist()`), začíná se Mixem od „Tři kříže – Hákový“. Po dohrání jde další písnička alba, po poslední zase první (`playMainTrack`, `audio.mainIndex`). Chybějící soubor se přeskočí.
- Po sluchátkách od Mykyho (`story.headphones`) se jeho tři písničky přidají na konec **Mixu** (v seznamu jsou fialově s 🎧). Do Red Hot Chili Peppers se nepřidají a předtím nikde nejsou.
- Album se vybere klávesou **Z** nebo tlačítkem „💿 Album (Z)“ v seznamu písniček (`toggleMusicMenu(true)`, `setAlbum`). Pustí se první písnička alba a pak se ukáže seznam jeho písniček. Klávesa se pozná podle písmene (`e.key`), ne podle fyzické pozice – na české klávesnici QWERTZ je Z tam, kde má anglická Y, takže kontrola `e.code === "KeyZ"` nefungovala.
- **Tlačítko s hudbou** (`drawMusicButton`, `takeMusicTaps`) ukazuje, co právě hraje. Ťuknutí na něj nebo klávesa **P** otevře **seznam písniček vybraného alba** (`state.musicMenu`, `toggleMusicMenu`, `drawMusicMenu`, `musicMenuEvents` v `13_katalog.js`). Vypadá jako katalog úkolů a funguje ve hře i na úvodu. Kliknutím nebo šipkami a mezerníkem se pustí vybraná písnička, P, Esc nebo ťuknutí mimo seznam ho zavře. Klávesa N přepne rovnou na další skladbu (`nextMusic`). Ve hře je pod tlačítky vpravo nahoře (`CONFIG.MUSIC_BUTTON`), na úvodu vlevo nahoře (`MUSIC_BUTTON_TITLE`). Když hraje písnička od Mykyho, je její název zeleně a ťuknutí ji ukončí a pustí další hudbu.
- Hudba na pozadí přidaná do složky se musí zapsat do `MUSIC_PLAYLIST` i s názvem.

**Písničky od Mykyho:** po rozhovoru s ním (`songs` u postavy) se otevře výběr písničky (`state.songMenu`, `drawSongMenu`).

- Vybraná hraje jednou místo hudby na pozadí (stopa `song`, `playSong`). Po dohrání se vrátí hlavní hudba.
- V liště vlevo je vidět „♪ název“.
- Soubory jsou ve `zvuky/Mykyta/` (FACE – Юморист, Red Hot Chili Peppers – Eddie, Градусы – Голая), seznam je v `songs` u Mykyho (`js/03_postavy.js`). Chybějící soubor ohlásí „Tahle písnička ve hře zatím není“.
- Fotbálek si pamatuje předchozí stopu (`audio.prevTrack`) a po odchodu ji vrátí.

**U fotbálku** hraje `CONFIG.FOOS_MUSIC_FILE` (`zvuky/fotbálek.mp3`). Pustí se od začátku při otevření fotbálku (`setMusicTrack('foos', true)`) a po odchodu hlavní hudba pokračuje, kde skončila. Vždy hraje jen jedna skladba (`audio.track`, `musicTracks`). Na iPhonu se další skladby při prvním kliknutí odemknou krátkým ztlumeným přehráním.

- Spustí se po prvním kliknutí nebo klávese (`unlockAudio`), dřív to prohlížeč nedovolí.
- Tlačítko zvuku nebo klávesa M ji vypne spolu s pípáním.
- Ve skryté záložce ztichne (`visibilitychange`).
- Pozor: v testovací záložce přes rozšíření je `document.hidden === true`, takže tam hudba nehraje. To je správně.
- Nový zvuk: dát soubor do `zvuky/`. `slozit_do_jednoho.py` vloží i zvuky (`zvuky/….mp3` v uvozovkách v kódu).

**Server:** používej `python tools/server.py`, ne `python -m http.server`. Posílá `Cache-Control: no-store`.

- Bez toho si prohlížeč (i mobil) pamatoval staré soubory z `js/`, míchal staré a nové a hra se rozbila.
- Při testech přes rozšíření se stalo, že `foosTableRect is not defined`.

**Fotbálek** je u stolního fotbalu v chodbě před schody (`SPOTS`, obrazovka `'foosball'`, `js/14_fotbalek.js`).

- Pohled shora, 8 tyčí. Hráč je červený a brání levou branku. Všechny tyče týmu se posouvají najednou (`f.p.red` −1…1).
- Ovládání:
  - šipky nebo W S posouvají tyče, mezerník (Enter) kope;
  - ve dvou hrají červení W S + mezerník a modří šipky + Enter;
  - na mobilu se táhne prstem (ve dvou každý na své půlce) a kope se samo.
- Hraje se do 5 gólů. Za výhru nad počítačem 5, 15 nebo 30 Kč (`FOOS.LEVELS`).
- Počítač vidí míček se zpožděním (`react`) a s chybou (`err`). Vyvážení otestováno roboty: průměrný hráč porazí lehkého i středního a prohraje s těžkým, dobrý hráč hraje s těžkým nastejno.
- Zaseknutý míček se po 1,5 s sám postrčí.
- Menu a tlačítka sdílí se šachy (`drawChessButton`, `chessMenuRows` …).

**Šachy** jsou u šachového stolku v chodbě před schody. Mezerník nebo ťuknutí otevře obrazovku `'chess'`, sekce `MINIHRA: ŠACHY`.

- Pravidla jsou úplná: šach, mat, pat, rošáda, braní mimochodem, proměna s výběrem figurky, remíza 50 tahy, trojím opakováním a nedostatkem materiálu. Ověřeno perft testy (start do hloubky 4, Kiwipete do hloubky 3 a další).
- Soupeř je počítač, nebo hrají dva hráči na jednom zařízení. Obtížnosti počítače:
  - lehký: skoro náhodný;
  - střední: hloubka 2;
  - těžký: hloubka 3 s klidovým dohledáním braní, nejvýš asi 0,15 s na tah.
- Hráč hraje bílými, dole.
- **Výhra nad počítačem dává peníze:** 10, 25 nebo 50 Kč (`CHESS.LEVELS`).
- Ovládání:
  - šipky a mezerník, Esc = vzdát se nebo odejít;
  - na mobilu ťuknout na figurku a pak na pole.
- Místa, u kterých jde něco udělat (zvonek, šachy), jsou v poli `SPOTS`. Má `rect()` a `act()`.

**2. patro budovy A** (`patroA2`) má stejný tvar jako 1. patro (díly `zapadP2`, `vychodP2`, `hlavniP2`, `schodyPatro2`). Kreslí se stejně (art `zapadP` / `vychodP` / `hlavniP`).

- **Schody:**
  - V 1. patře (`SCHODY_A1`) vede levé (3.) rameno dolů do přízemí. Pravé (1.) a horní (2.) rameno vedou nahoru, na horní podestě vlevo je přechod do 2. patra.
  - Ve 2. patře (`SCHODY_A2`) jde jen 3. rameno dolů. Na jeho konci se přejde do 1. patra na horní podestu.
- **Aula** (`aula`, 900 × 440, podle `fotky/Aula.jpg`) je naproti schodům a má dva vchody: x 1110 a x 1410, tam kde je v 1. patře předsíň kabinetů.
  - Uvnitř jsou parkety do stromečku, jeviště s červenou oponou, klavír, dva bloky fialových židlí (`aulachairs`) a okna dole.
  - Druhý vchod má v obou směrech `spawnLocal`, jinak by oba vedly k prvnímu.
- **Třídy** jsou podle fotek `fotky/A309…A311, A302, A305.jpg`:
  - A309 (podle `oprava a309.jpg`): dveře nahoře vpravo, dřevěné stoly do U, spojka je vpravo s židlemi zvenku, U je otevřené doleva k zelené tabuli. Zelená tabule a umyvadlo jsou vlevo, okna vpravo, bez katedry;
  - A310: stupňovitá učebna – od levé i pravé zdi 4 řady po 4 lavicích, uprostřed široká ulička, každá řada o schod výš; před tabulí velká katedra na šířku tabule (dá se obejít dokola), dveře vpravo vpředu;
  - A311 (upravená podle `fotky/A311 oprava.jpg`, okna na horní zdi): laboratoř se dvěma bílými stoly s umyvadlem od levé zdi (pravá půlka místnosti je volná), skříňky u pravé zdi, bez katedry. Tabule je na spodní zdi vpravo (`makeClassroomArt` s `boardAt: 0.72`), dveře jsou na spodní zdi vlevo od ní. Na chodbě zůstaly dveře do A311 na stejném místě;
  - A302: vchod vpravo nahoře, počítače ve třech řadách od zdi ke zdi s uličkou uprostřed (vlevo po třech, vpravo po dvou), tyrkysové židle, okna vlevo;
  - A305: vchod vlevo dole, moderní třída, tyrkysová zeď vpředu, velká obrazovka vlevo, tyrkysové židle.
  - `makeClassroomArt` umí `opts.floor = 'terrazzo'` a `opts.extra`, lavice a počítačové stoly umí barvu židlí `chair`.
- **Rozmístění tříd:**
  - A309 (místo A210, v rohu chodby vlevo dole), A310 (A211), A311 (A212);
  - Kabinet A312 (místo A213, číslo je odhad);
  - A305 vpravo dole v rohu (místo kanceláře);
  - A302 vpravo nahoře (pravá zeď východního křídla, místo sborovny);
  - Kabinet A302 na konci chodby vpravo (místo A216). Uživatel tak napsal oboje „A302“, je potřeba ověřit.

**Karel Chán** (`chan`) je učitel. Stojí u kávovaru pod ním u levé zdi a nepřekáží v přístupu.

**Myky** stojí ve Druhých schodech k šatnám u pravých skříněk (po rozhovoru má hráč v inventáři jeho sluchátka). **Studenti Emma a Zita** stojí v hlavní chodbě před bufetem, **Lili** je v C202 s Klusem, **David** je na parkovišti pod budkou (mimo trasy Kuby a Rauschera). Hlavy jsou z fotek, příkazy jsou v `tools/ucitele.sh`. Hlášky jsou provizorní.

## Mapa školy

Otevře se klávesou **K** nebo tlačítkem se složenou mapou vedle tlačítka úkolů (`CONFIG.MAP_BUTTON`).

- Ukazuje plánky chodeb (`MAP_SHEETS`): přízemí budovy A (`chodba`), 1. patro (`patroA`), 2. patro (`patroA2`) a Céčko (`cecko`, `cecko2`, `cecko3`).
- Plánek se počítá z podlahy po čtverečcích 10 px (`mapRaster`): bez zdí a `void`, jen uvnitř dílů. Popisky jsou uprostřed podlahy každé části.
- Červená tečka je Kuba Vozábal (živě, chodí dál), modrá je hráč. Dole je napsané, kde kdo je.
- Hráč stojí, zavírá se K, Esc, mezerníkem nebo ťuknutím.
- Nová chodba na mapě: přidat do `MAP_SHEETS` s polohou, měřítkem a výřezem.

## Úkoly (QUESTS)

Úkoly jdou plnit v libovolném pořadí a víc najednou.

- **Katalog úkolů** se otevře klávesou **Q** (nebo Tab) nebo tlačítkem vpravo nahoře vedle zvuku. Na tlačítku je počet rozdělaných úkolů.
- U každého úkolu v katalogu je název, kdo ho zadává, stav (Nový / Rozdělaný / Odnes / Hotovo) a co udělat (`questHint`).
- Na liště nahoře je úkol, na kterém hráč naposledy pracoval (`state.tracked`).
- Hra skončí, když jsou hotové všechny úkoly.
- Nový úkol = přidat záznam do `QUESTS` s novým `id` a texty `assign`, `waiting` a `thanks` u učitele. Učitel s víc úkoly je zadává postupně.
- Ukládání má nový formát `{ quests, tracked, money, bag }`. Staré uložení `questIndex`/`questStage` se při načtení převede.

Současné úkoly (úkoly Ztracené klíče, Třídní kniha a Ztracený atlas jsou smazané i se zadávajícími učiteli Procházkou, Novákovou a Svobodovou; Dvořák je smazaný a hod na koš zadává Holub):

1. **Peněženka pro Chána** (`penezenka`, 17_pribehy.js): Chán u kávovaru pošle hráče pro peněženku do sborovny. Při sebrání je v ní náhodně 50–300 Kč (po 10, `state.story.wallet`). U Chána se otevře výběr, kolik mu dá (`state.giveMenu`: ← → po 10, ↑ ↓ po 50, tlačítka −50/−10/+10/+50, „Dát Chánovi“). Zbytek si nechá (`story.chanKept`). Chán reaguje podle částky.
   - **Placení z peněženky:** dokud hráč peněženku nese, dá se z ní v bufetu a kávovaru doplatit (`walletCash()` v `shopBuy`): nejdřív se berou vlastní peníze, zbytek z peněženky. V liště je vidět `125 Kč (+290 👛)`. Placení z peněženky je utrácení Chánových peněz, takže se hned odemkne motorka (`storySpent(price, fromWallet)`). U Chána se pak rozděluje jen to, co v peněžence zbylo.
   - Text úkolu v liště začne vlevo, když je dlouhý, aby nezajel pod tlačítko s hudbou (`drawHud`).
   - **Chánova motorka** (`motorka`, `locked(story)` → `activeQuests()`): když si hráč něco nechal a pak cokoli koupí (`storySpent` v `shopBuy`), objeví se úkol a motorka na volném stání dole na parkovišti (`MOTORKA`, `drawMotorkaWorld`). Chán pošle hráče pro kanystr s benzínem do kabinetu 4 v Céčku. U motorky (SPOT) se s kanystrem spustí minihra Dráty (`state.wires`): čtyři barevné dráty vlevo spojit se stejnou barvou vpravo (↑ ↓ a mezerník, nebo ťuknout vlevo a pak vpravo, Esc = nechat být). Pak se dolije benzín a úkol je hotový.
   - Zamčené úkoly se nepočítají do „Splněno x/y“ ani do konce hry, dokud se neodemknou.
2. **Útěk od Kluse** (`klus`, 17_pribehy.js): Tomáš Klus (`TEACHERS.klus`, hlava z `fotky/Tomáš Klus.jpg`) a Lili jsou v C202. Při každém vstupu do C202 hraje od začátku Treplev (hudební stopa `klus`, `CONFIG.KLUS_MUSIC_FILE`) a po odchodu se vrátí hudba na pozadí.
   - Lili prosí, ať hráč Kluse zabaví. Když s ním hráč začne mluvit, Lili vyběhne ze třídy (`liliRunOut`) a úkol je ve stavu „Najdi Lili“.
   - Až hráč vyjde z C202, Lili se z chodby Céčka rozejde přes celou školu do kabinetu A312 (`liliStartWalk`). Trasu spočítá `buildRoute`: nejkratší řada místností přes dveře a v každé hledání cesty po mřížce 10 px mezi zdmi a nábytkem. Trasa má `once: true`, takže v cíli zůstane stát (`arrived`, `onArrive`).
   - U Bečváře říká „Všude dobře, u Bečváře nejlíp!“. Když s ní hráč mluví, úkol je hotový. Po načtení hry stojí Lili podle stavu úkolu buď v C202, nebo u Bečváře (`applyStory`).
3. Holub (tělocvična, hlava z `holub 3.jpg`) – minihra hod na koš. Po splnění si s ním jde hodit kdykoli znovu (`minigame` u postavy, `texts.play`). Ztížené: síla běhá rychleji (`BASKET_POWER_SPEED` 0.95), směr taky (`BASKET_DIR_SPEED` 0.6) a míč musí proletět blíž středu (`BASKET_HIT_RADIUS` 27).
4. Mála (kabinet) – **Struny pro Málu** (`struny`, `js/22_struny.js`). Úkol Káva pro Málu je smazaný.
   - **Půjčování peněz:** když už má hráč úkol se strunami (nebo je hotový), otevře rozhovor s Málou volbu „💰 Nepůjčil byste mi nějaký peníze?“. Pokaždé dá míň (100, 60, 40, 25, 15, 10, 5, 2, 1 Kč, `MALA_LOANS`) a je vtipně naštvanější. Pak už nedá nic a střídá vtipné odmítnutí (`MALA_BROKE`). Kolikrát se hráč ptal, je v `story.malaAsk`.
   - Mála potřebuje struny, jsou jen na kytarách v C202. Kleště půjčí školník (ve skříňkách dole), ale do 1:30 (`STRUNY.LIMIT`) je chce zpátky. V liště běží odpočet, který jde pořád (i v dialogu, v C202 s Klusem a Treplevem). Když vyprší, školník si kleště vezme, struny jsou pryč a začíná se znovu u školníka. Cesta tam a zpátky trvá asi 30 s.
   - Jakmile hráč kleště vezme, Binková (hráči se to neříká) vyjde z Kabinetu 5 a hlídkuje až do haly před C202 a zpátky (`binkovaPatrol`, k C202 jde rychle 140 px/s, pak 75 px/s). Konec hlídky je v hale u C203, ne přímo u dveří C202 (dřív tam stála a chytala hráče hned, uživatel to nedokázal projít). Vidí kratší a užší kužel než dozor (170 px, ±34°, zakrývá ho nábytek, `binkovaSees`, kužel je vidět). Po vstupu do místnosti 2 s nevidí (`GRACE`), aby hráč stihl uhnout nebo se vrátit dveřmi. Když hráče vidí asi 0,6 s (když stojí, skoro 2 s – `STILL`), sebere kleště i struny a začíná se znovu. Ověřeno simulací: uhnout v hale doprava, počkat, až odejde nebo je u C203 zády, pak do C202.
   - Školník má hlášky podle toho, pokolikáté si hráč kleště půjčuje (`SKOLNIK_ASK`, `SKOLNIK_GIVE`, pak dokola `SKOLNIK_GIVE_MORE`, počet ve `struny.borrows`), a jinou podle toho, jestli mu je minule přinesla Binková, nebo si pro ně musel dojít sám (`struny.lost`). Po vrácení kleští nebo po neúspěchu jde zpátky do C109 (`binkovaHome`).
   - V C202 se u kytary mezerníkem ustřihnou struny (kytary pak nemají struny, `guitarCut` v kreslení `guitar`). Kleště vrátit školníkovi, struny donést Málovi: „Já jí ty struny z C202 kradu už rok a pořád mě nechytla.“ Málova kytara má struny až potom.
   - **Málův kabinet:** stůl po celé pravé zdi se dvěma židlemi, okno na horní zdi, na levé zdi stůl shora do půlky, pod ním knihovna, vlevo dole kytara, druhá knihovna u spodní zdi.
5. David (parkoviště) – **Gumy s Davidem** (`js/16_gumy.js`):
   - David dá nůž („Pojď propíchat učitelům gumy!“). U každého auta se mezerníkem / ťuknutím propíchnou gumy (auto si sedne a ztmavne), v liště je počet `🔪 Gumy: 2/5`.
   - Po parkovišti chodí **Mráz**, učitel na dozoru (`TEACHERS.dozor`, hlava z `fotky/Láďa Mráz.jpg`): od dveří doleva, dolů uličkou vlevo od aut, pod auty a nahoru trávou za auty. Vidí jen před sebe (žlutý kužel, 230 px, ±43°) a auta, budka a budova mu zakrývají výhled.
   - Když hráče uvidí, hráč se objeví sám v ředitelně (David zůstane na parkovišti), gumy se opraví a dá se to zkusit znovu u Davida. Odchod z parkoviště minihru zruší.
   - Když jsou propíchnutá všechna auta, úkol je hotový.

Další učitelé bez úkolu: Křiváček (kabinet2, hlava z `Křiváček oprava.jpg`), Rauscher (chodí po chodbách), Karel Chán (u kávovaru), Šmahel (A310, vpravo vedle katedry) a Bečvář (kabinet A312). V A114 stojí **Lukášková** (chemie) vpravo u katedry (hlava z `fotky/Lukášková.jpg`). V C109 stojí **Binková** u tabule a student **Mišák** mezi lavicemi (hlavy z `fotky/Binková.jpg`, `Mišák.jpg`; Binková jen ovál, protože GrabCut jí uřízl vlasy). V A302 stojí **Jelínek** vedle učitelského počítače (hlava z `fotky/Jelínek rovně.jpg`, fotka narovnaná o 40°). V A211 stojí **Lencová** (u katedry vpravo nahoře), **Soumar** je v Předsíni kabinetů (`predsinKabinetu`), v C301 **Veselá** (vpravo od katedry). Hlavy jsou z `fotky/Soumar.jpg`, `Lencová.jpg`, `Veselá.jpg` (GrabCut, příkazy na konci `tools/ucitele.sh`), hlášky jsou provizorní. Šmahelova fotka byla nakřivo – `fotky/Šmahel rovně.jpg` je narovnaná o 23°.

6. **Recept na pivo** (`pivo`, `js/21_pivo.js`), zadávají Kája a Lukášková v laborkách. Postup je ve `state.story.pivo.step`:
   - Kája chce recept na nejlepší pivo. Recepty má Soumar v počítači u sebe v kabinetu (Kabinet A215, dolní dveře Předsíně kabinetů). Soumar stojí v předsíni u dveří a dovnitř nepustí (`doorBlocked`).
   - Odlákat ho umí **Kuba Vozábal**, který podezírá Netanjahua, že nás monitoruje. Nejdřív chce rozbít 3 kamery na Áčku v 1. patře (`PIVO.CAMS`, SPOT, `drawCamera`). Pak chce párek v rohlíku. Když na něj hráč nemá, půjčí mu Emma nebo Zita (`lendTalk`).
   - S párkem jde Kuba za Soumarem do předsíně (`startLure`, `walkTo` = trasa hledáním cesty přes dveře jako u Lili, Kuba jde 140 px/s). V předsíni zavolá Soumara a oba odejdou dveřmi k rozbité kameře v Chodbě v patře, kde zůstanou stát (`kubaAtSoumar`, krok `lakani`).
   - Roman musí čekat venku. Dokud je Soumar v předsíni a Roman v předsíni nebo v A215, Soumar ho vyhodí na chodbu (`updatePivo`, `throwOut`) a Kubu je potřeba poprosit znovu (bez nového párku). Až jsou oba venku, krok je `pc`.
   - U počítače (`pcdesk` v A215) si hráč vybere jedno z piv Kozel, Svijany, Radegast, Plzeň a Budvar. U Budvaru Roman hned řekne „Jak tohle někomu může chutnat, nechutná močka!“.
   - Tiskárna chce kontrolní otázku: jeden z 10 známých letopočtů (`PIVO.DATES`), odpovědi A/B/C. Na špatnou odpověď přijde jiná otázka. Po 3 špatných se spustí alarm a Soumar přiběhne od kamery dveřmi (170 px/s, krok `poplach`). Když Romana zastihne v kabinetu nebo předsíni, vyhodí ho na chodbu. Kubu je pak potřeba poprosit znovu.
   - Správná odpověď spustí tisk a recept se vyzvedne z tiskárny v předsíni. Soumar se pak dveřmi vrátí do předsíně (`soumarBack`) a řekne svou hlášku „Nikdo jiný neumí takové pivo jako já.“. Tu má jako `texts.idle` napořád, i mimo quest. Kuba se vrátí ke svému chození.
   - Po načtení hry uprostřed lákání začne Kuba znovu od začátku, po alarmu je Soumar zpátky u kabinetu (`applyPivo`).
   - Kája a Lukášková odpoví podle piva, vždycky nejdřív ony a pak Roman: Kozel chválí ony, Plzeň chválí všichni, Svijany chválí jen Roman a holky nadávají, Radegast je normální a Budvar „ujde“, ale Roman ho nechápe.
   - Okno s volbami (`openChoice`, `choicePanel`) se natáhne podle počtu možností a funguje i v hlavní hře.

**Texty postav:** učitelé ani studenti neříkají, kudy kam jít („vlevo“, „ve 3. patře“, „naproti WC“). O jiném učiteli řeknou „je u sebe v kabinetu“ nebo název třídy („je v A113“). Místo „dolní šatny“ říkají „ve skříňkách dole“. Hráč ví, kde kdo je.

7. **Tabák pro Křiváčka** (`tabak`, `js/23_tabak.js`): Roman se Křiváčka zeptá „…jestli byste mi prosím nenabil?“. Křiváček nechal tabák v A113. Tam je 10 míst k prohledání (`TABAK.SPOTS`, katedra, skříň, radiátory, umyvadla, lavice). Bublina „Mezerník“ se ukáže jen u místa, u kterého hráč stojí a které ještě neprohledal, jinak nic vidět není. Tabák je v umyvadle na katedře.
   - Kliknutí na tabák v inventáři cestou: „Jako dal bych si, ale počkám s tím na Křiváčka.“ (`use` u věci v inventáři).
   - Křiváček za něj dá 2 sáčky („zase až po výplatě“). Sáček v inventáři (`useBag`) zrychlí chůzi o 45 % na 45 s (`story.nabito`, `tabakSpeed` ve `walkSpeedFactor`, u ukazatele energie ⚡). Druhý sáček se nesčítá, jen obnoví čas.

8. **Damien a Michele** (`damien`, `js/24_damien.js`): Damien stojí v hale před šatnou kluků. Chce mluvit s Michele (už na školu nechodí, přišla se podívat, pracuje v květinářství). Ta je v C308 vedle Švecové a povídají si (bubliny `MICHAELLE_CHAT`, `drawMicheleChat`). Když jí to Roman řekne, Švecová dá hádanku a odpověď se píše na „tabuli“ – opravdové textové pole přes hru (`openBoard`, na mobilu vyskočí klávesnice, psaní neovládá hru). Správně je jen „vířivka“ (velké V a tečka nevadí, „virivka“ nebo „vyřivka“ je pravopisná chyba, `boardVerdict`). Dva pokusy, pak se quest začíná znovu u Damiena – každé kolo má jiné hlášky Damiena, Michele a Švecové i jinou hádanku (`DAMIEN_ASK`, `MICHAELLE_TOLD`, `DAMIEN_RIDDLES`, `MICHAELLE_FAIL`, `story.damien.round`).
   - Po správné odpovědi Michele dojde za Damienem a oba odejdou do holčičí šatny. Od chvíle, kdy Michele vyrazí, se do šatny nedá vejít ani jedním vchodem (`doorBlocked`, z haly i z tělocvičny) – Roman řekne „Asi bych tam neměl chodit, třeba probírají něco důležitého.“ Kdyby tam byl, vystrčí ho to do haly (`kickFromSatna`). Po minutě (`DAMIEN.SATNA_TIME`) vyjdou a vrátí se, kde začínali – Damien do haly, Michele k Švecové do C308 – a šatna je zase otevřená.
   - Jméno se píše **Michele** (fotka se jmenuje `Michaelle .jpg`, id v kódu je `michaelle`).
   - **Robin** stojí v A302 s Jelínkem. Hlavy jsou z `fotky/Damien.jpg`, `Robin.jpg`, `Michaelle .jpg` (příkazy na konci `tools/ucitele.sh`).

9. **HTML pro Robina** (`robin`, `js/25_robin.js`): Robin v A302 potřebuje napsat stránku v HTML (nadpis h1, odstavec s br, tučné b, kurzíva i, seznamy ul a ol – zadání `ROBIN.TASK`). Kód se píše do editoru přes hru s živým náhledem (`openEditor`, `state.board` = hra stojí). Vkládání nejde, opsat se musí ručně. Rozepsaný kód se ukládá (`story.robin.code`).
   - Jelínek radí za peníze: 200 Kč napíše celé, 150 Kč ukáže celý kód (musí se přepsat, text rady nejde označit), 100 Kč ukáže vybranou část (`ROBIN.PARTS`), 50 Kč náhodnou část s vynechanými značkami `<___>` (`holey`). Rady zůstávají v editoru (`story.robin.hints`).
   - Kontrola (`checkHtml`): všechny párové značky zavřené, správné texty (na velikosti písmen, tečkách a mezerách nezáleží), b/strong a i/em obojí platí. `<br>` může být uvnitř odstavce i mezi dvěma odstavci, jen musí být mezi oběma větami. Robin vypíše nejvýš 3 chyby.
   - Náhled se po znovuotevření editoru vykreslí až ve chvíli, kdy je editor vidět (`updatePreview(true)`), jinak zůstával prázdný.

**Binková a Mišák** stojí v C109 vedle sebe u tabule. Když na jednoho z nich Roman promluví, zahrají rozhovor o testu s Gulliverovými cestami (`binkovaMisakTalk` v `20_skola.js`). Bubliny nad nimi nejsou, rozhovor je jen po rozkliknutí.

**Názvy kabinetů a pater** (`20_skola.js`, nahoře): kabinety se jmenují podle učitelů – Kabinet Soumar (A215), Kabinet Ládová (A214), Kabinet Telingerová (A213), Kabinet Lencová (dřív Kabinet 3), Kabinet Mála, Kabinet Křiváček (2), Kabinet Chána (4), Kabinet Binková a Kučerová (5), Kabinet Holuba (7), Kabinet Švecové (8). **Ládová** stojí ve svém kabinetu (A214), **Telingerová** ve svém (A213) a **Kučerová** v Kabinetu Binková a Kučerová (Kabinet 5). Hlavy jsou z malých kulatých fotek (`fotky/Ládová.jpg`, `Telingerová .jpg`, `Kučerová .jpg`, příkazy na konci `tools/ucitele.sh`), hlášky jsou provizorní. Chodby budovy A mají jeden název na patro: **Přízemí**, **1. patro**, **2. patro** (bez západní a východní chodby). Hala s pingpongem, Spojovačka (dřív Prosklená chodba) a schodiště mají svůj název dál.
**Mráz** (dozor na parkovišti) říká: „Můj poslední dozor a pak tu nebudu dva měsíce, tak se snad nic nestane.“

10. **Teplota pro Láďu** (`teplota`, `js/26_teplota.js`): Láďa chce vědět, kolik je venku stupňů. Teploměr půjčí školník. Ve venkovní učebně nebo na parkovišti se mezerníkem změří teplota (bublina „Mezerník“ je přímo u hráče, `measureSpot`), je náhodná od −8 do 28 °C. Láďa na jakoukoli teplotu řekne „Jo, tak to dneska půjdeme na těláku ven.“
   - Roman teplotu řekne česky správně (`stupne`: „je 1 stupeň“, „jsou 3 stupně“, „je 5 stupňů“, „jsou minus 2 stupně“, „je nula stupňů“). Teploměr se dá školníkovi vrátit kdykoli, i před tím, než to Roman řekne Láďovi (`returnThermo`, `teplota.has`). Když ho vrátí dřív, než změřil, musí si ho půjčit znovu.
   - **Školník** (`skolnikMain`): když má hráč rozdělané kleště (struny pro Málu – půjčit, nebo vrátit) a zároveň potřebuje teploměr, vybere si v nabídce. Když jen jedno, dostane to rovnou. Ověřené cesty: jen teploměr, jen kleště, obojí (výběr teploměru i kleští), vrácení kleští + teploměr, vrácení teploměru (před Láďou i po něm, i spolu s kleštěmi), nic.
   - Hlášky Telingerové, Ládové a Kučerové jsou od uživatele (matika a Metoděj, sloh v pondělí, Racek k maturitě).

**Zita a Emma** před bufetem: když na jednu z nich Roman promluví, zahrají rozhovor – Zita si stěžuje na práci v kavárně, Emma odpovídá (`ZITA_EMMA` v `js/27_rozhovory.js`, pokaždé další z 6). Půjčení na párek pro Kubu má přednost.

**Fotbálek na mobilu:** během zápasu je vlevo nahoře tlačítko ✕ (`FOOS_QUIT_BTN`), otevře „Ukončit zápas?“ jako Esc. Vpravo nahoře je tlačítko zvuku, proto vlevo. Šachy mají vlastní tlačítko „Vzdát“.

**Ukládání:** hra se uloží při změně úkolu, při každé změně peněz nebo věcí v batohu (`watchProgress`, `bagSig`), po každém rozhovoru (`sceneNext`), průběžně každých 5 s a při zavření nebo přepnutí stránky (`pagehide`, `visibilitychange`). Dřív se ukládalo jen při změně úkolu, takže půjčky od Mály po „Pokračovat“ zmizely.

**Studenti** jsou v `TEACHERS` se `student: true` (stejná data jako učitelé).

- **Kuba Vozábal** (`vozabal`) chodí po chodbách celé školy, do tříd nechodí. Jde po trase `route` tam a zpátky rychlostí 70 px/s, celé kolečko trvá asi 9 minut.
  - Trasa: 2. patro A → schody → 1. patro → schody → přízemí (východní, hlavní, vstupní, západní, před schody, prosklená, hala) → Céčko → 2. a 3. patro Céčka.
  - Hlava je z vyříznuté fotky s bílým pozadím `fotky/Kuba Vozábal.png` (`obrazky/vozabal.png`). Příkaz je v `tools/ucitele.sh` (volba `--bile-pozadi`). Postava bez fotky má kreslený obličej (`look.hair`).
  - Běžná hláška (od uživatele): „Kámo, bacha, Netanjahu je všude.“ V questu s pivem má vlastní rozhovory (`kubaTalk`).
- **Trasy pohyblivých postav** se počítají hledáním cesty (BFS po mřížce 10 px, obdélník 34 × 44 + 2 px okraj proti `state.solids`), pak se zjednoduší a zapíšou napevno. Po změně nábytku na trase je potřeba přepočítat a zkontrolovat (test „Rauscher/Kuba na trase: 0 kolizí“).

## Multiplayer (`js/29_multiplayer.js`)

Uživatel chce postupně tři kroky: **1. hráči se vidí** (hotové), **2. smajlíky** (hotové – uživatel chtěl 10 smajlíků na výběr, žádné psaní), **hlasový chat** (hotový, `js/34_hlas.js`), **3. společný svět**: **pingpong, fotbálek a šachy pro dva online se sázkou** (hotové, `js/35_online_hry.js`), postup úkolů ostatních (od kamaráda); společné úkoly zatím ne. Uživatel zvažuje **mód Among Us** ve škole (lobby, tajné role, zabíjení, hlasování, úkoly) – po krocích.

### Jak se hraje online

- Hra je veřejně na **https://tondazajic08.github.io/hra_d-rek/** (GitHub Pages z `main`). Hráči můžou být kdekoli, stejná Wi-Fi není potřeba (ta je jen pro `tools/server.py` z počítače).
- Na úvodu vlevo nahoře pod hudbou jsou pod sebou: **„👥 Online: ZAP/VYP“** (`MP.BUTTON`, pamatuje se v `MP.ON_KEY`), **„👤 jméno“** (`MP.NAME_BUTTON`, ťuknutí = změnit jméno, `changePlayerName`) a **Kvalita** (`30_kvalita.js`). Online jde zapnout i ve hře v menu ☰.
- Při prvním zapnutí Online se hra zeptá na jméno. Je společné se žebříčkem (`SPEEDRUN.NAME_KEY`). Bez Online se na jméno neptá – Roman (dárek) hraje bez otázek.

### Co krok 1 umí

- Každý hraje svou hru – úkoly, peníze a věci zůstávají jeho. Sdílí se jen místnost, poloha (px od rohu místnosti) a co hráč dělá (`a`: `sachy`, `fotbalek`, `kos`, `mluvi`, `obchod` → ikonka ♟ ⚽ 🏀 💬 🛒 u jména, `MP.ACTIVITY`).
- Ostatní se kreslí jako Roman s jinou barvou vesty (`MP.COLORS` podle id) a jménem v černém štítku nad hlavou (`drawRemotePlayers` v `renderGame` před hráčem). V pohledu zepředu (ulice, bufet) se nekreslí. Postavička plynule dojede na poslední polohu (`MP.LERP`) a u toho jde (nohy, ruce).
- Ve hře je pod energií „👥 Online: 3 hráči (1 tady)“, se speedrunem o řádek níž (`drawOnlineBadge`, `MP.BADGE`). Na úvodu je u přepínače počet hráčů ve hře.
- Každé otevření stránky je nový hráč (`mp.id`), takže dvě záložky = dva hráči.

### Krok 2: smajlíky

- Ve hře je při zapnutém Online tlačítko **😊** vlevo od ☰ (`MP.EMOTE_BUTTON`) nebo klávesa **T**. Otevře se panel s 10 smajlíky vpravo dole (`MP.EMOTE_PANEL`, levá půlka mobilu patří joysticku): 👋 😂 👍 😮 ❤️ 💀 😡 😎 🤔 🔥 (`MP.EMOTES`). Ťuknutí / klik nebo čísla **1–0** pošlou smajlík, Esc nebo ťuknutí mimo zavře (Esc pak neotevře menu ☰ – `stopImmediatePropagation`).
- Smajlík je 3 s (`MP.EMOTE_TIME`) v bílé bublině nad jménem (`drawEmoteBubble`), u mě nad hlavou taky. V záznamu je jen po tu dobu: `e` = pořadí smajlíku, `ek` = pořadové číslo (stejný smajlík znovu = nová bublina).

### Hlasový chat (`js/34_hlas.js`)

- Zvuk jde **napřímo mezi prohlížeči (WebRTC)**, databáze slouží jen k navázání spojení: nabídka / odpověď (celé SDP i s adresami, čeká se na `iceGatheringState === 'complete'`, max 2,5 s) se pošle POSTem do schránky **`hlas/<id příjemce>/<klíč>`** `{ f, k: 'offer'|'answer', d, t }`. Příjemce schránku sleduje proudem (`voiceOpenInbox`), zprávu zpracuje a smaže; nepřečtenou nabídku smaže odesílatel, když se nespojí.
- **Zapnutí:** tlačítko **🎤** ve hře vlevo od 😊 (`VOICE.BUTTON`, jen s Online), klávesa **V** nebo ☰ → „🎤 Hlas: ZAP/VYP“. Zapnutí požádá o mikrofon (`getUserMedia` s potlačením ozvěny a šumu). Bez Online hlas nejde, vypnutý Online hlas vypne. Nepamatuje se – po otevření hry je vždy vypnutý.
- **Mluví se jen při držení V nebo 🎤** (vysílačka; stopa mikrofonu je jinak `enabled = false`). Tlačítko je pak červené s nápisem „mluvíš“. **Slyší jen ten, kdo má hlas zapnutý sám** (v záznamu hráče pole `v: 1`).
- **Spojení jen s hráči ve stejné místnosti**, kteří mají `v`. Nabídku posílá vždy ten s menším id (`mp.id < o.id`). Odchod do jiné místnosti spojení zavře (po 3 s), nespojené do 15 s se zavře a zkusí znovu za 4 s (`VOICE.CONNECT_TIMEOUT`, `VOICE.RETRY`).
- **Hlasitost podle vzdálenosti:** do 140 px plná, pak klesá až na 0,12 (`VOICE.NEAR / FAR / MIN_GAIN`). Příchozí zvuk jde přes Web Audio (`audio.ctx`, GainNode + AnalyserNode); Chrome ho tam pustí, jen když je proud zároveň ve ztlumeném `<audio>`. Kdo mluví, má u jména **🔊**.
- **Ztlumení:** v ☰ jsou pod „Hlas“ až 2 hráči z místnosti s hlasem („🔊 Slyšíš: Bob“ ↔ „🔇 Ztlumený: Bob“), ztlumený má u jména 🔇. Pamatuje se jen do zavření hry.
- **TURN:** jen STUN servery Googlu (`VOICE.ICE`). Některé sítě (školní Wi-Fi, mobilní data) přímé spojení nepustí – pak je potřeba TURN server (přeposílá zvuk), třeba účet zdarma na metered.ca, a dopsat ho do `VOICE.ICE`. Zatím nepřidaný.
- Ověřeno se 3 headless Chromy (`--use-fake-device-for-media-stream` = pípající mikrofon, `--use-fake-ui-for-media-stream`, `--disable-features=WebRtcHideLocalIpsWithMdns`) proti falešné databázi: spojí se jen ti dva s hlasem, mluví jen při držení V / 🎤 (i dotykem), 🔊 u jména, hlasitost z dálky 0,44, ztlumení, rozpojení v jiné místnosti a nové spojení po návratu, vypnutí; schránky v databázi zůstanou prázdné.

### Pingpong, fotbálek a šachy pro dva (`js/35_online_hry.js`)

- **Šachy online:** každý posílá celý seznam tahů partie (`mv`, 3 znaky na tah: odkud, kam – znak `48 + pole` – a proměna nebo `.`) a číslo partie (`n`). Kdo je na tahu, připíše svůj tah (`chessOnlineMoved` v `chessApply`), druhý si nové tahy přehraje, jen platné (`chessOnlineTake`). V první partii je vyzyvatel bílý, při odvetě se barvy prohodí (`chessOnlineNew`). **Černý má šachovnici otočenou** (`c.flip`, `chessView`), šipky jdou podle obrazovky. Vzdání `rs: 1` (`c.resignBy`). Ověřeno: celé partie (pat, nedostatek materiálu, mat) stejné u obou, odveta s prohozenými barvami, vzdání, odchod.
- **Sázka (nápad od kamaráda):** ve výběru soupeře ◀ ▶ (nebo ← →) 0 / 10 / 25 / 50 / 100 Kč (`DUEL.BETS`, jen co mám). Soupeř bez peněz (pole `m` v jeho záznamu) je šedý „nemá na sázku“. Výzva nese sázku v poli `z` (5. část), u vyzvaného je v okně „Sázka 25 Kč (máš 100 Kč)“, bez peněz jen Odmítnout. Oba zaplatí na začátku každé hry i odvety (`duelPay`), vítěz bere obě, remíza = zpět (`duelSettle`, text pod výsledkem `msg2`). **Kdo uteče nebo vypne Online uprostřed hry, sázku ztratí**, soupeř ji dostane.

- **Výzva:** v menu pingpongu, fotbálku i šachů je modrý řádek **„👥 Online – vyzvat hráče“** (`DUEL.ROW`, jen když je nastavená databáze; bez Online ho zapne a zeptá se na jméno). Ukáže až 4 online hráče ve stejné místnosti, nejbližší první (`duelCandidates`, kdo už hraje s někým jiným, chybí). Výběr → „Čekám, jestli Bob přijme…“ (30 s, `DUEL.ASK_TIME`, Zrušit / Esc). Odmítnutí, vypršení nebo odchod se ukáže červeně v menu (`duel.note`).
- **Vyzvaný** dostane nahoře okno „🏓 Alice tě vyzývá na pingpong!“ s **Přijmout (J) / Odmítnout (X)** (`drawDuelInvite`, `takeDuelTaps`, zvuk). Ukáže se ve hře (bez dialogu a menu ☰) nebo v menu pingpongu / fotbálku; přijetí ho rovnou přenese do zápasu. Když se vyzvou navzájem, zápas začne sám.
- Výzva jde polem **`z`** v záznamu hráče: `'komu|pp nebo foos|id zápasu|ch / ok / no'` (`duelZ`, `duelParse`).
- **Během zápasu** posílá každý PUTem nejčastěji po 0,05 s (`DUEL.SEND_EVERY`, beze změny jednou za 0,5 s) svůj stav do **`zapasy/<id zápasu>/<mé id>`** = `{ d: JSON, t }` a proudem sleduje celé `zapasy/<id zápasu>`. Souřadnice v síti jsou z pohledu vyzyvatele (role `h`), druhý (`g`) má stůl otočený o 180° – **každý hraje zdola (pingpong) / zleva červenými (fotbálek)**.
- **Kdo rozhoduje:** stav nese mou poslední událost `e` (`q` = pořadí, `k` = druh, `sc` = skóre z pohledu `h`); platí ta s vyšším `q` a rozhoduje vždy jen jeden:
  - **pingpong:** ten, ke komu míček letí (své pádlo vidí bez zpoždění). Pošle svůj úder (`k: 's'`, poloha a rychlost míčku) nebo bod (`k: 'p'` s textem pro soupeře). Soupeř si let spočítá sám a dožene 70 % zpoždění sítě. Když u mě soupeř míček „trefí“ nebo spadne, míček zamrzne (`b.frozen`) a čeká na jeho zprávu.
  - **fotbálek:** ten, čí tyč je míčku nejblíž (`f.own`). Když se míček dostane k soupeřově tyči (o 8 px blíž), předá ho (`k: 'h'`); gól pošle `k: 'g'` (výkop pak rozjede ten, kdo gól dostal). Kdo míček neřídí, vidí jeho polohu ze sítě posunutou o zpoždění a gól sám nedá (`boss` ve `foosPhysics`). Soupeřovy tyče (`p`) a kopy (`kk` = počet kopů, `foosKick`) jdou ve stavu.
- **Konec:** bez odměny (dají se hrát dvě záložky). „**Odveta**“ chtějí oba (`rm: 1`), hostitel pošle `k: 'n'`. Odchod (✕ → Ano, Esc, Odejít) zápas ukončí i soupeři: „Bob odešel ze zápasu“ (pole `z` zmizí, nebo 8 s bez zprávy – `DUEL.GONE`). Online zápas se nedá pozastavit, „Ukončit zápas?“ ho nechá běžet.
- **Pojistka:** když databáze odmítne záznam s `z` (401 / 403 = nenahraná nová pravidla), zápasy se do zavření hry vypnou (`duel.blocked`) a hráč ostatním nezmizí; v menu je „Online zápasy zatím nejdou – databáze nemá nová pravidla“.
- Staré zápasy (spadlý prohlížeč) starší než 10 minut smaže ten, kdo začíná nový zápas (`duelPurge`).

### Databáze

- **Firebase Realtime Database** v uživatelově vlastním projektu **`darek-online`** (založil ho sám, účet `tonda.zajic08@gmail.com`): `MP.DB_URL` = `https://darek-online-default-rtdb.europe-west1.firebasedatabase.app`. Žebříček je dál v kamarádově projektu `darek-30b0c` (Firestore, `28_speedrun.js`) – jsou to dvě nezávislé věci.
- Přes REST bez knihoven: vlastní záznam `hraci/<id>` = `{ n, r, x, y, a?, e?, ek?, s?, v?, t }` (`e`/`ek` smajlík, `s` = id skinu, když není výchozí, `v: 1` = má zapnutý hlas) se posílá PUTem (nejčastěji po 0,15 s, `MP.SEND_EVERY`, když hráč stojí, jednou za 3 s, `MP.HEARTBEAT`), změny ostatních chodí proudem `EventSource` (události `put` / `patch`, kopie v `mp.raw`, `mpSetAt`, `mpSync`). `t` je čas serveru (`{".sv": "timestamp"}`), rozdíl hodin se zjistí z vlastního záznamu (`mp.offset`).
- Kdo se neozval 12 s (`MP.STALE`), není vidět. Záznamy starší než 2 minuty (`MP.PURGE`) smaže kdokoli online. Na úvodu, na závěru, po vypnutí a při zavření stránky (`pagehide`) se vlastní záznam smaže.
- **Pravidla** jsou v `tools/firebase_pravidla_multiplayer.json` (Firebase konzole → Realtime Database → Pravidla → vložit → Publikovat). Číst jde jen `hraci`, schránky `hlas/<id>` a `zapasy`, zapisovat jen jednotlivé `hraci/<id>` s poli n (1–16 znaků), r, x, y, a, e (0–9), ek, s (do 24 znaků), v (= 1), z (do 64 znaků), t (= čas serveru), zprávy `hlas/<id>/<klíč>` s poli f, k (offer / answer), d (do 20 000 znaků), t a stav zápasu `zapasy/<zápas>/<id>` s poli d (do 2000 znaků), t; cokoli jiného databáze odmítne. Proto se celé `hraci` smazat nedá, jen po jednom. **Při přidání nového pole (krok 2, 3) se musí upravit i pravidla**, jinak databáze odmítne celý zápis a hráči se přestanou vidět.
- Firebase povoluje přístup odkudkoli (`Access-Control-Allow-Origin: *`), takže online jde i ze `jeden_soubor/hra_darek.html` otevřeného z disku.
- Bez adresy (`VLOŽ_…`) se přepínač Online neukáže. Adresa jde dočasně přepsat v URL: `index.html?mpdb=http://127.0.0.1:8001`.

### Testy

- **Bez Firebase:** falešná databáze (fronta spojení 128 – s výchozími 5 se při 4 prohlížečích občas nenačetl soubor hry) `python tools/falesna_databaze.py . 8001` (REST GET/PUT/POST/DELETE na libovolné cestě + proud `text/event-stream`, statické soubory hry; pravidla nekontroluje; třetí číslo = zpoždění v ms jako u skutečné databáze, např. `… . 8001 150`) a `index.html?mpdb=http://127.0.0.1:8001`. Dvě hry v headless Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe --headless=new --remote-debugging-port=…`) řízené přes DevTools protokol z Pythonu (`pip install websocket-client`, `Runtime.evaluate`, snímek přes `canvas.toDataURL`). Herní smyčka se v testu pumpuje ručně `update(1/60)`.
- Ověřené: vidí se navzájem na správném místě, chůze, ikonka u šachů (`openChess()`), odchod do jiné místnosti, návrat na úvod i vypnutí Online; smajlíky (tlačítko, T a čísla, druhý hráč vidí bublinu, po 3 s pole `e` zmizí); skin druhého hráče. Totéž prošlo i naostro proti `darek-online` (testovací záznamy se pak smažou ručně `curl -X DELETE …/hraci/<id>.json`).
- **Online zápasy** (22. 10. 2026, falešná databáze bez zpoždění i se 150 ms): dva Chromy s roboty (pádlo / tyče jdou za míčkem, občas schválně minou, `update` obalený robotem) – výzva, okno u vyzvaného, přijetí, pingpong 7:3 ↔ 3:7 i 7:4 se zpožděním (výměny až 68 úderů), fotbálek 5:2 / 1:5 i se zpožděním, skóre a události (`seq`) u obou stejné, odveta, odchod soupeře, odmítnutí pole `z` (401) bez zmizení hráče. **Naostro proti `darek-online` zatím nezkoušeno** – nejdřív musí uživatel nahrát nová pravidla.

### Kamarádovy online duely (`35_duely.js`, nepřevzaté)

- 26. 10. 2026 měl kamarád v `main` vlastní online duely (šachy, fotbálek, pingpong se sázkou, `duely/` + `hry/` v databázi, hostitel počítá míček, soupeř má větší pádlo). **Uživatel chtěl nechat naše** a převzít jen nápady: sázky (dodělané do `35_online_hry.js`) a postup úkolů ostatních (commit `253d690` – u jména „· 3/10“, v katalogu „👥 ✔ jména“, pole `qn` / `qd` + `m` = peníze, `mp.legacy` = stará pravidla → bez nich). Jeho `35_duely.js` a změny v šachách / fotbálku / pingpongu se **nepřebírají**.

### Kamarádova větev `mptest` (nepřevzatá)

- Kamarád (`robkojabko/darek_v2`) má ve větvi `mptest` vlastní online: `29_online.js` + `31_online_hry.js` (šachy a fotbálek proti sobě přes výzvy, přehled hráčů a jejich úkolů na klávese O, ✔ x/y nad hlavou, povinné jméno při startu hry), do své databáze `darek-30b0c` pod `mp/players`.
- **Uživatel ho nechtěl** – multiplayer zůstává ten náš (`29_multiplayer.js`). Převzaté jsou jen novinky mimo online: `30_kvalita.js` (beze změn) a menu ☰ z jeho `29_online.js` (do `31_menu.js`, napojené na `mp.on` / `setOnline`). Při 22. 10. 2026 jeho online navíc nefungoval: pravidla jeho databáze povolovala jen n, r, x, y, c, t a odmítla zápis s q, qm, qd, qt a m.
- Jeho kód výzev (`31_online_hry.js`, zprávy v poli `m` záznamu hráče, hostitel bílý / červení) se může hodit jako inspirace pro krok 3.

## Bacha na Láďu (`js/39_horor.js`)

Horor **z první osoby** po celé **budově A** (uživatel chtěl horor s jumpscary a naháněčkami). Mód v 🎮 Módy, obrazovka `'horor'` (joystick funguje i tady – `05_stav_a_ovladani.js`, `setScreen`).

- **Mapa = budova A** stejně jako mapa A v Among Us (`AMONG_MAPS.A.rooms`, `HOROR_ROOMS()`): přízemí bez části s fotbálkem (Hlavní chodba, křídla, schodiště, vstupní chodba), chodby 1. a 2. patra a 24 místností, do kterých z nich vedou dveře (třídy, kabinety, sborovna, kancelář, aula, WC) – 27 místností, 58 průchozích dveří. Dveře do místností mimo mapu jsou zamčené (tmavší), východ = dveře `venku` ve vstupní chodbě (se 3 klíči zelené).
- **Každá místnost má svou mřížku** po 10 px (`hororMap(id)`: 0 volno, 1 zeď, 2 nábytek, 3 mimo hru, 4 dveře; `obst` = který nábytek, `doors` s bodem před dveřmi `ix, iy`, `hides` = úkryty, navigační mřížka 20 px `nav` s okrajem jako hráč, `reach` = kam se dá dojít od dveří). Průchod dveřmi: hráč je do 26 px od dveří a jde k nim (u schodů je zábradlí) → `hororPlayerThrough` → místo jako ve hře (`door.spawn`), pohled od dveří (`hororThrough`), krátké ztmavnutí a zvuk dveří.
- **Pohled:** raycasting (`hororCast`, paprsek na 4 px šířky), tma a baterka. **Barvy** (`HOROR_STYLE`, `hororStyle`): chodby podle virtuální prohlídky na gympt.cz (Matterport `my.matterport.com/show/?m=aEGsK2FaXTn` – jde vyfotit v headless Chrome s `--use-angle=swiftshader`, šipka nahoru / klik do podlahy = krok): bílé zdi, bílé sloupy s černou lištou, světlé teraco; vstupní chodba okrová s krémovými plochami, šedomodrým pruhem a oranžovým soklem. Třídy krémové s dřevěnou lištou a parketami, WC s modrými obklady, aula. **Nábytek** (`HOROR_FURNITURE`) podle druhu – barva a výška (lavice, katedry, skříně, sloupy, umyvadla, kabinky, pódium…). Dveře kreslené podle jejich šířky (rám a klika jednou).
- **Ovládání:** W S / ↑ ↓ dopředu / dozadu, A D / ← → do stran, **otáčí jen myš** (zamčená po kliknutí; když zamknout nejde, tažení se zmáčknutým tlačítkem), **Shift sprint** s **výdrží** (4 s, obnova 0,55/s; když dojde, „Došel dech…“, sprint až od 1,4 s, oddychování), **E schovat / vylézt**, Esc pauza. Mobil: joystick vlevo (naplno = sprint), tažení vpravo = otáčení, tlačítko 🫣.
- **Klíče** jsou ve **3 náhodných třídách** (`HOROR.KEY_ROOMS`: A113, A114, A107, A209–A212, sborovna, A302–A311, aula), na místě, kam se dá dojít (`reach`). Vlevo nahoře je seznam tříd s klíči (sebrané ✔), nahoře název místnosti.
- **Láďa** (`hororLada`) chodí po celé budově i po schodech (`hororRoute` = BFS po místnostech přes dveře, které jsou pro něj dosažitelné – `navOk`; `hororPlan`; na konci cesty projde dveřmi). Režimy: `patrol` (náhodná místnost, chodby častěji), `check` (**slyšel tě sprintovat** – stejná místnost do 300 px – jde se podívat), `chase` (vidí tě: stejná místnost, nic mezi vámi, do 520 px, před sebou nebo blízko; 168 px/s, sprint 200, chůze 115), `look` (došel tam, kde tě viděl naposledy, 3 s se rozhlíží). **Setřesení:** když tě nevidí, jde jen na místo, kde tě viděl naposledy (za tebou dveřmi jen tehdy, když viděl, jak jimi utíkáš), pak se rozhlédne a vzdá to („Setřásl jsi ho… zatím.“). Kroky slyšíš i ze sousední místnosti.
- **Úkryty** (`hides`, E nebo 🫣): skříně (A113, A114, sborovna), 3 kabinky na WC, pódium v aule – jen ty, ke kterým se dá dojít (skříň v A310 je za lavicemi, vyřazená). Ve skříni tma se škvírou, nedá se chodit. **Když tě Láďa neviděl zalézt, nenajde tě**; když viděl (stejná místnost, viděl tě před chvílí, do 320 px), jde tam, kde jsi zalezl, a vytáhne tě.
- **Po 2. klíči** zhasne a Láďa je za tebou (naháněčka). **Chytí tě** (30 px) → jumpscare → Zkusit znovu / Odejít. Se 3 klíči hlavním vchodem ven → „UTEKL JSI!“.
- **Zvuky** (Web Audio): hučení, kroky s hlasitostí a stranou, dveře, srdce do 320 px, oddychování, výkřik. Hudba hry je během módu vypnutá.
- **Ověřeno skriptem** (headless Chrome): všech 27 místností se postaví (12 ms), všech 58 dveří jde projít (i schody), ze přízemí vede cesta do každé místnosti, klíče vždy dosažitelné (30 her), Láďa dojde z 2. patra do A113 (přes schody), setřesení (honí → rozhlíží se → patrola), ve skříni tě nenajde / když viděl zalézt, najde, za tebou dveřmi jde, útěk se 3 klíči, kreslení ~1 ms. Jediné: dveře sborovna → Kabinet Chválová jsou pro Láďu nedostupné (hráč jimi projde). Na mobilu zatím nezkoušeno.

## Among Us (`js/36_among.js`)

Uživatel chce Among Us jako **samostatný online režim** ve škole. Postup po krocích: **1. založení hry, seznam her a čekárna (hotové)**, **2. start hry hostitelem a tajné role (hotové)**, **3. mapy, nastavení, zabíjení, hlášení těla, porada s hlasováním a konec hry (hotové)**, **4. úkoly a animace smrti (hotové)**, **5. třídy, venty, sabotáže, barvy, převlékání v čekárně (hotové)**. Uživatel chce všechno doladit a **nahrát na GitHub až nakonec**.

- **Úvod:** „🎮 Módy“ → „👾 Among Us (online)“ (jen s databází, `modesItems` v `10_obrazovky.js`). Otevře seznam her (`state.amongPick`, `drawAmongPick`): řádky „Alice, Bob +1 · 3/10“ (max 5 her, plná hra šedá), „➕ Založit hru“, Zpět; šipky / Enter / Esc i ťuknutí. Bez Online ho zapne a zeptá se na jméno.
- **Hra = skupina hráčů se stejným polem `g`** v záznamu `hraci/<id>` (`g` = id hry, `gj` = čas připojení). Jiná cesta v databázi není: seznam her se skládá ze živých záznamů ostatních (`amongGames`), takže **když všichni odejdou nebo zavřou hru, hra zmizí sama**. Na úvodu se vlastní záznam neposílá a `mp.offset` může chybět – čas serveru se pak bere z nejnovějšího záznamu ostatních (`amongNow`).
- **Hostitel** = kdo je ve hře nejdéle (nejmenší `gj`), v seznamu hráčů 👑. Když odejde, je jím další.
- **Čekárna** = díl `hlavni` spojené chodby (Hlavní chodba za vchodem), hráč se nedostane ven (`amongLobbyRect`, ořez polohy), dveře nefungují. **Nejsou tu učitelé** (`enterRoom` obalené: `state.teachers = []`, bez nich i v `state.solids`), **nejdou úkoly** (`activeQuests` filtruje podle `state.mode`, takže v režimu `'among'` je prázdný), ani minihry a nápovědy „mezerník“ (`updateAmong` místo `updatePlaying`, `drawTalkHint` / bubliny Terky a Michele vypnuté). Horní lišta: „👾 Among Us · čekárna“, vpravo seznam hráčů (`drawAmongHud`). Funguje ☰ (Hlavní menu = odejít ze hry), smajlíky a hlas.
- **Hráči ve hře vidí jen sebe navzájem** – `mpHere` porovnává `g` (hráči ve škole mají `g` prázdné), takže ani hráči ze školy nevidí hráče v Among Us.
- **Hlavní hra se nepřepíše:** `saveProgress` v režimu nic nedělá, `amongJoin` nevolá `startPlaying` (ten by smazal uložení), jen `resetGame` v paměti; na úvodu se uložená hra načte znovu.
- **Kolo (2. krok):** hostitel má v čekárně dole „▶ Začít hru (mezerník)“ (`AMONG.START_BTN`), jde až od **4 hráčů** (`AMONG.MIN`). Hostitel náhodně vybere **záškodníky: do 6 hráčů 1, od 7 hráčů 2** (`AMONG.IMPOSTORS`) a zapíše kolo do **`among/<id hry>`** = `{ k: číslo kola, st: 'play' | 'lobby', im: 'id,id', p: 'id,…', t }` (`amongStartRound`, pojistka proti dvojímu stisku 3 s). Každý ve hře to sleduje proudem (`amongOpenDoc`, `amongApplyDoc`).
- **Role:** **Záškodník** (červeně) / **Nevinný** (modře) – na začátku kola obrazovka přes celou hru na 4,5 s (`drawAmongReveal`), záškodník vidí i druhého záškodníka. Pak vlevo nahoře „👾 Jsi Záškodník“, uprostřed nápověda. V kole se chodí **po celém přízemí** (spojená chodba, do tříd se nejde, dveře nefungují). Uživatel zatím neřekl, jestli chce celou školu.
- Hráč v kole má v záznamu `gp: 1`; rozehraná hra je v seznamu „(hraje se)“ a nejde se k ní připojit. **Hostitel může kolo ukončit v ☰** („⏹ Ukončit kolo“, `amongEndRound` → `st: 'lobby'`, všichni zpět do čekárny). Vypnutý Online = konec hry (na úvod).
- **Mapy (3. krok, uživatel chtěl menší než celé přízemí):** `AMONG_MAPS`. **A – budova A:** spojená chodba jen díly `zapad`, `vychod`, `hlavniTop`, `hlavni`, `schodyA`, `vstup` (bez části s fotbálkem) + chodby `patroA` a `patroA2`. **C – Céčko:** díly `predSchody` (fotbálek), `prosklena`, `hala` + `cecko`, `cecko2`, `cecko3`. Do tříd se nechodí. Povolená poloha = díl pod středem hráče (`amongPartAt`, u překryvů pozdější díl), mimo mapu se pohyb vrátí (`amongMove`); dveře jen do místností mapy a jen z povolených dílů (`amongDoorOk`, přechod jako ve hře – `updateTransition`). Start = kruh hráčů kolem **tlačítka porady** (A uprostřed Hlavní chodby, C v chodbě s fotbálkem pod ním).
- **Nastavení v čekárně** (⚙, mění jen hostitel, ostatní vidí; `AMONG_SETTINGS`, `AMONG_DEFAULTS`): mapa, čekání mezi zabitími **25 s** (10–60), vzdálenost zabití (krátká / **střední** / dlouhá = 55 / 85 / 120 px), porady na hráče **1**, čekání na poradu **15 s**, diskuze **15 s**, hlasování **120 s**, rychlost **1×**, ukázat roli vyhozeného **ano**, anonymní hlasování **ne**. Rozsahy podle skutečné hry (wiki / návody), výchozí kromě 25 s podle běžné hry. Hostitel ukládá nastavení do stavu (`st: 'lobby'`).
- **Síť 3. kroku:** stav kola řídí **hostitel**: `among/<hra>/s` = `{ d: JSON, t }` (jen hostitel zapisuje, všichni sledují, `amongApplyS`). Stav: `k` kolo, `st` (`lobby` / `play` / `meet` / `eject` / `end`), `set`, `im`, `p`, `names`, `dead`, `bodies` [{ id, r, x, y }], `em` (porady hráčů), `lme` (konec poslední porady), `meet` { by, body, t0, votes }, `ej` { id, imp, tie, skip, votes }, `win`, `ts`. Hráči posílají zprávy `among/<hra>/e/<klíč>` = `{ f, d: JSON { k: 'kill' | 'rep' | 'emer' | 'vote', r: kolo, … }, t }`; hostitel je zkontroluje (`amongHostEvent`), smaže a zapíše nový stav (`amongHostTick`, běží každý krok). Hostitel si stav kopíruje, takže změny vidí hned i u sebe. Když odejde, pokračuje další hostitel z posledního stavu. Kdo z kola zavře hru, počítá se jako mrtvý (bez těla).
- **Zabíjení:** záškodník má vpravo dole 🔪 ZABÍT (Q), svítí u živého nevinného v dosahu, odpočet čekání; první zabití v kole po 10 s (`AMONG.FIRST_KILL`), po poradě znovu celé čekání. Záškodník skočí na místo oběti. Na zemi zůstane tělo (ležící postava v kaluži). **Mrtvý je duch** (průhledný, „ZABILI TĚ!“): chodí dál, živí ho nevidí ani neslyší (`mpHere` obalené), nehlasuje.
- **Porada:** 📢 NAHLÁSIT (R) u těla, 🚨 PORADA (E) u tlačítka (počet porad a čekání podle nastavení). Všichni se přenesou ke stolu (hlas 🎤 funguje), 3 s úvod („Nalezeno tělo!“ / „Mimořádná porada!“), diskuze, hlasování: karty hráčů (mrtví přeškrtnutí, 📢 kdo svolal, ✔ kdo hlasoval), 1. ťuknutí vybere, 2. potvrdí, ⏭ Přeskočit, šipky + Enter. Hlasování skončí, když hlasovali všichni živí nebo vyprší čas.
- **Vyhození:** nejvíc hlasů = vyhozen (odlétá vesmírem), nerozhodně / nejvíc „přeskočit“ = nikdo. „Bob BYL / NEBYL záškodník“ a kolik jich zbývá (když je zapnuté), kdo jak hlasoval (když není anonymní). Pak všichni zpět na start mapy.
- **Konec:** všichni záškodníci pryč = **VYHRÁLI NEVINNÍ**, záškodníků stejně jako živých nevinných = **VYHRÁLI ZÁŠKODNÍCI**; obrazovka 7 s, pak všichni do čekárny. Hostitel může kolo kdykoli ukončit v ☰.
- **Úkoly (4. krok, `js/37_among_ukoly.js`):** na každé mapě 14 míst (`AMONG_MAPS.X.tasks`, od rohu místnosti; vybrané skriptem: volné, dosažitelné z tlačítka / dveří, u zdi, co nejdál od sebe). Hostitel při startu dá každému `tc` náhodných míst (nastavení „Úkoly na hráče“, výchozí 5) → stav `tk { id: [místa] }`, splněné `td`. U svého místa nevinný (i duch) zmáčkne **🛠 POUŽÍT (E)** (stejné tlačítko jako porada). Záškodník má úkoly jen na oko (seznam „předstírej“, žlutý ! nad místy, ale nejdou otevřít). Vlevo seznam „Tvoje úkoly“ s místem a **pruh úkolů všech** nevinných (bez odešlých – `S.gone`). **Všechny úkoly splněné = VYHRÁLI NEVINNÍ** („Nevinní splnili všechny úkoly!“, `S.how = 'tasks'`).
- **Druhy úkolů:** `math` rychlá matika (náhodné příklady: +, −, ·, :, mocnina, procenta, přednost operací; ověřeno 2000 příkladů), testy `bio`, `chem`, `cz`, `dej`, `zem` – **po 50 otázkách** (`AMONG_QUESTIONS`, [otázka, správně, 3× špatně], možnosti se míchají), v úkolu 3 správné odpovědi (klávesy 1–4 / ťuknutí), špatná ukáže správnou a dá jinou otázku; `wires` kabely u projektoru (spojit 4 barvy), `download` známky z Bakalářů (7 s, nezavírat), `board` smazat tabuli (houba za myší / prstem / šipkami), `trash` vynést koš (držet mezerník / páku 2,5 s). Úkol jde zavřít ✕ / Esc, hra běží dál (záškodník může zabít i u úkolu); porada nebo smrt úkol zavře.
- **Animace smrti:** oběť uvidí přes celou obrazovku, jak záškodník přiběhne, nůž, pád a krev, „Zabil tě …“ (`drawAmongDeathAnim`, tělo má `k` = vrah a `at` = čas), pak „ZABILI TĚ!“. Ostatní vidí čerstvé tělo padat na bok s rozstřikem krve a rozlévající se kaluží (podle `body.at`), záškodník záblesk nože.
- Ověřeno 4 prohlížeči: všechny druhy úkolů jdou splnit, pruh na 100 % → výhra nevinných, animace smrti, padající tělo; znovu prošel i test zabíjení / porad / hlasování (3. krok). Pozor na test: hostitel, který je ve hře sám bez záškodníka, hned vyhlásí výhru nevinných.
- **5. krok (`js/38_among_extra.js`):**
  - **Třídy:** k mapě patří i místnosti, do kterých vedou dveře z chodeb mapy (A: A113, A114, A107, kabinety, WC, A209–A212, sborovna, kancelář, aula, A302–A311…; C: šatny, tělocvična, C101, C109, C202, C203, C301, C308, WC, kabinety…), ne ven (`venku`), parkoviště a schody do laborek. Pravidlo místnosti `null` = celá.
  - **Venty** (`AMONG_MAPS.X.vents`, 3 sítě po 3): záškodník u mřížky 🕳 VENT (E) zmizí (pole `a: 'vent'` v záznamu → `mpHere` ho všem skryje), ve ventu tlačítka / 1–2 / šipky = jiný vent sítě (i do jiného patra), E = vylézt. Ve ventu nezabíjí ani nehlásí. A: západní a východní šachta (přízemí – 1. – 2. patro) a A113 – A107 – sborovna; C: hala – Céčko – tělocvična, chodba s fotbálkem – C 2. – C 3. patro, C109 – C202 – C301.
  - **Sabotáže** (⚡ SABOTÁŽ / F, jen živý záškodník mimo vent, 30 s čekání): 💡 zhasnout světla – nevinní vidí jen kruh kolem sebe, dokud někdo u **rozvodny** (`lightSwitch`, ⚡ s vykřičníkem; A horní kus Hlavní chodby, C Spojovačka) nenahodí 5 jističů (💡 OPRAVIT / E); během tmy nejde porada. 🚪 zamknout dveře na 10 s (`amongDoorOk`). Řídí hostitel (`S.sab`, `S.sabCd`, zprávy `sab` / `fix`), porada sabotáž zruší.
  - **Barvy** jako v Among Us (Červená, Modrá, Zelená, Růžová, Oranžová, Žlutá, Černá, Bílá, Fialová, Hnědá) podle pořadí ve hře: barevná jmenovka a kroužek pod nohama (i u mě), tečka v seznamu hráčů a na poradě (`amongColorOf`, `amongTag`).
  - **Převlékání:** v čekárně 👕 Převléct otevře Locker (`openSkins`); když kolo začne, Locker se zavře.
  - Tlačítko E dělá podle toho, co je blízko: vylézt z ventu > úkol > vypínač > vent > porada (`amongUse`, `amongUseInfo`).
- **Pořadí stavu:** každý zápis hostitele má `S.v` o 1 vyšší, starší stav z proudu se zahodí (jinak změna nastavení těsně před startem vrátila všechny do čekárny).
- Ověřeno se 4 prohlížeči: převlečení za Holuba / Binkovou, vent (zmizí, přesun do 1. patra, vylezení), zhasnutí světel u všech, porada při tmě nejde, oprava jističi, zamčené dveře 10 s, vstup do A113, barvy; znovu prošel test zabíjení a porad.
- **Role nejsou tajné před vývojářskými nástroji** – `im` je v databázi čitelně (opravdové tajemství by chtělo server nebo šifrování).
- Pravidla databáze: pole `g` (do 40 znaků), `gj` (číslo), `gp` (= 1) a cesta `among/<hra>` se stavem `s` { d do 8000 znaků, t } a zprávami `e/<klíč>` { f, d do 300 znaků, t }. Když je databáze odmítne, hra se vrátí na úvod se zprávou „Among Us zatím nejde – databáze nemá nová pravidla“ (`amongBlocked`).
- Ověřeno se 4 prohlížeči (3. krok, falešná databáze 80 ms): nastavení se propíše všem, zabití (oběť je duch, živí ji nevidí), nahlášení těla → porada u všech, hlasování → vyhozený záškodník → vyhráli nevinní → čekárna; 2. kolo: dvě zabití → vyhráli záškodníci; mapa C začíná u fotbálku a pustí jen do Céčka, mapa A jen do 1. patra. Bez chyb.
- Ověřeno se 4 prohlížeči (2. krok): se 3 hráči start nejde, se 4 právě 1 záškodník, stejné kolo u všech, dvojí stisk nerozdá role znovu, „hraje se“ v seznamu, po odhalení chůze po přízemí, ukončení kola vrátí všechny do čekárny.
- Ověřeno se 3 prohlížeči (falešná databáze, 80 ms): založení, druhý hráč hru vidí a připojí se, vidí se jen oni dva (třetí ve škole ne a naopak), bez učitelů, z čekárny se neodejde, předání hostitele, zmizení hry po odchodu všech, uložená hlavní hra beze změny.

## Pingpong (`js/32_pingpong.js`)

- U obou stolů v hale s pingpongem (`SPOTS`, `pingpongTableRect` = bližší stůl) mezerník / ťuknutí otevře obrazovku `'pingpong'`. V menu je i online soupeř (`35_online_hry.js`, viz Multiplayer). Menu, konec a „Ukončit zápas?“ sdílí vzhled se šachy a fotbálkem, ✕ vlevo nahoře jako u fotbálku.
- Pohled shora: ty dole (červené pádlo), počítač nahoře. Míček má výšku `z`: kreslí se o `z × PP.LIFT` výš a větší, stín je na stole. **Zásah se počítá s míčkem tam, kde je vidět** (ne se stínem) – jinak hráč mířil na míček a netrefil ho.
- Ovládání: pádlo jde za myší, na mobilu za prstem a je o `PP.TOUCH_LIFT` nad prstem, ať je vidět; nebo šipky / WASD. Odpaluje se samo, když míček po odskoku na mé straně narazí do pádla:
  - směr do stran = kde míček pádlo trefí (střed / kraj, `ppHitMe`), boční pohyb pádla přidá jen trochu (`vx / 2600`) – při natahování pro míček nelétá do autu;
  - síla = rychlost míčku + švih dopředu, pozvolná (`0,8 × (1 − e^(−švih/650))`), přes 1,13 je zámezí;
  - švih do strany = faleš (`ax`): míček se stáčí a po odskoku uhne.
- `ppShoot` spočítá z místa dopadu a doby letu rychlost a oblouk. Pravidla (`ppPhysics`): odskok na vlastní straně, dvojí odskok, zem bez odskoku = bod. Hraje se do 7 s rozdílem 2 (`PP.WIN`), podání po 2 bodech, za 6:6 po každém. Podání: švih dopředu / mezerník, samo po 4 s.
- Počítač (`ppAi`): po úderu hráče čeká `react`, pak jde na místo, kde míček bude (`ppPredictX` simuluje let), s chybou `err`; míří do stran podle `aim`, faleš `spin`, občas úder pokazí (`miss`). Výhra 5 / 15 / 30 Kč.
- **Vyvážení** robotem, který hraje jako člověk (reakce 0,15–0,32 s, chyba odhadu roste s rychlostí a falší míčku, omezená rychlost ruky): lehký počítač porazí slabý hráč skoro vždy, střední vyhraje asi 60 % zápasů proti dobrému, těžký proti výbornému asi 80 %.

## Start a skiny (`js/33_skiny.js`)

- **Kde začít:** po „Hrát“ (a výběru normální hra / speedrun), „Pokračovat“ i „Hrát znovu“ v hlavní hře se ukáže „Kde chceš začít?“ – 🏫 Venku před školou (`ulice`), nebo 🔒 Ve skříňkách (Dolní šatny, hned u Lockeru) (`START_PLACES`, `pickStart`, `enterStartRoom` v `resetGame`). Volba se pamatuje (`hra_darek_start_v1`). Režim Vrah se neptá.
- **Locker:** fialová skříňka s 👕 na levé zdi Dolních šaten (`LOCKER`, svítí, nad ní cedulka). Mezerník / ťuknutí otevře obrazovku `'skins'`.
- **Výběr skinu:** postava přes většinu obrazovky (`SKIN_UI.SCALE` 4,2), šipky po stranách (← → / ťuknutí), ťuknutí na postavu nebo ↑ = otočí se dokola (zúžení podle cos, zezadu vlasy místo obličeje – `drawFigureBack`), „✓ Vybrat“ / mezerník, ✕ / Esc zpět. Pozadí jsou šatny: řada skříněk, některé otevřené s oblečením na ramínkách, taška a boty (`drawSkinRoom`, `OPEN_LOCKERS`), lavička a reflektor.
- **Skiny** jsou v `SKINS` (`id`, `name`, `face?` = hlava z `obrazky/`, bez ní Romanova, `hair`, barvy oblečení jako pro `drawFigure`): Romanova oblečení (v mikině, v dresu, v obleku, v kostkované košili) a **všechny postavy ze hry** s vlastním vzhledem (učitelé, studenti, postavy z Vraha – 37 skinů `p_<id>`, `person`, kopie `look` při načtení; uživatel chtěl i za učitele). Převlékat se jde i v čekárně Among Us. Vybraný skin se pamatuje (`hra_darek_skin_v1`), hráč se v něm kreslí všude (`drawPlayerFigure` je přepsaná) a online ho vidí i ostatní (pole `s`).

## Menu ☰ a kvalita grafiky (od kamaráda)

- **☰ Hlavní menu / Pozastaveno** (`31_menu.js`): tlačítko ve hře vlevo od inventáře (`MENU_BUTTON`) nebo Esc. Hra stojí (i časovač speedrunu, `speedrunPaused`). Položky: Pokračovat, 👥 Online ZAP/VYP (jen když je nastavená databáze), Kvalita, 🏠 Hlavní menu (uloží a jde na úvod). Online a Kvalita se přepnou a menu zůstane otevřené. Esc nejde otevřít v obchodě, v dialogu ani v jiném okně (`canOpenPause`), Esc tak nejdřív zavře to okno.
- **Kvalita** (`30_kvalita.js`, uloží se v `hra_darek_kvalita_v1`): nízká = plátno v polovičním rozlišení bez `devicePixelRatio` (`renderScale` v `resize`), bez stínů canvasu a kreslí se jen každý druhý snímek (`shouldRender`). Logika hry běží stejně.
- **Nekreslení mimo obrazovku** (`CULL`, `cullBegin` / `inView` / `cullReset`): v `renderGame` se přeskočí díly chodby, průchody, nábytek, dveře, předměty, učitelé a online hráči mimo záběr kamery (s okrajem). V přízemí to je asi 29 z 50 kusů nábytku. Mimo svět ve hře (úvod, minihry, rozhraní) `inView` vrací vždy true.
- Ověřeno: všech 62 místností se vykreslí bez chyby ve výchozí i nízké kvalitě, menu zastaví hru, Esc menu zavře i otevře.

## Co je ještě v plánu

- **Výběr postavy na začátku.** Uživatel dodá fotky lidí, hlavy se udělají přes `tools/oblicej_na_sprite.py`.
- **Seznam úkolů na klávese nebo tlačítku**, úkoly v libovolném pořadí místo `questIndex`.

- **Šmahel** – fotka `fotky/Šmahel.jpg`, přijde „až potom“.
- Úkoly pro Křiváčka a Rauschera.
- Další způsoby vydělávání peněz. Zatím jsou peníze od Mály a za výhry v šachu.

## Jak uživatel pracuje (důležité!)

- Píše česky a posílá fotky skutečné školy do `fotky/`.
- Kreslí „ukázky“ (`ukázka*.png`, `další ukázka .png`): **červeně = smazat, modrá čára = odkud/pokud**. Drž se jich přesně.
- Pokus postavit celou školu podle virtuální prohlídky Matterport (gympt.cz) **odmítl** („strašný“) a vrátilo se to.
  Zamítnutá verze je v `zalohy/index_matterport_zamitnuta.html`. Neopakovat. Měnit postupně podle jeho pokynů.
- Nechce zužovat ani měnit tvary, které už odsouhlasil. Měnit jen to, o co žádá.

## Testy (v prohlížeči, přes JS na stránce)

Po každé změně mapy spusť tyto kontroly:

1. Ze `ulice` jsou přes dveře dosažitelné všechny místnosti (teď 36/36).
2. Žádný spawn ve dveřích není v pevné překážce ani nestojí na jiných dveřích.
3. Projdi každé dveře: postav hráče 34 px před ně, drž šipku a ověř, že se dostane do cílové místnosti (teď 72/72).
4. Flood fill na mřížce 10 px v `chodba` z hlavní chodby. Všechny dveře musí být dosažitelné a nesmí se dát projít zdí.
5. Rauscher na trase 10 minut: žádný překryv se zdí ani s překážkou.
6. Vykresli všechny místnosti (`enterRoom(id); render();`), nesmí vzniknout chyba.

Pozor: ve skryté záložce se `requestAnimationFrame` zastaví, proto se v testech volá `update(1/60)` ručně.
Pomocné funkce:

- `startPlaying(null)`
- `setScreen('playing')`
- `enterRoom(id, {x,y})`
- `findTouchedDoor`
- `rectsOverlap`
- `roomWalls`
- `updateMovingTeachers`

## Zálohy

- Složka `zalohy/` obsahuje poslední verzi před úpravou vybavení a postavičky a zamítnutou Matterport verzi.
- Před větší změnou si udělej zálohu složky `js/` (třeba do `zalohy/`).
- Úpravy se dělají Python skripty s přesným nahrazením textu (`assert count == 1`) v příslušném souboru `js/…`. Bash heredoc se složitým JS obsahem selhává.
- Kontrola syntaxe bez prohlížeče: `python -c "import esprima"`, pak `esprima.parseScript` na každý `js/*.js`. Neumí `??` ani `?.`, ty v kódu nepoužívat.
