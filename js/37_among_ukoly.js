// Among Us: úkoly pro nevinné – otázky ze školních předmětů, rychlá matika a malé úkoly
// Část hry Dárek – načítá se v index.html po 36_among.js a před 15_hlavni.js.
'use strict';

// =====================================================================
// ÚKOLY (4. krok Among Us). Na každé mapě je 14 míst s úkolem (AMONG_MAPS.X.tasks,
// souřadnice od rohu místnosti, vybrané tak, aby byly volné, dosažitelné a u zdi).
// Hostitel na začátku kola dá každému hráči náhodně N míst (nastavení „Úkoly na hráče“).
// Nevinný u svého místa zmáčkne 🛠 POUŽÍT (E) a splní úkol; záškodník má úkoly jen na oko.
// Druhy úkolů:
//   math – rychlá matika (3 příklady, generují se náhodně)
//   bio, chem, cz, dej, zem – test (3 náhodné otázky z 50, vždy 4 možnosti)
//   wires – oprav kabely u projektoru (spoj stejné barvy)
//   download – stáhni známky z Bakalářů (počkat, až se stáhnou)
//   board – smaž tabuli (přejet houbou po křídě)
//   trash – vynes koš (držet páku)
// Splněný úkol jde hostiteli jako zpráva { k: 'task', i: číslo místa }. Když nevinní
// (i jako duchové) splní všechny své úkoly, vyhráli.
// =====================================================================
AMONG_DEFAULTS.tc = 5;
AMONG_SETTINGS.push({ id: 'tc', label: 'Úkoly na hráče', values: [1, 2, 3, 4, 5, 6, 7, 8], show: (v) => `${v}` });

AMONG_MAPS.A.tasks = [
  { room: 'chodba', x: 60, y: 828, type: 'math' },      { room: 'chodba', x: 2140, y: 1488, type: 'bio' },
  { room: 'chodba', x: 220, y: 1868, type: 'wires' },   { room: 'chodba', x: 1580, y: 1408, type: 'chem' },
  { room: 'chodba', x: 1160, y: 2328, type: 'trash' },  { room: 'chodba', x: 340, y: 1308, type: 'cz' },
  { room: 'patroA', x: 1420, y: 1748, type: 'download' }, { room: 'patroA', x: 340, y: 1208, type: 'dej' },
  { room: 'patroA', x: 700, y: 1828, type: 'board' },   { room: 'patroA', x: 2020, y: 1388, type: 'zem' },
  { room: 'patroA2', x: 1400, y: 1828, type: 'math' },  { room: 'patroA2', x: 340, y: 1208, type: 'wires' },
  { room: 'patroA2', x: 2020, y: 1388, type: 'cz' },    { room: 'patroA2', x: 680, y: 1828, type: 'board' },
];
AMONG_MAPS.C.tasks = [
  { room: 'chodba', x: 1460, y: 48, type: 'trash' },    { room: 'chodba', x: 1400, y: 948, type: 'math' },
  { room: 'chodba', x: 1160, y: 1388, type: 'bio' },    { room: 'chodba', x: 1280, y: 488, type: 'wires' },
  { room: 'chodba', x: 480, y: 1208, type: 'zem' },     { room: 'chodba', x: 840, y: 1188, type: 'download' },
  { room: 'cecko', x: 190, y: 454, type: 'chem' },      { room: 'cecko', x: 730, y: 54, type: 'board' },
  { room: 'cecko', x: 50, y: 54, type: 'cz' },          { room: 'cecko2', x: 310, y: 268, type: 'dej' },
  { room: 'cecko2', x: 50, y: 468, type: 'math' },      { room: 'cecko2', x: 150, y: 48, type: 'wires' },
  { room: 'cecko3', x: 190, y: 114, type: 'board' },    { room: 'cecko3', x: 730, y: 54, type: 'zem' },
];
const AMONG_TASK_TYPES = {
  math: { name: 'Rychlá matika', icon: '➗' },
  bio: { name: 'Test z biologie', icon: '🧬' },
  chem: { name: 'Test z chemie', icon: '⚗️' },
  cz: { name: 'Test z češtiny', icon: '📖' },
  dej: { name: 'Test z dějepisu', icon: '🏰' },
  zem: { name: 'Test ze zeměpisu', icon: '🌍' },
  wires: { name: 'Oprav kabely u projektoru', icon: '🔌' },
  download: { name: 'Stáhni známky z Bakalářů', icon: '💾' },
  board: { name: 'Smaž tabuli', icon: '🧽' },
  trash: { name: 'Vynes koš', icon: '🗑️' },
};

