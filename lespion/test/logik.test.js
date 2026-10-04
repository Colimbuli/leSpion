// Prüft die Logik von lespion.app.html (Abgleich, Prompts, Ablauf) und die
// Ladeschale lespion.html gegen einen minimalen DOM-Stub.
// Aufruf: node test/logik.test.js
// Beide Skripte werden direkt aus den HTML-Dateien gezogen, damit der Test nie
// gegen eine veraltete Kopie läuft.
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'lespion.app.html'), 'utf8');
const laderHtml = fs.readFileSync(path.join(__dirname, '..', 'lespion.html'), 'utf8');
const block = html.match(/<script>([\s\S]*)<\/script>/);
if (!block) { console.error('Kein <script>-Block in lespion.app.html gefunden.'); process.exit(1); }
const laderBlock = laderHtml.match(/<script>([\s\S]*)<\/script>/);
if (!laderBlock) { console.error('Kein <script>-Block in lespion.html gefunden.'); process.exit(1); }

let ok = 0, bad = 0;
function pruefe(name, bedingung, extra) {
  if (bedingung) { ok++; console.log('  ok   ' + name); }
  else { bad++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

// ── Ladeschale: Perchance-Syntax ──────────────────────────────────────────
console.log('\n— Ladeschale —');
// Den HTML-Bereich wertet Perchance als Vorlage aus: eingeklammerte Wörter
// gelten als Listenverweis und brechen den Generator ab.
const laderMarkup = laderHtml.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
const listenVerweise = laderMarkup.match(/\[[A-Za-zÄÖÜäöüß_][^\]]*\]/g) || [];
pruefe('keine eckigen Klammern im Start-Markup', listenVerweise.length === 0, listenVerweise.join(' '));
const inlineWahl = laderMarkup.match(/\{[^}]*\}/g) || [];
pruefe('keine geschweiften Klammern im Start-Markup', inlineWahl.length === 0, inlineWahl.join(' '));
const nackteWorte = (laderHtml.match(/\[[^\]\n]*\]/g) || []).filter(k =>
  /^\[\s*[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_]*(\s+[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_]*)+\s*\]$/.test(k));
