// 시리즈 2편(주유/유가): 주유소 영상 4구간 + 유가 카드 + 도메인 끝 카드. 원본 소리는 쓰지 않음(무음, 음악은 TikTok에서).
// 사전: node fuel-card.mjs vn  (fs_fuel.json 최신화 후)  사용: node ep02.mjs "<PRO_VID...mp4>"  → out/ep02-vn.mp4
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'child_process';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const SRC = process.argv[2];
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
fs.mkdirSync('out/ep02', { recursive:true });
const _f = JSON.parse(fs.readFileSync('fs_fuel.json', 'utf8'))[0].data;
const _d = new Date((_f.effectiveAt.seconds + 7 * 3600) * 1000);
const EFF = `${_d.getUTCDate()}/${_d.getUTCMonth() + 1}`;   // 예: 8/10 (발효일, 베트남 시간)
const T = {
  a: 'Xăng lại tăng nữa rồi…',
  b1: 'Đến cây xăng mới biết giá',
  c: 'Sao không xem giá trước khi đi?',
  card: 'Giá xăng mới nhất<br>ngay trên màn hình chính', cardDate: `Kỳ điều hành ${EFF}`,
  domain: 'ridemate.iconbox.com', sub: 'Gõ vào trình duyệt · Link ở bio',
};
// 원본에서 쓸 구간(초). 대기 줄 구간(약 20~330초)은 번호판·사람이 많아 쓰지 않음.
const SEG = [
  { k:'a',  ss: 3.8,   t: 3.2, blur: [0, 480, 400, 940] },   // 진입: 앞 스쿠터(번호판) 가림 x,y,w,h (1080x1920 기준)
  { k:'b1', ss: 345.7, t: 1.0 },                                // 주유기 간판(E10 RON95) + 손
  { k:'b2', ss: 348.9, t: 2.1 },                                // 주유구/주유 (직원 얼굴 정면 컷 제외)
  { k:'c',  ss: 393.0, t: 2.5 },                                // 출발: 손/계기판/지갑
];
const CARD_T = 4.0, END_T = 3.0;
const css = `*{margin:0;box-sizing:border-box}html,body{width:1080px;height:1920px;overflow:hidden;font-family:-apple-system,'Helvetica Neue',sans-serif;color:#fff}
.t{position:absolute;left:70px;right:70px;top:200px;font-size:76px;line-height:1.2;font-weight:800;text-shadow:0 4px 18px rgba(0,0,0,.85),0 0 4px rgba(0,0,0,.9);-webkit-text-stroke:2px rgba(0,0,0,.55);paint-order:stroke fill}`;
const imgData = 'data:image/png;base64,' + fs.readFileSync('out/ep02/fuelcard.png').toString('base64');
const pages = {
  a: `<style>${css}</style><div class=t>${T.a}</div>`,
  b1: `<style>${css}</style><div class=t>${T.b1}</div>`,
  c: `<style>${css}</style><div class=t>${T.c}</div>`,
  card: `<style>${css}body{background:#0c0c0d}.t{top:330px;text-align:center;font-size:76px;-webkit-text-stroke:0;text-shadow:none}
   .p{position:absolute;left:36px;right:36px;top:680px;padding:36px;border-radius:44px;background:#0c0c0d;border:2px solid #2a2a2e;box-shadow:0 30px 80px rgba(0,0,0,.6)}
   .p img{width:100%;display:block}.dt{position:absolute;left:0;right:0;top:530px;text-align:center;font-size:52px;font-weight:800;color:#eca710}.l{position:absolute;left:0;right:0;bottom:120px;text-align:center;font-size:40px;font-weight:800;letter-spacing:12px;color:#eca710}</style>
   <div class=t>${T.card}</div><div class=dt>${T.cardDate}</div><div class=p><img src="${imgData}"></div><div class=l>RIDEMATE</div>`,
  end: `<style>${css}body{background:#0c0c0d}.l{position:absolute;left:0;right:0;top:640px;text-align:center;font-size:56px;font-weight:800;letter-spacing:14px;color:#eca710}
   .d{position:absolute;left:0;right:0;top:800px;text-align:center;font-size:84px;font-weight:800;letter-spacing:-1px}
   .s{position:absolute;left:0;right:0;top:950px;text-align:center;font-size:44px;color:#a0a0a8}</style><div class=l>RIDEMATE</div><div class=d>${T.domain}</div><div class=s>${T.sub}</div>`,
};
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new' });
const p = await b.newPage(); await p.setViewport({ width:1080, height:1920, deviceScaleFactor:1 });
for (const [k, h] of Object.entries(pages)) {
  fs.writeFileSync(`out/ep02/${k}.html`, `<!doctype html><meta charset=utf-8>${h}`);
  await p.goto('file://' + path.resolve(`out/ep02/${k}.html`)); await new Promise(r => setTimeout(r, 300));
  await p.screenshot({ path:`out/ep02/${k}.png`, omitBackground: !['card','end'].includes(k) });
}
await b.close();