// --- Otázky: [otázka, správně, špatně, špatně, špatně] ---
const AMONG_QUESTIONS = {
  bio: [
    ['Kolik komor má lidské srdce?', '4', '2', '3', '6'],
    ['Který orgán čistí krev a tvoří moč?', 'Ledviny', 'Plíce', 'Žaludek', 'Slezina'],
    ['Kde v buňce probíhá fotosyntéza?', 'V chloroplastech', 'V mitochondriích', 'V jádře', 'V ribozomech'],
    ['„Energetická centrála“ buňky je…', 'Mitochondrie', 'Golgiho aparát', 'Lysozom', 'Vakuola'],
    ['Kolik chromozomů má tělní buňka člověka?', '46', '23', '44', '48'],
    ['Nositelem dědičné informace je…', 'DNA', 'ATP', 'Glukóza', 'Chlorofyl'],
    ['Největší orgán lidského těla je…', 'Kůže', 'Játra', 'Mozek', 'Plíce'],
    ['Která krevní buňka přenáší kyslík?', 'Červená krvinka', 'Bílá krvinka', 'Krevní destička', 'Neuron'],
    ['Kolik kostí má dospělý člověk (přibližně)?', '206', '150', '306', '412'],
    ['Velryba patří mezi…', 'Savce', 'Ryby', 'Obojživelníky', 'Plazy'],
    ['Žába patří mezi…', 'Obojživelníky', 'Plazy', 'Savce', 'Ryby'],
    ['Kolik nohou má hmyz?', '6', '8', '4', '10'],
    ['Kolik nohou má pavouk?', '8', '6', '10', '4'],
    ['Který plyn rostliny při fotosyntéze přijímají?', 'Oxid uhličitý', 'Kyslík', 'Dusík', 'Vodík'],
    ['Inzulin vytváří…', 'Slinivka břišní', 'Játra', 'Štítná žláza', 'Ledviny'],
    ['Nejdelší kost v lidském těle je…', 'Stehenní kost', 'Pažní kost', 'Holenní kost', 'Klíční kost'],
    ['Zakladatelem genetiky je…', 'Gregor Mendel', 'Charles Darwin', 'Louis Pasteur', 'J. E. Purkyně'],
    ['Evoluci přírodním výběrem popsal…', 'Charles Darwin', 'Gregor Mendel', 'Isaac Newton', 'Carl Linné'],
    ['Penicilin objevil…', 'Alexander Fleming', 'Louis Pasteur', 'Robert Koch', 'Edward Jenner'],
    ['Kde začíná trávení škrobu?', 'V ústech', 'V žaludku', 'V tlustém střevě', 'V jícnu'],
    ['Zelené barvivo listů je…', 'Chlorofyl', 'Hemoglobin', 'Melanin', 'Karoten'],
    ['Kolik párů chromozomů má člověk?', '23', '46', '22', '12'],
    ['Okysličenou krev z plic do srdce vedou…', 'Plicní žíly', 'Plicní tepny', 'Aorta', 'Duté žíly'],
    ['Největší tepna v těle je…', 'Aorta', 'Krční tepna', 'Plicní žíla', 'Dutá žíla'],
    ['Které zvíře je obratlovec?', 'Kapr', 'Hlemýžď', 'Chobotnice', 'Včela'],
    ['Motýl se vyvíjí přes…', 'Housenku a kuklu', 'Pulce', 'Plůdek', 'Zárodek v děloze'],
    ['Bakterie patří mezi…', 'Prokaryota', 'Eukaryota', 'Viry', 'Houby'],
    ['Viry se množí…', 'Jen v živých buňkách', 'Dělením samy', 'Výtrusy', 'Pučením'],
    ['Kolik zubů má dospělý člověk i se zuby moudrosti?', '32', '28', '20', '36'],
    ['Rovnováhu a koordinaci pohybů řídí…', 'Mozeček', 'Hypofýza', 'Prodloužená mícha', 'Štítná žláza'],
    ['Hemoglobin obsahuje…', 'Železo', 'Vápník', 'Hořčík', 'Zinek'],
    ['Kosti jsou pevné hlavně díky…', 'Vápníku', 'Železu', 'Sodíku', 'Jódu'],
    ['Nedostatek jódu poškozuje…', 'Štítnou žlázu', 'Ledviny', 'Plíce', 'Kůži'],
    ['Nedostatek vitaminu C způsobuje…', 'Kurděje', 'Křivici', 'Šeroslepost', 'Cukrovku'],
    ['Nedostatek vitaminu D způsobuje…', 'Křivici', 'Kurděje', 'Šeroslepost', 'Chřipku'],
    ['Barvy v oku vnímají…', 'Čípky', 'Tyčinky', 'Duhovka', 'Čočka'],
    ['Kolik plic má člověk?', '2', '1', '3', '4'],
    ['Které zvíře je plaz?', 'Ještěrka', 'Mlok', 'Čolek', 'Žába'],
    ['Netopýr je…', 'Savec', 'Pták', 'Hmyz', 'Plaz'],
    ['Houby se rozmnožují…', 'Výtrusy', 'Semeny', 'Hlízami', 'Cibulkami'],
    ['Člověk patří do řádu…', 'Primáti', 'Šelmy', 'Hlodavci', 'Kopytníci'],
    ['Nejrychlejší suchozemské zvíře je…', 'Gepard', 'Lev', 'Antilopa', 'Kůň'],
    ['Kde vzniká žluč?', 'V játrech', 'Ve žlučníku', 'V žaludku', 'Ve slinivce'],
    ['Lidské tělo je z vody asi z…', '60 %', '30 %', '90 %', '10 %'],
    ['Který jehličnan na zimu shazuje jehlice?', 'Modřín', 'Smrk', 'Borovice', 'Jedle'],
    ['Kolik srdcí má chobotnice?', '3', '1', '2', '4'],
    ['Mezi jehličnany patří…', 'Borovice', 'Buk', 'Lípa', 'Javor'],
    ['Přeměna housenky v motýla se jmenuje…', 'Proměna (metamorfóza)', 'Mitóza', 'Fotosyntéza', 'Osmóza'],
    ['Krev skupiny 0 negativní může dostat…', 'Kdokoli', 'Jen skupina AB', 'Jen skupina A', 'Nikdo'],
    ['Dělení buňky na dvě stejné se jmenuje…', 'Mitóza', 'Meióza', 'Osmóza', 'Difuze'],
  ],
  chem: [
    ['Chemická značka zlata je…', 'Au', 'Ag', 'Zn', 'Go'],
    ['Chemická značka stříbra je…', 'Ag', 'Au', 'Si', 'S'],
    ['Chemická značka železa je…', 'Fe', 'Ze', 'Fr', 'F'],
    ['Vzorec vody je…', 'H₂O', 'HO₂', 'H₂O₂', 'OH'],
    ['Vzorec oxidu uhličitého je…', 'CO₂', 'CO', 'C₂O', 'CH₄'],
    ['Chemická značka sodíku je…', 'Na', 'So', 'S', 'N'],
    ['Chemická značka draslíku je…', 'K', 'D', 'Ka', 'P'],
    ['Chemická značka vodíku je…', 'H', 'V', 'Hy', 'He'],
    ['Jaké pH má neutrální roztok?', '7', '0', '14', '1'],
    ['Kyselina má pH…', 'Menší než 7', 'Větší než 7', 'Přesně 7', 'Vždy 14'],
    ['Vzorec kuchyňské soli je…', 'NaCl', 'KCl', 'NaOH', 'HCl'],
    ['Nejlehčí prvek je…', 'Vodík', 'Helium', 'Lithium', 'Kyslík'],
    ['Který z nich je vzácný plyn?', 'Neon', 'Dusík', 'Chlor', 'Kyslík'],
    ['Kolik protonů má atom uhlíku?', '6', '12', '8', '4'],
    ['Protonové číslo kyslíku je…', '8', '16', '6', '10'],
    ['Periodickou tabulku sestavil…', 'D. I. Mendělejev', 'Marie Curie', 'A. Lavoisier', 'Niels Bohr'],
    ['Vzorec kyseliny sírové je…', 'H₂SO₄', 'HCl', 'HNO₃', 'H₂CO₃'],
    ['Vzorec kyseliny chlorovodíkové je…', 'HCl', 'NaCl', 'HClO', 'H₂S'],
    ['Vzorec methanu je…', 'CH₄', 'C₂H₆', 'CO₂', 'CH₃OH'],
    ['Při jaké teplotě vře voda (normální tlak)?', '100 °C', '90 °C', '0 °C', '120 °C'],
    ['Kladně nabitá částice v jádře je…', 'Proton', 'Elektron', 'Neutron', 'Foton'],
    ['Záporně nabitá částice atomu je…', 'Elektron', 'Proton', 'Neutron', 'Kation'],
    ['Částice bez náboje je…', 'Neutron', 'Proton', 'Elektron', 'Anion'],
    ['Chemická značka rtuti je…', 'Hg', 'Rt', 'Me', 'H'],
    ['Který kov je za pokojové teploty kapalný?', 'Rtuť', 'Olovo', 'Cín', 'Sodík'],
    ['Vzorec hydroxidu sodného je…', 'NaOH', 'NaCl', 'KOH', 'Na₂O'],
    ['Rez je hlavně…', 'Oxid železa', 'Oxid měďnatý', 'Uhličitan vápenatý', 'Chlorid sodný'],
    ['Ozon má vzorec…', 'O₃', 'O₂', 'CO', 'H₂O₂'],
    ['Dusík tvoří vzduch asi z…', '78 %', '21 %', '50 %', '1 %'],
    ['Kyslík tvoří vzduch asi z…', '21 %', '78 %', '50 %', '5 %'],
    ['Vápenec je hlavně…', 'Uhličitan vápenatý', 'Síran vápenatý', 'Oxid křemičitý', 'Chlorid vápenatý'],
    ['Písek je hlavně…', 'Oxid křemičitý', 'Uhličitan vápenatý', 'Chlorid sodný', 'Oxid hlinitý'],
    ['Chemická značka mědi je…', 'Cu', 'Me', 'Co', 'C'],
    ['Chemická značka hliníku je…', 'Al', 'H', 'Hl', 'Li'],
    ['Chemická značka chloru je…', 'Cl', 'C', 'Ch', 'K'],
    ['Neutralizace je reakce kyseliny se…', 'Zásadou', 'Vodou', 'Kyselinou', 'Vzácným plynem'],
    ['Vzorec amoniaku je…', 'NH₃', 'NH₄', 'N₂H', 'HNO₃'],
    ['Destilace dělí látky podle…', 'Teploty varu', 'Barvy', 'Tvaru', 'Magnetismu'],
    ['Filtrací oddělíme…', 'Pevnou látku od kapaliny', 'Dva plyny', 'Sůl rozpuštěnou ve vodě', 'Dvě mísitelné kapaliny'],
    ['Ethanol je…', 'Alkohol', 'Kyselina', 'Cukr', 'Zásada'],
    ['Glukóza je…', 'Cukr', 'Bílkovina', 'Tuk', 'Kyselina'],
    ['Fenolftalein v zásadě zbarví roztok…', 'Fialově', 'Modře', 'Zeleně', 'Žlutě'],
    ['Z kolika prvků se skládá voda?', '2', '1', '3', '4'],
    ['Prvek se značkou S je…', 'Síra', 'Sodík', 'Stříbro', 'Křemík'],
    ['Prvek se značkou P je…', 'Fosfor', 'Draslík', 'Platina', 'Olovo'],
    ['Prvek se značkou Pb je…', 'Olovo', 'Platina', 'Fosfor', 'Palladium'],
    ['Chemická značka helia je…', 'He', 'H', 'Hl', 'Hm'],
    ['Diamant je tvořen…', 'Uhlíkem', 'Křemíkem', 'Dusíkem', 'Sírou'],
    ['Hoření je reakce látky s…', 'Kyslíkem', 'Dusíkem', 'Vodíkem', 'Heliem'],
    ['Přechod z pevné látky přímo na plyn je…', 'Sublimace', 'Tání', 'Var', 'Kondenzace'],
  ],
  cz: [
    ['Kolik pádů má čeština?', '7', '6', '5', '8'],
    ['Na co se ptáme ve 2. pádě?', 'Koho, čeho?', 'Komu, čemu?', 'Koho, co?', 'O kom, o čem?'],
    ['Na co se ptáme ve 3. pádě?', 'Komu, čemu?', 'Koho, čeho?', 'S kým, s čím?', 'Koho, co?'],
    ['Na co se ptáme v 7. pádě?', 'S kým, s čím?', 'Komu, čemu?', 'O kom, o čem?', 'Koho, čeho?'],
    ['Kolik je v češtině slovních druhů?', '10', '8', '12', '9'],
    ['Slovo „rychle“ je…', 'Příslovce', 'Přídavné jméno', 'Sloveso', 'Citoslovce'],
    ['Slova „a, ale, protože“ jsou…', 'Spojky', 'Předložky', 'Částice', 'Příslovce'],
    ['Doplň: Chlapci ___ venku.', 'byli', 'byly', 'bili', 'bily'],
    ['Doplň: Psi ___ celou noc.', 'štěkali', 'štěkaly', 'štěkalo', 'štěkal'],
    ['Doplň: Kočky ___ mléko.', 'pily', 'pili', 'pyly', 'pyli'],
    ['Které slovo je vyjmenované po B?', 'obyvatel', 'bílý', 'bitva', 'bič'],
    ['Které slovo je vyjmenované po L?', 'lyže', 'líný', 'lípa', 'listí'],
    ['Které slovo je vyjmenované po M?', 'myš', 'mísa', 'míra', 'milý'],
    ['Které slovo je vyjmenované po P?', 'pýcha', 'píseň', 'písek', 'pivo'],
    ['Které slovo je vyjmenované po S?', 'syrový', 'síla', 'silnice', 'sirup'],
    ['Které slovo je vyjmenované po V?', 'výr', 'vítr', 'víla', 'vidle'],
    ['Které slovo je vyjmenované po Z?', 'brzy', 'zima', 'zítra', 'zisk'],
    ['Kdo napsal Babičku?', 'Božena Němcová', 'K. J. Erben', 'Jan Neruda', 'Karel Čapek'],
    ['Kdo napsal Kytici?', 'K. J. Erben', 'K. H. Mácha', 'Jan Neruda', 'Božena Němcová'],
    ['Kdo napsal Máj?', 'K. H. Mácha', 'K. J. Erben', 'J. Vrchlický', 'J. Seifert'],
    ['Kdo napsal drama R.U.R.?', 'Karel Čapek', 'Jaroslav Hašek', 'Bohumil Hrabal', 'Jan Neruda'],
    ['Kdo napsal Osudy dobrého vojáka Švejka?', 'Jaroslav Hašek', 'Karel Čapek', 'Bohumil Hrabal', 'Franz Kafka'],
    ['Kdo napsal Povídky malostranské?', 'Jan Neruda', 'Alois Jirásek', 'K. H. Borovský', 'Svatopluk Čech'],
    ['Kdo napsal Staré pověsti české?', 'Alois Jirásek', 'Jan Neruda', 'Božena Němcová', 'K. J. Erben'],
    ['Který Čech dostal Nobelovu cenu za literaturu?', 'Jaroslav Seifert', 'Karel Čapek', 'Václav Havel', 'Milan Kundera'],
    ['Kdo napsal Ostře sledované vlaky?', 'Bohumil Hrabal', 'Josef Škvorecký', 'Ladislav Fuks', 'Milan Kundera'],
    ['Kdo napsal Proměnu (Řehoř Samsa)?', 'Franz Kafka', 'Karel Čapek', 'Jaroslav Hašek', 'Gustav Meyrink'],
    ['Synonymum je slovo…', 'Stejného významu', 'Opačného významu', 'Zdrobnělé', 'Cizího původu'],
    ['Antonymum je slovo…', 'Opačného významu', 'Stejného významu', 'Zdrobnělé', 'Citoslovce'],
    ['Opak slova „velký“ je…', 'malý', 'obrovský', 'široký', 'dlouhý'],
    ['Kolik slabik má slovo „čokoláda“?', '4', '3', '5', '2'],
    ['Podmět je větný člen, který…', 'Říká, kdo nebo co', 'Vyjadřuje děj', 'Rozvíjí přísudek', 'Je vždy na konci'],
    ['Přísudek nejčastěji vyjadřuje…', 'Děj', 'Osobu', 'Vlastnost', 'Místo'],
    ['Slovo „krásný“ je…', 'Přídavné jméno', 'Podstatné jméno', 'Příslovce', 'Zájmeno'],
    ['Slova „já, ty, on“ jsou…', 'Zájmena', 'Číslovky', 'Podstatná jména', 'Částice'],
    ['Slova „pět, pátý“ jsou…', 'Číslovky', 'Zájmena', 'Přídavná jména', 'Příslovce'],
    ['Slova „au, haf“ jsou…', 'Citoslovce', 'Částice', 'Spojky', 'Příslovce'],
    ['Slova „na, pod, v“ jsou…', 'Předložky', 'Spojky', 'Částice', 'Příslovce'],
    ['Jak se to píše správně?', 'výborně', 'vyborně', 'výborňe', 'vybórně'],
    ['Jak se to píše správně?', 'výjimka', 'vyjímka', 'výjímka', 'vyjimka'],
    ['Doplň: Dej to ___.', 'mně', 'mě', 'mňe', 'mňě'],
    ['Jak se to píše správně?', 'sjet z kopce', 'zjet z kopce', 'sjed z kopce', 'zjed z kopce'],
    ['Jak se to píše správně?', 'zpívat', 'spívat', 'zpývat', 'spývat'],
    ['Kdo napsal Saturnina?', 'Zdeněk Jirotka', 'Karel Poláček', 'Eduard Bass', 'Vladislav Vančura'],
    ['Kdo napsal knihu Bylo nás pět?', 'Karel Poláček', 'Zdeněk Jirotka', 'Eduard Bass', 'Jan Drda'],
    ['Kdo napsal Klapzubovu jedenáctku?', 'Eduard Bass', 'Karel Poláček', 'Jaroslav Foglar', 'Jan Drda'],
    ['Kdo napsal Rychlé šípy?', 'Jaroslav Foglar', 'Eduard Bass', 'Václav Čtvrtek', 'Josef Lada'],
    ['Kdo vymyslel loupežníka Rumcajse?', 'Václav Čtvrtek', 'Josef Lada', 'Jaroslav Foglar', 'Zdeněk Miler'],
    ['Znaménko nad „á“ se jmenuje…', 'Čárka', 'Háček', 'Kroužek', 'Tečka'],
    ['Nad „ů“ je…', 'Kroužek', 'Čárka', 'Háček', 'Tečka'],
  ],
  dej: [
    ['Kdy vzniklo Československo?', '1918', '1914', '1938', '1945'],
    ['Kdo byl prvním československým prezidentem?', 'T. G. Masaryk', 'Edvard Beneš', 'Václav Havel', 'Ludvík Svoboda'],
    ['Kdy začala 2. světová válka?', '1939', '1938', '1941', '1914'],
    ['Kdy skončila 2. světová válka v Evropě?', '1945', '1944', '1946', '1939'],
    ['Kdy začala 1. světová válka?', '1914', '1918', '1912', '1939'],
    ['Kdy proběhla sametová revoluce?', '1989', '1968', '1993', '1948'],
    ['Kdy se rozdělilo Československo?', '1993', '1989', '1992', '2004'],
    ['Kdy vstoupila ČR do Evropské unie?', '2004', '1999', '2007', '1993'],
    ['Kdy vstoupila ČR do NATO?', '1999', '2004', '1993', '2001'],
    ['Kdy obsadila vojska Varšavské smlouvy ČSSR?', '1968', '1948', '1956', '1977'],
    ['Kdy byl upálen Jan Hus?', '1415', '1348', '1419', '1620'],
    ['Kdy byla bitva na Bílé hoře?', '1620', '1415', '1648', '1526'],
    ['Kdy byla založena Karlova univerzita?', '1348', '1415', '1212', '1526'],
    ['Kdo založil Karlovu univerzitu?', 'Karel IV.', 'Přemysl Otakar II.', 'Václav IV.', 'Rudolf II.'],
    ['Kdy byla vydána Zlatá bula sicilská?', '1212', '1348', '1306', '1158'],
    ['Kdy vymřeli Přemyslovci po meči?', '1306', '1212', '1278', '1346'],
    ['Kdy doplul Kolumbus do Ameriky?', '1492', '1415', '1517', '1620'],
    ['Kdy začala reformace (Martin Luther)?', '1517', '1492', '1415', '1648'],
    ['Kdy začala Velká francouzská revoluce?', '1789', '1776', '1815', '1848'],
    ['Kdy byl Napoleon poražen u Waterloo?', '1815', '1805', '1789', '1848'],
    ['Kdy byla bitva u Slavkova?', '1805', '1815', '1789', '1866'],
    ['Kdy vyhlásily USA nezávislost?', '1776', '1789', '1492', '1812'],
    ['Kdy padla Berlínská zeď?', '1989', '1961', '1991', '1945'],
    ['Kdy se rozpadl Sovětský svaz?', '1991', '1989', '1985', '1993'],
    ['Kdy stanul člověk poprvé na Měsíci?', '1969', '1961', '1957', '1975'],
    ['Kdo byl první člověk ve vesmíru?', 'Jurij Gagarin', 'Neil Armstrong', 'Vladimír Remek', 'Alan Shepard'],
    ['Kdo byl první Čechoslovák ve vesmíru?', 'Vladimír Remek', 'Emil Zátopek', 'Jan Palach', 'Ludvík Svoboda'],
    ['Kdy se upálil Jan Palach?', '1969', '1968', '1989', '1977'],
    ['Kdy byla podepsána Mnichovská dohoda?', '1938', '1939', '1918', '1948'],
    ['Kdy převzali moc komunisté (Únor)?', '1948', '1945', '1938', '1968'],
    ['Kdy vznikla Charta 77?', '1977', '1968', '1989', '1948'],
    ['Kdo byl prvním prezidentem ČR?', 'Václav Havel', 'Václav Klaus', 'T. G. Masaryk', 'Miloš Zeman'],
    ['Svatý Václav byl…', 'Kníže', 'Král', 'Císař', 'Papež'],
    ['Kdo přinesl na Velkou Moravu písmo?', 'Cyril a Metoděj', 'Karel IV. a Jan Hus', 'Přemysl a Libuše', 'Václav a Ludmila'],
    ['Hlaholici vytvořil…', 'Konstantin (Cyril)', 'Karel IV.', 'Jan Hus', 'Jan Amos Komenský'],
    ['Komu se říká Otec vlasti?', 'Karel IV.', 'T. G. Masaryk', 'Jan Hus', 'Jiří z Poděbrad'],
    ['Který král byl „železný a zlatý“?', 'Přemysl Otakar II.', 'Karel IV.', 'Václav II.', 'Jan Lucemburský'],
    ['Slavný husitský vojevůdce byl…', 'Jan Žižka', 'Jan Hus', 'Jiří z Poděbrad', 'Albrecht z Valdštejna'],
    ['Kdo byl husitským králem?', 'Jiří z Poděbrad', 'Karel IV.', 'Václav IV.', 'Rudolf II.'],
    ['Komu se říká Učitel národů?', 'J. A. Komenský', 'Jan Hus', 'František Palacký', 'Josef Jungmann'],
    ['Povinnou školní docházku zavedla…', 'Marie Terezie', 'Eliška Přemyslovna', 'Kateřina Veliká', 'Královna Viktorie'],
    ['Kdy zrušil Josef II. nevolnictví?', '1781', '1848', '1620', '1918'],
    ['Pyramidy v Gíze postavili…', 'Egypťané', 'Římané', 'Řekové', 'Mayové'],
    ['Kdy byl podle pověsti založen Řím?', '753 př. n. l.', '476 n. l.', '1000 př. n. l.', '33 n. l.'],
    ['Kdy zanikla Západořímská říše?', '476', '753', '1453', '1066'],
    ['Kdy padla Konstantinopol?', '1453', '1492', '476', '1204'],
    ['Kdy byl spáchán atentát na Heydricha?', '1942', '1939', '1945', '1938'],
    ['Kde byl zabit František Ferdinand d’Este?', 'V Sarajevu', 'Ve Vídni', 'V Praze', 'V Bělehradě'],
    ['Kdo vedl nacistické Německo?', 'Adolf Hitler', 'Josif Stalin', 'Benito Mussolini', 'Otto von Bismarck'],
    ['Karel IV. byl synem…', 'Jana Lucemburského', 'Václava II.', 'Přemysla Otakara II.', 'Rudolfa II.'],
  ],
  zem: [
    ['Hlavní město Slovenska je…', 'Bratislava', 'Košice', 'Žilina', 'Nitra'],
    ['Hlavní město Německa je…', 'Berlín', 'Mnichov', 'Hamburk', 'Bonn'],
    ['Hlavní město Rakouska je…', 'Vídeň', 'Salcburk', 'Linec', 'Štýrský Hradec'],
    ['Hlavní město Polska je…', 'Varšava', 'Krakov', 'Gdaňsk', 'Vratislav'],
    ['Hlavní město Francie je…', 'Paříž', 'Lyon', 'Marseille', 'Nice'],
    ['Hlavní město Itálie je…', 'Řím', 'Milán', 'Benátky', 'Neapol'],
    ['Hlavní město Španělska je…', 'Madrid', 'Barcelona', 'Sevilla', 'Valencie'],
    ['Hlavní město Velké Británie je…', 'Londýn', 'Manchester', 'Edinburgh', 'Liverpool'],
    ['Hlavní město Austrálie je…', 'Canberra', 'Sydney', 'Melbourne', 'Perth'],
    ['Hlavní město Kanady je…', 'Ottawa', 'Toronto', 'Montreal', 'Vancouver'],
    ['Hlavní město USA je…', 'Washington', 'New York', 'Los Angeles', 'Chicago'],
    ['Hlavní město Japonska je…', 'Tokio', 'Ósaka', 'Kjóto', 'Hirošima'],
    ['Nejvyšší hora Česka je…', 'Sněžka', 'Praděd', 'Lysá hora', 'Klínovec'],
    ['Nejdelší řeka na území Česka je…', 'Vltava', 'Labe', 'Morava', 'Odra'],
    ['Nejvyšší hora světa je…', 'Mount Everest', 'K2', 'Mont Blanc', 'Kilimandžáro'],
    ['Nejdelší řeka Afriky je…', 'Nil', 'Kongo', 'Niger', 'Zambezi'],
    ['Největší oceán je…', 'Tichý', 'Atlantský', 'Indický', 'Severní ledový'],
    ['Největší stát světa rozlohou je…', 'Rusko', 'Kanada', 'Čína', 'USA'],
    ['Nejlidnatější stát světa je dnes…', 'Indie', 'Čína', 'USA', 'Indonésie'],
    ['Na kterém kontinentu leží Egypt?', 'Afrika', 'Asie', 'Evropa', 'Austrálie'],
    ['Největší horká poušť světa je…', 'Sahara', 'Gobi', 'Kalahari', 'Atacama'],
    ['Ve kterém kraji leží Prachatice?', 'Jihočeském', 'Plzeňském', 'Vysočina', 'Středočeském'],
    ['Které pohoří je u Prachatic?', 'Šumava', 'Krkonoše', 'Jeseníky', 'Beskydy'],
    ['Krajské město Jihočeského kraje je…', 'České Budějovice', 'Tábor', 'Písek', 'Prachatice'],
    ['Největší rybník v Česku je…', 'Rožmberk', 'Bezdrev', 'Horusický rybník', 'Máchovo jezero'],
    ['Největší přehradní nádrž v Česku (rozlohou) je…', 'Lipno', 'Orlík', 'Slapy', 'Vranov'],
    ['Dunaj se vlévá do…', 'Černého moře', 'Severního moře', 'Baltského moře', 'Jaderského moře'],
    ['Labe se vlévá do…', 'Severního moře', 'Baltského moře', 'Černého moře', 'Středozemního moře'],
    ['Kolik krajů má Česko (i s Prahou)?', '14', '13', '8', '10'],
    ['Se kterým státem Česko NEsousedí?', 'Maďarsko', 'Rakousko', 'Polsko', 'Slovensko'],
    ['Rovník dělí Zemi na…', 'Severní a jižní polokouli', 'Východní a západní polokouli', 'Evropu a Asii', 'Den a noc'],
    ['Nultý poledník prochází…', 'Greenwichem', 'Paříží', 'Prahou', 'Římem'],
    ['Nejvyšší hora Alp je…', 'Mont Blanc', 'Matterhorn', 'Großglockner', 'Zugspitze'],
    ['Hlavní město Ukrajiny je…', 'Kyjev', 'Lvov', 'Charkov', 'Oděsa'],
    ['Hlavní město Maďarska je…', 'Budapešť', 'Debrecín', 'Szeged', 'Pécs'],
    ['Hlavní město Chorvatska je…', 'Záhřeb', 'Split', 'Dubrovník', 'Rijeka'],
    ['Hlavní město Řecka je…', 'Atény', 'Soluň', 'Sparta', 'Korint'],
    ['Hlavní město Norska je…', 'Oslo', 'Bergen', 'Stockholm', 'Helsinky'],
    ['Hlavní město Švédska je…', 'Stockholm', 'Oslo', 'Göteborg', 'Kodaň'],
    ['Hlavní město Nizozemska je…', 'Amsterdam', 'Rotterdam', 'Haag', 'Brusel'],
    ['Hlavní město Švýcarska je…', 'Bern', 'Curych', 'Ženeva', 'Basilej'],
    ['Hlavní město Brazílie je…', 'Brasília', 'Rio de Janeiro', 'São Paulo', 'Salvador'],
    ['Hlavní město Turecka je…', 'Ankara', 'Istanbul', 'Izmir', 'Antalya'],
    ['Hlavní město Egypta je…', 'Káhira', 'Alexandrie', 'Luxor', 'Gíza'],
    ['Měna Velké Británie je…', 'Libra', 'Euro', 'Dolar', 'Frank'],
    ['Měna Polska je…', 'Zlotý', 'Euro', 'Koruna', 'Forint'],
    ['Měna Maďarska je…', 'Forint', 'Zlotý', 'Euro', 'Koruna'],
    ['Na kterém kontinentu je Brazílie?', 'Jižní Amerika', 'Afrika', 'Severní Amerika', 'Asie'],
    ['Které moře je nejslanější?', 'Mrtvé moře', 'Baltské moře', 'Severní moře', 'Černé moře'],
    ['Nejvyšší vodopád světa je…', 'Salto Angel', 'Niagarské vodopády', 'Viktoriiny vodopády', 'Iguaçu'],
  ],
};