pruefe('keine nackten Wortfolgen in eckigen Klammern', nackteWorte.length === 0, nackteWorte.join(' '));
pruefe('Ladeschale zeigt auf lespion.app.html', laderHtml.includes("pfad: 'lespion/lespion.app.html'"));
pruefe('Ladeschale zeigt auf das Repository leSpion', laderHtml.includes("repo: 'leSpion'"));
pruefe('Ladeschale hat keine PROXIMA-Reste', !/prx-|PROXIMA_LADER|proxima\.quelltext/.test(laderHtml));
pruefe('Ladeschale brückt ai() und image()', laderHtml.includes("var PLUGINS = ['ai', 'image'];"));
const externeSchrift = /@import\s+url\(\s*['"]?https?:|<link[^>]+fonts\./i;
pruefe('Spiel lädt keine externe Schrift', !externeSchrift.test(html));
pruefe('keine fremden Bildquellen mehr im Spiel', !/pollinations|aihorde|huggingface|comfy/i.test(html));

// ── Spiel laden ───────────────────────────────────────────────────────────
function fakeEl(id) {
  return {
    id, value: '', textContent: '', innerHTML: '', className: '', style: {}, disabled: false, src: '', scrollTop: 0, scrollHeight: 0,
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    appendChild() {}, remove() {}, querySelector() { return fakeEl('sub'); },
    setAttribute() {}, addEventListener() {}, focus() {}, select() {}, click() {}
  };
}
const elemente = {};
const store = {};
const ctx = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  document: {
    body: fakeEl('body'),
    getElementById: id => (elemente[id] = elemente[id] || fakeEl(id)),
    createElement: fakeEl
  },
  window: {},
  Date, Math, JSON, Object, Array, String, Number, RegExp, Promise, isNaN, parseInt, parseFloat
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(block[1], ctx);
ctx.document.getElementById('nameFeld').value = 'Alex';

pruefe('Version im Skript gesetzt', /^V\d+\.\d+/.test(ctx.VERSION), ctx.VERSION);
pruefe('Version im Startbildschirm', html.includes('LE SPION ' + ctx.VERSION));

console.log('\n— Begriffe —');
const kats = Object.keys(ctx.BEGRIFFE);
pruefe('mindestens zwölf Kategorien', kats.length >= 12, String(kats.length));
pruefe('jede Kategorie hat mindestens zwölf Begriffe', kats.every(k => ctx.BEGRIFFE[k].length >= 12),
  kats.filter(k => ctx.BEGRIFFE[k].length < 12).join(', '));
const alle = [].concat(...kats.map(k => ctx.BEGRIFFE[k]));
const doppelt = alle.filter((b, i) => alle.findIndex(x => ctx.norm(x) === ctx.norm(b)) !== i);
pruefe('kein Begriff doppelt', doppelt.length === 0, doppelt.join(', '));
pruefe('alle Begriffe sind einzelne Wörter', alle.every(b => !/\s/.test(b)), alle.filter(b => /\s/.test(b)).join(', '));

console.log('\n— Tipp-Abgleich —');
pruefe('exakt', ctx.tippRichtig('Pinguin', 'Pinguin'));
pruefe('Groß/klein und Artikel', ctx.tippRichtig('der pinguin', 'Pinguin'));
pruefe('Plural', ctx.tippRichtig('Pinguine', 'Pinguin'));
pruefe('Umlaut ausgeschrieben', ctx.tippRichtig('Kuehlschrank', 'Kühlschrank'));
pruefe('ein Tippfehler bei langen Wörtern', ctx.tippRichtig('Kühlschrnk', 'Kühlschrank'));
pruefe('kurzes Wort mit Tippfehler zählt nicht', !ctx.tippRichtig('Has', 'Hai'));
pruefe('anderes Wort zählt nicht', !ctx.tippRichtig('Robbe', 'Pinguin'));
pruefe('leerer Tipp zählt nicht', !ctx.tippRichtig('', 'Pinguin'));

console.log('\n— Verrat des Begriffs —');
pruefe('Begriff selbst', ctx.verraetBegriff('Ein Pinguin halt', 'Pinguin'));
pruefe('als Wortteil', ctx.verraetBegriff('Pinguinkolonie am Pol', 'Pinguin'));
pruefe('Plural', ctx.verraetBegriff('Hunde bellen', 'Hund'));
pruefe('Umlaut-Schreibweise', ctx.verraetBegriff('kuehlschrank kalt', 'Kühlschrank'));
pruefe('Stamm', ctx.verraetBegriff('Feuerwehrleute kommen', 'Feuerwehrmann'));
pruefe('harmloser Hinweis bleibt erlaubt', !ctx.verraetBegriff('watschelt im Frack', 'Pinguin'));
pruefe('ähnlicher Anfang bleibt erlaubt', !ctx.verraetBegriff('zählt Schafe', 'Schach') && !ctx.verraetBegriff('Sonnenschein pur', 'Sonnenuntergang'));
pruefe('kurze Wörter lösen nichts aus', !ctx.verraetBegriff('Hai und Hi', 'Haifisch'));

console.log('\n— JSON aus KI-Antworten —');
pruefe('mit Text drumherum', ctx.jsonAus('Klar! ```json\n{"hinweis":"kalt"}\n``` fertig').hinweis === 'kalt');
pruefe('mit Komma am Ende', ctx.jsonAus('{"a":"b",}').a === 'b');
pruefe('Unbrauchbares gibt null', ctx.jsonAus('kein json') === null);

console.log('\n— Auszählen —');
let a = ctx.auszaehlen({ 0: 2, 1: 2, 2: 1, 3: 2 });
pruefe('klare Mehrheit', a.beschuldigt === 2 && a.zaehlung[2] === 3, JSON.stringify(a));
a = ctx.auszaehlen({ 0: 1, 1: 0, 2: 3, 3: 2 });
pruefe('Gleichstand beschuldigt niemanden', a.beschuldigt === null, JSON.stringify(a));
a = ctx.auszaehlen({ 0: 1, 1: 2, 2: 1, 3: 2 });
pruefe('2:2 ist Gleichstand', a.beschuldigt === null, JSON.stringify(a));

console.log('\n— Partie aufbauen —');
pruefe('Uhrzeigersinn ab oben links', ctx.reihenfolgeAb(0).join() === '0,1,3,2');
pruefe('Uhrzeigersinn ab unten links', ctx.reihenfolgeAb(2).join() === '2,0,1,3');
let p = ctx.neuePartie({ name: 'Alex', spion: 2, kategorie: 'Tiere', begriff: 'Pinguin', start: 1, runden: 3 });
pruefe('vier Spieler, einer davon Mensch', p.spieler.length === 4 && p.spieler.filter(s => s.mensch).length === 1);
pruefe('genau ein Spion', p.spieler.filter(s => s.spion).length === 1 && p.spieler[2].spion);
pruefe('Namen eindeutig', new Set(p.spieler.map(s => s.name)).size === 4, p.spieler.map(s => s.name).join());
pruefe('jeder hat einen eigenen Seed', new Set(p.spieler.map(s => s.seed)).size === 4);
let spionZaehler = [0, 0, 0, 0];
for (let i = 0; i < 400; i++) spionZaehler[ctx.neuePartie({}).spion]++;
pruefe('Spion-Rolle trifft jeden Platz, auch den Menschen', spionZaehler.every(n => n > 50), spionZaehler.join());

console.log('\n— Porträts —');
ctx.G = p;
ctx.CFG.stil = 'aquarell';
p.spieler[1].mimik = 'misstrauisch'; p.spieler[1].kopf = ctx.KOPF[3];
let pp = ctx.portraetPrompt(p.spieler[1]);
pruefe('Prompt enthält Aussehen', pp.startsWith(p.spieler[1].aussehen.replace(/[.\s]+$/, '')), pp);
pruefe('Prompt enthält Miene', pp.includes(ctx.MIMIK.misstrauisch.prompt));
pruefe('Prompt enthält Kopfhaltung', pp.includes(ctx.KOPF[3]));
pruefe('Prompt endet mit dem Stil', pp.endsWith(ctx.STILE.aquarell));
ctx.CFG.stil = 'eigen'; ctx.CFG.stilEigen = 'charcoal sketch';
pruefe('eigener Stil wird übernommen', ctx.portraetPrompt(p.spieler[1]).endsWith('charcoal sketch'));
ctx.CFG.stil = 'realistisch';
pruefe('Stil-Negativ hängt am Negativprompt', ctx.baueNegativ().includes('plastic skin'));
ctx.CFG.stil = 'noir';
pruefe('jede Miene der Agenten ist definiert', ctx.MIMIK_SPIEL.every(k => ctx.MIMIK[k]));
pruefe('Miene aus freiem Text', ctx.mimikAus('Misstrauisch') === 'misstrauisch' && ctx.mimikAus('nervös') === 'nervoes'
  && ctx.mimikAus('quatsch') === 'nachdenklich');

console.log('\n— Agenten wissen nur ihre eigene Rolle —');
p.runde = 1;
p.spieler[1].notizen = ['GEHEIM-EINS'];
p.spieler[2].notizen = ['GEHEIM-ZWEI'];
p.spieler[3].notizen = ['GEHEIM-DREI'];
const promptsVon = i => [ctx.baueHinweisPrompt(i), ctx.baueStimmPrompt(i), ctx.baueTippPrompt(i, true)];
promptsVon(2).forEach((t, k) => pruefe('Spion-Prompt ' + k + ' enthält den Begriff nicht', !ctx.norm(t).includes('pinguin')));
pruefe('Spion-Prompt sagt ihm seine Rolle', ctx.baueHinweisPrompt(2).includes('DU BIST DER SPION'));
[1, 3].forEach(i => {
  const t = ctx.baueHinweisPrompt(i);
  pruefe('Agent ' + i + ' kennt den Begriff', t.includes('„Pinguin"'));
  pruefe('Agent ' + i + ' erfährt nicht, wer Spion ist',
    !t.includes(p.spieler[2].name + ' ist') && !t.includes('DU BIST DER SPION'));
});
for (let i = 1; i < 4; i++) {
  const fremde = ['GEHEIM-EINS', 'GEHEIM-ZWEI', 'GEHEIM-DREI'].filter((_, k) => k + 1 !== i);
  promptsVon(i).forEach((t, k) => pruefe('Agent ' + i + ' Prompt ' + k + ' ohne fremde Notizen',
    fremde.every(f => !t.includes(f)) && t.includes(p.spieler[i].notizen[0])));
}

// ── Ganze Partien mit gestellter KI ──────────────────────────────────────
// Der Mensch wird durch Stummel ersetzt, die KI durch eine Funktion, die am
// Prompt erkennt, was gefragt ist. Jeder Agent verrät beim ersten Versuch
// den Begriff - das muss der Filter abfangen.
async function simuliere(opt) {
  const prompts = [];
  let versuche = {};
  ctx.frageKI = async (prompt) => {
    prompts.push(prompt);
    const ich = ctx.G.spieler.find(s => prompt.includes('Du bist ' + s.name + '.'));
    if (prompt.includes('"stimme"')) {
      const ziel = opt.stimmeAuf != null ? ctx.G.spieler[opt.stimmeAuf] : ctx.G.spieler.find(s => s !== ich);
      return JSON.stringify({ stimme: ziel === ich ? ctx.G.spieler.find(s => s !== ich).name : ziel.name, begruendung: 'weil' });
    }
    if (prompt.includes('"tipp"')) return JSON.stringify({ tipp: opt.spionTipp });
    const k = ich.name + ctx.G.runde;
    versuche[k] = (versuche[k] || 0) + 1;
    if (!ich.spion && versuche[k] === 1) return JSON.stringify({ hinweis: 'Das ist ein ' + ctx.G.begriff, mimik: 'nervös' });
    return 'Hier mein Zug: ' + JSON.stringify({
      hinweis: 'Hinweis ' + ich.name + ' ' + ctx.G.runde, mimik: 'verschmitzt', verdacht: '', notiz: 'Notiz ' + ich.name,
      vermutung: opt.spionTipp, sicherheit: opt.spionSicher || 10
    });
  };
  let bilder = 0;
  ctx.image = async () => { bilder++; return { dataUrl: 'data:image/png;base64,AA' }; };
  ctx.menschZug = async () => ({ text: 'mein Hinweis ' + ctx.G.runde, mimik: 'neutral' });
  ctx.menschStimme = async () => opt.menschStimme;
  ctx.menschLetzterTipp = async () => opt.spionTipp;
  ctx.CFG.runden = 3; ctx.CFG.name = 'Alex'; ctx.CFG.aussehen = 'a person';
  ctx.zufall = (n) => 0;   // Spion auf Platz 0, Start bei 0, Kategorie/Begriff jeweils der erste Eintrag
  if (opt.spion != null) {
    const echt = ctx.neuePartie;
    ctx.neuePartie = (o) => echt(Object.assign({}, o, { spion: opt.spion, start: 0 }));
    ctx.partieStarten();
    ctx.neuePartie = echt;
  } else ctx.partieStarten();
  for (let i = 0; i < 400 && ctx.G.phase !== 'ende'; i++) await new Promise(r => setTimeout(r, 1));
  for (let i = 0; i < 50 && (ctx.BILD.laeuft || ctx.BILD.wartend.length); i++) await new Promise(r => setTimeout(r, 1));
  ctx.zufall = (n) => Math.floor(Math.random() * n);
  return { prompts, bilder };
}

async function partien() {
  console.log('\n— Partie: KI-Spion wird enttarnt und rät falsch —');
  let r = await simuliere({ spion: 2, stimmeAuf: 2, menschStimme: 2, spionTipp: 'Robbe' });
  let G = ctx.G;
  pruefe('Partie endet', G.phase === 'ende', G.phase);
  pruefe('drei Runden à vier Hinweise', G.verlauf.filter(v => v.typ === 'hinweis').length === 12,
    String(G.verlauf.filter(v => v.typ === 'hinweis').length));
  pruefe('kein KI-Hinweis verrät den Begriff', G.verlauf.every(v => !ctx.verraetBegriff(v.text, G.begriff)));
  pruefe('Spion beschuldigt', G.beschuldigt === 2);
  pruefe('Team gewinnt nach falschem letzten Tipp', G.ergebnis.sieger === 'team', JSON.stringify(G.ergebnis));
  pruefe('Reihenfolge im Uhrzeigersinn', G.verlauf.slice(0, 4).map(v => v.idx).join() === '0,1,3,2',
    G.verlauf.slice(0, 4).map(v => v.idx).join());
  pruefe('Porträts: 4 am Anfang, je Zug eines, 4 am Ende (Warteschlange fasst zusammen)',
    r.bilder >= 8 && r.bilder <= 4 + 12 + 4, String(r.bilder));
  const spionName = G.spieler[2].name;
  const spionPrompts = r.prompts.filter(t => t.includes('Du bist ' + spionName + '.'));
  pruefe('Spion bekam Prompts', spionPrompts.length > 0);
  pruefe('kein Prompt des Spions enthält den Begriff', spionPrompts.every(t => !t.includes('„' + G.begriff + '"')));
  pruefe('kein Prompt nennt fremde Rollen',
    r.prompts.every(t => !(t.includes('DU BIST DER SPION') && !t.includes('Du bist ' + spionName + '.'))));

  console.log('\n— Partie: KI-Spion enttarnt, rät aber richtig —');
  await simuliere({ spion: 3, stimmeAuf: 3, menschStimme: 3, spionTipp: ctx.BEGRIFFE[Object.keys(ctx.BEGRIFFE)[0]][0] });
  pruefe('Spion gewinnt mit letztem Tipp', ctx.G.ergebnis.sieger === 'spion' && ctx.G.spionTipp.letzteChance,
    JSON.stringify(ctx.G.ergebnis));

  console.log('\n— Partie: falsche Mehrheit —');
  await simuliere({ spion: 3, stimmeAuf: 1, menschStimme: 1, spionTipp: 'x' });
  pruefe('Spion gewinnt, wenn ein Unschuldiger beschuldigt wird', ctx.G.ergebnis.sieger === 'spion' && ctx.G.beschuldigt === 1,
    JSON.stringify(ctx.G.ergebnis));

  console.log('\n— Partie: KI-Spion rät früh und sicher —');
  const begriff = ctx.BEGRIFFE[Object.keys(ctx.BEGRIFFE)[0]][0];
  await simuliere({ spion: 1, stimmeAuf: 2, menschStimme: 2, spionTipp: begriff, spionSicher: 95 });
  pruefe('Spion beendet in Runde 2 mit richtigem Tipp', ctx.G.ergebnis.sieger === 'spion' && ctx.G.runde === 2
    && !ctx.G.spionTipp.letzteChance, JSON.stringify({ e: ctx.G.ergebnis, r: ctx.G.runde }));
  await simuliere({ spion: 1, stimmeAuf: 2, menschStimme: 2, spionTipp: 'Daneben', spionSicher: 95 });
  pruefe('falscher früher Tipp kostet den Sieg', ctx.G.ergebnis.sieger === 'team' && ctx.G.runde === 2,
    JSON.stringify(ctx.G.ergebnis));

  console.log('\n— Partie: Mensch ist Spion —');
  await simuliere({ spion: 0, stimmeAuf: 0, menschStimme: 1, spionTipp: 'Daneben' });
  pruefe('enttarnter Mensch mit falschem Tipp verliert', ctx.G.ergebnis.sieger === 'team' && ctx.G.beschuldigt === 0,
    JSON.stringify(ctx.G.ergebnis));

  console.log('\n— Abbruch —');
  ctx.menschZug = () => new Promise(() => {});   // Mensch antwortet nie
  ctx.zufall = () => 0;
  ctx.partieStarten();
  ctx.zufall = (n) => Math.floor(Math.random() * n);
  const alteId = ctx.G.id;
  await new Promise(r => setTimeout(r, 5));
  ctx.zumStart();
  pruefe('zurück zum Start beendet die Partie', ctx.G.phase === 'start' && ctx.G.id === alteId + 1);

  console.log('\n— Konfiguration —');
  pruefe('Einstellungen werden gespeichert', JSON.parse(store.lespion_cfg_v1).name === 'Alex');

  console.log('\n' + ok + ' ok, ' + bad + ' fehlgeschlagen');
  process.exit(bad ? 1 : 0);
}
partien().catch(e => { console.error(e); process.exit(1); });
