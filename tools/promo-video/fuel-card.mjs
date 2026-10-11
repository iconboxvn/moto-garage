// 앱 홈의 '유가' 섹션(제목+카드)을 고해상도로 캡처해 out/ep02/fuelcard.png 로 저장 (실제 Firestore 데이터 fs_fuel.json 사용)
import puppeteer from 'puppeteer-core';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)); process.chdir(HERE);
const lang = process.argv[2] || 'vn';
const file = { vn:'index_vn.html', en:'index_en.html', ko:'index.html' }[lang];
const FUEL = JSON.parse(fs.readFileSync('fs_fuel.json', 'utf8'));
const WWW = path.resolve(HERE, '../../www'); const PORT = 8794, ORIGIN = `http://localhost:${PORT}`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf' };
const server = http.createServer((req, res) => { const f = path.join(WWW, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(WWW) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(PORT);
fs.mkdirSync('out/ep02', { recursive:true });
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new' });
const p = await b.newPage(); await p.setViewport({ width:320, height:700, deviceScaleFactor:5, isMobile:true, hasTouch:true });
await p.evaluateOnNewDocument((lang, fuel) => {
  localStorage.setItem('mg2', JSON.stringify({ bikes:[{ id:1, brand:'Yamaha', model:'Janus', year:2017, cc:125, odometer:14202, plate:'', color:'', consumables:[] }], rides:[], history:[] }));
  localStorage.setItem('mg2-last-bike-id', '1'); localStorage.setItem('mg2-lang', lang); localStorage.setItem('mg2-launched','1');
  ['mg2-tos-consent','mg2-sos-consent','mg2-ai-consent','mg2-review-asked'].forEach(k => localStorage.setItem(k,'1'));
  localStorage.setItem('mg2-last-backup-ts', String(Date.now()));
  window.Capacitor = { Plugins: { FirebaseFirestore: { getCollection: async ({ reference, queryConstraints }) => {
    let items = reference === 'fuel_prices' ? fuel.map(x => ({ id: x.id, data: x.data })) : [];
    const lim = (queryConstraints || []).find(q => q.type === 'limit'); if (lim) items = items.slice(0, lim.limit); return { snapshots: items }; } } } };
}, lang, FUEL);
await p.goto(`${ORIGIN}/${file}`, { waitUntil:'networkidle2' }); await new Promise(r => setTimeout(r, 3000));
await p.addStyleTag({ content:'*{transition:none!important;animation:none!important} #welcome-overlay{display:none!important} .sos-fab{display:none!important}' });
const box = await p.evaluate(() => { const c = document.getElementById('fuel-price-card'); // 카드 안에 '유가' 제목이 포함돼 있음
  window.scrollTo(0, window.scrollY + c.getBoundingClientRect().top - 150);
  const r = c.getBoundingClientRect(); return { x: 0, y: r.top, w: 390, h: r.height, text: c.innerText }; });
console.log(box.text.replace(/\n+/g, ' | '));
await new Promise(r => setTimeout(r, 400));
await (await p.$('#fuel-price-card')).screenshot({ path:'out/ep02/fuelcard.png' });
await b.close(); server.close();