// --- Rychlá matika: náhodný příklad a 4 možnosti ---
const amongRand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function amongMathQuestion() {
  const kind = amongRand(0, 6);
  let q, ans;
  if (kind === 0) { const a = amongRand(12, 89), b = amongRand(12, 89); q = `${a} + ${b}`; ans = a + b; }
  else if (kind === 1) { const a = amongRand(30, 99), b = amongRand(10, a - 5); q = `${a} − ${b}`; ans = a - b; }
  else if (kind === 2) { const a = amongRand(3, 12), b = amongRand(3, 12); q = `${a} · ${b}`; ans = a * b; }
  else if (kind === 3) { const b = amongRand(3, 12), r = amongRand(3, 12); q = `${b * r} : ${b}`; ans = r; }
  else if (kind === 4) { const a = amongRand(4, 15); q = `${a}²`; ans = a * a; }
  else if (kind === 5) { const p = [10, 20, 25, 50][amongRand(0, 3)], n = amongRand(1, 20) * 20; q = `${p} % z ${n}`; ans = n * p / 100; }
  else { const a = amongRand(2, 9), b = amongRand(2, 9), c = amongRand(2, 9); q = `${a} + ${b} · ${c}`; ans = a + b * c; }
  const wrong = new Set();
  while (wrong.size < 3) {
    const w = ans + [-10, -2, -1, 1, 2, 10, -5, 5][amongRand(0, 7)] * (Math.random() < 0.3 ? 2 : 1);
    if (w !== ans && w >= 0) wrong.add(w);
  }
  return [`Kolik je ${q}?`, String(ans), ...[...wrong].map(String)];
}
// Otázka daného druhu (bez opakování těch, co už v úkolu byly) → { q, opts, ok }
function amongQuestion(type, used) {
  let row;
  if (type === 'math') row = amongMathQuestion();
  else {
    const list = AMONG_QUESTIONS[type];
    let i;
    for (let k = 0; k < 20; k++) { i = amongRand(0, list.length - 1); if (!used.includes(i)) break; }
    used.push(i);
    row = list[i];
  }
  const opts = row.slice(1).map((t, k) => ({ t, ok: k === 0 }));
  for (let i = opts.length - 1; i > 0; i--) { const j = amongRand(0, i); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return { q: row[0], opts };
}

// --- Místa s úkoly ---
const amongTasks = () => amongMap().tasks || [];
const amongMyTasks = () => (among.S && among.S.tk && among.S.tk[mp.id]) || [];
const amongTaskDone = (i) => among.myDone.includes(i) || ((among.S && among.S.td && among.S.td[mp.id]) || []).includes(i);
function amongTaskPlace(t) {   // název místa (díl chodby nebo místnost)
  const room = ROOMS[t.room], part = room.parts ? amongPart(t.room, amongPartAt(room, room.x + t.x, room.y + t.y)) : null;
  return (part && part.name) || room.name;
}
// Můj nesplněný úkol na dosah (jen nevinný – záškodník úkoly jen předstírá)
function amongTaskNear() {
  if (among.role !== 'nevinny' || among.phase !== 'play') return -1;
  const me = amongMyPos();
  for (const i of amongMyTasks()) {
    const t = amongTasks()[i];
    if (t && t.room === state.room.id && !amongTaskDone(i) && Math.hypot(t.x - me.x, t.y - me.y) <= 70) return i;
  }
  return -1;
}
// Postup všech nevinných (0–1) – pruh úkolů
function amongTaskBar() {
  const S = among.S;
  if (!S || !S.tk) return 0;
  let all = 0, done = 0;
  for (const id of S.p) {
    if (S.im.includes(id) || (S.gone || []).includes(id)) continue;
    all += (S.tk[id] || []).length;
    done += ((S.td && S.td[id]) || []).length;
  }
  return all ? done / all : 0;
}

// --- Otevřený úkol ---
function amongOpenTask(i) {
  const t = amongTasks()[i];
  if (!t) return;
  const T = state.amongTask = { i, type: t.type, t: 0, doneT: 0 };
  if (AMONG_QUESTIONS[t.type] || t.type === 'math') Object.assign(T, { used: [], right: 0, cur: amongQuestion(t.type, []), wrongT: 0, wrongText: '' });
  if (t.type === 'wires') {
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5), right = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    Object.assign(T, { left: order, right, links: {}, pick: -1 });
  }
  if (t.type === 'download') Object.assign(T, { started: false, p: 0 });
  if (t.type === 'board') {
    const spots = [];
    for (let k = 0; k < 14; k++) spots.push({ x: amongRand(240, 560), y: amongRand(190, 420), r: amongRand(14, 26), on: true, kind: amongRand(0, 2) });
    Object.assign(T, { spots, sponge: { x: 400, y: 300 }, pointer: null });
  }
  if (t.type === 'trash') Object.assign(T, { p: 0, hold: false });
  playSound([[600, 0, 0.05]]);
}
function amongCloseTask() { state.amongTask = null; }
function amongFinishTask() {
  const T = state.amongTask;
  if (!T || T.doneT) return;
  T.doneT = 0.9;   // chvíli ukázat „Hotovo!“
  among.myDone.push(T.i);
  amongSend({ k: 'task', i: T.i });
  playSound([[523, 0, 0.08], [659, 0.09, 0.08], [784, 0.18, 0.08], [1047, 0.27, 0.16]]);
}
const AMONG_TASK_PANEL = { x: 140, y: 80, w: 520, h: 470 };
const AMONG_TASK_CLOSE = { x: 606, y: 86, w: 46, h: 40 };
const amongOptRect = (k) => ({ x: 190, y: 300 + k * 56, w: 420, h: 48 });
const amongWireL = (k) => ({ x: 200, y: 180 + k * 80, w: 70, h: 44 });
const amongWireR = (k) => ({ x: 530, y: 180 + k * 80, w: 70, h: 44 });
const AMONG_WIRE_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#d81b60'];
const AMONG_BTN = { x: 290, y: 430, w: 220, h: 54 };

