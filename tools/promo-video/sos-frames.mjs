// SOS 카운트다운 화면을 프레임 PNG로 뽑는다 (앱의 실제 _sosSimulate 로직을 setInterval 가로채서 한 틱씩 직접 돌림).
// 사용: node sos-frames.mjs [vn|en|ko]   → frames/{lang}/f0001.png ... (12fps 기준)
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
process.chdir(HERE);
const lang = process.argv[2] || 'vn';
const file = { vn:'index_vn.html', en:'index_en.html', ko:'index.html' }[lang];
const WWW = path.resolve(HERE, '../../www');
const PORT = 8792, ORIGIN = `http://localhost:${PORT}`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf' };
const server = http.createServer((req, res) => {
  const f = path.join(WWW, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(WWW) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT);

const outDir = `frames/${lang}`;
fs.rmSync(outDir, { recursive:true, force:true }); fs.mkdirSync(outDir, { recursive:true });
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new' });
const p = await b.newPage();
// 9:16(1080x1920)에 맞춘 뷰포트: 390 x 693 @ 2.769배
await p.setViewport({ width:390, height:693, deviceScaleFactor:1080/390, isMobile:true, hasTouch:true });
await p.evaluateOnNewDocument((lang) => {
  localStorage.setItem('mg2', JSON.stringify({ bikes:[{ id:1, brand:'Yamaha', model:'Janus', year:2017, cc:125, odometer:14202, plate:'', color:'', consumables:[] }], rides:[], history:[] }));
  localStorage.setItem('mg2-last-bike-id', '1');
  localStorage.setItem('mg2-lang', lang);
  localStorage.setItem('mg2-launched','1');
  ['mg2-tos-consent','mg2-sos-consent','mg2-ai-consent','mg2-review-asked'].forEach(k => localStorage.setItem(k,'1'));
  localStorage.setItem('mg2-last-backup-ts', String(Date.now()));
  localStorage.setItem('mg2-medical', JSON.stringify({ emergency: ({vn:'Bạn Minh', en:'Friend Minh', ko:'친구 민수'})[lang], emergencyPhone:'09** *** ***' }));
}, lang);
await p.goto(`${ORIGIN}/${file}`, { waitUntil:'networkidle2' });
await new Promise(r => setTimeout(r, 2500));

// 시뮬레이션 시작: setInterval을 가로채 틱을 우리가 직접 호출
await p.evaluate(() => {
  const orig = window.setInterval; window.__tick = null;
  window.setInterval = (f) => { window.__tick = f; return 999999; };
  _sosSimulate();
  window.setInterval = orig;
  document.querySelector('.auto-sos-sim').style.display = 'none';
  document.getElementById('auto-sos-dbg').style.visibility = 'hidden';
  // 링 애니메이션(transition)이 있으면 프레임이 흐려지니 끔
  const st = document.createElement('style'); st.textContent = '*{transition:none!important;animation:none!important} #welcome-overlay{display:none!important}'; document.head.appendChild(st);
});
let n = 0;
const snap = async () => { n++; await p.screenshot({ path: `${outDir}/f${String(n).padStart(4,'0')}.png` }); };
const FPS = 12;
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(500);
await snap();                                  // 60 — 도입부 1초 홀드 (같은 프레임 복제)
const first = `${outDir}/f0001.png`;
for (let i = 0; i < FPS - 1; i++) { n++; fs.copyFileSync(first, `${outDir}/f${String(n).padStart(4,'0')}.png`); }
for (let v = 59; v >= 1; v--) { await p.evaluate(() => window.__tick()); await snap(); }   // 59→1, 초당 12틱(12배속). 0은 '체험 결과' 화면이라 제외
const last = `${outDir}/f${String(n).padStart(4,'0')}.png`;
for (let i = 0; i < FPS - 1; i++) { n++; fs.copyFileSync(last, `${outDir}/f${String(n).padStart(4,'0')}.png`); }   // 마지막 1초 홀드
console.log(`frames: ${n} (${(n / FPS).toFixed(1)}s @ ${FPS}fps) → ${outDir}`);
await b.close(); server.close();
