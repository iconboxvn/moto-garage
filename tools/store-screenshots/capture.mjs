import puppeteer from 'puppeteer-core';
import { buildData } from './data.mjs';
import fs from 'fs';
import { fileURLToPath as _f } from 'url';
import { dirname as _d } from 'path';
process.chdir(_d(_f(import.meta.url)));
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.resolve(HERE, '../../www');
const PORT = 8791, ORIGIN = `http://localhost:${PORT}`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf' };
const server = http.createServer((req, res) => {
  const f = path.join(WWW, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(WWW) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT);
const FSN = JSON.parse(fs.readFileSync('fs_news.json','utf8')), FSF = JSON.parse(fs.readFileSync('fs_fuel.json','utf8'));
const langs = (process.argv[2] || 'vn').split(',');
const files = { vn:'index_vn.html', en:'index_en.html', ko:'index.html' };
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new' });
const wait = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync('raw', { recursive:true });
for (const lang of langs) {
  await b.defaultBrowserContext().clearPermissionOverrides();
  const { D, janusId } = buildData(lang);
  const p = await b.newPage();
  await p.setViewport({ width:390, height:844, deviceScaleFactor:3, isMobile:true, hasTouch:true });
  await p.evaluateOnNewDocument((D, janusId, lang) => {
    localStorage.setItem('mg2', JSON.stringify(D));
    localStorage.setItem('mg2-lang', lang);
    localStorage.setItem('mg2-launched','1');
    localStorage.setItem('mg2-last-bike-id', String(janusId));
    ['mg2-tos-consent','mg2-sos-consent','mg2-ai-consent','mg2-review-asked'].forEach(k => localStorage.setItem(k,'1'));
    localStorage.setItem('mg2-last-backup-ts', String(Date.now()));
    localStorage.setItem('mg2-medical', JSON.stringify({ emergency: ({vn:'Bạn Minh', en:'Friend Minh', ko:'친구 민수'})[lang], emergencyPhone:'09** *** ***' }));
  }, D, janusId, lang);
  await p.evaluateOnNewDocument((news, fuel) => {
    const db = { brand_news: news, fuel_prices: fuel };
    window.Capacitor = { Plugins: { FirebaseFirestore: { getCollection: async ({ reference, queryConstraints }) => {
      let items = (db[reference] || []).map(x => ({ id: x.id, data: x.data }));
      const lim = (queryConstraints || []).find(q => q.type === 'limit');
      if (lim) items = items.slice(0, lim.limit);
      return { snapshots: items };
    } } } };
  }, FSN, FSF);
  await p.setGeolocation({ latitude:10.7769, longitude:106.7009 });
  p.on('pageerror', e => console.log(lang, 'pageerror', e.message));
  await p.goto(ORIGIN + '/' + files[lang], { waitUntil:'networkidle2' });
  await wait(3000);
  const shot = async (name, ms = 800) => { await wait(ms); await p.screenshot({ path:`raw/${lang}_${name}.png` }); };
  await shot('home');
  const hideFab = await p.addStyleTag({ content:'.sos-fab{display:none!important}' });
  await p.evaluate(() => showPage('consumables', document.querySelectorAll('.nav-btn')[1])); await shot('consumables');
  await p.evaluate(() => showPage('history', document.querySelectorAll('.nav-btn')[2])); await shot('history');
  await p.evaluate(() => showPage('brandNews')); await wait(4000); await shot('news');
  await p.evaluate(() => showPage('dashboard', document.querySelectorAll('.nav-btn')[0]));
  await b.defaultBrowserContext().overridePermissions(ORIGIN, ['geolocation']);
  await p.evaluate(() => document.querySelectorAll('style').forEach(s => { if (s.textContent.includes('sos-fab{display:none!important}')) s.remove(); }));
  await p.click('.sos-fab'); await wait(1500); await shot('sos');
  await p.evaluate(() => { closeModal('m-sos'); _sosSimulate(); document.querySelector('.auto-sos-sim').style.display='none'; document.getElementById('auto-sos-dbg').style.visibility='hidden'; }); await shot('sosauto', 150);
  await p.close();
}
await b.close();
server.close();