// Ukazatel (myš / prst) pro tabuli a páku – plátno se přepočítá na souřadnice hry
function amongTaskPointer(e, down) {
  const T = state.amongTask;
  if (!T || state.screen !== 'playing') return;
  const pt = screenToGame(e.clientX, e.clientY);
  if (!pt) return;
  if (down === true) T.pointer = { x: pt.x, y: pt.y, down: true };
  else if (down === false) { if (T.pointer) T.pointer.down = false; }
  else T.pointer = { x: pt.x, y: pt.y, down: T.pointer ? T.pointer.down : e.pointerType === 'mouse' && e.buttons > 0 };
  if (T.type === 'board' && e.pointerType === 'mouse') T.pointer.down = true;   // myší stačí přejíždět
}
window.addEventListener('pointerdown', (e) => amongTaskPointer(e, true));
window.addEventListener('pointermove', (e) => amongTaskPointer(e));
window.addEventListener('pointerup', (e) => amongTaskPointer(e, false));
window.addEventListener('pointercancel', (e) => amongTaskPointer(e, false));
const amongTaskKeys = [];
window.addEventListener('keydown', (e) => {
  if (!state.amongTask || e.repeat) return;
  amongTaskKeys.push(e.code);
  e.stopImmediatePropagation();
}, true);

