// frames/{lang}/*.png → out/sos-{lang}-screen.mp4 (화면만) + out/sos-{lang}-card.mp4 (폰 카드 + 자막)
// 사전 준비: node sos-frames.mjs {lang}, ffmpeg 설치
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
process.chdir(HERE);
const lang = process.argv[2] || 'vn';
const CAPTION = {
  vn: 'Va chạm? SOS tự gửi|vị trí cho người bạn chọn',
  en: 'Crash? SOS texts|your location',
  ko: '낙차 감지 시|자동 SOS 문자 발송',
}[lang];
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
fs.mkdirSync('out', { recursive:true });

// 1) 화면만 (1080x1920, 30fps)
const screen = `out/sos-${lang}-screen.mp4`;
execFileSync(FFMPEG, ['-y','-loglevel','error','-framerate','12','-i',`frames/${lang}/f%04d.png`,'-vf','fps=30,scale=1080:1920:flags=lanczos,format=yuv420p','-c:v','libx264','-crf','16','-movflags','+faststart',screen]);

// 2) 카드 프레임(PNG): 자막 + 둥근 구멍 (구멍 밖은 배경색으로 덮음)
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new' });
const p = await b.newPage(); await p.setViewport({ width:1080, height:1920, deviceScaleFactor:1 });
const html = `<!doctype html><meta charset=utf-8><style>*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;background:transparent;overflow:hidden;font-family:-apple-system,'Helvetica Neue','Apple SD Gothic Neo',sans-serif;color:#fff}
.hole{position:absolute;left:140px;top:380px;width:800px;height:1422px;border-radius:44px;box-shadow:0 0 0 2400px #0c0c0d;outline:2px solid #2a2a2e}
.bar{position:absolute;left:140px;top:150px;width:72px;height:8px;background:#eca710;border-radius:4px}
h1{position:absolute;left:140px;right:100px;top:180px;font-size:68px;line-height:1.18;font-weight:800;letter-spacing:-.5px}
.tag{position:absolute;left:140px;bottom:56px;font-size:34px;font-weight:700;letter-spacing:6px;color:#eca710}</style>
<div class=hole></div><div class=bar></div><h1>${CAPTION.replace('|','<br>')}</h1><div class=tag>RIDEMATE</div>`;
fs.writeFileSync('out/_card.html', html);
await p.goto('file://' + path.resolve('out/_card.html'));
await p.screenshot({ path:'out/_card.png', omitBackground:true });
await b.close();

// 3) 합성: 배경 + 화면 영상(800px) + 카드 프레임
const card = `out/sos-${lang}-card.mp4`;
execFileSync(FFMPEG, ['-y','-loglevel','error','-f','lavfi','-i','color=c=0c0c0d:s=1080x1920:r=30','-i',screen,'-i','out/_card.png',
  '-filter_complex','[1:v]scale=800:1422[v];[0:v][v]overlay=140:380:shortest=1[a];[a][2:v]overlay=0:0,format=yuv420p','-c:v','libx264','-crf','16','-movflags','+faststart',card]);
console.log('done:', screen, card);