const up = 'scale=1080:1920:flags=lanczos,setsar=1,fps=30,format=yuv420p';
const inputs = []; const fc = []; let idx = 0; const labels = [];
for (const s of SEG) {
  inputs.push('-ss', s.ss, '-t', s.t, '-i', SRC);                       // 영상 입력
  const vi = idx++; let chain = `[${vi}:v]${up}`;
  if (s.blur) { const [x, y, w, h] = s.blur;                              // 번호판 영역 블러(가장자리 부드럽게)
    fc.push(`${chain}[v${vi}raw]`);
    fc.push(`[v${vi}raw]split[bs${vi}a][bs${vi}b]`);
    fc.push(`[bs${vi}b]crop=${w}:${h}:${x}:${y},gblur=sigma=48[bl${vi}]`);
    fc.push(`color=c=black:s=${w}x${h}:r=30:d=${s.t + 1},drawbox=x=0:y=40:w=${w - 40}:h=${h - 80}:color=white:t=fill,gblur=sigma=26,format=gray[mk${vi}]`);
    fc.push(`[bl${vi}][mk${vi}]alphamerge[bla${vi}]`);
    fc.push(`[bs${vi}a][bla${vi}]overlay=${x}:${y}:shortest=1[v${vi}blurred]`);
    chain = `[v${vi}blurred]`; } else { fc.push(`${chain}[v${vi}blurred]`); chain = `[v${vi}blurred]`; }
  const cap = ['a', 'b1', 'c'].includes(s.k) ? s.k : null;
  if (cap) { inputs.push('-loop', '1', '-framerate', '30', '-t', s.t, '-i', `out/ep02/${cap}.png`); const ci = idx++;
    fc.push(`${chain}[${ci}:v]overlay=0:0:enable='between(t,0.15,${(s.t - 0.1).toFixed(2)})'[seg${vi}]`); }
  else fc.push(`${chain}null[seg${vi}]`);
  labels.push(`[seg${vi}]`);
}
// 구간 순서: a, b1, b2, c 다음에 카드, 끝카드
for (const [k, d] of [['card', CARD_T], ['end', END_T]]) {
  inputs.push('-loop', '1', '-framerate', '30', '-t', d, '-i', `out/ep02/${k}.png`); const i = idx++;
  fc.push(`[${i}:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[seg${i}]`); labels.push(`[seg${i}]`); }
fc.push(`${labels.join('')}concat=n=${labels.length}:v=1:a=0[v]`);
const total = SEG.reduce((s, x) => s + x.t, 0) + CARD_T + END_T;
inputs.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'); const ai = idx++;
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...inputs.map(String), '-filter_complex', fc.join(';'), '-map', '[v]', '-map', `${ai}:a`, '-t', total.toFixed(2),
  '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', 'out/ep02-vn.mp4']);
console.log('done: out/ep02-vn.mp4 (', total.toFixed(1), 's )');