// Krok otevřeného úkolu (hra běží dál – záškodník může zabít i u úkolu)
function amongTaskUpdate(dt, events) {
  const T = state.amongTask, keys = amongTaskKeys.splice(0);
  T.t += dt;
  if (T.doneT) { T.doneT -= dt; if (T.doneT <= 0) amongCloseTask(); return; }
  if (keys.includes('Escape') || events.some((ev) => ev.x != null && (pointInRect(ev.x, ev.y, AMONG_TASK_CLOSE, 4) || !pointInRect(ev.x, ev.y, AMONG_TASK_PANEL, 0)))) { amongCloseTask(); return; }
  const digit = (code) => { const m = /^(?:Digit|Numpad)([1-4])$/.exec(code); return m ? Number(m[1]) - 1 : -1; };
  if (T.cur) {   // test / matika
    if (T.wrongT > 0) { T.wrongT -= dt; if (T.wrongT <= 0) T.cur = amongQuestion(T.type, T.used); return; }
    let pick = -1;
    for (const k of keys) if (digit(k) >= 0) pick = digit(k);
    for (const ev of events) if (ev.x != null) { const k = [0, 1, 2, 3].find((n) => pointInRect(ev.x, ev.y, amongOptRect(n), 0)); if (k !== undefined) pick = k; }
    if (pick < 0) return;
    const o = T.cur.opts[pick];
    if (o.ok) {
      T.right++;
      playSound([[880, 0, 0.05]]);
      if (T.right >= 3) amongFinishTask(); else T.cur = amongQuestion(T.type, T.used);
    } else {   // špatně: ukázat správnou odpověď a dát jinou otázku
      T.wrongT = 1.4;
      T.wrongText = `Špatně! Správně: ${T.cur.opts.find((x) => x.ok).t}`;
      T.wrongPick = pick;
      playSound([[220, 0, 0.15]]);
    }
    return;
  }
  if (T.type === 'wires') {
    const tapL = (k) => { T.pick = k; playSound([[700, 0, 0.03]]); };
    const tapR = (k) => {
      if (T.pick < 0) return;
      if (T.left[T.pick] === T.right[k]) { T.links[T.left[T.pick]] = k; playSound([[880, 0, 0.05]]); }
      else playSound([[200, 0, 0.1]]);
      T.pick = -1;
      if (Object.keys(T.links).length === 4) amongFinishTask();
    };
    for (const k of keys) { const d = digit(k); if (d >= 0) (T.pick < 0 ? tapL : tapR)(d); }
    for (const ev of events) {
      if (ev.x == null) continue;
      for (let k = 0; k < 4; k++) {
        if (pointInRect(ev.x, ev.y, amongWireL(k), 6) && T.links[T.left[k]] === undefined) tapL(k);
        if (pointInRect(ev.x, ev.y, amongWireR(k), 6)) tapR(k);
      }
    }
    return;
  }
  if (T.type === 'download') {
    if (!T.started && (events.some((ev) => ev.type === 'action' || (ev.x != null && pointInRect(ev.x, ev.y, AMONG_BTN, 4))))) { T.started = true; playSound([[600, 0, 0.05]]); }
    if (T.started) { T.p = Math.min(1, T.p + dt / 7); if (T.p >= 1) amongFinishTask(); }
    return;
  }
  if (T.type === 'board') {   // houba za myší / prstem, nebo šipkami
    const kx = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0), ky = (isDown('down') ? 1 : 0) - (isDown('up') ? 1 : 0);
    if (kx || ky) { T.sponge.x += kx * 420 * dt; T.sponge.y += ky * 420 * dt; }
    else if (T.pointer && T.pointer.down) { T.sponge.x = T.pointer.x; T.sponge.y = T.pointer.y; }
    T.sponge.x = Math.max(220, Math.min(580, T.sponge.x)); T.sponge.y = Math.max(170, Math.min(440, T.sponge.y));
    const erasing = !!(kx || ky || (T.pointer && T.pointer.down));
    for (const s of T.spots) if (erasing && s.on && Math.hypot(s.x - T.sponge.x, s.y - T.sponge.y) < s.r + 26) { s.on = false; playSound([[300 + Math.random() * 200, 0, 0.02]]); }
    if (T.spots.every((s) => !s.on)) amongFinishTask();
    return;
  }
  if (T.type === 'trash') {   // držet páku (mezerník / prst na páce)
    const lever = { x: 470, y: 200, w: 120, h: 230 };
    const hold = input.keys.has('Space') || input.keys.has('Enter') || (T.pointer && T.pointer.down && pointInRect(T.pointer.x, T.pointer.y, lever, 30));
    T.hold = !!hold;
    T.p = hold ? Math.min(1, T.p + dt / 2.5) : Math.max(0, T.p - dt / 4);
    if (T.p >= 1) amongFinishTask();
  }
}

// --- Kreslení: místa s úkoly ve světě, seznam úkolů, otevřený úkol ---
function drawAmongStations() {
  const room = state.room, mine = amongMyTasks(), imp = among.role === 'zaskodnik';
  amongTasks().forEach((t, i) => {
    if (t.room !== room.id) return;
    const x = room.x + t.x, y = room.y + t.y, my = mine.includes(i) && !amongTaskDone(i);
    // stolek s počítačem / věcí podle úkolu
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath(); ctx.ellipse(x + 3, y + 16, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    roundRectPath(x - 20, y - 14, 40, 28, 6);
    ctx.fillStyle = my ? '#ffe082' : '#9aa6bd'; ctx.fill();
    ctx.strokeStyle = my ? '#ffb300' : '#5d6b80'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000000';
    ctx.fillText(AMONG_TASK_TYPES[t.type].icon, x, y + 1);
    if (my) {   // můj úkol: žlutý vykřičník nad místem (u záškodníka jen na oko)
      const bob = Math.sin(state.time * 4) * 3;
      drawOutlinedText('!', x, y - 30 + bob, 'bold 24px sans-serif', imp ? '#ffcc80' : '#ffd54a', 'middle');
    }
  });
}
function drawAmongTaskList() {
  if (among.phase !== 'play' && among.phase !== 'meet') return;
  const mine = amongMyTasks(), imp = among.role === 'zaskodnik', W = 250, rowH = 18;
  const h = 46 + mine.length * rowH;
  roundRectPath(8, 78, W, h, 8);
  ctx.fillStyle = 'rgba(15, 20, 35, 0.75)'; ctx.fill();
  // pruh úkolů všech nevinných
  const bar = amongTaskBar();
  ctx.fillStyle = '#2a3a2a'; ctx.fillRect(16, 86, W - 16, 12);
  ctx.fillStyle = '#43a047'; ctx.fillRect(16, 86, (W - 16) * bar, 12);
  ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  ctx.fillText(`Úkoly všech: ${Math.round(bar * 100)} %`, 8 + W / 2, 92);
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillStyle = imp ? '#ffcc80' : '#ffffff';
  ctx.fillText(imp ? 'Úkoly jen na oko (předstírej):' : 'Tvoje úkoly:', 16, 112);
  mine.forEach((i, k) => {
    const t = amongTasks()[i], done = amongTaskDone(i);
    ctx.fillStyle = done ? '#7ee08a' : '#e0e6f2';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${done ? '✔' : '•'} ${AMONG_TASK_TYPES[t.type].name} – ${amongTaskPlace(t)}`, 16, 130 + k * rowH, W - 18);
  });
}
function drawAmongTask() {
  const T = state.amongTask;
  if (!T) return;
  const P = AMONG_TASK_PANEL, info = AMONG_TASK_TYPES[T.type];
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(-VIEW.offX, 0, CONFIG.WIDTH + 2 * VIEW.offX, CONFIG.HEIGHT);
  roundRectPath(P.x, P.y, P.w, P.h, 16);
  ctx.fillStyle = '#e9edf3'; ctx.fill();
  ctx.strokeStyle = '#37474f'; ctx.lineWidth = 4; ctx.stroke();
  ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#263238';
  ctx.fillText(`${info.icon} ${info.name}`, P.x + 20, P.y + 26, P.w - 90);
  drawChessButton(AMONG_TASK_CLOSE, '✕', false, '#7a2a20');
  if (T.doneT) {
    drawOutlinedText('HOTOVO! ✔', 400, 320, 'bold 46px sans-serif', '#43a047', 'middle');
    return;
  }
  const keys = !isTouchHint();
  if (T.cur) {
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#546e7a';
    ctx.fillText(`Správně ${T.right} ze 3${keys ? ' · klávesy 1–4' : ''}`, 400, 150);
    ctx.font = `bold ${T.type === 'math' ? 30 : 20}px sans-serif`; ctx.fillStyle = '#263238';
    ctx.fillText(T.cur.q, 400, 220, P.w - 40);
    T.cur.opts.forEach((o, k) => {
      const r = amongOptRect(k), wrong = T.wrongT > 0;
      const col = wrong && o.ok ? '#2e7d32' : wrong && k === T.wrongPick ? '#c62828' : '#37474f';
      drawChessButton(r, `${keys ? `${k + 1})  ` : ''}${o.t}`, false, col);
    });
    if (T.wrongT > 0) drawOutlinedText(T.wrongText, 400, 278, 'bold 15px sans-serif', '#c62828', 'middle');
    return;
  }
  if (T.type === 'wires') {
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#546e7a';
    ctx.fillText(keys ? 'Spoj stejné barvy: vlevo, pak vpravo (myší nebo 1–4 a 1–4)' : 'Ťukni na kabel vlevo a pak na stejnou barvu vpravo', 400, 140);
    for (let k = 0; k < 4; k++) {
      const L = amongWireL(k), R = amongWireR(k);
      drawRect(L, AMONG_WIRE_COLORS[T.left[k]]); drawRect(R, AMONG_WIRE_COLORS[T.right[k]]);
      if (T.pick === k) { ctx.strokeStyle = '#000000'; ctx.lineWidth = 3; ctx.strokeRect(L.x - 3, L.y - 3, L.w + 6, L.h + 6); }
    }
    for (const [c, rk] of Object.entries(T.links)) {   // hotové spoje
      const lk = T.left.indexOf(Number(c)), L = amongWireL(lk), R = amongWireR(rk);
      ctx.strokeStyle = AMONG_WIRE_COLORS[c]; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(L.x + L.w, L.y + L.h / 2); ctx.lineTo(R.x, R.y + R.h / 2); ctx.stroke();
      ctx.lineCap = 'butt';
    }
    return;
  }
  if (T.type === 'download') {
    ctx.font = '60px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('📁', 260, 230); ctx.fillText('💻', 540, 230);
    const n = 6;   // letící papíry
    if (T.started && T.p < 1) for (let k = 0; k < n; k++) { const f = ((T.t * 0.8 + k / n) % 1); ctx.font = '22px sans-serif'; ctx.fillText('📄', 300 + f * 200, 220 - Math.sin(f * Math.PI) * 40); }
    ctx.fillStyle = '#cfd8dc'; ctx.fillRect(200, 320, 400, 26);
    ctx.fillStyle = '#43a047'; ctx.fillRect(200, 320, 400 * T.p, 26);
    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#263238';
    ctx.fillText(T.started ? `Stahuji známky… ${Math.round(T.p * 100)} %` : 'Známky čekají na stažení', 400, 368);
    if (!T.started) drawChessButton(AMONG_BTN, '⬇ Stáhnout', false, '#1e88e5');
    else drawOutlinedText('Nezavírej, dokud se nestáhne!', 400, 456, 'bold 15px sans-serif', '#ffffff', 'middle');
    return;
  }
  if (T.type === 'board') {
    drawRect({ x: 210, y: 160, w: 380, h: 290 }, '#6d4c2f');
    drawRect({ x: 220, y: 170, w: 360, h: 270 }, '#1e4d36');
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctx.lineWidth = 3;
    for (const s of T.spots) {
      if (!s.on) continue;
      ctx.beginPath();
      if (s.kind === 0) ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      else if (s.kind === 1) { ctx.moveTo(s.x - s.r, s.y - s.r / 2); ctx.lineTo(s.x + s.r, s.y + s.r / 2); ctx.moveTo(s.x - s.r, s.y + s.r / 2); ctx.lineTo(s.x + s.r, s.y - s.r / 2); }
      else { ctx.font = `bold ${s.r + 6}px sans-serif`; ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.fillText(['x²', 'π', '√2', 'H₂O'][s.r % 4], s.x, s.y); }
      ctx.stroke();
    }
    ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🧽', T.sponge.x, T.sponge.y);
    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#263238';
    ctx.fillText(keys ? 'Přejeď houbou po křídě (myš nebo šipky)' : 'Přejeď prstem po křídě', 400, 480);
    return;
  }
  if (T.type === 'trash') {
    ctx.font = '90px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🗑️', 300, 300 - T.p * 120);
    drawRect({ x: 520, y: 200, w: 16, h: 230 }, '#78909c');
    const ly = 220 + T.p * 180;
    ctx.fillStyle = T.hold ? '#e53935' : '#b71c1c';
    ctx.beginPath(); ctx.arc(528, ly, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cfd8dc'; ctx.fillRect(200, 470, 400, 16);
    ctx.fillStyle = '#43a047'; ctx.fillRect(200, 470, 400 * T.p, 16);
    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#263238';
    ctx.fillText(keys ? 'Drž mezerník (nebo páku myší), dokud koš nevyjede' : 'Drž prst na páce, dokud koš nevyjede', 400, 160);
  }
}
